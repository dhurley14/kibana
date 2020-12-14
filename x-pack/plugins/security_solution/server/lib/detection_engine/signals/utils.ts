/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import { createHash } from 'crypto';
import moment from 'moment';
import dateMath from '@elastic/datemath';
import { isEmpty, partition } from 'lodash/fp';

import { TimestampOverrideOrUndefined } from '../../../../common/detection_engine/schemas/common/schemas';
import { Logger, SavedObjectsClientContract } from '../../../../../../../src/core/server';
import { AlertServices, parseDuration } from '../../../../../alerts/server';
import { ExceptionListClient, ListClient, ListPluginSetup } from '../../../../../lists/server';
import { ExceptionListItemSchema } from '../../../../../lists/common/schemas';
import { ListArray } from '../../../../common/detection_engine/schemas/types/lists';
import {
  BulkResponse,
  BulkResponseErrorAggregation,
  GetFieldMappingType,
  isValidUnit,
  SignalHit,
  SearchAfterAndBulkCreateReturnType,
  SignalSearchResponse,
  Signal,
  WrappedSignalHit,
} from './types';
import { BuildRuleMessage } from './rule_messages';
import { parseScheduleDates } from '../../../../common/detection_engine/parse_schedule_dates';
import { hasLargeValueList } from '../../../../common/detection_engine/utils';
import { MAX_EXCEPTION_LIST_SIZE } from '../../../../../lists/common/constants';
import { ShardError } from '../../types';

interface SortExceptionsReturn {
  exceptionsWithValueLists: ExceptionListItemSchema[];
  exceptionsWithoutValueLists: ExceptionListItemSchema[];
}

export const MAX_RULE_GAP_RATIO = 4;

export const shorthandMap = {
  s: {
    momentString: 'seconds',
    asFn: (duration: moment.Duration) => duration.asSeconds(),
  },
  m: {
    momentString: 'minutes',
    asFn: (duration: moment.Duration) => duration.asMinutes(),
  },
  h: {
    momentString: 'hours',
    asFn: (duration: moment.Duration) => duration.asHours(),
  },
};

export const getGapMaxCatchupRatio = ({
  logger,
  previousStartedAt,
  unit,
  buildRuleMessage,
  ruleParamsFrom,
  interval,
}: {
  logger: Logger;
  ruleParamsFrom: string;
  previousStartedAt: Date | null | undefined;
  interval: string;
  buildRuleMessage: BuildRuleMessage;
  unit: string;
}): {
  maxCatchup: number | null;
  ratio: number | null;
  gapDiffInUnits: number | null;
} => {
  if (previousStartedAt == null) {
    return {
      maxCatchup: null,
      ratio: null,
      gapDiffInUnits: null,
    };
  }
  if (!isValidUnit(unit)) {
    logger.error(buildRuleMessage(`unit: ${unit} failed isValidUnit check`));
    return {
      maxCatchup: null,
      ratio: null,
      gapDiffInUnits: null,
    };
  }
  /*
      we need the total duration from now until the last time the rule ran.
      the next few lines can be summed up as calculating
      "how many second | minutes | hours have passed since the last time this ran?"
      */
  const nowToGapDiff = moment.duration(moment().diff(previousStartedAt));
  // rule ran early, no gap
  if (shorthandMap[unit].asFn(nowToGapDiff) < 0) {
    // rule ran early, no gap
    return {
      maxCatchup: null,
      ratio: null,
      gapDiffInUnits: null,
    };
  }
  const calculatedFrom = `now-${
    parseInt(shorthandMap[unit].asFn(nowToGapDiff).toString(), 10) + unit
  }`;
  logger.debug(buildRuleMessage(`calculatedFrom: ${calculatedFrom}`));

  const intervalMoment = moment.duration(parseInt(interval, 10), unit);
  logger.debug(buildRuleMessage(`intervalMoment: ${shorthandMap[unit].asFn(intervalMoment)}`));
  const calculatedFromAsMoment = dateMath.parse(calculatedFrom);
  const dateMathRuleParamsFrom = dateMath.parse(ruleParamsFrom);
  if (dateMathRuleParamsFrom != null && intervalMoment != null) {
    const momentUnit = shorthandMap[unit].momentString as moment.DurationInputArg2;
    const gapDiffInUnits = dateMathRuleParamsFrom.diff(calculatedFromAsMoment, momentUnit);

    const ratio = gapDiffInUnits / shorthandMap[unit].asFn(intervalMoment);

    // maxCatchup is to ensure we are not trying to catch up too far back.
    // This allows for a maximum of 4 consecutive rule execution misses
    // to be included in the number of signals generated.
    const maxCatchup = ratio < MAX_RULE_GAP_RATIO ? ratio : MAX_RULE_GAP_RATIO;
    return { maxCatchup, ratio, gapDiffInUnits };
  }
  logger.error(buildRuleMessage('failed to parse calculatedFrom and intervalMoment'));
  return {
    maxCatchup: null,
    ratio: null,
    gapDiffInUnits: null,
  };
};

export const getListsClient = ({
  lists,
  spaceId,
  updatedByUser,
  services,
  savedObjectClient,
}: {
  lists: ListPluginSetup | undefined;
  spaceId: string;
  updatedByUser: string | null;
  services: AlertServices;
  savedObjectClient: SavedObjectsClientContract;
}): {
  listClient: ListClient;
  exceptionsClient: ExceptionListClient;
} => {
  if (lists == null) {
    throw new Error('lists plugin unavailable during rule execution');
  }

  const listClient = lists.getListClient(services.callCluster, spaceId, updatedByUser ?? 'elastic');
  const exceptionsClient = lists.getExceptionListClient(
    savedObjectClient,
    updatedByUser ?? 'elastic'
  );

  return { listClient, exceptionsClient };
};

export const getExceptions = async ({
  client,
  lists,
}: {
  client: ExceptionListClient;
  lists: ListArray;
}): Promise<ExceptionListItemSchema[] | undefined> => {
  if (lists.length > 0) {
    try {
      const listIds = lists.map(({ list_id: listId }) => listId);
      const namespaceTypes = lists.map(({ namespace_type: namespaceType }) => namespaceType);
      const items = await client.findExceptionListsItem({
        listId: listIds,
        namespaceType: namespaceTypes,
        page: 1,
        perPage: MAX_EXCEPTION_LIST_SIZE,
        filter: [],
        sortOrder: undefined,
        sortField: undefined,
      });
      return items != null ? items.data : [];
    } catch {
      throw new Error('unable to fetch exception list items');
    }
  } else {
    return [];
  }
};

export const sortExceptionItems = (exceptions: ExceptionListItemSchema[]): SortExceptionsReturn => {
  return exceptions.reduce<SortExceptionsReturn>(
    (acc, exception) => {
      const { entries } = exception;
      const { exceptionsWithValueLists, exceptionsWithoutValueLists } = acc;

      if (hasLargeValueList(entries)) {
        return {
          exceptionsWithValueLists: [...exceptionsWithValueLists, { ...exception }],
          exceptionsWithoutValueLists,
        };
      } else {
        return {
          exceptionsWithValueLists,
          exceptionsWithoutValueLists: [...exceptionsWithoutValueLists, { ...exception }],
        };
      }
    },
    { exceptionsWithValueLists: [], exceptionsWithoutValueLists: [] }
  );
};

export const generateId = (
  docIndex: string,
  docId: string,
  version: string,
  ruleId: string
): string => createHash('sha256').update(docIndex.concat(docId, version, ruleId)).digest('hex');

// TODO: do we need to include version in the id? If it does matter then we should include it in signal.parents as well
export const generateSignalId = (signal: Signal) =>
  createHash('sha256')
    .update(
      signal.parents
        .reduce((acc, parent) => acc.concat(parent.id, parent.index), '')
        .concat(signal.rule.id)
    )
    .digest('hex');

/**
 * Generates unique doc ids for each building block signal within a sequence. The id of each building block
 * depends on the parents of every building block, so that a signal which appears in multiple different sequences
 * (e.g. if multiple rules build sequences that share a common event/signal) will get a unique id per sequence.
 * @param buildingBlocks The full list of building blocks in the sequence.
 */
export const generateBuildingBlockIds = (buildingBlocks: SignalHit[]): string[] => {
  const baseHashString = buildingBlocks.reduce(
    (baseString, block) =>
      baseString
        .concat(
          block.signal.parents.reduce((acc, parent) => acc.concat(parent.id, parent.index), '')
        )
        .concat(block.signal.rule.id),
    ''
  );
  return buildingBlocks.map((block, idx) =>
    createHash('sha256').update(baseHashString).update(String(idx)).digest('hex')
  );
};

export const wrapBuildingBlocks = (
  buildingBlocks: SignalHit[],
  index: string
): WrappedSignalHit[] => {
  const blockIds = generateBuildingBlockIds(buildingBlocks);
  return buildingBlocks.map((block, idx) => {
    return {
      _id: blockIds[idx],
      _index: index,
      _source: {
        ...block,
      },
    };
  });
};

export const wrapSignal = (signal: SignalHit, index: string): WrappedSignalHit => {
  return {
    _id: generateSignalId(signal.signal),
    _index: index,
    _source: {
      ...signal,
    },
  };
};

export const parseInterval = (intervalString: string): moment.Duration | null => {
  try {
    return moment.duration(parseDuration(intervalString));
  } catch (err) {
    return null;
  }
};

export const getDriftTolerance = ({
  from,
  to,
  interval,
  now = moment(),
}: {
  from: string;
  to: string;
  interval: moment.Duration;
  now?: moment.Moment;
}): moment.Duration | null => {
  const toDate = parseScheduleDates(to) ?? now;
  const fromDate = parseScheduleDates(from) ?? dateMath.parse('now-6m');
  const timeSegment = toDate.diff(fromDate);
  const duration = moment.duration(timeSegment);

  if (duration !== null) {
    return duration.subtract(interval);
  } else {
    return null;
  }
};

export const getGapBetweenRuns = ({
  previousStartedAt,
  interval,
  from,
  to,
  now = moment(),
}: {
  previousStartedAt: Date | undefined | null;
  interval: string;
  from: string;
  to: string;
  now?: moment.Moment;
}): moment.Duration | null => {
  if (previousStartedAt == null) {
    return null;
  }
  const intervalDuration = parseInterval(interval);
  if (intervalDuration == null) {
    return null;
  }
  const driftTolerance = getDriftTolerance({ from, to, interval: intervalDuration });
  if (driftTolerance == null) {
    return null;
  }
  const diff = moment.duration(now.diff(previousStartedAt));
  const drift = diff.subtract(intervalDuration);
  return drift.subtract(driftTolerance);
};

export const makeFloatString = (num: number): string => Number(num).toFixed(2);

/**
 * Given a BulkResponse this will return an aggregation based on the errors if any exist
 * from the BulkResponse. Errors are aggregated on the reason as the unique key.
 *
 * Example would be:
 * {
 *   'Parse Error': {
 *      count: 100,
 *      statusCode: 400,
 *   },
 *   'Internal server error': {
 *       count: 3,
 *       statusCode: 500,
 *   }
 * }
 * If this does not return any errors then you will get an empty object like so: {}
 * @param response The bulk response to aggregate based on the error message
 * @param ignoreStatusCodes Optional array of status codes to ignore when creating aggregate error messages
 * @returns The aggregated example as shown above.
 */
export const errorAggregator = (
  response: BulkResponse,
  ignoreStatusCodes: number[]
): BulkResponseErrorAggregation => {
  return response.items.reduce<BulkResponseErrorAggregation>((accum, item) => {
    if (item.create?.error != null && !ignoreStatusCodes.includes(item.create.status)) {
      if (accum[item.create.error.reason] == null) {
        accum[item.create.error.reason] = {
          count: 1,
          statusCode: item.create.status,
        };
      } else {
        accum[item.create.error.reason] = {
          count: accum[item.create.error.reason].count + 1,
          statusCode: item.create.status,
        };
      }
    }
    return accum;
  }, Object.create(null));
};

/**
 * Determines the number of time intervals to search if gap is present
 * along with new maxSignals per time interval.
 * @param logger Logger
 * @param ruleParamsFrom string representing the rules 'from' property
 * @param ruleParamsTo string representing the rules 'to' property
 * @param ruleParamsMaxSignals int representing the maxSignals property on the rule (usually unmodified at 100)
 * @param gap moment.Duration representing a gap in since the last time the rule ran
 * @param previousStartedAt Date at which the rule last ran
 * @param interval string the interval which the rule runs
 * @param buildRuleMessage function provides meta information for logged event
 */
export const getSignalTimeTuples = ({
  logger,
  ruleParamsFrom,
  ruleParamsTo,
  ruleParamsMaxSignals,
  gap,
  previousStartedAt,
  interval,
  buildRuleMessage,
}: {
  logger: Logger;
  ruleParamsFrom: string;
  ruleParamsTo: string;
  ruleParamsMaxSignals: number;
  gap: moment.Duration | null;
  previousStartedAt: Date | null | undefined;
  interval: string;
  buildRuleMessage: BuildRuleMessage;
}): Array<{
  to: moment.Moment | undefined;
  from: moment.Moment | undefined;
  maxSignals: number;
}> => {
  let totalToFromTuples: Array<{
    to: moment.Moment | undefined;
    from: moment.Moment | undefined;
    maxSignals: number;
  }> = [];
  if (gap != null && gap.valueOf() > 0 && previousStartedAt != null) {
    const fromUnit = ruleParamsFrom[ruleParamsFrom.length - 1];
    if (isValidUnit(fromUnit)) {
      const unit = fromUnit; // only seconds (s), minutes (m) or hours (h)

      /*
      we need the total duration from now until the last time the rule ran.
      the next few lines can be summed up as calculating
      "how many second | minutes | hours have passed since the last time this ran?"
      */
      const nowToGapDiff = moment.duration(moment().diff(previousStartedAt));
      const calculatedFrom = `now-${
        parseInt(shorthandMap[unit].asFn(nowToGapDiff).toString(), 10) + unit
      }`;
      logger.debug(buildRuleMessage(`calculatedFrom: ${calculatedFrom}`));

      const intervalMoment = moment.duration(parseInt(interval, 10), unit);
      logger.debug(buildRuleMessage(`intervalMoment: ${shorthandMap[unit].asFn(intervalMoment)}`));
      const momentUnit = shorthandMap[unit].momentString as moment.DurationInputArg2;
      // maxCatchup is to ensure we are not trying to catch up too far back.
      // This allows for a maximum of 4 consecutive rule execution misses
      // to be included in the number of signals generated.
      const { maxCatchup, ratio, gapDiffInUnits } = getGapMaxCatchupRatio({
        logger,
        buildRuleMessage,
        previousStartedAt,
        unit,
        ruleParamsFrom,
        interval,
      });
      logger.debug(buildRuleMessage(`maxCatchup: ${maxCatchup}, ratio: ${ratio}`));
      if (maxCatchup == null || ratio == null || gapDiffInUnits == null) {
        throw new Error(
          buildRuleMessage('failed to calculate maxCatchup, ratio, or gapDiffInUnits')
        );
      }
      let tempTo = dateMath.parse(ruleParamsFrom);
      if (tempTo == null) {
        // return an error
        throw new Error(buildRuleMessage('dateMath parse failed'));
      }

      let beforeMutatedFrom: moment.Moment | undefined;
      while (totalToFromTuples.length < maxCatchup) {
        // if maxCatchup is less than 1, we calculate the 'from' differently
        // and maxSignals becomes some less amount of maxSignals
        // in order to maintain maxSignals per full rule interval.
        if (maxCatchup > 0 && maxCatchup < 1) {
          totalToFromTuples.push({
            to: tempTo.clone(),
            from: tempTo.clone().subtract(gapDiffInUnits, momentUnit),
            maxSignals: ruleParamsMaxSignals * maxCatchup,
          });
          break;
        }
        const beforeMutatedTo = tempTo.clone();

        // moment.subtract mutates the moment so we need to clone again..
        beforeMutatedFrom = tempTo.clone().subtract(intervalMoment, momentUnit);
        const tuple = {
          to: beforeMutatedTo,
          from: beforeMutatedFrom,
          maxSignals: ruleParamsMaxSignals,
        };
        totalToFromTuples = [...totalToFromTuples, tuple];
        tempTo = beforeMutatedFrom;
      }
      totalToFromTuples = [
        {
          to: dateMath.parse(ruleParamsTo),
          from: dateMath.parse(ruleParamsFrom),
          maxSignals: ruleParamsMaxSignals,
        },
        ...totalToFromTuples,
      ];
    }
  } else {
    totalToFromTuples = [
      {
        to: dateMath.parse(ruleParamsTo),
        from: dateMath.parse(ruleParamsFrom),
        maxSignals: ruleParamsMaxSignals,
      },
    ];
  }
  logger.debug(
    buildRuleMessage(`totalToFromTuples: ${JSON.stringify(totalToFromTuples, null, 4)}`)
  );
  return totalToFromTuples;
};

/**
 * Given errors from a search query this will return an array of strings derived from the errors.
 * @param errors The errors to derive the strings from
 */
export const createErrorsFromShard = ({ errors }: { errors: ShardError[] }): string[] => {
  return errors.map((error) => {
    const {
      reason: {
        reason,
        type,
        caused_by: { reason: causedByReason, type: causedByType } = {
          reason: undefined,
          type: undefined,
        },
      } = {},
    } = error;

    return [
      ...(reason != null ? [`reason: "${reason}"`] : []),
      ...(type != null ? [`type: "${type}"`] : []),
      ...(causedByReason != null ? [`caused by reason: "${causedByReason}"`] : []),
      ...(causedByType != null ? [`caused by type: "${causedByType}"`] : []),
    ].join(' ');
  });
};

/**
 * Given a SignalSearchResponse this will return a valid last date if it can find one, otherwise it
 * will return undefined. This tries the "fields" first to get a formatted date time if it can, but if
 * it cannot it will resort to using the "_source" fields second which can be problematic if the date time
 * is not correctly ISO8601 or epoch milliseconds formatted.
 * @param searchResult The result to try and parse out the timestamp.
 * @param timestampOverride The timestamp override to use its values if we have it.
 */
export const lastValidDate = ({
  searchResult,
  timestampOverride,
}: {
  searchResult: SignalSearchResponse;
  timestampOverride: TimestampOverrideOrUndefined;
}): Date | undefined => {
  if (searchResult.hits.hits.length === 0) {
    return undefined;
  } else {
    const lastRecord = searchResult.hits.hits[searchResult.hits.hits.length - 1];
    const timestamp = timestampOverride ?? '@timestamp';
    const timestampValue =
      lastRecord.fields != null && lastRecord.fields[timestamp] != null
        ? lastRecord.fields[timestamp][0]
        : lastRecord._source[timestamp];
    const lastTimestamp =
      typeof timestampValue === 'string' || typeof timestampValue === 'number'
        ? timestampValue
        : undefined;
    if (lastTimestamp != null) {
      const tempMoment = moment(lastTimestamp);
      if (tempMoment.isValid()) {
        return tempMoment.toDate();
      } else {
        return undefined;
      }
    }
  }
};

export const createSearchAfterReturnTypeFromResponse = ({
  searchResult,
  timestampOverride,
}: {
  searchResult: SignalSearchResponse;
  timestampOverride: TimestampOverrideOrUndefined;
}): SearchAfterAndBulkCreateReturnType => {
  return createSearchAfterReturnType({
    success: searchResult._shards.failed === 0,
    lastLookBackDate: lastValidDate({ searchResult, timestampOverride }),
  });
};

export const createSearchAfterReturnType = ({
  success,
  searchAfterTimes,
  bulkCreateTimes,
  lastLookBackDate,
  createdSignalsCount,
  createdSignals,
  errors,
}: {
  success?: boolean | undefined;
  searchAfterTimes?: string[] | undefined;
  bulkCreateTimes?: string[] | undefined;
  lastLookBackDate?: Date | undefined;
  createdSignalsCount?: number | undefined;
  createdSignals?: SignalHit[] | undefined;
  errors?: string[] | undefined;
} = {}): SearchAfterAndBulkCreateReturnType => {
  return {
    success: success ?? true,
    searchAfterTimes: searchAfterTimes ?? [],
    bulkCreateTimes: bulkCreateTimes ?? [],
    lastLookBackDate: lastLookBackDate ?? null,
    createdSignalsCount: createdSignalsCount ?? 0,
    createdSignals: createdSignals ?? [],
    errors: errors ?? [],
  };
};

export const mergeReturns = (
  searchAfters: SearchAfterAndBulkCreateReturnType[]
): SearchAfterAndBulkCreateReturnType => {
  return searchAfters.reduce((prev, next) => {
    const {
      success: existingSuccess,
      searchAfterTimes: existingSearchAfterTimes,
      bulkCreateTimes: existingBulkCreateTimes,
      lastLookBackDate: existingLastLookBackDate,
      createdSignalsCount: existingCreatedSignalsCount,
      createdSignals: existingCreatedSignals,
      errors: existingErrors,
    } = prev;

    const {
      success: newSuccess,
      searchAfterTimes: newSearchAfterTimes,
      bulkCreateTimes: newBulkCreateTimes,
      lastLookBackDate: newLastLookBackDate,
      createdSignalsCount: newCreatedSignalsCount,
      createdSignals: newCreatedSignals,
      errors: newErrors,
    } = next;

    return {
      success: existingSuccess && newSuccess,
      searchAfterTimes: [...existingSearchAfterTimes, ...newSearchAfterTimes],
      bulkCreateTimes: [...existingBulkCreateTimes, ...newBulkCreateTimes],
      lastLookBackDate: newLastLookBackDate ?? existingLastLookBackDate,
      createdSignalsCount: existingCreatedSignalsCount + newCreatedSignalsCount,
      createdSignals: [...existingCreatedSignals, ...newCreatedSignals],
      errors: [...new Set([...existingErrors, ...newErrors])],
    };
  });
};

export const createTotalHitsFromSearchResult = ({
  searchResult,
}: {
  searchResult: SignalSearchResponse;
}): number => {
  const totalHits =
    typeof searchResult.hits.total === 'number'
      ? searchResult.hits.total
      : searchResult.hits.total.value;
  return totalHits;
};

export interface TimestampsAndIndices {
  [timestampString: string]: string[]; // maps timestampString like @timestamp or 'event.ingested' to the indices that contain that timestamp mapping
}

export const checkIndexMappingsForTimestampFields = async (
  indices: string[],
  timestamps: string[],
  services: AlertServices,
  logger: Logger,
  buildRuleMessage: BuildRuleMessage
): Promise<TimestampsAndIndices> => {
  try {
    const foundMappings: GetFieldMappingType = await services.callCluster(
      'indices.getFieldMapping',
      {
        index: indices,
        fields: timestamps,
      }
    );

    // get the full names of the indices found to contain the given field mapping
    const matchedIndices = Object.keys(foundMappings);

    // map the timestamp fields like '@timestamp', 'event.ingested' etc.. to the indices that contain mappings for these fields
    const toReturn = timestamps.reduce((acc, timestamp) => {
      return {
        [timestamp]: matchedIndices.filter(
          (index) => foundMappings[index]?.mappings[timestamp] != null
        ),
        ...acc,
      };
    }, {} as TimestampsAndIndices);
    return toReturn;
  } catch (exc) {
    logger.error(
      buildRuleMessage(
        `An error occurred while getting the field mapping type for this rule ${exc}`
      )
    );
    return {};
  }
};

export const getIndexesMatchingIndexPatterns = async (
  indices: string[],
  services: AlertServices,
  logger: Logger,
  buildRuleMessage: BuildRuleMessage
): Promise<Record<string, string[]>> => {
  try {
    const res = await indices.reduce(async (acc, indexPattern) => {
      try {
        const totalIndices: Array<Record<'index', string>> = await services.callCluster(
          'cat.indices',
          {
            index: indexPattern,
            format: 'json',
          }
        );
        return { [indexPattern]: totalIndices.map((item) => item.index), ...(await acc) };
      } catch (exc) {
        logger.error(
          buildRuleMessage(`[-] failed to cat indices: ${JSON.stringify(indices, null, 2)}`)
        );
        logger.error(buildRuleMessage(`Exception: ${exc}`));
        return { ...(await acc) };
      }
    }, {} as Promise<Record<string, string[]>>);
    return res;
  } catch (exc) {
    logger.error(
      buildRuleMessage(`[-] failed to cat indices: ${JSON.stringify(indices, null, 2)}`)
    );
    logger.error(buildRuleMessage(`Exception: ${exc}`));
    return Promise.resolve({});
  }
};

export const findIndicesWithTimestampAndWithout = (
  indexPatternRegEx: Record<string, RegExp>,
  indexPatternIndices: Record<string, string[]>,
  timestampsAndIndices: TimestampsAndIndices,
  timestamp: string,
  logger: Logger,
  buildRuleMessage: BuildRuleMessage
) => {
  let failingIndexes: string[] = [];
  let successIndexes: string[] = [];
  for (const indexPattern of Object.keys(indexPatternRegEx)) {
    const matchingIndexes = timestampsAndIndices[timestamp].filter((index) =>
      indexPatternRegEx[indexPattern].test(index)
    );
    const [indexesWithTimestampField, indexesMissingTimestampField] = partition(
      (index) => matchingIndexes.some((idx) => idx === index),
      indexPatternIndices[indexPattern]
    );

    if (indexesMissingTimestampField.length > 0) {
      logger.error(
        buildRuleMessage(
          `The following indices ${JSON.stringify(
            indexesMissingTimestampField,
            null,
            2
          )} matching matching index pattern ${JSON.stringify(
            indexPattern,
            null,
            2
          )} are missing required field ${timestamp}.`
        )
      );
      failingIndexes = [...failingIndexes, ...indexesMissingTimestampField];
    }
    successIndexes = [...successIndexes, ...indexesWithTimestampField];
  }
  return [successIndexes, failingIndexes];
};

/**
 * The basic gist is find all indices that have the given timestamp(s)
 * If there is a timestamp override, ensure all indices for all index
 * patterns have that timestamp override. If an index pattern does not,
 * check if that index has an '@timestamp' field and default to that.
 *
 * If no timestamp override field is found, use the '@timestamp' field.
 * If an index in a given index pattern is missing the '@timestamp' field
 * set the status of the rule to be a partial failure
 *
 * If all index patterns are missing the '@timestamp' field and the override
 * set the status to error.
 * @param indices string[]
 * @param timestamps string[]
 * @param services AlertServices
 * @param logger Logger
 * @param buildRuleMessage
 */
export const timestampFieldCheck = async (
  indices: string[],
  timestamps: string[],
  services: AlertServices,
  logger: Logger,
  buildRuleMessage: BuildRuleMessage
): Promise<PreCheckRuleResultInterface> => {
  const timestampsAndIndices = await checkIndexMappingsForTimestampFields(
    indices,
    timestamps,
    services,
    logger,
    buildRuleMessage
  );

  if (isEmpty(timestampsAndIndices)) {
    return {
      result: 'success',
      resultMessages: [
        `Could not find field mappings for ${JSON.stringify(
          timestamps
        )} in indices: ${JSON.stringify(indices)}`,
      ],
      successIndexes: [],
      failingIndexes: [],
      timestampsAndIndices: {},
    };
  }

  // get all indices which match the given index pattern(s)
  // we will use this for determining which indices within
  // a given index pattern are missing timestamp field(s)
  // IMPORTANT: this uses cat.indices api which requires
  // 'monitor' privilege on both the cluster and the index
  // patterns
  const indexPatternIndices = await getIndexesMatchingIndexPatterns(
    indices,
    services,
    logger,
    buildRuleMessage
  );

  // if timestampsAndIndices[timestampOverride].length === Object.values(indexPatternIndices).length
  // then skip the @timestamp field since we have all of the indices in the timestamp override.
  const timestampOverrideField = Object.keys(timestampsAndIndices).filter(
    (timestamp) => timestamp !== '@timestamp'
  )[0];

  if (
    !isEmpty(indexPatternIndices) &&
    timestampOverrideField != null &&
    Object.keys(timestampsAndIndices).includes(timestampOverrideField)
  ) {
    if (
      timestampsAndIndices[timestampOverrideField].length ===
      Object.values(indexPatternIndices).flat(2).length
    ) {
      delete timestampsAndIndices['@timestamp'];
    }
  }

  const timestampKeys = Object.keys(timestampsAndIndices);

  if (timestampKeys.length === 0) {
    throw Error(`No indices contained timestamp fields: ${JSON.stringify(timestamps)}`);
  }

  const indexPatternRegEx = indices.reduce(
    (acc, indexPattern) => ({ [indexPattern]: new RegExp(indexPattern), ...acc }),
    {} as Record<string, RegExp>
  );

  /**
   * Compute our return object based off of what indexes contain the timestamp override (if provided)
   * or are missing the '@timestamp' field and generate a status (error, partial failure, success)
   */
  const toReturn: PreCheckRuleResultInterface = timestampKeys.reduce(
    (acc, timestamp) => {
      if (timestampsAndIndices[timestamp] == null || timestampsAndIndices[timestamp].length === 0) {
        logger.error(
          buildRuleMessage(
            `The field ${timestamp} was not found in any of the following index patterns ${JSON.stringify(
              indices
            )}`
          )
        );
        return {
          result: 'error',
          resultMessages: [
            ...acc.resultMessages,
            `The field ${timestamp} was not found in any of the following index patterns ${JSON.stringify(
              indices
            )}`,
          ],
          failingIndexes: [...acc.failingIndexes, ...indices],
          successIndexes: [...acc.successIndexes],
          timestampsAndIndices,
        };
      }

      const [indexesWithTimestampField, indexesWithNoTimestampField] = isEmpty(indexPatternIndices)
        ? partition(
            (indexPattern) =>
              timestampsAndIndices[timestamp]?.some((index) =>
                indexPatternRegEx[indexPattern].test(index)
              ),
            indices
          )
        : findIndicesWithTimestampAndWithout(
            indexPatternRegEx,
            indexPatternIndices,
            timestampsAndIndices,
            timestamp,
            logger,
            buildRuleMessage
          );

      // filter out failed indices that DO contain the override field (if provided)
      const tempFailedIdxs = indexesWithNoTimestampField.filter(
        (idx) =>
          !timestampsAndIndices[timestampOverrideField]?.some(
            (indx) =>
              indx === idx || (indexPatternRegEx[idx] != null && indexPatternRegEx[idx].test(indx))
          )
      );

      const resultMessages =
        tempFailedIdxs.length > 0
          ? [
              ...acc.resultMessages,
              `The ${
                timestamp !== '@timestamp' ? 'timestamp override' : ''
              } field ${timestamp} was not found in any of the following index patterns ${
                tempFailedIdxs.length > 5 && !isEmpty(indexPatternIndices)
                  ? JSON.stringify([
                      ...new Set(
                        tempFailedIdxs.reduce((failedIndexesAcc, item) => {
                          const foundIndexPattern = Object.keys(
                            indexPatternRegEx
                          ).find((indexPattern) => indexPatternRegEx[indexPattern].test(item));
                          if (foundIndexPattern == null) {
                            return [...failedIndexesAcc];
                          }
                          return [...failedIndexesAcc, foundIndexPattern];
                        }, [] as string[])
                      ),
                    ])
                  : JSON.stringify(tempFailedIdxs)
              }`,
            ]
          : [...acc.resultMessages];
      const failingIndexes =
        tempFailedIdxs.length > 0
          ? [...acc.failingIndexes, ...tempFailedIdxs]
          : [...acc.failingIndexes];
      return {
        result: ((): 'success' | 'partial failure' | 'error' => {
          if (
            indexesWithNoTimestampField.length > 0 &&
            (acc.successIndexes.length > 0 || indexesWithTimestampField.length > 0)
          ) {
            return 'partial failure';
          } else if (
            acc.failingIndexes.length >= 0 &&
            indexesWithNoTimestampField.length >= 0 &&
            acc.successIndexes.length === 0 &&
            indexesWithTimestampField.length === 0 &&
            acc.result === 'error'
          ) {
            return 'error';
          }
          return acc.result;
        })(),
        resultMessages,
        failingIndexes,
        successIndexes: [...acc.successIndexes, ...indexesWithTimestampField],
        timestampsAndIndices,
      };
    },
    {
      result: 'success',
      resultMessages: [],
      successIndexes: [],
      failingIndexes: [],
      timestampsAndIndices: {},
    } as PreCheckRuleResultInterface
  );

  return toReturn;
};

export interface PreCheckRuleResultInterface {
  result: 'success' | 'partial failure' | 'error';
  failingIndexes: string[];
  successIndexes: string[];
  resultMessages: string[];
  timestampsAndIndices: TimestampsAndIndices;
}

// run privilege checks before rule execution begins
// currently the only check is for the timestampFields
// in the future we will add more.
export const preExecutionRuleCheck = async (
  indices: string[],
  timestamps: string[],
  services: AlertServices,
  logger: Logger,
  buildRuleMessage: BuildRuleMessage
): Promise<PreCheckRuleResultInterface> => {
  return timestampFieldCheck(indices, timestamps, services, logger, buildRuleMessage);
};
