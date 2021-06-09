/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { map, flatMap, mergeMap } from 'rxjs/operators';
import { from } from 'rxjs';
import {
  ISearchStrategy,
  PluginStart,
  shimHitsTotal,
} from '../../../../../../src/plugins/data/server';
import {
  PluginStartContract as AlertPluginStartContract,
  AlertingAuthorizationEntity,
  AlertingAuthorizationFilterType,
} from '../../../../alerting/server';
import {
  TimelineFactoryQueryTypes,
  TimelineStrategyResponseType,
  TimelineStrategyRequestType,
} from '../../../common/search_strategy/timeline';
import { securitySolutionTimelineFactory } from './factory';
import { SecuritySolutionTimelineFactory } from './factory/types';

export const securitySolutionTimelineSearchStrategyProvider = <T extends TimelineFactoryQueryTypes>(
  data: PluginStart,
  alerting: AlertPluginStartContract
): ISearchStrategy<TimelineStrategyRequestType<T>, TimelineStrategyResponseType<T>> => {
  const es = data.search.searchAsInternalUser;
  return {
    search: (request, options, deps) => {
      const factoryQueryType = request.factoryQueryType;

      if (factoryQueryType == null) {
        throw new Error('factoryQueryType is required');
      }
      const alertingAuthorizationClient = alerting.getAlertingAuthorizationWithRequest(
        deps.request
      );

      const queryFactory: SecuritySolutionTimelineFactory<T> =
        securitySolutionTimelineFactory[factoryQueryType];

      const getAuthFilter = async () => {
        return alertingAuthorizationClient.getFindAuthorizationFilter(
          AlertingAuthorizationEntity.Alert,
          {
            type: AlertingAuthorizationFilterType.ESDSL,
            fieldNames: { consumer: 'kibana.rac.alert.owner', ruleTypeId: 'rule.id' },
          }
        );
      };

      return from(getAuthFilter()).pipe(
        flatMap(({ filter }) => {
          const dsl = queryFactory.buildDsl({ ...request, authFilter: filter });
          return es.search({ ...request, params: dsl }, options, deps);
        }),
        map((response) => {
          return {
            ...response,
            ...{
              rawResponse: shimHitsTotal(response.rawResponse, options),
            },
          };
        }),
        mergeMap((esSearchRes) => queryFactory.parse(request, esSearchRes))
      );
    },
    cancel: async (id, options, deps) => {
      if (es.cancel) {
        return es.cancel(id, options, deps);
      }
    },
  };
};
