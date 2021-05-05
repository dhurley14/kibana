/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';
import { take } from 'rxjs/operators';
import {
  AlertType,
  ALERT_TYPES_CONFIG,
  APM_SERVER_FEATURE_ID,
} from '../../../common/alert_types';
import {
  EVENT_OUTCOME,
  PROCESSOR_EVENT,
  SERVICE_ENVIRONMENT,
  SERVICE_NAME,
  TRANSACTION_TYPE,
} from '../../../common/elasticsearch_fieldnames';
import { EventOutcome } from '../../../common/event_outcome';
import { ProcessorEvent } from '../../../common/processor_event';
import { asDecimalOrInteger } from '../../../common/utils/formatters';
import { environmentQuery } from '../../../server/utils/queries';
import { getApmIndices } from '../settings/apm_indices/get_apm_indices';
import { apmActionVariables } from './action_variables';
import { alertingEsClient } from './alerting_es_client';
import { createAPMLifecycleRuleType } from './create_apm_lifecycle_rule_type';
import { RegisterRuleDependencies } from './register_apm_alerts';

const paramsSchema = schema.object({
  windowSize: schema.number(),
  windowUnit: schema.string(),
  threshold: schema.number(),
  transactionType: schema.maybe(schema.string()),
  serviceName: schema.maybe(schema.string()),
  environment: schema.string(),
});

const alertTypeConfig = ALERT_TYPES_CONFIG[AlertType.TransactionErrorRate];

export function registerTransactionErrorRateAlertType({
  registry,
  config$,
}: RegisterRuleDependencies) {
  registry.registerType(
    createAPMLifecycleRuleType({
      id: AlertType.TransactionErrorRate,
      name: alertTypeConfig.name,
      actionGroups: alertTypeConfig.actionGroups,
      defaultActionGroupId: alertTypeConfig.defaultActionGroupId,
      validate: {
        params: paramsSchema,
      },
      actionVariables: {
        context: [
          apmActionVariables.transactionType,
          apmActionVariables.serviceName,
          apmActionVariables.environment,
          apmActionVariables.threshold,
          apmActionVariables.triggerValue,
          apmActionVariables.interval,
        ],
      },
      producer: APM_SERVER_FEATURE_ID,
      minimumLicenseRequired: 'basic',
      executor: async ({ services, params: alertParams }) => {
        const config = await config$.pipe(take(1)).toPromise();
        const indices = await getApmIndices({
          config,
          savedObjectsClient: services.savedObjectsClient,
        });

        const searchParams = {
          index: indices['apm_oss.transactionIndices'],
          size: 1,
          body: {
            query: {
              bool: {
                filter: [
                  {
                    range: {
                      '@timestamp': {
                        gte: `now-${alertParams.windowSize}${alertParams.windowUnit}`,
                      },
                    },
                  },
                  { term: { [PROCESSOR_EVENT]: ProcessorEvent.transaction } },
                  {
                    terms: {
                      [EVENT_OUTCOME]: [
                        EventOutcome.failure,
                        EventOutcome.success,
                      ],
                    },
                  },
                  ...(alertParams.serviceName
                    ? [{ term: { [SERVICE_NAME]: alertParams.serviceName } }]
                    : []),
                  ...(alertParams.transactionType
                    ? [
                        {
                          term: {
                            [TRANSACTION_TYPE]: alertParams.transactionType,
                          },
                        },
                      ]
                    : []),
                  ...environmentQuery(alertParams.environment),
                ],
              },
            },
            aggs: {
              series: {
                multi_terms: {
                  terms: [
                    { field: SERVICE_NAME },
                    { field: SERVICE_ENVIRONMENT, missing: '' },
                    { field: TRANSACTION_TYPE },
                  ],
                  size: 10000,
                },
                aggs: {
                  outcomes: {
                    terms: {
                      field: EVENT_OUTCOME,
                    },
                  },
                },
              },
            },
          },
        };

        const response = await alertingEsClient({
          scopedClusterClient: services.scopedClusterClient,
          params: searchParams,
        });

        if (!response.aggregations) {
          return {};
        }

        const results = response.aggregations.series.buckets
          .map((bucket) => {
            const [serviceName, environment, transactionType] = bucket.key;

            const failed =
              bucket.outcomes.buckets.find(
                (outcomeBucket) => outcomeBucket.key === EventOutcome.failure
              )?.doc_count ?? 0;
            const succesful =
              bucket.outcomes.buckets.find(
                (outcomeBucket) => outcomeBucket.key === EventOutcome.success
              )?.doc_count ?? 0;

            return {
              serviceName,
              environment,
              transactionType,
              errorRate: (failed / (failed + succesful)) * 100,
            };
          })
          .filter((result) => result.errorRate >= alertParams.threshold);

        results.forEach((result) => {
          const {
            serviceName,
            environment,
            transactionType,
            errorRate,
          } = result;

          services
            .alertWithLifecycle({
              id: [
                AlertType.TransactionErrorRate,
                serviceName,
                transactionType,
                environment,
              ]
                .filter((name) => name)
                .join('_'),
              fields: {
                [SERVICE_NAME]: serviceName,
                ...(environment ? { [SERVICE_ENVIRONMENT]: environment } : {}),
                [TRANSACTION_TYPE]: transactionType,
                [PROCESSOR_EVENT]: ProcessorEvent.transaction,
                'kibana.observability.evaluation.value': errorRate,
                'kibana.observability.evaluation.threshold':
                  alertParams.threshold,
              },
            })
            .scheduleActions(alertTypeConfig.defaultActionGroupId, {
              serviceName,
              transactionType,
              environment,
              threshold: alertParams.threshold,
              triggerValue: asDecimalOrInteger(errorRate),
              interval: `${alertParams.windowSize}${alertParams.windowUnit}`,
            });
        });

        return {};
      },
    })
  );
}
