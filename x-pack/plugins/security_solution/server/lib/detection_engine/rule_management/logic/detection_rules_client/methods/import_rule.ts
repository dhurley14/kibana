/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { partition } from 'lodash';
import type { RulesClient } from '@kbn/alerting-plugin/server';
import type { ActionsClient } from '@kbn/actions-plugin/server';

import type { MlAuthz } from '../../../../../machine_learning/authz';
import type { ImportRuleArgs } from '../detection_rules_client_interface';
import type { RuleAlertType, RuleParams } from '../../../../rule_schema';
import { createBulkErrorObject } from '../../../../routes/utils';
import {
  convertCreateAPIToInternalSchema,
  convertUpdateAPIToInternalSchema,
} from '../../../normalization/rule_converters';

import { validateMlAuth } from '../utils';

import { readRules } from '../read_rules';

export const importRule = async (
  actionsClient: ActionsClient,
  rulesClient: RulesClient,
  importRulePayload: ImportRuleArgs,
  mlAuthz: MlAuthz
): Promise<RuleAlertType> => {
  const { ruleToImport, overwriteRules, allowMissingConnectorSecrets } = importRulePayload;
  console.error('RULE TO IMPORT', JSON.stringify(ruleToImport));

  await validateMlAuth(mlAuthz, ruleToImport.type);

  const existingRule = await readRules({
    rulesClient,
    ruleId: ruleToImport.rule_id,
    id: undefined,
  });

  if (!existingRule) {
    const [oldActions, systemActions] = partition(ruleToImport.actions, (action) =>
      actionsClient.isSystemAction(action.action_type_id)
    );

    console.error('OLD ACTIONS', oldActions);
    console.error('sys actions 1', systemActions);

    const internalRule = convertCreateAPIToInternalSchema(
      {
        ...ruleToImport,
        actions: oldActions,
        systemActions,
      },
      { immutable: false }
    );

    return rulesClient.create<RuleParams>({
      data: internalRule,
      allowMissingConnectorSecrets,
    });
  } else if (existingRule && overwriteRules) {
    const newInternalRule = convertUpdateAPIToInternalSchema({
      existingRule,
      ruleUpdate: ruleToImport,
    });

    return rulesClient.update({
      id: existingRule.id,
      data: newInternalRule,
    });
  } else {
    throw createBulkErrorObject({
      ruleId: existingRule.params.ruleId,
      statusCode: 409,
      message: `rule_id: "${existingRule.params.ruleId}" already exists`,
    });
  }
};
