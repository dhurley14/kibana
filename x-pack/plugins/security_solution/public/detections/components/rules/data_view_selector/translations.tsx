/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';

export const PICK_INDEX_PATTERNS = i18n.translate(
  'xpack.securitySolution.detectionEngine.stepDefineRule.pickDataView',
  {
    defaultMessage: 'Select a Data View',
  }
);

export const ADVANCED_SETTING_WARNING_LABEL = i18n.translate(
  'xpack.securitySolution.detectionEngine.stepDefineRule.dataViewsSettingWarningLabel',
  {
    defaultMessage: 'Option not available',
  }
);

export const ADVANCED_SETTING_WARNING = i18n.translate(
  'xpack.securitySolution.detectionEngine.stepDefineRule.dataViewsSettingWarningDescription',
  {
    defaultMessage:
      'The `securitySolution:strictlyUseRuleIndexPatterns` setting is set to `true` disallowing the use of data views for rules.',
  }
);
