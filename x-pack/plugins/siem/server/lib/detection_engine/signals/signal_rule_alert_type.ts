/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { performance } from 'perf_hooks';
import { Logger } from 'src/core/server';

import { SIGNALS_ID, DEFAULT_SEARCH_AFTER_PAGE_SIZE } from '../../../../common/constants';
import { isJobStarted, isMlRule } from '../../../../common/detection_engine/ml_helpers';
import { SetupPlugins } from '../../../plugin';

import { buildEventsSearchQuery } from './build_events_query';
import { getInputIndex } from './get_input_output_index';
import {
  searchAfterAndBulkCreate,
  SearchAfterAndBulkCreateReturnType,
} from './search_after_bulk_create';
import { getFilter } from './get_filter';
import { SignalRuleAlertTypeDefinition, RuleAlertAttributes } from './types';
import { getGapBetweenRuns, makeFloatString, parseScheduleDates } from './utils';
import { signalParamsSchema } from './signal_params_schema';
import { siemRuleActionGroups } from './siem_rule_action_groups';
import { findMlSignals } from './find_ml_signals';
import { bulkCreateMlSignals } from './bulk_create_ml_signals';
import {
  scheduleNotificationActions,
  NotificationRuleTypeParams,
} from '../notifications/schedule_notification_actions';
import { ruleStatusServiceFactory } from './rule_status_service';
import { buildRuleMessageFactory } from './rule_messages';
import { ruleStatusSavedObjectsClientFactory } from './rule_status_saved_objects_client';
import { getNotificationResultsLink } from '../notifications/utils';

/* eslint-disable complexity*/
// const allowIps = ['127.0.0.1']; // collection of ip's in our system
// const blockIps = [['1.1.1.1']];
export const signalRulesAlertType = ({
  logger,
  version,
  ml,
  lists,
}: // getListItemByValues,
{
  logger: Logger;
  version: string;
  ml: SetupPlugins['ml'];
  lists: SetupPlugins['lists'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // getListItemByValues: any;
}): SignalRuleAlertTypeDefinition => {
  return {
    id: SIGNALS_ID,
    name: 'SIEM signal',
    actionGroups: siemRuleActionGroups,
    defaultActionGroupId: 'default',
    validate: {
      params: signalParamsSchema(),
    },
    async executor({ previousStartedAt, alertId, services, params, spaceId }) {
      const {
        anomalyThreshold,
        from,
        ruleId,
        index,
        filters,
        language,
        maxSignals,
        meta,
        machineLearningJobId,
        outputIndex,
        savedId,
        query,
        to,
        type,
        // allowListId,
        exceptions_list,
      } = params;
      const searchAfterSize = Math.min(maxSignals, DEFAULT_SEARCH_AFTER_PAGE_SIZE);
      let hasError: boolean = false;
      let result: SearchAfterAndBulkCreateReturnType = {
        success: false,
        bulkCreateTimes: [],
        searchAfterTimes: [],
        lastLookBackDate: null,
        createdSignalsCount: 0,
      };
      const ruleStatusClient = ruleStatusSavedObjectsClientFactory(services.savedObjectsClient);
      const ruleStatusService = await ruleStatusServiceFactory({
        alertId,
        ruleStatusClient,
      });
      const savedObject = await services.savedObjectsClient.get<RuleAlertAttributes>(
        'alert',
        alertId
      );
      // const list = await services. // maybe add lists here?
      const {
        actions,
        name,
        tags,
        createdAt,
        createdBy,
        updatedBy,
        enabled,
        schedule: { interval },
        throttle,
        params: ruleParams,
      } = savedObject.attributes;
      const updatedAt = savedObject.updated_at ?? '';
      const refresh = actions.length ? 'wait_for' : false;
      const buildRuleMessage = buildRuleMessageFactory({
        id: alertId,
        ruleId,
        name,
        index: outputIndex,
      });

      logger.debug(buildRuleMessage('[+] Starting Signal Rule execution'));
      await ruleStatusService.goingToRun();

      const gap = getGapBetweenRuns({ previousStartedAt, interval, from, to });
      if (gap != null && gap.asMilliseconds() > 0) {
        const gapString = gap.humanize();
        const gapMessage = buildRuleMessage(
          `${gapString} (${gap.asMilliseconds()}ms) has passed since last rule execution, and signals may have been missed.`,
          'Consider increasing your look behind time or adding more Kibana instances.'
        );
        logger.warn(gapMessage);

        hasError = true;
        await ruleStatusService.error(gapMessage, { gap: gapString });
      }
      try {
        if (isMlRule(type)) {
          if (ml == null) {
            throw new Error('ML plugin unavailable during rule execution');
          }
          if (machineLearningJobId == null || anomalyThreshold == null) {
            throw new Error(
              [
                'Machine learning rule is missing job id and/or anomaly threshold:',
                `job id: "${machineLearningJobId}"`,
                `anomaly threshold: "${anomalyThreshold}"`,
              ].join(' ')
            );
          }

          const summaryJobs = await ml
            .jobServiceProvider(ml.mlClient.callAsInternalUser)
            .jobsSummary([machineLearningJobId]);
          const jobSummary = summaryJobs.find(job => job.id === machineLearningJobId);

          if (jobSummary == null || !isJobStarted(jobSummary.jobState, jobSummary.datafeedState)) {
            const errorMessage = buildRuleMessage(
              'Machine learning job is not started:',
              `job id: "${machineLearningJobId}"`,
              `job status: "${jobSummary?.jobState}"`,
              `datafeed status: "${jobSummary?.datafeedState}"`
            );
            logger.warn(errorMessage);
            hasError = true;
            await ruleStatusService.error(errorMessage);
          }

          const anomalyResults = await findMlSignals(
            machineLearningJobId,
            anomalyThreshold,
            from,
            to,
            services.callCluster
          );
          const anomalyCount = anomalyResults.hits.hits.length;
          if (anomalyCount) {
            logger.info(buildRuleMessage(`Found ${anomalyCount} signals from ML anomalies.`));
          }

          const { success, bulkCreateDuration, createdItemsCount } = await bulkCreateMlSignals({
            actions,
            throttle,
            someResult: anomalyResults,
            ruleParams: params,
            services,
            logger,
            id: alertId,
            signalsIndex: outputIndex,
            name,
            createdBy,
            createdAt,
            updatedBy,
            updatedAt,
            interval,
            enabled,
            refresh,
            tags,
          });
          result.success = success;
          result.createdSignalsCount = createdItemsCount;
          if (bulkCreateDuration) {
            result.bulkCreateTimes.push(bulkCreateDuration);
          }
        } else {
          // if (lists == null) {
          //   throw new Error('lists plugin unavailable during rule execution');
          // }

          const inputIndex = await getInputIndex(services, version, index);
          const esFilter = await getFilter({
            type,
            filters,
            language,
            query,
            savedId,
            services,
            index: inputIndex,
            lists: exceptions_list,
          });

          const noReIndex = buildEventsSearchQuery({
            index: inputIndex,
            from,
            to,
            filter: esFilter,
            size: searchAfterSize,
            searchAfterSortId: undefined,
          });

          logger.debug(buildRuleMessage('[+] Initial search call'));
          const start = performance.now();
          // const dataClient = {
          //   callAsCurrentUser: services.callCluster,
          //   callAsInternalUser: services.callCluster,
          // };
          const noReIndexResult = await services.callCluster('search', noReIndex);
          // grab the result set and run it through the

          const end = performance.now();

          const signalCount = noReIndexResult.hits.total.value;
          if (signalCount !== 0) {
            logger.info(
              buildRuleMessage(
                `Found ${signalCount} signals from the indexes of "[${inputIndex.join(', ')}]"`
              )
            );
            const value = noReIndexResult.hits.hits
              .map((item: { _source: { source?: { ip?: string } } }) => item._source.source?.ip)
              .filter((item: string) => item != null);
            let listSignals;
            if (lists != null) {
              listSignals = await lists
                .getListClient(services.callCluster, spaceId)
                .getListItemByValues({
                  listId: 'ci-badguys.txt',
                  type: 'ip',
                  value: [...new Set<string>(value)],
                });
            }
            // const listSignals = await getListItemByValues({
            //   dataClient,
            //   listId: 'ci-badguys.txt',
            //   listItemIndex: '.items-default', // get this when lists plugin is available....... >:(
            //   type: 'ip',
            //   value: [...new Set(value)],
            // });
            // console.log({ listSignals });
          }

          result = await searchAfterAndBulkCreate({
            someResult: noReIndexResult, // possibleSignals
            ruleParams: params,
            services,
            logger,
            id: alertId,
            inputIndexPattern: inputIndex,
            signalsIndex: outputIndex,
            filter: esFilter,
            actions,
            name,
            createdBy,
            createdAt,
            updatedBy,
            updatedAt,
            interval,
            enabled,
            pageSize: searchAfterSize,
            refresh,
            tags,
            throttle,
          });
          result.searchAfterTimes.push(makeFloatString(end - start));
        }

        if (result.success) {
          if (actions.length) {
            const notificationRuleParams: NotificationRuleTypeParams = {
              ...ruleParams,
              name,
              id: savedObject.id,
            };

            const fromInMs = parseScheduleDates(`now-${interval}`)?.format('x');
            const toInMs = parseScheduleDates('now')?.format('x');

            const resultsLink = getNotificationResultsLink({
              from: fromInMs,
              to: toInMs,
              id: savedObject.id,
              kibanaSiemAppUrl: meta?.kibana_siem_app_url,
            });

            logger.info(
              buildRuleMessage(`Found ${result.createdSignalsCount} signals for notification.`)
            );

            if (result.createdSignalsCount) {
              const alertInstance = services.alertInstanceFactory(alertId);
              scheduleNotificationActions({
                alertInstance,
                signalsCount: result.createdSignalsCount,
                resultsLink,
                ruleParams: notificationRuleParams,
              });
            }
          }

          logger.debug(buildRuleMessage('[+] Signal Rule execution completed.'));
          if (!hasError) {
            await ruleStatusService.success('succeeded', {
              bulkCreateTimeDurations: result.bulkCreateTimes,
              searchAfterTimeDurations: result.searchAfterTimes,
              lastLookBackDate: result.lastLookBackDate?.toISOString(),
            });
          }
        } else {
          const errorMessage = buildRuleMessage(
            'Bulk Indexing of signals failed. Check logs for further details.'
          );
          logger.error(errorMessage);
          await ruleStatusService.error(errorMessage, {
            bulkCreateTimeDurations: result.bulkCreateTimes,
            searchAfterTimeDurations: result.searchAfterTimes,
            lastLookBackDate: result.lastLookBackDate?.toISOString(),
          });
        }
      } catch (error) {
        const errorMessage = error.message ?? '(no error message given)';
        const message = buildRuleMessage(
          'An error occurred during rule execution:',
          `message: "${errorMessage}"`
        );

        logger.error(message);
        await ruleStatusService.error(message, {
          bulkCreateTimeDurations: result.bulkCreateTimes,
          searchAfterTimeDurations: result.searchAfterTimes,
          lastLookBackDate: result.lastLookBackDate?.toISOString(),
        });
      }
    },
  };
};
