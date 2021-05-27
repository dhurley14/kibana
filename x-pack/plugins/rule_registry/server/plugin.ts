/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { schema } from '@kbn/config-schema';

import {
  PluginInitializerContext,
  Plugin,
  CoreSetup,
  Logger,
  KibanaRequest,
  CoreStart,
  IContextProvider,
} from 'src/core/server';
import { SecurityPluginSetup } from '../../security/server';
import { AlertsClientFactory } from './alert_data_client/alert_client_factory';
import { PluginStartContract as AlertingStart } from '../../alerting/server';
import { RacApiRequestHandlerContext, RacRequestHandlerContext } from './types';
import { defineRoutes } from './routes';
import { SpacesPluginStart } from '../../spaces/server';

import { RuleRegistryPluginConfig } from './config';
import { RuleDataPluginService } from './rule_data_plugin_service';
import { EventLogService, IEventLogService } from './event_log';

interface RuleRegistryPluginSetupDependencies {
  security: SecurityPluginSetup;
}

interface RuleRegistryPluginStartDependencies {
  spaces: SpacesPluginStart;
  alerting: AlertingStart;
}

export interface RuleRegistryPluginsStart {
  alerting: AlertingStart;
  spaces?: SpacesPluginStart;
}

export interface RuleRegistryPluginsSetup {
  security?: SecurityPluginSetup;
}

export interface RuleRegistryPluginSetupContract {
  ruleDataService: RuleDataPluginService;
  eventLogService: IEventLogService;
}

export type RuleRegistryPluginStartContract = void;

export class RuleRegistryPlugin
  implements
    Plugin<
      RuleRegistryPluginSetupContract,
      RuleRegistryPluginStartContract,
      RuleRegistryPluginSetupDependencies,
      RuleRegistryPluginStartDependencies
    > {
  private readonly config: RuleRegistryPluginConfig;
  private readonly logger: Logger;
  private eventLogService: EventLogService | null;
  private readonly alertsClientFactory: AlertsClientFactory;
  private ruleDataService: RuleDataPluginService;
  private security: SecurityPluginSetup | undefined;

  constructor(initContext: PluginInitializerContext) {
    this.config = initContext.config.get<RuleRegistryPluginConfig>();
    this.logger = initContext.logger.get();
    this.eventLogService = null;
    this.ruleDataService = null;
    this.alertsClientFactory = new AlertsClientFactory();
  }

  public setup(
    core: CoreSetup<RuleRegistryPluginStartDependencies, RuleRegistryPluginStartContract>,
    plugins: RuleRegistryPluginsSetup
  ): RuleRegistryPluginSetupContract {
    const { config, logger } = this;

    const startDependencies = core.getStartServices().then(([coreStart, pluginStart]) => {
      return {
        core: coreStart,
        ...pluginStart,
      };
    });

    this.security = plugins.security;

    const service = new RuleDataPluginService({
      logger: this.logger,
      isWriteEnabled: this.config.write.enabled,
      index: this.config.index,
      getClusterClient: async () => {
        const deps = await startDependencies;
        return deps.core.elasticsearch.client.asInternalUser;
      },
    });

    service.init().catch((originalError) => {
      const error = new Error('Failed installing assets');
      // @ts-ignore
      error.stack = originalError.stack;
      this.logger.error(error);
    });

    this.ruleDataService = service;

    // ALERTS ROUTES
    const router = core.http.createRouter<RacRequestHandlerContext>();
    core.http.registerRouteHandlerContext<RacRequestHandlerContext, 'rac'>(
      'rac',
      this.createRouteHandlerContext()
    );

    defineRoutes(router);
    // handler is called when '/path' resource is requested with `GET` method
    router.get({ path: '/rac-myfakepath', validate: false }, async (context, req, res) => {
      const racClient = await context.rac.getAlertsClient();
      // console.error(`WHATS IN THE RAC CLIENT`, racClient);
      racClient?.get({ id: 'hello world', assetName: 'observability-apm' });
      return res.ok();
    });

    const eventLogService = new EventLogService({
      config: {
        indexPrefix: this.config.index,
        isWriteEnabled: this.config.write.enabled,
      },
      dependencies: {
        clusterClient: startDependencies.then((deps) => deps.core.elasticsearch.client),
        spacesService: startDependencies.then((deps) => deps.spaces.spacesService),
        logger: logger.get('eventLog'),
      },
    });

    this.eventLogService = eventLogService;

    return { ruleDataService: this.ruleDataService, eventLogService };
  }

  public start(core: CoreStart, plugins: RuleRegistryPluginsStart) {
    const { logger, alertsClientFactory, security } = this;

    alertsClientFactory.initialize({
      logger,
      getSpaceId(request: KibanaRequest) {
        return plugins.spaces?.spacesService.getSpaceId(request);
      },
      esClient: core.elasticsearch.client.asInternalUser,
      // NOTE: Alerts share the authorization client with the alerting plugin
      getAlertingAuthorization(request: KibanaRequest) {
        return plugins.alerting.getAlertingAuthorizationWithRequest(request);
      },
      securityPluginSetup: security,
      ruleDataService: this.ruleDataService,
    });

    const getRacClientWithRequest = (request: KibanaRequest) => {
      return alertsClientFactory.create(request, this.config.index);
    };

    return {
      getRacClientWithRequest,
      alerting: plugins.alerting,
    };
  }

  private createRouteHandlerContext = (): IContextProvider<RacRequestHandlerContext, 'rac'> => {
    const { alertsClientFactory, config } = this;
    return async function alertsRouteHandlerContext(
      context,
      request
    ): Promise<RacApiRequestHandlerContext> {
      return {
        getAlertsClient: async () => {
          const createdClient = alertsClientFactory.create(request, config.index);
          return createdClient;
        },
      };
    };
  };

  public stop() {
    const { eventLogService, logger } = this;

    if (eventLogService) {
      eventLogService.stop().catch((e) => {
        logger.error(e);
      });
    }
  }
}
