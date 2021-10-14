/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/* eslint-disable complexity */

import { DEFAULT_MAX_SIGNALS } from '../../../../common/constants';
import { transformRuleToAlertAction } from '../../../../common/detection_engine/transform_actions';
import { PartialAlert } from '../../../../../alerting/server';
import { readRules } from './read_rules';
import { UpdateRulesOptions } from './types';
import { addTags } from './add_tags';
import { typeSpecificSnakeToCamel } from '../schemas/rule_converters';
import { RuleParams } from '../schemas/rule_schemas';
import { enableRule } from './enable_rule';
import { maybeMute, transformToAlertThrottle, transformToNotifyWhen } from './utils';
// eslint-disable-next-line no-restricted-imports
import { legacyRuleActionsSavedObjectType } from '../rule_actions/legacy_saved_object_mappings';

export const updateRules = async ({
  isRuleRegistryEnabled,
  spaceId,
  rulesClient,
  ruleStatusClient,
  defaultOutputIndex,
  ruleUpdate,
  savedObjectsClient,
}: UpdateRulesOptions): Promise<PartialAlert<RuleParams> | null> => {
  const existingRule = await readRules({
    isRuleRegistryEnabled,
    rulesClient,
    ruleId: ruleUpdate.rule_id,
    id: ruleUpdate.id,
  });
  if (existingRule == null) {
    return null;
  }

  /**
   * On update / patch I'm going to take the actions as they are, better off taking rules client.find (siem.notification) result
   * and putting that into the actions array of the rule, then set the rules onThrottle property, notifyWhen and throttle from null -> actualy value (1hr etc..)
   * Then use the rules client to delete the siem.notification
   * Then with the legacy Rule Actions saved object type, just delete it.
   */

  // find it using the references array, not params.ruleAlertId
  let migratedRule = false;
  if (existingRule != null) {
    const siemNotification = await rulesClient.find({
      options: {
        hasReference: {
          type: 'alert',
          id: existingRule.id,
        },
      },
    });

    await rulesClient.delete({ id: siemNotification.data[0].id });

    const thing2 = await savedObjectsClient.find({ type: legacyRuleActionsSavedObjectType });

    console.error(
      'DID WE FIND THE SIEM NOTIFICATION FOR THIS ALERT?',
      JSON.stringify(siemNotification, null, 2)
    );

    console.error('RULE SIDE CAR', JSON.stringify(thing2, null, 2));

    if (existingRule?.actions != null) {
      existingRule.actions = siemNotification.data[0].actions;
      existingRule.throttle = siemNotification.data[0].schedule.interval;
      existingRule.notifyWhen = transformToNotifyWhen(siemNotification.data[0].throttle);
      migratedRule = true;
    }
  }

  const typeSpecificParams = typeSpecificSnakeToCamel(ruleUpdate);
  const enabled = ruleUpdate.enabled ?? true;
  const newInternalRule = {
    name: ruleUpdate.name,
    tags: addTags(ruleUpdate.tags ?? [], existingRule.params.ruleId, existingRule.params.immutable),
    params: {
      author: ruleUpdate.author ?? [],
      buildingBlockType: ruleUpdate.building_block_type,
      description: ruleUpdate.description,
      ruleId: existingRule.params.ruleId,
      falsePositives: ruleUpdate.false_positives ?? [],
      from: ruleUpdate.from ?? 'now-6m',
      // Unlike the create route, immutable comes from the existing rule here
      immutable: existingRule.params.immutable,
      license: ruleUpdate.license,
      outputIndex: ruleUpdate.output_index ?? defaultOutputIndex,
      timelineId: ruleUpdate.timeline_id,
      timelineTitle: ruleUpdate.timeline_title,
      meta: ruleUpdate.meta,
      maxSignals: ruleUpdate.max_signals ?? DEFAULT_MAX_SIGNALS,
      riskScore: ruleUpdate.risk_score,
      riskScoreMapping: ruleUpdate.risk_score_mapping ?? [],
      ruleNameOverride: ruleUpdate.rule_name_override,
      severity: ruleUpdate.severity,
      severityMapping: ruleUpdate.severity_mapping ?? [],
      threat: ruleUpdate.threat ?? [],
      timestampOverride: ruleUpdate.timestamp_override,
      to: ruleUpdate.to ?? 'now',
      references: ruleUpdate.references ?? [],
      namespace: ruleUpdate.namespace,
      note: ruleUpdate.note,
      // Always use the version from the request if specified. If it isn't specified, leave immutable rules alone and
      // increment the version of mutable rules by 1.
      version:
        ruleUpdate.version ?? existingRule.params.immutable
          ? existingRule.params.version
          : existingRule.params.version + 1,
      exceptionsList: ruleUpdate.exceptions_list ?? [],
      ...typeSpecificParams,
    },
    schedule: { interval: ruleUpdate.interval ?? '5m' },
    actions: migratedRule
      ? existingRule.actions
      : ruleUpdate.actions != null
      ? ruleUpdate.actions.map(transformRuleToAlertAction)
      : [],
    throttle: migratedRule ? existingRule.throttle : transformToAlertThrottle(ruleUpdate.throttle),
    notifyWhen: migratedRule ? existingRule.notifyWhen : transformToNotifyWhen(ruleUpdate.throttle),
  };

  const update = await rulesClient.update({
    id: existingRule.id,
    data: newInternalRule,
  });

  await maybeMute({
    rulesClient,
    muteAll: existingRule.muteAll,
    throttle: ruleUpdate.throttle,
    id: update.id,
  });

  if (existingRule.enabled && enabled === false) {
    await rulesClient.disable({ id: existingRule.id });
  } else if (!existingRule.enabled && enabled === true) {
    await enableRule({ rule: existingRule, rulesClient, ruleStatusClient, spaceId });
  }
  return { ...update, enabled };
};
