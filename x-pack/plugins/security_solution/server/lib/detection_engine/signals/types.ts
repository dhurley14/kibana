/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { estypes } from '@elastic/elasticsearch';
import { DslQuery, Filter } from 'src/plugins/data/common';
import moment, { Moment } from 'moment';
import type { ExceptionListItemSchema } from '@kbn/securitysolution-io-ts-list-types';
import { Status } from '../../../../common/detection_engine/schemas/common/schemas';
import { RulesSchema } from '../../../../common/detection_engine/schemas/response/rules_schema';
import {
  AlertType,
  AlertTypeState,
  AlertInstanceState,
  AlertInstanceContext,
  AlertExecutorOptions,
  AlertServices,
} from '../../../../../alerting/server';
import { BaseSearchResponse, SearchHit, TermAggregationBucket } from '../../types';
import {
  EqlSearchResponse,
  BaseHit,
  RuleAlertAction,
  SearchTypes,
  EqlSequence,
} from '../../../../common/detection_engine/types';
import { ListClient } from '../../../../../lists/server';
import { Logger, SavedObject } from '../../../../../../../src/core/server';
import { BuildRuleMessage } from './rule_messages';
import { TelemetryEventsSender } from '../../telemetry/sender';
import { RuleParams } from '../schemas/rule_schemas';
import { GenericBulkCreateResponse } from './bulk_create_factory';

// used for gap detection code
// eslint-disable-next-line @typescript-eslint/naming-convention
export type unitType = 's' | 'm' | 'h';
export const isValidUnit = (unitParam: string): unitParam is unitType =>
  ['s', 'm', 'h'].includes(unitParam);

export interface SignalsParams {
  signalIds: string[] | undefined | null;
  query: object | undefined | null;
  status: Status;
}

export interface SignalsStatusParams {
  signalIds: string[] | undefined | null;
  query: object | undefined | null;
  status: Status;
}

export interface ThresholdResult {
  terms?: Array<{
    field: string;
    value: string;
  }>;
  cardinality?: Array<{
    field: string;
    value: number;
  }>;
  count: number;
  from: string;
}

export interface ThresholdSignalHistoryRecord {
  terms: Array<{
    field?: string;
    value: SearchTypes;
  }>;
  lastSignalTimestamp: number;
}

export interface ThresholdSignalHistory {
  [hash: string]: ThresholdSignalHistoryRecord;
}

export interface RuleRangeTuple {
  to: moment.Moment;
  from: moment.Moment;
  maxSignals: number;
}

/**
 * SignalSource is being used as both a type for documents that match detection engine queries as well as
 * for queries that could be on top of signals. In cases where it is matched against detection engine queries,
 * '@timestamp' might not be there since it is not required and we have timestamp override capabilities. Also
 * the signal addition object, "signal?: {" will not be there unless it's a conflicting field when we are running
 * queries on events.
 *
 * For cases where we are running queries against signals (signals on signals) "@timestamp" should always be there
 * and the "signal?: {" sub-object should always be there.
 */
export interface SignalSource {
  [key: string]: SearchTypes;
  '@timestamp'?: string;
  signal?: {
    /**
     * "parent" is deprecated: new signals should populate "parents" instead. Both are optional
     * until all signals with parent are gone and we can safely remove it.
     * @deprecated Use parents instead
     */
    parent?: Ancestor;
    parents?: Ancestor[];
    ancestors: Ancestor[];
    group?: {
      id: string;
      index?: number;
    };
    rule: {
      id: string;
    };
    /** signal.depth was introduced in 7.10 and pre-7.10 signals do not have it. */
    depth?: number;
    original_time?: string;
    threshold_result?: ThresholdResult;
  };
}

export interface BulkItem {
  create?: {
    _index: string;
    _type?: string;
    _id: string;
    _version: number;
    result?: string;
    _shards?: {
      total: number;
      successful: number;
      failed: number;
    };
    _seq_no?: number;
    _primary_term?: number;
    status: number;
    error?: {
      type: string;
      reason: string;
      index_uuid?: string;
      shard: string;
      index: string;
    };
  };
}

export interface BulkResponse {
  took: number;
  errors: boolean;
  items: BulkItem[];
}

export interface MGetResponse {
  docs: GetResponse[];
}
export interface GetResponse {
  _index: string;
  _type: string;
  _id: string;
  _version: number;
  _seq_no: number;
  _primary_term: number;
  found: boolean;
  _source: SearchTypes;
}

export type SignalSearchResponse = estypes.SearchResponse<SignalSource>;
export type SignalSourceHit = estypes.SearchHit<SignalSource>;
export type WrappedSignalHit = BaseHit<SignalHit>;
export type BaseSignalHit = estypes.SearchHit<SignalSource>;

export type EqlSignalSearchResponse = EqlSearchResponse<SignalSource>;

export type RuleExecutorOptions = AlertExecutorOptions<
  RuleParams,
  AlertTypeState,
  AlertInstanceState,
  AlertInstanceContext
>;

// This returns true because by default a RuleAlertTypeDefinition is an AlertType
// since we are only increasing the strictness of params.
export const isAlertExecutor = (
  obj: SignalRuleAlertTypeDefinition
): obj is AlertType<
  RuleParams,
  AlertTypeState,
  AlertInstanceState,
  AlertInstanceContext,
  'default'
> => {
  return true;
};

export type SignalRuleAlertTypeDefinition = AlertType<
  RuleParams,
  AlertTypeState,
  AlertInstanceState,
  AlertInstanceContext,
  'default'
>;

export interface Ancestor {
  rule?: string;
  id: string;
  type: string;
  index: string;
  depth: number;
}

export interface Signal {
  _meta?: {
    version: number;
  };
  rule: RulesSchema;
  /**
   * @deprecated Use "parents" instead of "parent"
   */
  parent?: Ancestor;
  parents: Ancestor[];
  ancestors: Ancestor[];
  group?: {
    id: string;
    index?: number;
  };
  original_time?: string;
  original_event?: SearchTypes;
  owner?: string;
  status: Status;
  threshold_result?: ThresholdResult;
  original_signal?: SearchTypes;
  depth: number;
}

export interface SignalHit {
  '@timestamp': string;
  event: object;
  signal: Signal;
  [key: string]: SearchTypes;
}

export interface AlertAttributes<T extends RuleParams = RuleParams> {
  actions: RuleAlertAction[];
  enabled: boolean;
  name: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  schedule: {
    interval: string;
  };
  consumer: string;
  throttle: string;
  params: T;
}

export type BulkResponseErrorAggregation = Record<string, { count: number; statusCode: number }>;

/**
 * TODO: Remove this if/when the return filter has its own type exposed
 */
export interface QueryFilter {
  bool: {
    must: DslQuery[];
    filter: Filter[];
    should: unknown[];
    must_not: Filter[];
  };
}

export type SignalsEnrichment = (signals: SignalSearchResponse) => Promise<SignalSearchResponse>;

export type BulkCreate = <T>(docs: Array<BaseHit<T>>) => Promise<GenericBulkCreateResponse<T>>;

export type SimpleHit = BaseHit<{ '@timestamp': string }>;

export type WrapHits = (hits: Array<estypes.SearchHit<SignalSource>>) => SimpleHit[];

export type WrapSequences = (sequences: Array<EqlSequence<SignalSource>>) => SimpleHit[];

export interface SearchAfterAndBulkCreateParams {
  tuple: {
    to: moment.Moment;
    from: moment.Moment;
    maxSignals: number;
  };
  ruleSO: SavedObject<AlertAttributes>;
  services: AlertServices<AlertInstanceState, AlertInstanceContext, 'default'>;
  listClient: ListClient;
  exceptionsList: ExceptionListItemSchema[];
  logger: Logger;
  eventsTelemetry: TelemetryEventsSender | undefined;
  id: string;
  inputIndexPattern: string[];
  signalsIndex: string;
  pageSize: number;
  filter: unknown;
  buildRuleMessage: BuildRuleMessage;
  enrichment?: SignalsEnrichment;
  bulkCreate: BulkCreate;
  wrapHits: WrapHits;
}

export interface SearchAfterAndBulkCreateReturnType {
  success: boolean;
  warning: boolean;
  searchAfterTimes: string[];
  bulkCreateTimes: string[];
  lastLookBackDate: Date | null | undefined;
  createdSignalsCount: number;
  createdSignals: unknown[];
  errors: string[];
  warningMessages: string[];
  totalToFromTuples?: Array<{
    to: Moment | undefined;
    from: Moment | undefined;
    maxSignals: number;
  }>;
}

export interface ThresholdAggregationBucket extends TermAggregationBucket {
  top_threshold_hits: BaseSearchResponse<SignalSource>;
  cardinality_count: {
    value: number;
  };
}

export interface MultiAggBucket {
  cardinality?: Array<{
    field: string;
    value: number;
  }>;
  terms: Array<{
    field: string;
    value: string;
  }>;
  docCount: number;
  topThresholdHits?:
    | {
        hits: {
          hits: SearchHit[];
        };
      }
    | undefined;
}

export interface ThresholdQueryBucket extends TermAggregationBucket {
  lastSignalTimestamp: {
    value_as_string: string;
  };
}
