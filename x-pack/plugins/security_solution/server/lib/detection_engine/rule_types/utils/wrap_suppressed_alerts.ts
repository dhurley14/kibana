/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import objectHash from 'object-hash';

import { TIMESTAMP } from '@kbn/rule-data-utils';
import type { SuppressionFieldsLatest } from '@kbn/rule-registry-plugin/common/schemas';
import type { EqlHitsSequence } from '@elastic/elasticsearch/lib/api/types';

import type { SignalSource, SignalSourceHit } from '../types';
import type {
  BaseFieldsLatest,
  WrappedFieldsLatest,
  EqlBuildingBlockFieldsLatest,
} from '../../../../../common/api/detection_engine/model/alerts';
import type { ConfigType } from '../../../../config';
import type {
  CompleteRule,
  EqlRuleParams,
  MachineLearningRuleParams,
  ThreatRuleParams,
} from '../../rule_schema';
import type { IRuleExecutionLogForExecutors } from '../../rule_monitoring';
import { transformHitToAlert } from '../factories/utils/transform_hit_to_alert';
import { getSuppressionAlertFields, getSuppressionTerms } from './suppression_utils';
import { generateId, isEqlShellAlert } from './utils';

import type { BuildReasonMessage } from './reason_formatters';
import type { ExtraFieldsForShellAlert } from '../eql/build_alert_group_from_sequence';
import { buildAlertGroupFromSequence } from '../eql/build_alert_group_from_sequence';

type RuleWithInMemorySuppression = ThreatRuleParams | EqlRuleParams | MachineLearningRuleParams;

/**
 * wraps suppressed alerts
 * creates instanceId hash, which is used to search on time interval alerts
 * populates alert's suppression fields
 */
export const wrapSuppressedAlerts = ({
  events,
  spaceId,
  completeRule,
  mergeStrategy,
  indicesToQuery,
  buildReasonMessage,
  alertTimestampOverride,
  ruleExecutionLogger,
  publicBaseUrl,
  primaryTimestamp,
  secondaryTimestamp,
  intendedTimestamp,
}: {
  events: SignalSourceHit[];
  spaceId: string;
  completeRule: CompleteRule<RuleWithInMemorySuppression>;
  mergeStrategy: ConfigType['alertMergeStrategy'];
  indicesToQuery: string[];
  buildReasonMessage: BuildReasonMessage;
  alertTimestampOverride: Date | undefined;
  ruleExecutionLogger: IRuleExecutionLogForExecutors;
  publicBaseUrl: string | undefined;
  primaryTimestamp: string;
  secondaryTimestamp?: string;
  intendedTimestamp: Date | undefined;
}): Array<WrappedFieldsLatest<BaseFieldsLatest & SuppressionFieldsLatest>> => {
  return events.map((event) => {
    const suppressionTerms = getSuppressionTerms({
      alertSuppression: completeRule?.ruleParams?.alertSuppression,
      fields: event.fields,
    });

    const id = generateId(
      event._index,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      event._id!,
      String(event._version),
      `${spaceId}:${completeRule.alertId}`
    );

    const instanceId = objectHash([suppressionTerms, completeRule.alertId, spaceId]);

    const baseAlert: BaseFieldsLatest = transformHitToAlert({
      spaceId,
      completeRule,
      doc: event,
      mergeStrategy,
      ignoreFields: {},
      ignoreFieldsRegexes: [],
      applyOverrides: true,
      buildReasonMessage,
      indicesToQuery,
      alertTimestampOverride,
      ruleExecutionLogger,
      alertUuid: id,
      publicBaseUrl,
      intendedTimestamp,
    });

    return {
      _id: id,
      _index: '',
      _source: {
        ...baseAlert,
        ...getSuppressionAlertFields({
          primaryTimestamp,
          secondaryTimestamp,
          fields: event.fields,
          suppressionTerms,
          fallbackTimestamp: baseAlert[TIMESTAMP],
          instanceId,
        }),
      },
    };
  });
};

/**
 * wraps suppressed alerts
 * creates instanceId hash, which is used to search on time interval alerts
 * populates alert's suppression fields
 */
export const wrapSuppressedSequenceAlerts = ({
  sequences,
  spaceId,
  completeRule,
  mergeStrategy,
  indicesToQuery,
  buildReasonMessage,
  alertTimestampOverride,
  ruleExecutionLogger,
  publicBaseUrl,
  primaryTimestamp,
  secondaryTimestamp,
}: {
  sequences: Array<EqlHitsSequence<SignalSource>>;
  spaceId: string;
  completeRule: CompleteRule<RuleWithInMemorySuppression>;
  mergeStrategy: ConfigType['alertMergeStrategy'];
  indicesToQuery: string[];
  buildReasonMessage: BuildReasonMessage;
  alertTimestampOverride: Date | undefined;
  ruleExecutionLogger: IRuleExecutionLogForExecutors;
  publicBaseUrl: string | undefined;
  primaryTimestamp: string;
  secondaryTimestamp?: string;
}): Array<
  WrappedFieldsLatest<BaseFieldsLatest & SuppressionFieldsLatest> & {
    subAlerts: Array<WrappedFieldsLatest<BaseFieldsLatest & SuppressionFieldsLatest>>;
  }
> => {
  return sequences.reduce(
    (
      acc: Array<
        WrappedFieldsLatest<BaseFieldsLatest & SuppressionFieldsLatest> & {
          subAlerts: Array<WrappedFieldsLatest<BaseFieldsLatest & SuppressionFieldsLatest>>;
        }
      >,
      sequence
    ) => {
      const alertGroupFromSequence = buildAlertGroupFromSequence({
        ruleExecutionLogger,
        sequence,
        completeRule,
        mergeStrategy,
        spaceId,
        buildReasonMessage,
        indicesToQuery,
        alertTimestampOverride,
        applyOverrides: true,
        publicBaseUrl,
      });
      const shellAlert = alertGroupFromSequence[0];
      if (!isEqlShellAlert(shellAlert)) {
        return [...acc];
      }
      const buildingBlocks = alertGroupFromSequence.slice(1) as Array<
        WrappedFieldsLatest<EqlBuildingBlockFieldsLatest>
      >;
      const suppressionTerms = getSuppressionTerms({
        alertSuppression: completeRule?.ruleParams?.alertSuppression,
        fields: shellAlert?._source,
      });
      const instanceId = objectHash([suppressionTerms, completeRule.alertId, spaceId]);

      const suppressionFields = getSuppressionAlertFields({
        primaryTimestamp,
        secondaryTimestamp,
        // as casting should work because the alert fields are flattened (hopefully?)
        fields: shellAlert?._source as Record<string, string | number | null> | undefined,
        suppressionTerms,
        fallbackTimestamp: alertTimestampOverride?.toISOString() ?? new Date().toISOString(),
        instanceId,
      });
      const theFields = Object.keys(suppressionFields) as Array<keyof ExtraFieldsForShellAlert>;
      // mutates shell alert to contain values from suppression fields
      theFields.forEach((field) => (shellAlert._source[field] = suppressionFields[field]));
      shellAlert.subAlerts = buildingBlocks;

      return [...acc, shellAlert] as Array<
        WrappedFieldsLatest<BaseFieldsLatest & SuppressionFieldsLatest> & {
          subAlerts: Array<WrappedFieldsLatest<BaseFieldsLatest & SuppressionFieldsLatest>>;
        }
      >;
    },
    [] as Array<
      WrappedFieldsLatest<BaseFieldsLatest & SuppressionFieldsLatest> & {
        subAlerts: Array<WrappedFieldsLatest<BaseFieldsLatest & SuppressionFieldsLatest>>;
      }
    >
  );
};
