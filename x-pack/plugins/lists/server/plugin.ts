/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

/* eslint-disable consistent-return */

import { first } from 'rxjs/operators';
import { ElasticsearchServiceSetup, Logger, Plugin, PluginInitializerContext } from 'kibana/server';
import { CoreSetup } from 'src/core/server';
import { APICaller } from 'target/types/core/server/elasticsearch/api_types';

import { SecurityPluginSetup } from '../../security/server';
import { SpacesServiceSetup } from '../../spaces/server';

import { ConfigType } from './config';
import { initRoutes } from './routes/init_routes';
import { ListClient } from './services/lists/client';
import { ContextProvider, ContextProviderReturn, PluginsSetup } from './types';
import { createConfig$ } from './create_config';

export type ListClientType = InstanceType<typeof ListClient>;
export type GetListClientType = (dataClient: APICaller, spaceId: string) => ListClient;
export interface ListPluginSetup {
  getListClient: GetListClientType;
}
export type ListsPluginStart = void;
export class ListPlugin
  implements Plugin<Promise<ListPluginSetup>, ListsPluginStart, PluginsSetup> {
  private readonly logger: Logger;
  private spaces: SpacesServiceSetup | undefined | null;
  private config: ConfigType | undefined | null;
  private elasticsearch: ElasticsearchServiceSetup | undefined | null;
  private security: SecurityPluginSetup | undefined | null;

  constructor(private readonly initializerContext: PluginInitializerContext) {
    this.logger = this.initializerContext.logger.get();
  }

  public async setup(core: CoreSetup, plugins: PluginsSetup): Promise<ListPluginSetup> {
    const config = await createConfig$(this.initializerContext)
      .pipe(first())
      .toPromise();

    this.spaces = plugins.spaces?.spacesService;
    this.config = config;
    this.elasticsearch = core.elasticsearch;
    this.security = plugins.security;

    if (config.enabled) {
      core.http.registerRouteHandlerContext('lists', this.createRouteHandlerContext());
    }
    const router = core.http.createRouter();
    initRoutes(router);
    return {
      getListClient: (apiCaller, spaceId): ListClient => {
        // create adapter for apicaller / dataclient and space / space id
        // just fake the request object with the spaceid on it.
        if (this.security != null) {
          return new ListClient({
            apiCaller,
            config,
            dataClient: undefined,
            request: undefined,
            security: this.security,
            spaceId,
            spaces: this.spaces,
          });
        }
        throw new TypeError('Security plugin is required for this plugin to operate');
      },
    };
  }

  public start(): void {
    this.logger.debug('Starting plugin');
  }

  public stop(): void {
    this.logger.debug('Stopping plugin');
  }

  private createRouteHandlerContext = (): ContextProvider => {
    return async (context, request): ContextProviderReturn => {
      const { spaces, config, security, elasticsearch } = this;
      const {
        core: {
          elasticsearch: { dataClient },
        },
      } = context;
      if (config == null) {
        throw new TypeError('Configuration is required for this plugin to operate');
      } else if (elasticsearch == null) {
        throw new TypeError('Elastic Search is required for this plugin to operate');
      } else if (security == null) {
        // TODO: This might be null, test authentication being turned off.
        throw new TypeError('Security plugin is required for this plugin to operate');
      } else {
        return {
          getListClient: (): ListClient =>
            new ListClient({
              apiCaller: undefined,
              config,
              dataClient,
              request,
              security,
              spaceId: undefined,
              spaces,
            }),
        };
      }
    };
  };
}
