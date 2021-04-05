/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  Logger,
  PluginInitializerContext,
  Plugin,
  CoreSetup,
  CoreStart,
  SharedGlobalConfig,
  KibanaRequest,
  IContextProvider,
} from 'src/core/server';
import { PublicMethodsOf } from '@kbn/utility-types';
import { SecurityPluginSetup, SecurityPluginStart } from '../../security/server';
import {
  PluginSetupContract as AlertingPluginSetupContract,
  PluginStartContract as AlertPluginStartContract,
} from '../../alerting/server';
import { SpacesPluginStart } from '../../spaces/server';
import { PluginStartContract as FeaturesPluginStart } from '../../features/server';

import { RuleRegistry } from './rule_registry';
import { defaultIlmPolicy } from './rule_registry/defaults/ilm_policy';
import { defaultFieldMap } from './rule_registry/defaults/field_map';
import { RacClientFactory } from './rac_client/rac_client_factory';
import { RuleRegistryConfig } from '.';
import {
  ContextProviderReturn,
  RacApiRequestHandlerContext,
  RacRequestHandlerContext,
} from './types';
import { RacClient } from './rac_client/rac_client';
export interface RacPluginsSetup {
  security?: SecurityPluginSetup;
  alerting: AlertingPluginSetupContract;
}
export interface RacPluginsStart {
  security?: SecurityPluginStart;
  spaces?: SpacesPluginStart;
  features: FeaturesPluginStart;
  alerting: AlertPluginStartContract;
  getRacClientWithRequest(request: KibanaRequest): PublicMethodsOf<RacClient>;
}

export type RacPluginSetupContract = RuleRegistry<typeof defaultFieldMap>;

export class RuleRegistryPlugin implements Plugin<RacPluginSetupContract> {
  private readonly globalConfig: SharedGlobalConfig;
  private readonly config: RuleRegistryConfig;
  private readonly racClientFactory: RacClientFactory;
  private security?: SecurityPluginSetup;
  private readonly logger: Logger;
  private readonly kibanaVersion: PluginInitializerContext['env']['packageInfo']['version'];

  constructor(private readonly initContext: PluginInitializerContext) {
    this.initContext = initContext;
    this.racClientFactory = new RacClientFactory();
    this.globalConfig = this.initContext.config.legacy.get();
    this.config = initContext.config.get<RuleRegistryConfig>();
    this.logger = initContext.logger.get('root');
    this.kibanaVersion = initContext.env.packageInfo.version;
  }

  public setup(core: CoreSetup, plugins: RacPluginsSetup): RacPluginSetupContract {
    this.security = plugins.security;

    // RULE REGISTRY
    const rootRegistry = new RuleRegistry({
      core,
      ilmPolicy: defaultIlmPolicy,
      fieldMap: defaultFieldMap,
      kibanaIndex: this.globalConfig.kibana.index,
      name: 'alert-history',
      kibanaVersion: this.kibanaVersion,
      logger: this.logger,
      alertingPluginSetupContract: plugins.alerting,
      writeEnabled: this.config.writeEnabled,
    });

    // ALERTS ROUTES
    core.http.registerRouteHandlerContext<RacRequestHandlerContext, 'ruleRegistry'>(
      'ruleRegistry',
      this.createRouteHandlerContext()
    );

    const router = core.http.createRouter<RacRequestHandlerContext>();
    // handler is called when '/path' resource is requested with `GET` method
    router.get({ path: '/rac-myfakepath', validate: false }, async (context, req, res) => {
      const racClient = await context.ruleRegistry?.getRacClient();
      console.error(`WHATS IN THE RAC CLIENT`, racClient);
      racClient?.get({ id: 'hello world' });
      return res.ok();
    });

    return rootRegistry;
  }

  public start(core: CoreStart, plugins: RacPluginsStart) {
    const { logger, security, racClientFactory } = this;

    racClientFactory.initialize({
      logger,
      securityPluginSetup: security,
      securityPluginStart: plugins.security,
      getSpaceId(request: KibanaRequest) {
        return plugins.spaces?.spacesService.getSpaceId(request);
      },
      async getSpace(request: KibanaRequest) {
        return plugins.spaces?.spacesService.getActiveSpace(request);
      },
      features: plugins.features,
      kibanaVersion: this.kibanaVersion,
    });

    const getRacClientWithRequest = (request: KibanaRequest) => {
      return racClientFactory!.create(request);
    };

    return {
      getRacClientWithRequest,
      alerting: plugins.alerting,
    };
  }

  private createRouteHandlerContext = (): IContextProvider<
    RacRequestHandlerContext,
    'ruleRegistry'
  > => {
    const { racClientFactory } = this;
    return async function alertsRouteHandlerContext(
      context,
      request
    ): Promise<RacApiRequestHandlerContext> {
      return {
        getRacClient: async () => {
          const createdClient = racClientFactory!.create(request);
          return createdClient;
        },
      };
    };
  };

  public stop() {}
}
