/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { loggingSystemMock } from 'src/core/server/mocks';
import { alertsMock, AlertServicesMock } from '../../../../../../alerting/server/mocks';
import { RuleStatusService } from '../rule_status_service';
import { thresholdExecutor } from './threshold';
import { getExceptionListItemSchemaMock } from '../../../../../../lists/common/schemas/response/exception_list_item_schema.mock';
import { getEntryListMock } from '../../../../../../lists/common/schemas/types/entry_list.mock';
import { getThresholdRuleParams } from '../../schemas/rule_schemas.mock';
import { buildRuleMessageFactory } from '../rule_messages';

describe('threshold_executor', () => {
  const version = '8.0.0';
  let logger: ReturnType<typeof loggingSystemMock.createLogger>;
  let alertServices: AlertServicesMock;
  let ruleStatusService: Record<string, jest.Mock>;
  const thresholdSO = {
    id: '04128c15-0d1b-4716-a4c5-46997ac7f3bd',
    type: 'alert',
    version: '1',
    updated_at: '2020-03-27T22:55:59.577Z',
    attributes: {
      actions: [],
      enabled: true,
      name: 'rule-name',
      consumer: 'siem',
      tags: ['some fake tag 1', 'some fake tag 2'],
      createdBy: 'sample user',
      createdAt: '2020-03-27T22:55:59.577Z',
      updatedBy: 'sample user',
      schedule: {
        interval: '5m',
      },
      throttle: 'no_actions',
      params: getThresholdRuleParams(),
    },
    references: [],
  };
  const buildRuleMessage = buildRuleMessageFactory({
    id: thresholdSO.id,
    ruleId: thresholdSO.attributes.params.ruleId,
    name: thresholdSO.attributes.name,
    index: thresholdSO.attributes.params.outputIndex,
  });

  beforeEach(() => {
    alertServices = alertsMock.createAlertServices();
    logger = loggingSystemMock.createLogger();
    ruleStatusService = {
      success: jest.fn(),
      find: jest.fn(),
      goingToRun: jest.fn(),
      error: jest.fn(),
      partialFailure: jest.fn(),
    };
  });

  describe('thresholdExecutor', () => {
    it('should set a warning when exception list for threshold rule contains value list exceptions', async () => {
      const exceptionItems = [getExceptionListItemSchemaMock({ entries: [getEntryListMock()] })];
      await thresholdExecutor({
        rule: thresholdSO,
        tuples: [],
        exceptionItems,
        ruleStatusService: (ruleStatusService as unknown) as RuleStatusService,
        services: alertServices,
        version,
        logger,
        refresh: false,
        buildRuleMessage,
        startedAt: new Date(),
      });
      expect(ruleStatusService.partialFailure).toHaveBeenCalled();
      expect(ruleStatusService.partialFailure.mock.calls[0][0]).toContain(
        'Exceptions that use "is in list" or "is not in list" operators are not applied to Threshold rules'
      );
    });
  });
});
