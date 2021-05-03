/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import Boom from '@hapi/boom';
import { map, mapValues, fromPairs, has, get } from 'lodash';
import { KibanaRequest } from 'src/core/server';
import { ALERTS_FEATURE_ID } from '../../common';
import { AlertTypeRegistry } from '../types';
import { SecurityPluginSetup } from '../../../security/server';
import { RegistryAlertType } from '../alert_type_registry';
import { PluginStartContract as FeaturesPluginStart } from '../../../features/server';
import { AlertsAuthorizationAuditLogger, ScopeType } from './audit_logger';
import { Space } from '../../../spaces/server';
import { asFiltersByAlertTypeAndConsumer } from './alerts_authorization_kuery';
import { KueryNode } from '../../../../../src/plugins/data/server';

export enum AlertingAuthorizationTypes {
  Rule = 'rule',
  Alert = 'alert',
}

export enum ReadOperations {
  Get = 'get',
  GetAlertState = 'getAlertState',
  GetAlertInstanceSummary = 'getAlertInstanceSummary',
  Find = 'find',
}

export enum WriteOperations {
  Create = 'create',
  Delete = 'delete',
  Update = 'update',
  UpdateApiKey = 'updateApiKey',
  Enable = 'enable',
  Disable = 'disable',
  MuteAll = 'muteAll',
  UnmuteAll = 'unmuteAll',
  MuteInstance = 'muteInstance',
  UnmuteInstance = 'unmuteInstance',
}

export interface EnsureAuthorizedOpts {
  ruleTypeId: string;
  consumer: string;
  operation: ReadOperations | WriteOperations;
  authorizationType: AlertingAuthorizationTypes;
}

interface HasPrivileges {
  read: boolean;
  all: boolean;
}
type AuthorizedConsumers = Record<string, HasPrivileges>;
export interface RegistryAlertTypeWithAuth extends RegistryAlertType {
  authorizedConsumers: AuthorizedConsumers;
}

type IsAuthorizedAtProducerLevel = boolean;
export interface ConstructorOptions {
  alertTypeRegistry: AlertTypeRegistry;
  request: KibanaRequest;
  features: FeaturesPluginStart;
  getSpace: (request: KibanaRequest) => Promise<Space | undefined>;
  auditLogger: AlertsAuthorizationAuditLogger;
  privilegeName: string;
  exemptConsumerIds: string[];
  authorization?: SecurityPluginSetup['authz'];
}

export class AlertsAuthorization {
  private readonly alertTypeRegistry: AlertTypeRegistry;
  private readonly request: KibanaRequest;
  private readonly authorization?: SecurityPluginSetup['authz'];
  private readonly auditLogger: AlertsAuthorizationAuditLogger;
  private readonly featuresIds: Promise<Set<string>>;
  private readonly allPossibleConsumers: Promise<AuthorizedConsumers>;
  private readonly privilegeName: string;
  private readonly exemptConsumerIds: string[];

  constructor({
    alertTypeRegistry,
    request,
    authorization,
    features,
    auditLogger,
    getSpace,
    privilegeName,
    exemptConsumerIds,
  }: ConstructorOptions) {
    this.request = request;
    this.authorization = authorization;
    this.alertTypeRegistry = alertTypeRegistry;
    this.auditLogger = auditLogger;
    this.privilegeName = privilegeName;

    // List of consumer ids that are exempt from privilege check. This should be used sparingly.
    // An example of this is the Rules Management `consumer` as we don't want to have to
    // manually authorize each rule type in the management UI.
    this.exemptConsumerIds = exemptConsumerIds;

    this.featuresIds = getSpace(request)
      .then((maybeSpace) => new Set(maybeSpace?.disabledFeatures ?? []))
      .then(
        (disabledFeatures) =>
          new Set(
            features
              .getKibanaFeatures()
              .filter((feature) => {
                // ignore features which are disabled in the user's space
                return (
                  !disabledFeatures.has(feature.id) &&
                  // ignore features which don't grant privileges to the specified privilege
                  (get(feature, this.privilegeName, undefined)?.length ?? 0 > 0)
                );
              })
              .map((feature) => feature.id)
          )
      )
      .catch(() => {
        // failing to fetch the space means the user is likely not privileged in the
        // active space at all, which means that their list of features should be empty
        return new Set();
      });

    this.allPossibleConsumers = this.featuresIds.then((featuresIds) =>
      featuresIds.size
        ? asAuthorizedConsumers([...this.exemptConsumerIds, ...featuresIds], {
            read: true,
            all: true,
          })
        : {}
    );
  }

  private shouldCheckAuthorization(): boolean {
    return this.authorization?.mode?.useRbacForRequest(this.request) ?? false;
  }

  public async ensureAuthorized({
    ruleTypeId,
    consumer,
    operation,
    authorizationType,
  }: EnsureAuthorizedOpts) {
    const { authorization } = this;

    const isAvailableConsumer = has(await this.allPossibleConsumers, consumer);
    if (authorization && this.shouldCheckAuthorization()) {
      const ruleType = this.alertTypeRegistry.get(ruleTypeId);
      const requiredPrivilegesByScope = {
        consumer: authorization.actions.alerting.get(
          ruleTypeId,
          consumer,
          authorizationType,
          operation
        ),
        producer: authorization.actions.alerting.get(
          ruleTypeId,
          ruleType.producer,
          authorizationType,
          operation
        ),
      };

      // Skip authorizing consumer if it is in the list of exempt consumer ids
      const shouldAuthorizeConsumer = !this.exemptConsumerIds.includes(consumer);

      const checkPrivileges = authorization.checkPrivilegesDynamicallyWithRequest(this.request);
      const { hasAllRequested, username, privileges } = await checkPrivileges({
        kibana:
          shouldAuthorizeConsumer && consumer !== ruleType.producer
            ? [
                // check for access at consumer level
                requiredPrivilegesByScope.consumer,
                // check for access at producer level
                requiredPrivilegesByScope.producer,
              ]
            : [
                // skip consumer privilege checks for exempt consumer ids as all rule types can
                // be created for exempt consumers if user has producer level privileges
                requiredPrivilegesByScope.producer,
              ],
      });

      if (!isAvailableConsumer) {
        /**
         * Under most circumstances this would have been caught by `checkPrivileges` as
         * a user can't have Privileges to an unknown consumer, but super users
         * don't actually get "privilege checked" so the made up consumer *will* return
         * as Privileged.
         * This check will ensure we don't accidentally let these through
         */
        throw Boom.forbidden(
          this.auditLogger.alertsAuthorizationFailure(
            username,
            ruleTypeId,
            ScopeType.Consumer,
            consumer,
            operation,
            authorizationType
          )
        );
      }

      if (hasAllRequested) {
        this.auditLogger.alertsAuthorizationSuccess(
          username,
          ruleTypeId,
          ScopeType.Consumer,
          consumer,
          operation,
          authorizationType
        );
      } else {
        const authorizedPrivileges = map(
          privileges.kibana.filter((privilege) => privilege.authorized),
          'privilege'
        );
        const unauthorizedScopes = mapValues(
          requiredPrivilegesByScope,
          (privilege) => !authorizedPrivileges.includes(privilege)
        );

        const [unauthorizedScopeType, unauthorizedScope] =
          shouldAuthorizeConsumer && unauthorizedScopes.consumer
            ? [ScopeType.Consumer, consumer]
            : [ScopeType.Producer, ruleType.producer];

        throw Boom.forbidden(
          this.auditLogger.alertsAuthorizationFailure(
            username,
            ruleTypeId,
            unauthorizedScopeType,
            unauthorizedScope,
            operation,
            authorizationType
          )
        );
      }
    } else if (!isAvailableConsumer) {
      throw Boom.forbidden(
        this.auditLogger.alertsAuthorizationFailure(
          '',
          ruleTypeId,
          ScopeType.Consumer,
          consumer,
          operation,
          authorizationType
        )
      );
    }
  }

  public async getFindAuthorizationFilter(
    authorizationType: AlertingAuthorizationTypes
  ): Promise<{
    filter?: KueryNode;
    ensureAlertTypeIsAuthorized: (alertTypeId: string, consumer: string) => void;
    logSuccessfulAuthorization: () => void;
  }> {
    if (this.authorization && this.shouldCheckAuthorization()) {
      const { username, authorizedAlertTypes } = await this.augmentAlertTypesWithAuthorization(
        this.alertTypeRegistry.list(),
        [
          // maybe pass in this operation? or require it to be 'find'
          ReadOperations.Find,
        ],
        authorizationType
      );

      if (!authorizedAlertTypes.size) {
        throw Boom.forbidden(
          this.auditLogger.alertsUnscopedAuthorizationFailure(username!, 'find')
        );
      }

      const authorizedAlertTypeIdsToConsumers = new Set<string>(
        [...authorizedAlertTypes].reduce<string[]>((alertTypeIdConsumerPairs, alertType) => {
          for (const consumer of Object.keys(alertType.authorizedConsumers)) {
            alertTypeIdConsumerPairs.push(`${alertType.id}/${consumer}`);
          }
          return alertTypeIdConsumerPairs;
        }, [])
      );

      const authorizedEntries: Map<string, Set<string>> = new Map();
      return {
        filter: asFiltersByAlertTypeAndConsumer(authorizedAlertTypes),
        ensureAlertTypeIsAuthorized: (alertTypeId: string, consumer: string) => {
          if (!authorizedAlertTypeIdsToConsumers.has(`${alertTypeId}/${consumer}`)) {
            throw Boom.forbidden(
              this.auditLogger.alertsAuthorizationFailure(
                username!,
                alertTypeId,
                ScopeType.Consumer,
                consumer,
                'find'
              )
            );
          } else {
            if (authorizedEntries.has(alertTypeId)) {
              authorizedEntries.get(alertTypeId)!.add(consumer);
            } else {
              authorizedEntries.set(alertTypeId, new Set([consumer]));
            }
          }
        },
        logSuccessfulAuthorization: () => {
          if (authorizedEntries.size) {
            this.auditLogger.alertsBulkAuthorizationSuccess(
              username!,
              [...authorizedEntries.entries()].reduce<Array<[string, string]>>(
                (authorizedPairs, [alertTypeId, consumers]) => {
                  for (const consumer of consumers) {
                    authorizedPairs.push([alertTypeId, consumer]);
                  }
                  return authorizedPairs;
                },
                []
              ),
              ScopeType.Consumer,
              'find'
            );
          }
        },
      };
    }
    return {
      ensureAlertTypeIsAuthorized: (alertTypeId: string, consumer: string) => {},
      logSuccessfulAuthorization: () => {},
    };
  }

  public async filterByAlertTypeAuthorization(
    alertTypes: Set<RegistryAlertType>,
    operations: Array<ReadOperations | WriteOperations>,
    authorizationType: AlertingAuthorizationTypes
  ): Promise<Set<RegistryAlertTypeWithAuth>> {
    const { authorizedAlertTypes } = await this.augmentAlertTypesWithAuthorization(
      alertTypes,
      operations,
      authorizationType
    );
    return authorizedAlertTypes;
  }

  private async augmentAlertTypesWithAuthorization(
    alertTypes: Set<RegistryAlertType>,
    operations: Array<ReadOperations | WriteOperations>,
    authorizationType: AlertingAuthorizationTypes
  ): Promise<{
    username?: string;
    hasAllRequested: boolean;
    authorizedAlertTypes: Set<RegistryAlertTypeWithAuth>;
  }> {
    const featuresIds = await this.featuresIds;
    if (this.authorization && this.shouldCheckAuthorization()) {
      const checkPrivileges = this.authorization.checkPrivilegesDynamicallyWithRequest(
        this.request
      );

      // add an empty `authorizedConsumers` array on each alertType
      const alertTypesWithAuthorization = this.augmentWithAuthorizedConsumers(alertTypes, {});

      // map from privilege to alertType which we can refer back to when analyzing the result
      // of checkPrivileges
      const privilegeToAlertType = new Map<
        string,
        [RegistryAlertTypeWithAuth, string, HasPrivileges, IsAuthorizedAtProducerLevel]
      >();
      // as we can't ask ES for the user's individual privileges we need to ask for each feature
      // and alertType in the system whether this user has this privilege
      for (const alertType of alertTypesWithAuthorization) {
        for (const feature of featuresIds) {
          for (const operation of operations) {
            privilegeToAlertType.set(
              // this function needs to be swappable
              this.authorization!.actions.alerting.get(
                alertType.id,
                feature,
                authorizationType,
                operation
              ),
              [
                alertType,
                feature,
                hasPrivilegeByOperation(operation),
                alertType.producer === feature,
              ]
            );
          }
        }
      }

      const { username, hasAllRequested, privileges } = await checkPrivileges({
        kibana: [...privilegeToAlertType.keys()],
      });

      return {
        username,
        hasAllRequested,
        authorizedAlertTypes: hasAllRequested
          ? // has access to all features
            this.augmentWithAuthorizedConsumers(alertTypes, await this.allPossibleConsumers)
          : // only has some of the required privileges
            privileges.kibana.reduce((authorizedAlertTypes, { authorized, privilege }) => {
              if (authorized && privilegeToAlertType.has(privilege)) {
                const [
                  alertType,
                  feature,
                  hasPrivileges,
                  isAuthorizedAtProducerLevel,
                ] = privilegeToAlertType.get(privilege)!;
                alertType.authorizedConsumers[feature] = mergeHasPrivileges(
                  hasPrivileges,
                  alertType.authorizedConsumers[feature]
                );

                // this needs to be feature flagged
                if (isAuthorizedAtProducerLevel) {
                  // granting privileges under the producer automatically authorized the Alerts Management UI as well
                  alertType.authorizedConsumers[ALERTS_FEATURE_ID] = mergeHasPrivileges(
                    hasPrivileges,
                    alertType.authorizedConsumers[ALERTS_FEATURE_ID]
                  );
                }
                authorizedAlertTypes.add(alertType);
              }
              return authorizedAlertTypes;
            }, new Set<RegistryAlertTypeWithAuth>()),
      };
    } else {
      return {
        hasAllRequested: true,
        authorizedAlertTypes: this.augmentWithAuthorizedConsumers(
          new Set([...alertTypes].filter((alertType) => featuresIds.has(alertType.producer))),
          await this.allPossibleConsumers
        ),
      };
    }
  }

  private augmentWithAuthorizedConsumers(
    alertTypes: Set<RegistryAlertType>,
    authorizedConsumers: AuthorizedConsumers
  ): Set<RegistryAlertTypeWithAuth> {
    return new Set(
      Array.from(alertTypes).map((alertType) => ({
        ...alertType,
        authorizedConsumers: { ...authorizedConsumers },
      }))
    );
  }
}

function mergeHasPrivileges(left: HasPrivileges, right?: HasPrivileges): HasPrivileges {
  return {
    read: (left.read || right?.read) ?? false,
    all: (left.all || right?.all) ?? false,
  };
}

function hasPrivilegeByOperation(operation: ReadOperations | WriteOperations): HasPrivileges {
  const read = Object.values(ReadOperations).includes((operation as unknown) as ReadOperations);
  const all = Object.values(WriteOperations).includes((operation as unknown) as WriteOperations);
  return {
    read: read || all,
    all,
  };
}

function asAuthorizedConsumers(
  consumers: string[],
  hasPrivileges: HasPrivileges
): AuthorizedConsumers {
  return fromPairs(consumers.map((feature) => [feature, hasPrivileges]));
}
