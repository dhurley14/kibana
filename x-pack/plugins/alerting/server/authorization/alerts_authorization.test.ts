/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { KibanaRequest } from 'kibana/server';
import { alertTypeRegistryMock } from '../alert_type_registry.mock';
import { securityMock } from '../../../../plugins/security/server/mocks';
import {
  PluginStartContract as FeaturesStartContract,
  KibanaFeature,
} from '../../../features/server';
import { featuresPluginMock } from '../../../features/server/mocks';
import {
  AlertsAuthorization,
  WriteOperations,
  ReadOperations,
  AlertingAuthorizationTypes,
} from './alerts_authorization';
import { alertsAuthorizationAuditLoggerMock } from './audit_logger.mock';
import { AlertsAuthorizationAuditLogger, AuthorizationResult } from './audit_logger';
import uuid from 'uuid';
import { RecoveredActionGroup } from '../../common';
import { RegistryAlertType } from '../alert_type_registry';
import { esKuery } from '../../../../../src/plugins/data/server';
import { AlertingAuthorizationFilterType } from './alerts_authorization_kuery';

const alertTypeRegistry = alertTypeRegistryMock.create();
const features: jest.Mocked<FeaturesStartContract> = featuresPluginMock.createStart();
const request = {} as KibanaRequest;

const auditLogger = alertsAuthorizationAuditLoggerMock.create();
const realAuditLogger = new AlertsAuthorizationAuditLogger();

const getSpace = jest.fn();

const exemptConsumerIds: string[] = [];

const mockAuthorizationAction = (
  type: string,
  app: string,
  alertingType: string,
  operation: string
) => `${type}/${app}/${alertingType}/${operation}`;
function mockSecurity() {
  const security = securityMock.createSetup();
  const authorization = security.authz;
  // typescript is having trouble inferring jest's automocking
  (authorization.actions.alerting.get as jest.MockedFunction<
    typeof authorization.actions.alerting.get
  >).mockImplementation(mockAuthorizationAction);
  authorization.mode.useRbacForRequest.mockReturnValue(true);
  return { authorization };
}

function mockFeature(appName: string, typeName?: string) {
  return new KibanaFeature({
    id: appName,
    name: appName,
    app: [],
    category: { id: 'foo', label: 'foo' },
    ...(typeName
      ? {
          alerting: [typeName],
        }
      : {}),
    privileges: {
      all: {
        ...(typeName
          ? {
              alerting: {
                all: [typeName],
              },
            }
          : {}),
        savedObject: {
          all: [],
          read: [],
        },
        ui: [],
      },
      read: {
        ...(typeName
          ? {
              alerting: {
                read: [typeName],
              },
            }
          : {}),
        savedObject: {
          all: [],
          read: [],
        },
        ui: [],
      },
    },
  });
}

function mockFeatureWithSubFeature(appName: string, typeName: string) {
  return new KibanaFeature({
    id: appName,
    name: appName,
    app: [],
    category: { id: 'foo', label: 'foo' },
    ...(typeName
      ? {
          alerting: [typeName],
        }
      : {}),
    privileges: {
      all: {
        savedObject: {
          all: [],
          read: [],
        },
        ui: [],
      },
      read: {
        savedObject: {
          all: [],
          read: [],
        },
        ui: [],
      },
    },
    subFeatures: [
      {
        name: appName,
        privilegeGroups: [
          {
            groupType: 'independent',
            privileges: [
              {
                id: 'doSomethingAlertRelated',
                name: 'sub feature alert',
                includeIn: 'all',
                alerting: {
                  all: [typeName],
                },
                savedObject: {
                  all: [],
                  read: [],
                },
                ui: ['doSomethingAlertRelated'],
              },
              {
                id: 'doSomethingAlertRelated',
                name: 'sub feature alert',
                includeIn: 'read',
                alerting: {
                  read: [typeName],
                },
                savedObject: {
                  all: [],
                  read: [],
                },
                ui: ['doSomethingAlertRelated'],
              },
            ],
          },
        ],
      },
    ],
  });
}

const myAppFeature = mockFeature('myApp', 'myType');
const myOtherAppFeature = mockFeature('myOtherApp', 'myType');
const myAppWithSubFeature = mockFeatureWithSubFeature('myAppWithSubFeature', 'myType');
const myFeatureWithoutAlerting = mockFeature('myOtherApp');

beforeEach(() => {
  jest.resetAllMocks();
  auditLogger.alertsAuthorizationFailure.mockImplementation((username, ...args) =>
    realAuditLogger.getAuthorizationMessage(AuthorizationResult.Unauthorized, ...args)
  );
  auditLogger.alertsAuthorizationSuccess.mockImplementation((username, ...args) =>
    realAuditLogger.getAuthorizationMessage(AuthorizationResult.Authorized, ...args)
  );
  auditLogger.alertsUnscopedAuthorizationFailure.mockImplementation(
    (username, operation) => `Unauthorized ${username}/${operation}`
  );
  alertTypeRegistry.get.mockImplementation((id) => ({
    id,
    name: 'My Alert Type',
    actionGroups: [{ id: 'default', name: 'Default' }],
    defaultActionGroupId: 'default',
    minimumLicenseRequired: 'basic',
    recoveryActionGroup: RecoveredActionGroup,
    async executor() {},
    producer: 'myApp',
  }));
  features.getKibanaFeatures.mockReturnValue([
    myAppFeature,
    myOtherAppFeature,
    myAppWithSubFeature,
    myFeatureWithoutAlerting,
  ]);
  getSpace.mockResolvedValue(undefined);
});

describe('AlertsAuthorization', () => {
  describe('constructor', () => {
    test(`fetches the user's current space`, async () => {
      const space = {
        id: uuid.v4(),
        name: uuid.v4(),
        disabledFeatures: [],
      };
      getSpace.mockResolvedValue(space);

      new AlertsAuthorization({
        request,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds,
      });

      expect(getSpace).toHaveBeenCalledWith(request);
    });
  });

  describe('ensureAuthorized', () => {
    test('is a no-op when there is no authorization api', async () => {
      const alertAuthorization = new AlertsAuthorization({
        request,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds,
      });

      await alertAuthorization.ensureAuthorized({
        ruleTypeId: 'myType',
        consumer: 'myApp',
        operation: WriteOperations.Create,
        authorizationType: AlertingAuthorizationTypes.Rule,
      });

      expect(alertTypeRegistry.get).toHaveBeenCalledTimes(0);
    });

    test('is a no-op when the security license is disabled', async () => {
      const { authorization } = mockSecurity();
      authorization.mode.useRbacForRequest.mockReturnValue(false);
      const alertAuthorization = new AlertsAuthorization({
        request,
        alertTypeRegistry,
        authorization,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds,
      });

      await alertAuthorization.ensureAuthorized({
        ruleTypeId: 'myType',
        consumer: 'myApp',
        operation: WriteOperations.Create,
        authorizationType: AlertingAuthorizationTypes.Rule,
      });

      expect(alertTypeRegistry.get).toHaveBeenCalledTimes(0);
    });

    test('ensures the user has privileges to execute the specified rule type, operation and alerting type without consumer when producer and consumer are the same', async () => {
      const { authorization } = mockSecurity();
      const checkPrivileges: jest.MockedFunction<
        ReturnType<typeof authorization.checkPrivilegesDynamicallyWithRequest>
      > = jest.fn();
      authorization.checkPrivilegesDynamicallyWithRequest.mockReturnValue(checkPrivileges);
      const alertAuthorization = new AlertsAuthorization({
        request,
        authorization,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds,
      });

      checkPrivileges.mockResolvedValueOnce({
        username: 'some-user',
        hasAllRequested: true,
        privileges: { kibana: [] },
      });

      await alertAuthorization.ensureAuthorized({
        ruleTypeId: 'myType',
        consumer: 'myApp',
        operation: WriteOperations.Create,
        authorizationType: AlertingAuthorizationTypes.Rule,
      });

      expect(alertTypeRegistry.get).toHaveBeenCalledWith('myType');

      expect(authorization.actions.alerting.get).toHaveBeenCalledTimes(2);
      expect(authorization.actions.alerting.get).toHaveBeenCalledWith(
        'myType',
        'myApp',
        'rule',
        'create'
      );
      expect(checkPrivileges).toHaveBeenCalledWith({
        kibana: [mockAuthorizationAction('myType', 'myApp', 'rule', 'create')],
      });

      expect(auditLogger.alertsAuthorizationSuccess).toHaveBeenCalledTimes(1);
      expect(auditLogger.alertsAuthorizationFailure).not.toHaveBeenCalled();
      expect(auditLogger.alertsAuthorizationSuccess.mock.calls[0]).toMatchInlineSnapshot(`
          Array [
            "some-user",
            "myType",
            0,
            "myApp",
            "create",
            "rule",
          ]
        `);
    });

    test('ensures the user has privileges to execute the specified rule type, operation and alerting type without consumer when consumer is exempt', async () => {
      const { authorization } = mockSecurity();
      const checkPrivileges: jest.MockedFunction<
        ReturnType<typeof authorization.checkPrivilegesDynamicallyWithRequest>
      > = jest.fn();
      authorization.checkPrivilegesDynamicallyWithRequest.mockReturnValue(checkPrivileges);
      const alertAuthorization = new AlertsAuthorization({
        request,
        authorization,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds: ['exemptConsumer'],
      });

      checkPrivileges.mockResolvedValueOnce({
        username: 'some-user',
        hasAllRequested: true,
        privileges: { kibana: [] },
      });

      await alertAuthorization.ensureAuthorized({
        ruleTypeId: 'myType',
        consumer: 'exemptConsumer',
        operation: WriteOperations.Create,
        authorizationType: AlertingAuthorizationTypes.Rule,
      });

      expect(alertTypeRegistry.get).toHaveBeenCalledWith('myType');

      expect(authorization.actions.alerting.get).toHaveBeenCalledTimes(2);
      expect(authorization.actions.alerting.get).toHaveBeenCalledWith(
        'myType',
        'exemptConsumer',
        'rule',
        'create'
      );
      expect(authorization.actions.alerting.get).toHaveBeenCalledWith(
        'myType',
        'myApp',
        'rule',
        'create'
      );
      expect(checkPrivileges).toHaveBeenCalledWith({
        kibana: [mockAuthorizationAction('myType', 'myApp', 'rule', 'create')],
      });

      expect(auditLogger.alertsAuthorizationSuccess).toHaveBeenCalledTimes(1);
      expect(auditLogger.alertsAuthorizationFailure).not.toHaveBeenCalled();
      expect(auditLogger.alertsAuthorizationSuccess.mock.calls[0]).toMatchInlineSnapshot(`
          Array [
            "some-user",
            "myType",
            0,
            "exemptConsumer",
            "create",
            "rule",
          ]
        `);
    });

    test('ensures the user has privileges to execute the specified rule type, operation, alerting type and producer when producer is different from consumer', async () => {
      const { authorization } = mockSecurity();
      const checkPrivileges: jest.MockedFunction<
        ReturnType<typeof authorization.checkPrivilegesDynamicallyWithRequest>
      > = jest.fn();
      authorization.checkPrivilegesDynamicallyWithRequest.mockReturnValue(checkPrivileges);
      checkPrivileges.mockResolvedValueOnce({
        username: 'some-user',
        hasAllRequested: true,
        privileges: { kibana: [] },
      });

      const alertAuthorization = new AlertsAuthorization({
        request,
        authorization,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds,
      });

      await alertAuthorization.ensureAuthorized({
        ruleTypeId: 'myType',
        consumer: 'myOtherApp',
        operation: WriteOperations.Create,
        authorizationType: AlertingAuthorizationTypes.Rule,
      });

      expect(alertTypeRegistry.get).toHaveBeenCalledWith('myType');

      expect(authorization.actions.alerting.get).toHaveBeenCalledTimes(2);
      expect(authorization.actions.alerting.get).toHaveBeenCalledWith(
        'myType',
        'myApp',
        'rule',
        'create'
      );
      expect(authorization.actions.alerting.get).toHaveBeenCalledWith(
        'myType',
        'myOtherApp',
        'rule',
        'create'
      );
      expect(checkPrivileges).toHaveBeenCalledWith({
        kibana: [
          mockAuthorizationAction('myType', 'myOtherApp', 'rule', 'create'),
          mockAuthorizationAction('myType', 'myApp', 'rule', 'create'),
        ],
      });

      expect(auditLogger.alertsAuthorizationSuccess).toHaveBeenCalledTimes(1);
      expect(auditLogger.alertsAuthorizationFailure).not.toHaveBeenCalled();
      expect(auditLogger.alertsAuthorizationSuccess.mock.calls[0]).toMatchInlineSnapshot(`
          Array [
            "some-user",
            "myType",
            0,
            "myOtherApp",
            "create",
            "rule",
          ]
        `);
    });

    test('throws if user lacks the required privileges for the consumer', async () => {
      const { authorization } = mockSecurity();
      const checkPrivileges: jest.MockedFunction<
        ReturnType<typeof authorization.checkPrivilegesDynamicallyWithRequest>
      > = jest.fn();
      authorization.checkPrivilegesDynamicallyWithRequest.mockReturnValue(checkPrivileges);
      const alertAuthorization = new AlertsAuthorization({
        request,
        authorization,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds,
      });

      checkPrivileges.mockResolvedValueOnce({
        username: 'some-user',
        hasAllRequested: false,
        privileges: {
          kibana: [
            {
              privilege: mockAuthorizationAction('myType', 'myOtherApp', 'rule', 'create'),
              authorized: false,
            },
            {
              privilege: mockAuthorizationAction('myType', 'myApp', 'rule', 'create'),
              authorized: true,
            },
          ],
        },
      });

      await expect(
        alertAuthorization.ensureAuthorized({
          ruleTypeId: 'myType',
          consumer: 'myOtherApp',
          operation: WriteOperations.Create,
          authorizationType: AlertingAuthorizationTypes.Rule,
        })
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Unauthorized to create a \\"myType\\" rule for \\"myOtherApp\\""`
      );

      expect(auditLogger.alertsAuthorizationSuccess).not.toHaveBeenCalled();
      expect(auditLogger.alertsAuthorizationFailure).toHaveBeenCalledTimes(1);
      expect(auditLogger.alertsAuthorizationFailure.mock.calls[0]).toMatchInlineSnapshot(`
          Array [
            "some-user",
            "myType",
            0,
            "myOtherApp",
            "create",
            "rule",
          ]
        `);
    });

    test('throws if user lacks the required privieleges for the producer', async () => {
      const { authorization } = mockSecurity();
      const checkPrivileges: jest.MockedFunction<
        ReturnType<typeof authorization.checkPrivilegesDynamicallyWithRequest>
      > = jest.fn();
      authorization.checkPrivilegesDynamicallyWithRequest.mockReturnValue(checkPrivileges);
      const alertAuthorization = new AlertsAuthorization({
        request,
        authorization,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds,
      });

      checkPrivileges.mockResolvedValueOnce({
        username: 'some-user',
        hasAllRequested: false,
        privileges: {
          kibana: [
            {
              privilege: mockAuthorizationAction('myType', 'myOtherApp', 'alert', 'create'),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction('myType', 'myApp', 'alert', 'create'),
              authorized: false,
            },
          ],
        },
      });

      await expect(
        alertAuthorization.ensureAuthorized({
          ruleTypeId: 'myType',
          consumer: 'myOtherApp',
          operation: WriteOperations.Create,
          authorizationType: AlertingAuthorizationTypes.Alert,
        })
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Unauthorized to create a \\"myType\\" alert by \\"myApp\\""`
      );

      expect(auditLogger.alertsAuthorizationSuccess).not.toHaveBeenCalled();
      expect(auditLogger.alertsAuthorizationFailure).toHaveBeenCalledTimes(1);
      expect(auditLogger.alertsAuthorizationFailure.mock.calls[0]).toMatchInlineSnapshot(`
          Array [
            "some-user",
            "myType",
            1,
            "myApp",
            "create",
            "alert",
          ]
        `);
    });

    test('throws if user lacks the required privieleges for both consumer and producer', async () => {
      const { authorization } = mockSecurity();
      const checkPrivileges: jest.MockedFunction<
        ReturnType<typeof authorization.checkPrivilegesDynamicallyWithRequest>
      > = jest.fn();
      authorization.checkPrivilegesDynamicallyWithRequest.mockReturnValue(checkPrivileges);
      const alertAuthorization = new AlertsAuthorization({
        request,
        authorization,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds,
      });

      checkPrivileges.mockResolvedValueOnce({
        username: 'some-user',
        hasAllRequested: false,
        privileges: {
          kibana: [
            {
              privilege: mockAuthorizationAction('myType', 'myOtherApp', 'alert', 'create'),
              authorized: false,
            },
            {
              privilege: mockAuthorizationAction('myType', 'myApp', 'alert', 'create'),
              authorized: false,
            },
          ],
        },
      });

      await expect(
        alertAuthorization.ensureAuthorized({
          ruleTypeId: 'myType',
          consumer: 'myOtherApp',
          operation: WriteOperations.Create,
          authorizationType: AlertingAuthorizationTypes.Alert,
        })
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Unauthorized to create a \\"myType\\" alert for \\"myOtherApp\\""`
      );

      expect(auditLogger.alertsAuthorizationSuccess).not.toHaveBeenCalled();
      expect(auditLogger.alertsAuthorizationFailure).toHaveBeenCalledTimes(1);
      expect(auditLogger.alertsAuthorizationFailure.mock.calls[0]).toMatchInlineSnapshot(`
          Array [
            "some-user",
            "myType",
            0,
            "myOtherApp",
            "create",
            "alert",
          ]
        `);
    });
  });

  describe('getFindAuthorizationFilter', () => {
    const myOtherAppAlertType: RegistryAlertType = {
      actionGroups: [],
      actionVariables: undefined,
      defaultActionGroupId: 'default',
      minimumLicenseRequired: 'basic',
      recoveryActionGroup: RecoveredActionGroup,
      id: 'myOtherAppAlertType',
      name: 'myOtherAppAlertType',
      producer: 'alerts',
      enabledInLicense: true,
    };
    const myAppAlertType: RegistryAlertType = {
      actionGroups: [],
      actionVariables: undefined,
      defaultActionGroupId: 'default',
      minimumLicenseRequired: 'basic',
      recoveryActionGroup: RecoveredActionGroup,
      id: 'myAppAlertType',
      name: 'myAppAlertType',
      producer: 'myApp',
      enabledInLicense: true,
    };
    const mySecondAppAlertType: RegistryAlertType = {
      actionGroups: [],
      actionVariables: undefined,
      defaultActionGroupId: 'default',
      minimumLicenseRequired: 'basic',
      recoveryActionGroup: RecoveredActionGroup,
      id: 'mySecondAppAlertType',
      name: 'mySecondAppAlertType',
      producer: 'myApp',
      enabledInLicense: true,
    };
    const setOfAlertTypes = new Set([myAppAlertType, myOtherAppAlertType, mySecondAppAlertType]);

    test('omits filter when there is no authorization api', async () => {
      const alertAuthorization = new AlertsAuthorization({
        request,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds,
      });

      const {
        filter,
        ensureRuleTypeIsAuthorized,
      } = await alertAuthorization.getFindAuthorizationFilter(AlertingAuthorizationTypes.Rule, {
        type: AlertingAuthorizationFilterType.KQL,
        fieldNames: {
          ruleTypeId: 'ruleId',
          consumer: 'consumer',
        },
      });

      expect(() => ensureRuleTypeIsAuthorized('someMadeUpType', 'myApp', 'rule')).not.toThrow();

      expect(filter).toEqual(undefined);
    });

    test('ensureAlertTypeIsAuthorized is no-op when there is no authorization api', async () => {
      const alertAuthorization = new AlertsAuthorization({
        request,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds,
      });

      const { ensureRuleTypeIsAuthorized } = await alertAuthorization.getFindAuthorizationFilter(
        AlertingAuthorizationTypes.Rule,
        {
          type: AlertingAuthorizationFilterType.KQL,
          fieldNames: {
            ruleTypeId: 'ruleId',
            consumer: 'consumer',
          },
        }
      );

      ensureRuleTypeIsAuthorized('someMadeUpType', 'myApp', 'rule');

      expect(auditLogger.alertsAuthorizationSuccess).not.toHaveBeenCalled();
      expect(auditLogger.alertsAuthorizationFailure).not.toHaveBeenCalled();
    });

    test('creates a filter based on the privileged types', async () => {
      const { authorization } = mockSecurity();
      const checkPrivileges: jest.MockedFunction<
        ReturnType<typeof authorization.checkPrivilegesDynamicallyWithRequest>
      > = jest.fn();
      authorization.checkPrivilegesDynamicallyWithRequest.mockReturnValue(checkPrivileges);
      checkPrivileges.mockResolvedValueOnce({
        username: 'some-user',
        hasAllRequested: true,
        privileges: { kibana: [] },
      });

      const alertAuthorization = new AlertsAuthorization({
        request,
        authorization,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds,
      });
      alertTypeRegistry.list.mockReturnValue(setOfAlertTypes);

      expect(
        (
          await alertAuthorization.getFindAuthorizationFilter(AlertingAuthorizationTypes.Rule, {
            type: AlertingAuthorizationFilterType.KQL,
            fieldNames: {
              ruleTypeId: 'path.to.rule.id',
              consumer: 'consumer-field',
            },
          })
        ).filter
      ).toEqual(
        esKuery.fromKueryExpression(
          `((path.to.rule.id:myAppAlertType and consumer-field:(myApp or myOtherApp or myAppWithSubFeature)) or (path.to.rule.id:myOtherAppAlertType and consumer-field:(myApp or myOtherApp or myAppWithSubFeature)) or (path.to.rule.id:mySecondAppAlertType and consumer-field:(myApp or myOtherApp or myAppWithSubFeature)))`
        )
      );

      expect(auditLogger.alertsAuthorizationSuccess).not.toHaveBeenCalled();
    });

    test('creates an `ensureAlertTypeIsAuthorized` function which throws if type is unauthorized', async () => {
      const { authorization } = mockSecurity();
      const checkPrivileges: jest.MockedFunction<
        ReturnType<typeof authorization.checkPrivilegesDynamicallyWithRequest>
      > = jest.fn();
      authorization.checkPrivilegesDynamicallyWithRequest.mockReturnValue(checkPrivileges);
      checkPrivileges.mockResolvedValueOnce({
        username: 'some-user',
        hasAllRequested: false,
        privileges: {
          kibana: [
            {
              privilege: mockAuthorizationAction('myOtherAppAlertType', 'myApp', 'alert', 'find'),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction(
                'myOtherAppAlertType',
                'myOtherApp',
                'alert',
                'find'
              ),
              authorized: false,
            },
            {
              privilege: mockAuthorizationAction('myAppAlertType', 'myApp', 'alert', 'find'),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction('myAppAlertType', 'myOtherApp', 'alert', 'find'),
              authorized: false,
            },
          ],
        },
      });

      const alertAuthorization = new AlertsAuthorization({
        request,
        authorization,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds,
      });
      alertTypeRegistry.list.mockReturnValue(setOfAlertTypes);

      const { ensureRuleTypeIsAuthorized } = await alertAuthorization.getFindAuthorizationFilter(
        AlertingAuthorizationTypes.Alert,
        {
          type: AlertingAuthorizationFilterType.KQL,
          fieldNames: {
            ruleTypeId: 'ruleId',
            consumer: 'consumer',
          },
        }
      );
      expect(() => {
        ensureRuleTypeIsAuthorized('myAppAlertType', 'myOtherApp', 'alert');
      }).toThrowErrorMatchingInlineSnapshot(
        `"Unauthorized to find a \\"myAppAlertType\\" alert for \\"myOtherApp\\""`
      );

      expect(auditLogger.alertsAuthorizationSuccess).not.toHaveBeenCalled();
      expect(auditLogger.alertsAuthorizationFailure).toHaveBeenCalledTimes(1);
      expect(auditLogger.alertsAuthorizationFailure.mock.calls[0]).toMatchInlineSnapshot(`
          Array [
            "some-user",
            "myAppAlertType",
            0,
            "myOtherApp",
            "find",
            "alert",
          ]
        `);
    });

    test('creates an `ensureAlertTypeIsAuthorized` function which is no-op if type is authorized', async () => {
      const { authorization } = mockSecurity();
      const checkPrivileges: jest.MockedFunction<
        ReturnType<typeof authorization.checkPrivilegesDynamicallyWithRequest>
      > = jest.fn();
      authorization.checkPrivilegesDynamicallyWithRequest.mockReturnValue(checkPrivileges);
      checkPrivileges.mockResolvedValueOnce({
        username: 'some-user',
        hasAllRequested: false,
        privileges: {
          kibana: [
            {
              privilege: mockAuthorizationAction('myOtherAppAlertType', 'myApp', 'rule', 'find'),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction(
                'myOtherAppAlertType',
                'myOtherApp',
                'rule',
                'find'
              ),
              authorized: false,
            },
            {
              privilege: mockAuthorizationAction('myAppAlertType', 'myApp', 'rule', 'find'),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction('myAppAlertType', 'myOtherApp', 'rule', 'find'),
              authorized: true,
            },
          ],
        },
      });

      const alertAuthorization = new AlertsAuthorization({
        request,
        authorization,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds,
      });
      alertTypeRegistry.list.mockReturnValue(setOfAlertTypes);

      const { ensureRuleTypeIsAuthorized } = await alertAuthorization.getFindAuthorizationFilter(
        AlertingAuthorizationTypes.Rule,
        {
          type: AlertingAuthorizationFilterType.KQL,
          fieldNames: {
            ruleTypeId: 'ruleId',
            consumer: 'consumer',
          },
        }
      );
      expect(() => {
        ensureRuleTypeIsAuthorized('myAppAlertType', 'myOtherApp', 'rule');
      }).not.toThrow();

      expect(auditLogger.alertsAuthorizationSuccess).not.toHaveBeenCalled();
      expect(auditLogger.alertsAuthorizationFailure).not.toHaveBeenCalled();
    });

    test('creates an `logSuccessfulAuthorization` function which logs every authorized type', async () => {
      const { authorization } = mockSecurity();
      const checkPrivileges: jest.MockedFunction<
        ReturnType<typeof authorization.checkPrivilegesDynamicallyWithRequest>
      > = jest.fn();
      authorization.checkPrivilegesDynamicallyWithRequest.mockReturnValue(checkPrivileges);
      checkPrivileges.mockResolvedValueOnce({
        username: 'some-user',
        hasAllRequested: false,
        privileges: {
          kibana: [
            {
              privilege: mockAuthorizationAction('myOtherAppAlertType', 'myApp', 'rule', 'find'),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction(
                'myOtherAppAlertType',
                'myOtherApp',
                'rule',
                'find'
              ),
              authorized: false,
            },
            {
              privilege: mockAuthorizationAction('myAppAlertType', 'myApp', 'rule', 'find'),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction('myAppAlertType', 'myOtherApp', 'rule', 'find'),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction('mySecondAppAlertType', 'myApp', 'rule', 'find'),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction(
                'mySecondAppAlertType',
                'myOtherApp',
                'rule',
                'find'
              ),
              authorized: true,
            },
          ],
        },
      });

      const alertAuthorization = new AlertsAuthorization({
        request,
        authorization,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds,
      });
      alertTypeRegistry.list.mockReturnValue(setOfAlertTypes);

      const {
        ensureRuleTypeIsAuthorized,
        logSuccessfulAuthorization,
      } = await alertAuthorization.getFindAuthorizationFilter(AlertingAuthorizationTypes.Rule, {
        type: AlertingAuthorizationFilterType.KQL,
        fieldNames: {
          ruleTypeId: 'ruleId',
          consumer: 'consumer',
        },
      });
      expect(() => {
        ensureRuleTypeIsAuthorized('myAppAlertType', 'myOtherApp', 'rule');
        ensureRuleTypeIsAuthorized('mySecondAppAlertType', 'myOtherApp', 'rule');
        ensureRuleTypeIsAuthorized('myAppAlertType', 'myOtherApp', 'rule');
      }).not.toThrow();

      expect(auditLogger.alertsAuthorizationSuccess).not.toHaveBeenCalled();
      expect(auditLogger.alertsAuthorizationFailure).not.toHaveBeenCalled();

      logSuccessfulAuthorization();

      expect(auditLogger.alertsBulkAuthorizationSuccess).toHaveBeenCalledTimes(1);
      expect(auditLogger.alertsBulkAuthorizationSuccess.mock.calls[0]).toMatchInlineSnapshot(`
          Array [
            "some-user",
            Array [
              Array [
                "myAppAlertType",
                "myOtherApp",
              ],
              Array [
                "mySecondAppAlertType",
                "myOtherApp",
              ],
            ],
            0,
            "find",
            "rule",
          ]
        `);
    });
  });

  describe('filterByAlertTypeAuthorization', () => {
    const myOtherAppAlertType: RegistryAlertType = {
      actionGroups: [],
      actionVariables: undefined,
      defaultActionGroupId: 'default',
      minimumLicenseRequired: 'basic',
      recoveryActionGroup: RecoveredActionGroup,
      id: 'myOtherAppAlertType',
      name: 'myOtherAppAlertType',
      producer: 'myOtherApp',
      enabledInLicense: true,
    };
    const myAppAlertType: RegistryAlertType = {
      actionGroups: [],
      actionVariables: undefined,
      defaultActionGroupId: 'default',
      minimumLicenseRequired: 'basic',
      recoveryActionGroup: RecoveredActionGroup,
      id: 'myAppAlertType',
      name: 'myAppAlertType',
      producer: 'myApp',
      enabledInLicense: true,
    };
    const setOfAlertTypes = new Set([myAppAlertType, myOtherAppAlertType]);

    test('augments a list of types with all features when there is no authorization api', async () => {
      const alertAuthorization = new AlertsAuthorization({
        request,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds,
      });
      alertTypeRegistry.list.mockReturnValue(setOfAlertTypes);

      await expect(
        alertAuthorization.filterByRuleTypeAuthorization(
          new Set([myAppAlertType, myOtherAppAlertType]),
          [WriteOperations.Create],
          AlertingAuthorizationTypes.Rule
        )
      ).resolves.toMatchInlineSnapshot(`
              Set {
                Object {
                  "actionGroups": Array [],
                  "actionVariables": undefined,
                  "authorizedConsumers": Object {
                    "myApp": Object {
                      "all": true,
                      "read": true,
                    },
                    "myAppWithSubFeature": Object {
                      "all": true,
                      "read": true,
                    },
                    "myOtherApp": Object {
                      "all": true,
                      "read": true,
                    },
                  },
                  "defaultActionGroupId": "default",
                  "enabledInLicense": true,
                  "id": "myAppAlertType",
                  "minimumLicenseRequired": "basic",
                  "name": "myAppAlertType",
                  "producer": "myApp",
                  "recoveryActionGroup": Object {
                    "id": "recovered",
                    "name": "Recovered",
                  },
                },
                Object {
                  "actionGroups": Array [],
                  "actionVariables": undefined,
                  "authorizedConsumers": Object {
                    "myApp": Object {
                      "all": true,
                      "read": true,
                    },
                    "myAppWithSubFeature": Object {
                      "all": true,
                      "read": true,
                    },
                    "myOtherApp": Object {
                      "all": true,
                      "read": true,
                    },
                  },
                  "defaultActionGroupId": "default",
                  "enabledInLicense": true,
                  "id": "myOtherAppAlertType",
                  "minimumLicenseRequired": "basic",
                  "name": "myOtherAppAlertType",
                  "producer": "myOtherApp",
                  "recoveryActionGroup": Object {
                    "id": "recovered",
                    "name": "Recovered",
                  },
                },
              }
            `);
    });

    test('augments a list of types with all features and exempt consumer ids when there is no authorization api', async () => {
      const alertAuthorization = new AlertsAuthorization({
        request,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds: ['exemptConsumerA', 'exemptConsumerB'],
      });
      alertTypeRegistry.list.mockReturnValue(setOfAlertTypes);

      await expect(
        alertAuthorization.filterByRuleTypeAuthorization(
          new Set([myAppAlertType, myOtherAppAlertType]),
          [WriteOperations.Create],
          AlertingAuthorizationTypes.Rule
        )
      ).resolves.toMatchInlineSnapshot(`
              Set {
                Object {
                  "actionGroups": Array [],
                  "actionVariables": undefined,
                  "authorizedConsumers": Object {
                    "exemptConsumerA": Object {
                      "all": true,
                      "read": true,
                    },
                    "exemptConsumerB": Object {
                      "all": true,
                      "read": true,
                    },
                    "myApp": Object {
                      "all": true,
                      "read": true,
                    },
                    "myAppWithSubFeature": Object {
                      "all": true,
                      "read": true,
                    },
                    "myOtherApp": Object {
                      "all": true,
                      "read": true,
                    },
                  },
                  "defaultActionGroupId": "default",
                  "enabledInLicense": true,
                  "id": "myAppAlertType",
                  "minimumLicenseRequired": "basic",
                  "name": "myAppAlertType",
                  "producer": "myApp",
                  "recoveryActionGroup": Object {
                    "id": "recovered",
                    "name": "Recovered",
                  },
                },
                Object {
                  "actionGroups": Array [],
                  "actionVariables": undefined,
                  "authorizedConsumers": Object {
                    "exemptConsumerA": Object {
                      "all": true,
                      "read": true,
                    },
                    "exemptConsumerB": Object {
                      "all": true,
                      "read": true,
                    },
                    "myApp": Object {
                      "all": true,
                      "read": true,
                    },
                    "myAppWithSubFeature": Object {
                      "all": true,
                      "read": true,
                    },
                    "myOtherApp": Object {
                      "all": true,
                      "read": true,
                    },
                  },
                  "defaultActionGroupId": "default",
                  "enabledInLicense": true,
                  "id": "myOtherAppAlertType",
                  "minimumLicenseRequired": "basic",
                  "name": "myOtherAppAlertType",
                  "producer": "myOtherApp",
                  "recoveryActionGroup": Object {
                    "id": "recovered",
                    "name": "Recovered",
                  },
                },
              }
            `);
    });

    test('augments a list of types with consumers under which the operation is authorized', async () => {
      const { authorization } = mockSecurity();
      const checkPrivileges: jest.MockedFunction<
        ReturnType<typeof authorization.checkPrivilegesDynamicallyWithRequest>
      > = jest.fn();
      authorization.checkPrivilegesDynamicallyWithRequest.mockReturnValue(checkPrivileges);
      checkPrivileges.mockResolvedValueOnce({
        username: 'some-user',
        hasAllRequested: false,
        privileges: {
          kibana: [
            {
              privilege: mockAuthorizationAction('myOtherAppAlertType', 'myApp', 'rule', 'create'),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction(
                'myOtherAppAlertType',
                'myOtherApp',
                'rule',
                'create'
              ),
              authorized: false,
            },
            {
              privilege: mockAuthorizationAction('myAppAlertType', 'myApp', 'rule', 'create'),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction('myAppAlertType', 'myOtherApp', 'rule', 'create'),
              authorized: true,
            },
          ],
        },
      });

      const alertAuthorization = new AlertsAuthorization({
        request,
        authorization,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds,
      });
      alertTypeRegistry.list.mockReturnValue(setOfAlertTypes);

      await expect(
        alertAuthorization.filterByRuleTypeAuthorization(
          new Set([myAppAlertType, myOtherAppAlertType]),
          [WriteOperations.Create],
          AlertingAuthorizationTypes.Rule
        )
      ).resolves.toMatchInlineSnapshot(`
                Set {
                  Object {
                    "actionGroups": Array [],
                    "actionVariables": undefined,
                    "authorizedConsumers": Object {
                      "myApp": Object {
                        "all": true,
                        "read": true,
                      },
                    },
                    "defaultActionGroupId": "default",
                    "enabledInLicense": true,
                    "id": "myOtherAppAlertType",
                    "minimumLicenseRequired": "basic",
                    "name": "myOtherAppAlertType",
                    "producer": "myOtherApp",
                    "recoveryActionGroup": Object {
                      "id": "recovered",
                      "name": "Recovered",
                    },
                  },
                  Object {
                    "actionGroups": Array [],
                    "actionVariables": undefined,
                    "authorizedConsumers": Object {
                      "myApp": Object {
                        "all": true,
                        "read": true,
                      },
                      "myOtherApp": Object {
                        "all": true,
                        "read": true,
                      },
                    },
                    "defaultActionGroupId": "default",
                    "enabledInLicense": true,
                    "id": "myAppAlertType",
                    "minimumLicenseRequired": "basic",
                    "name": "myAppAlertType",
                    "producer": "myApp",
                    "recoveryActionGroup": Object {
                      "id": "recovered",
                      "name": "Recovered",
                    },
                  },
                }
              `);
    });

    test('augments a list of types with consumers and exempt consumer ids under which the operation is authorized', async () => {
      const { authorization } = mockSecurity();
      const checkPrivileges: jest.MockedFunction<
        ReturnType<typeof authorization.checkPrivilegesDynamicallyWithRequest>
      > = jest.fn();
      authorization.checkPrivilegesDynamicallyWithRequest.mockReturnValue(checkPrivileges);
      checkPrivileges.mockResolvedValueOnce({
        username: 'some-user',
        hasAllRequested: false,
        privileges: {
          kibana: [
            {
              privilege: mockAuthorizationAction('myOtherAppAlertType', 'myApp', 'rule', 'create'),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction(
                'myOtherAppAlertType',
                'myOtherApp',
                'rule',
                'create'
              ),
              authorized: false,
            },
            {
              privilege: mockAuthorizationAction('myAppAlertType', 'myApp', 'rule', 'create'),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction('myAppAlertType', 'myOtherApp', 'rule', 'create'),
              authorized: true,
            },
          ],
        },
      });

      const alertAuthorization = new AlertsAuthorization({
        request,
        authorization,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds: ['exemptConsumerA'],
      });
      alertTypeRegistry.list.mockReturnValue(setOfAlertTypes);

      await expect(
        alertAuthorization.filterByRuleTypeAuthorization(
          new Set([myAppAlertType, myOtherAppAlertType]),
          [WriteOperations.Create],
          AlertingAuthorizationTypes.Rule
        )
      ).resolves.toMatchInlineSnapshot(`
                Set {
                  Object {
                    "actionGroups": Array [],
                    "actionVariables": undefined,
                    "authorizedConsumers": Object {
                      "myApp": Object {
                        "all": true,
                        "read": true,
                      },
                    },
                    "defaultActionGroupId": "default",
                    "enabledInLicense": true,
                    "id": "myOtherAppAlertType",
                    "minimumLicenseRequired": "basic",
                    "name": "myOtherAppAlertType",
                    "producer": "myOtherApp",
                    "recoveryActionGroup": Object {
                      "id": "recovered",
                      "name": "Recovered",
                    },
                  },
                  Object {
                    "actionGroups": Array [],
                    "actionVariables": undefined,
                    "authorizedConsumers": Object {
                      "exemptConsumerA": Object {
                        "all": true,
                        "read": true,
                      },
                      "myApp": Object {
                        "all": true,
                        "read": true,
                      },
                      "myOtherApp": Object {
                        "all": true,
                        "read": true,
                      },
                    },
                    "defaultActionGroupId": "default",
                    "enabledInLicense": true,
                    "id": "myAppAlertType",
                    "minimumLicenseRequired": "basic",
                    "name": "myAppAlertType",
                    "producer": "myApp",
                    "recoveryActionGroup": Object {
                      "id": "recovered",
                      "name": "Recovered",
                    },
                  },
                }
              `);
    });

    test('authorizes user under exempt consumers when they are authorized by the producer', async () => {
      const { authorization } = mockSecurity();
      const checkPrivileges: jest.MockedFunction<
        ReturnType<typeof authorization.checkPrivilegesDynamicallyWithRequest>
      > = jest.fn();
      authorization.checkPrivilegesDynamicallyWithRequest.mockReturnValue(checkPrivileges);
      checkPrivileges.mockResolvedValueOnce({
        username: 'some-user',
        hasAllRequested: false,
        privileges: {
          kibana: [
            {
              privilege: mockAuthorizationAction('myAppAlertType', 'myApp', 'alert', 'create'),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction('myAppAlertType', 'myOtherApp', 'alert', 'create'),
              authorized: false,
            },
          ],
        },
      });

      const alertAuthorization = new AlertsAuthorization({
        request,
        authorization,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds: ['exemptConsumerA'],
      });
      alertTypeRegistry.list.mockReturnValue(setOfAlertTypes);

      await expect(
        alertAuthorization.filterByRuleTypeAuthorization(
          new Set([myAppAlertType]),
          [WriteOperations.Create],
          AlertingAuthorizationTypes.Alert
        )
      ).resolves.toMatchInlineSnapshot(`
                Set {
                  Object {
                    "actionGroups": Array [],
                    "actionVariables": undefined,
                    "authorizedConsumers": Object {
                      "exemptConsumerA": Object {
                        "all": true,
                        "read": true,
                      },
                      "myApp": Object {
                        "all": true,
                        "read": true,
                      },
                    },
                    "defaultActionGroupId": "default",
                    "enabledInLicense": true,
                    "id": "myAppAlertType",
                    "minimumLicenseRequired": "basic",
                    "name": "myAppAlertType",
                    "producer": "myApp",
                    "recoveryActionGroup": Object {
                      "id": "recovered",
                      "name": "Recovered",
                    },
                  },
                }
              `);
    });

    test('augments a list of types with consumers under which multiple operations are authorized', async () => {
      const { authorization } = mockSecurity();
      const checkPrivileges: jest.MockedFunction<
        ReturnType<typeof authorization.checkPrivilegesDynamicallyWithRequest>
      > = jest.fn();
      authorization.checkPrivilegesDynamicallyWithRequest.mockReturnValue(checkPrivileges);
      checkPrivileges.mockResolvedValueOnce({
        username: 'some-user',
        hasAllRequested: false,
        privileges: {
          kibana: [
            {
              privilege: mockAuthorizationAction('myOtherAppAlertType', 'myApp', 'alert', 'create'),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction(
                'myOtherAppAlertType',
                'myOtherApp',
                'alert',
                'create'
              ),
              authorized: false,
            },
            {
              privilege: mockAuthorizationAction('myAppAlertType', 'myApp', 'alert', 'create'),
              authorized: false,
            },
            {
              privilege: mockAuthorizationAction('myAppAlertType', 'myOtherApp', 'alert', 'create'),
              authorized: false,
            },
            {
              privilege: mockAuthorizationAction('myOtherAppAlertType', 'myApp', 'alert', 'get'),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction(
                'myOtherAppAlertType',
                'myOtherApp',
                'alert',
                'get'
              ),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction('myAppAlertType', 'myApp', 'alert', 'get'),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction('myAppAlertType', 'myOtherApp', 'alert', 'get'),
              authorized: true,
            },
          ],
        },
      });

      const alertAuthorization = new AlertsAuthorization({
        request,
        authorization,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds,
      });
      alertTypeRegistry.list.mockReturnValue(setOfAlertTypes);

      await expect(
        alertAuthorization.filterByRuleTypeAuthorization(
          new Set([myAppAlertType, myOtherAppAlertType]),
          [WriteOperations.Create, ReadOperations.Get],
          AlertingAuthorizationTypes.Alert
        )
      ).resolves.toMatchInlineSnapshot(`
                Set {
                  Object {
                    "actionGroups": Array [],
                    "actionVariables": undefined,
                    "authorizedConsumers": Object {
                      "myApp": Object {
                        "all": true,
                        "read": true,
                      },
                      "myOtherApp": Object {
                        "all": false,
                        "read": true,
                      },
                    },
                    "defaultActionGroupId": "default",
                    "enabledInLicense": true,
                    "id": "myOtherAppAlertType",
                    "minimumLicenseRequired": "basic",
                    "name": "myOtherAppAlertType",
                    "producer": "myOtherApp",
                    "recoveryActionGroup": Object {
                      "id": "recovered",
                      "name": "Recovered",
                    },
                  },
                  Object {
                    "actionGroups": Array [],
                    "actionVariables": undefined,
                    "authorizedConsumers": Object {
                      "myApp": Object {
                        "all": false,
                        "read": true,
                      },
                      "myOtherApp": Object {
                        "all": false,
                        "read": true,
                      },
                    },
                    "defaultActionGroupId": "default",
                    "enabledInLicense": true,
                    "id": "myAppAlertType",
                    "minimumLicenseRequired": "basic",
                    "name": "myAppAlertType",
                    "producer": "myApp",
                    "recoveryActionGroup": Object {
                      "id": "recovered",
                      "name": "Recovered",
                    },
                  },
                }
              `);
    });

    test('omits types which have no consumers under which the operation is authorized', async () => {
      const { authorization } = mockSecurity();
      const checkPrivileges: jest.MockedFunction<
        ReturnType<typeof authorization.checkPrivilegesDynamicallyWithRequest>
      > = jest.fn();
      authorization.checkPrivilegesDynamicallyWithRequest.mockReturnValue(checkPrivileges);
      checkPrivileges.mockResolvedValueOnce({
        username: 'some-user',
        hasAllRequested: false,
        privileges: {
          kibana: [
            {
              privilege: mockAuthorizationAction('myOtherAppAlertType', 'myApp', 'alert', 'create'),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction(
                'myOtherAppAlertType',
                'myOtherApp',
                'alert',
                'create'
              ),
              authorized: true,
            },
            {
              privilege: mockAuthorizationAction('myAppAlertType', 'myApp', 'alert', 'create'),
              authorized: false,
            },
            {
              privilege: mockAuthorizationAction('myAppAlertType', 'myOtherApp', 'alert', 'create'),
              authorized: false,
            },
          ],
        },
      });

      const alertAuthorization = new AlertsAuthorization({
        request,
        authorization,
        alertTypeRegistry,
        features,
        auditLogger,
        getSpace,
        exemptConsumerIds,
      });
      alertTypeRegistry.list.mockReturnValue(setOfAlertTypes);

      await expect(
        alertAuthorization.filterByRuleTypeAuthorization(
          new Set([myAppAlertType, myOtherAppAlertType]),
          [WriteOperations.Create],
          AlertingAuthorizationTypes.Alert
        )
      ).resolves.toMatchInlineSnapshot(`
                Set {
                  Object {
                    "actionGroups": Array [],
                    "actionVariables": undefined,
                    "authorizedConsumers": Object {
                      "myApp": Object {
                        "all": true,
                        "read": true,
                      },
                      "myOtherApp": Object {
                        "all": true,
                        "read": true,
                      },
                    },
                    "defaultActionGroupId": "default",
                    "enabledInLicense": true,
                    "id": "myOtherAppAlertType",
                    "minimumLicenseRequired": "basic",
                    "name": "myOtherAppAlertType",
                    "producer": "myOtherApp",
                    "recoveryActionGroup": Object {
                      "id": "recovered",
                      "name": "Recovered",
                    },
                  },
                }
              `);
    });
  });
});
