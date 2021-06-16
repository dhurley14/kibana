/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { PublicMethodsOf } from '@kbn/utility-types';
import { AlertTypeParams } from '../../../alerting/server';
import {
  ReadOperations,
  AlertingAuthorization,
  WriteOperations,
  AlertingAuthorizationEntity,
  // eslint-disable-next-line @kbn/eslint/no-restricted-paths
} from '../../../alerting/server/authorization';
import { Logger, ElasticsearchClient } from '../../../../../src/core/server';
import { alertAuditEvent, AlertAuditAction } from './audit_events';
import { RuleDataPluginService } from '../rule_data_plugin_service';
import { AuditLogger } from '../../../security/server';
import { OWNER, RULE_ID } from '../../common/technical_rule_data_field_names';
import { ParsedTechnicalFields } from '../../common/parse_technical_fields';

export interface ConstructorOptions {
  logger: Logger;
  authorization: PublicMethodsOf<AlertingAuthorization>;
  auditLogger?: AuditLogger;
  esClient: ElasticsearchClient;
  ruleDataService: PublicMethodsOf<RuleDataPluginService>;
}

export interface UpdateOptions<Params extends AlertTypeParams> {
  id: string;
  data: {
    status: string;
  };
  // observability-apm see here: x-pack/plugins/apm/server/plugin.ts:191
  indexName: string;
}

interface GetAlertParams {
  id: string;
  // observability-apm see here: x-pack/plugins/apm/server/plugin.ts:191
  indexName: string;
}

export class AlertsClient {
  private readonly logger: Logger;
  private readonly auditLogger?: AuditLogger;
  private readonly authorization: PublicMethodsOf<AlertingAuthorization>;
  private readonly esClient: ElasticsearchClient;
  private readonly ruleDataService: PublicMethodsOf<RuleDataPluginService>;

  constructor({
    auditLogger,
    authorization,
    logger,
    esClient,
    ruleDataService,
  }: ConstructorOptions) {
    this.logger = logger;
    this.authorization = authorization;
    this.esClient = esClient;
    this.auditLogger = auditLogger;
    this.ruleDataService = ruleDataService;
  }

  public getFullAssetName() {
    return this.ruleDataService?.getFullAssetName();
  }

  public async getAlertsIndex(featureIds: string[]) {
    return this.authorization.getAuthorizedAlertsIndices(
      featureIds.length !== 0 ? featureIds : ['apm', 'siem']
    );
  }

  // pull concrete index name off of document
  private async fetchAlert({ id, indexName }: GetAlertParams): Promise<ParsedTechnicalFields> {
    try {
      const result = await this.esClient.get<ParsedTechnicalFields>({
        index: indexName,
        id,
      });

      if (
        result.body._source == null ||
        result.body._source[RULE_ID] == null ||
        result.body._source[OWNER] == null
      ) {
        const errorMessage = `[rac] - Unable to retrieve alert details for alert with id of "${id}".`;
        this.logger.debug(errorMessage);
        throw new Error(errorMessage);
      }

      return result.body._source;
    } catch (error) {
      const errorMessage = `[rac] - Unable to retrieve alert with id of "${id}".`;
      this.logger.debug(errorMessage);
      throw error;
    }
  }

  public async get({ id, indexName }: GetAlertParams): Promise<ParsedTechnicalFields> {
    try {
      // first search for the alert by id, then use the alert info to check if user has access to it
      const alert = await this.fetchAlert({
        id,
        indexName,
      });

      // this.authorization leverages the alerting plugin's authorization
      // client exposed to us for reuse
      await this.authorization.ensureAuthorized({
        ruleTypeId: alert['rule.id']!, // we assert in fetchAlert that these values are non-null
        consumer: alert['kibana.rac.alert.owner']!, // we assert in fetchAlert that these values are non-null
        operation: ReadOperations.Get,
        entity: AlertingAuthorizationEntity.Alert,
      });

      this.auditLogger?.log(
        alertAuditEvent({
          action: AlertAuditAction.GET,
          id,
        })
      );

      return alert;
    } catch (error) {
      this.logger.debug(`[rac] - Error fetching alert with id of "${id}"`);
      this.auditLogger?.log(
        alertAuditEvent({
          action: AlertAuditAction.GET,
          id,
          error,
        })
      );
      throw error;
    }
  }

  public async update<Params extends AlertTypeParams = never>({
    id,
    data,
    indexName,
  }: UpdateOptions<Params>): Promise<ParsedTechnicalFields | null | undefined> {
    try {
      // TODO: use MGET
      const alert = await this.fetchAlert({
        id,
        indexName,
      });

      await this.authorization.ensureAuthorized({
        ruleTypeId: alert['rule.id']!, // we assert in fetchAlert that these values are non-null
        consumer: alert['kibana.rac.alert.owner']!, // we assert in fetchAlert that these values are non-null
        operation: WriteOperations.Update,
        entity: AlertingAuthorizationEntity.Alert,
      });

      const updateParameters = {
        id,
        index: indexName,
        body: {
          doc: {
            'kibana.rac.alert.status': data.status,
          },
        },
      };

      const res = await this.esClient.update<ParsedTechnicalFields, unknown, unknown, unknown>(
        updateParameters
      );

      this.auditLogger?.log(
        alertAuditEvent({
          action: AlertAuditAction.UPDATE,
          id,
        })
      );

      return res.body.get?._source;
    } catch (error) {
      this.auditLogger?.log(
        alertAuditEvent({
          action: AlertAuditAction.UPDATE,
          id,
          error,
        })
      );
      throw error;
    }
  }
}
