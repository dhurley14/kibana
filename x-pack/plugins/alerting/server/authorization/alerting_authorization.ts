/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import Boom from '@hapi/boom';
import { map, mapValues, fromPairs, has } from 'lodash';
import { KibanaRequest } from 'src/core/server';
import { AlertTypeRegistry } from '../types';
import { SecurityPluginSetup } from '../../../security/server';
import { RegistryAlertType } from '../alert_type_registry';
import { PluginStartContract as FeaturesPluginStart } from '../../../features/server';
import { AlertingAuthorizationAuditLogger, ScopeType } from './audit_logger';
import { Space } from '../../../spaces/server';
import {
  asFiltersByRuleTypeAndConsumer,
  AlertingAuthorizationFilterOpts,
} from './alerting_authorization_kuery';
import { KueryNode } from '../../../../../src/plugins/data/server';
import { JsonObject } from '../../../../../src/plugins/kibana_utils/common';

export enum AlertingAuthorizationEntity {
  Rule = 'rule',
  Alert = 'alert',
}

export enum ReadOperations {
  Get = 'get',
  GetRuleState = 'getRuleState',
  GetAlertSummary = 'getAlertSummary',
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
  MuteAlert = 'muteAlert',
  UnmuteAlert = 'unmuteAlert',
}

export interface EnsureAuthorizedOpts {
  ruleTypeId: string;
  consumer: string;
  operation: ReadOperations | WriteOperations;
  entity: AlertingAuthorizationEntity;
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
  auditLogger: AlertingAuthorizationAuditLogger;
  exemptConsumerIds: string[];
  authorization?: SecurityPluginSetup['authz'];
}

export class AlertingAuthorization {
  private readonly alertTypeRegistry: AlertTypeRegistry;
  private readonly request: KibanaRequest;
  private readonly authorization?: SecurityPluginSetup['authz'];
  private readonly auditLogger: AlertingAuthorizationAuditLogger;
  private readonly featuresIds: Promise<Set<string>>;
  private readonly allPossibleConsumers: Promise<AuthorizedConsumers>;
  private readonly exemptConsumerIds: string[];
  // to be used when building the alerts as data index name
  // private readonly spaceId: Promise<string | undefined>;

  constructor({
    alertTypeRegistry,
    request,
    authorization,
    features,
    auditLogger,
    getSpace,
    exemptConsumerIds,
  }: ConstructorOptions) {
    this.request = request;
    this.authorization = authorization;
    this.alertTypeRegistry = alertTypeRegistry;
    this.auditLogger = auditLogger;

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
              .filter(
                ({ id, alerting }) =>
                  // ignore features which are disabled in the user's space
                  !disabledFeatures.has(id) &&
                  // ignore features which don't grant privileges to alerting
                  (alerting?.length ?? 0 > 0)
              )
              .map((feature) => feature.id)
          )
      )
      .catch(() => {
        // failing to fetch the space means the user is likely not privileged in the
        // active space at all, which means that their list of features should be empty
        return new Set();
      });

    // this.spaceId = getSpace(request).then((maybeSpace) => maybeSpace?.id ?? undefined);

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

  public async getAuthorizedAlertsIndices(featureIds: string[]): Promise<string[] | undefined> {
    const augmentedRuleTypes = await this.augmentRuleTypesWithAuthorization(
      this.alertTypeRegistry.list(),
      [ReadOperations.Find, ReadOperations.Get, WriteOperations.Update],
      AlertingAuthorizationEntity.Alert,
      new Set(featureIds)
    );

    const arrayOfAuthorizedRuleTypes = Array.from(augmentedRuleTypes.authorizedRuleTypes);

    // As long as the user can read a minimum of one type of rule type produced by the provided feature,
    // the user should be provided that features' alerts index.
    // Limiting which alerts that user can read on that index will be done via the findAuthorizationFilter
    const authorizedFeatures = arrayOfAuthorizedRuleTypes.reduce(
      (acc, ruleType) => acc.add(ruleType.producer),
      new Set<string>()
    );

    // when we add the spaceId to the index name, uncomment this line
    // const spaceName = await this.spaceName;

    const toReturn = Array.from(authorizedFeatures).flatMap((feature) => {
      switch (feature) {
        case 'apm':
          return '.alerts-observability-apm';
        case 'siem':
          return ['.alerts-security-solution', '.siem-signals'];
        default:
          return [];
      }
    });

    return toReturn;
  }

  public async ensureAuthorized({ ruleTypeId, consumer, operation, entity }: EnsureAuthorizedOpts) {
    const { authorization } = this;

    const isAvailableConsumer = has(await this.allPossibleConsumers, consumer);
    if (authorization && this.shouldCheckAuthorization()) {
      const ruleType = this.alertTypeRegistry.get(ruleTypeId);
      const requiredPrivilegesByScope = {
        consumer: authorization.actions.alerting.get(ruleTypeId, consumer, entity, operation),
        producer: authorization.actions.alerting.get(
          ruleTypeId,
          ruleType.producer,
          entity,
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
          this.auditLogger.logAuthorizationFailure(
            username,
            ruleTypeId,
            ScopeType.Consumer,
            consumer,
            operation,
            entity
          )
        );
      }

      if (hasAllRequested) {
        this.auditLogger.logAuthorizationSuccess(
          username,
          ruleTypeId,
          ScopeType.Consumer,
          consumer,
          operation,
          entity
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
          this.auditLogger.logAuthorizationFailure(
            username,
            ruleTypeId,
            unauthorizedScopeType,
            unauthorizedScope,
            operation,
            entity
          )
        );
      }
    } else if (!isAvailableConsumer) {
      throw Boom.forbidden(
        this.auditLogger.logAuthorizationFailure(
          '',
          ruleTypeId,
          ScopeType.Consumer,
          consumer,
          operation,
          entity
        )
      );
    }
  }

  public async getFindAuthorizationFilter(
    authorizationEntity: AlertingAuthorizationEntity,
    filterOpts: AlertingAuthorizationFilterOpts
  ): Promise<{
    filter?: KueryNode | JsonObject;
    ensureRuleTypeIsAuthorized: (ruleTypeId: string, consumer: string, auth: string) => void;
    logSuccessfulAuthorization: () => void;
  }> {
    if (this.authorization && this.shouldCheckAuthorization()) {
      const { username, authorizedRuleTypes } = await this.augmentRuleTypesWithAuthorization(
        this.alertTypeRegistry.list(),
        [ReadOperations.Find],
        authorizationEntity
      );

      if (!authorizedRuleTypes.size) {
        throw Boom.forbidden(
          this.auditLogger.logUnscopedAuthorizationFailure(username!, 'find', authorizationEntity)
        );
      }

      const authorizedRuleTypeIdsToConsumers = new Set<string>(
        [...authorizedRuleTypes].reduce<string[]>((ruleTypeIdConsumerPairs, ruleType) => {
          for (const consumer of Object.keys(ruleType.authorizedConsumers)) {
            ruleTypeIdConsumerPairs.push(`${ruleType.id}/${consumer}/${authorizationEntity}`);
          }
          return ruleTypeIdConsumerPairs;
        }, [])
      );

      const authorizedEntries: Map<string, Set<string>> = new Map();
      return {
        filter: asFiltersByRuleTypeAndConsumer(authorizedRuleTypes, filterOpts),
        ensureRuleTypeIsAuthorized: (ruleTypeId: string, consumer: string, authType: string) => {
          if (!authorizedRuleTypeIdsToConsumers.has(`${ruleTypeId}/${consumer}/${authType}`)) {
            throw Boom.forbidden(
              this.auditLogger.logAuthorizationFailure(
                username!,
                ruleTypeId,
                ScopeType.Consumer,
                consumer,
                'find',
                authorizationEntity
              )
            );
          } else {
            if (authorizedEntries.has(ruleTypeId)) {
              authorizedEntries.get(ruleTypeId)!.add(consumer);
            } else {
              authorizedEntries.set(ruleTypeId, new Set([consumer]));
            }
          }
        },
        logSuccessfulAuthorization: () => {
          if (authorizedEntries.size) {
            this.auditLogger.logBulkAuthorizationSuccess(
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
              'find',
              authorizationEntity
            );
          }
        },
      };
    }
    return {
      ensureRuleTypeIsAuthorized: (ruleTypeId: string, consumer: string, authType: string) => {},
      logSuccessfulAuthorization: () => {},
    };
  }

  public async filterByRuleTypeAuthorization(
    ruleTypes: Set<RegistryAlertType>,
    operations: Array<ReadOperations | WriteOperations>,
    authorizationEntity: AlertingAuthorizationEntity
  ): Promise<Set<RegistryAlertTypeWithAuth>> {
    const { authorizedRuleTypes } = await this.augmentRuleTypesWithAuthorization(
      ruleTypes,
      operations,
      authorizationEntity
    );
    return authorizedRuleTypes;
  }

  private async augmentRuleTypesWithAuthorization(
    ruleTypes: Set<RegistryAlertType>,
    operations: Array<ReadOperations | WriteOperations>,
    authorizationEntity: AlertingAuthorizationEntity,
    featuresIds?: Set<string>
  ): Promise<{
    username?: string;
    hasAllRequested: boolean;
    authorizedRuleTypes: Set<RegistryAlertTypeWithAuth>;
    unauthorizedRuleTypes: Set<RegistryAlertTypeWithAuth> | undefined;
  }> {
    const fIds = featuresIds ?? (await this.featuresIds);
    if (this.authorization && this.shouldCheckAuthorization()) {
      const checkPrivileges = this.authorization.checkPrivilegesDynamicallyWithRequest(
        this.request
      );

      // add an empty `authorizedConsumers` array on each ruleType
      const ruleTypesWithAuthorization = this.augmentWithAuthorizedConsumers(ruleTypes, {});

      // map from privilege to ruleType which we can refer back to when analyzing the result
      // of checkPrivileges
      const privilegeToRuleType = new Map<
        string,
        [RegistryAlertTypeWithAuth, string, HasPrivileges, IsAuthorizedAtProducerLevel]
      >();
      // as we can't ask ES for the user's individual privileges we need to ask for each feature
      // and ruleType in the system whether this user has this privilege
      for (const ruleType of ruleTypesWithAuthorization) {
        for (const feature of fIds) {
          for (const operation of operations) {
            privilegeToRuleType.set(
              this.authorization!.actions.alerting.get(
                ruleType.id,
                feature,
                authorizationEntity,
                operation
              ),
              [ruleType, feature, hasPrivilegeByOperation(operation), ruleType.producer === feature]
            );
          }
        }
      }

      const { username, hasAllRequested, privileges } = await checkPrivileges({
        kibana: [...privilegeToRuleType.keys()],
      });

      let authorizedRuleTypes;
      let unauthorizedRuleTypes;
      if (hasAllRequested) {
        authorizedRuleTypes = this.augmentWithAuthorizedConsumers(
          ruleTypes,
          await this.allPossibleConsumers
        );
      } else {
        [authorizedRuleTypes, unauthorizedRuleTypes] = privileges.kibana.reduce(
          ([authzRuleTypes, unauthzRuleTypes], { authorized, privilege }) => {
            if (authorized && privilegeToRuleType.has(privilege)) {
              const [
                ruleType,
                feature,
                hasPrivileges,
                isAuthorizedAtProducerLevel,
              ] = privilegeToRuleType.get(privilege)!;
              ruleType.authorizedConsumers[feature] = mergeHasPrivileges(
                hasPrivileges,
                ruleType.authorizedConsumers[feature]
              );

              if (isAuthorizedAtProducerLevel && this.exemptConsumerIds.length > 0) {
                // granting privileges under the producer automatically authorized exempt consumer IDs as well
                this.exemptConsumerIds.forEach((exemptId: string) => {
                  ruleType.authorizedConsumers[exemptId] = mergeHasPrivileges(
                    hasPrivileges,
                    ruleType.authorizedConsumers[exemptId]
                  );
                });
              }
              authzRuleTypes.add(ruleType);
            } else if (!authorized) {
              const [ruleType, , , ,] = privilegeToRuleType.get(privilege)!;
              unauthzRuleTypes.add(ruleType);
            }
            return [authzRuleTypes, unauthzRuleTypes];
          },
          [new Set<RegistryAlertTypeWithAuth>(), new Set<RegistryAlertTypeWithAuth>()]
        );
      }

      return {
        username,
        hasAllRequested,
        authorizedRuleTypes,
        unauthorizedRuleTypes,
      };
    } else {
      return {
        hasAllRequested: true,
        authorizedRuleTypes: this.augmentWithAuthorizedConsumers(
          new Set([...ruleTypes].filter((ruleType) => fIds.has(ruleType.producer))),
          await this.allPossibleConsumers
        ),
        unauthorizedRuleTypes: undefined,
      };
    }
  }

  private augmentWithAuthorizedConsumers(
    ruleTypes: Set<RegistryAlertType>,
    authorizedConsumers: AuthorizedConsumers
  ): Set<RegistryAlertTypeWithAuth> {
    return new Set(
      Array.from(ruleTypes).map((ruleType) => ({
        ...ruleType,
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
