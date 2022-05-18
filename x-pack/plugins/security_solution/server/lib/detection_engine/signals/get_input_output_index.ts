/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  AlertInstanceContext,
  AlertInstanceState,
  RuleExecutorServices,
} from '@kbn/alerting-plugin/server';
import { DataViewAttributes } from '@kbn/data-views-plugin/common';
import type * as estypes from '@elastic/elasticsearch/lib/api/typesWithBodyKey';

import { DEFAULT_INDEX_KEY, DEFAULT_INDEX_PATTERN } from '../../../../common/constants';
import { withSecuritySpan } from '../../../utils/with_security_span';

export interface GetInputIndex {
  index: string[] | null | undefined;
  services: RuleExecutorServices<AlertInstanceState, AlertInstanceContext, 'default'>;
  version: string;
  dataViewId?: string | null;
}

export interface GetInputIndexReturn {
  index: string[] | null;
  runtimeMappings: estypes.MappingRuntimeFields | null;
  errorToWrite?: string;
  warningToWrite?: string;
}

export const getInputIndex = async ({
  index,
  services,
  version,
  dataViewId,
}: GetInputIndex): Promise<GetInputIndexReturn> => {
  // If data views defined, use it
  if (dataViewId != null && dataViewId !== '') {
    // Check to see that the selected dataView exists
    const dataView = await services.savedObjectsClient.get<DataViewAttributes>(
      'index-pattern',
      dataViewId
    );

    // if data view does exist, return it and it's runtimeMappings
    return {
      index: dataView.attributes.title.split(','),
      runtimeMappings:
        dataView.attributes.runtimeFieldMap != null
          ? JSON.parse(dataView.attributes.runtimeFieldMap)
          : null,
    };
  } else {
    if (index != null) {
      return {
        index,
        runtimeMappings: {},
      };
    } else {
      const configuration = await withSecuritySpan('getDefaultIndex', () =>
        services.savedObjectsClient.get<{
          'securitySolution:defaultIndex': string[];
        }>('config', version)
      );
      if (configuration.attributes != null && configuration.attributes[DEFAULT_INDEX_KEY] != null) {
        return {
          index: configuration.attributes[DEFAULT_INDEX_KEY],
          runtimeMappings: {},
        };
      } else {
        return {
          index: DEFAULT_INDEX_PATTERN,
          runtimeMappings: {},
        };
      }
    }
  }
};
