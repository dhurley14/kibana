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
import { SavedObject, DataViewAttributes } from '@kbn/data-views-plugin/common';
import type * as estypes from '@elastic/elasticsearch/lib/api/typesWithBodyKey';

import { DEFAULT_INDEX_KEY, DEFAULT_INDEX_PATTERN } from '../../../../common/constants';
import { ExperimentalFeatures } from '../../../../common/experimental_features';
import { withSecuritySpan } from '../../../utils/with_security_span';

export interface GetInputIndex {
  experimentalFeatures?: ExperimentalFeatures;
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
  // Determines whether user wants rules to run using
  // data views or not. If set to `true`, rules will cease
  // using the dataViewId and fall back to the `indexPattern`
  const dataViewConfiguration = await withSecuritySpan('getDefaultIndex', () =>
    services.savedObjectsClient.get<{
      'securitySolution:strictlyUseRuleIndexPatternsDescription': boolean;
    }>('config', version)
  );

  // Data views allowed and rule has a data view defined,
  // use it
  console.log({ dataViewConfiguration, dataViewId });
  if (!dataViewConfiguration && dataViewId != null) {
    // Check to see that the selected dataView exists
    const dataView = await services.savedObjectsClient.get<DataViewAttributes>(
      'index-pattern',
      dataViewId
    );
    // if no data view is found, return null and error
    if (dataView == null) {
      return {
        index: null,
        runtimeMappings: null,
        errorToWrite: `This rule is attempting to query data from a Kibana Data View listed in the "Data View" section of the rule definition, however no data view matching: ${JSON.stringify(
          dataViewId
        )} was found. This warning will continue to appear until a matching data view is created or this rule is disabled.`,
      };
    }

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
        runtimeMappings: null,
        warningToWrite: getWarningToWrite(dataViewConfiguration, dataViewId, index),
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
          runtimeMappings: null,
          warningToWrite: getWarningToWrite(
            dataViewConfiguration,
            dataViewId,
            configuration.attributes[DEFAULT_INDEX_KEY]
          ),
        };
      } else {
        return {
          index: DEFAULT_INDEX_PATTERN,
          runtimeMappings: null,
          warningToWrite: getWarningToWrite(
            dataViewConfiguration,
            dataViewId,
            DEFAULT_INDEX_PATTERN
          ),
        };
      }
    }
  }
};

export const getWarningToWrite = (
  dataViewConfiguration: SavedObject<{
    'securitySolution:strictlyUseRuleIndexPatternsDescription': boolean;
  }>,
  dataViewId: string | null | undefined,
  pattern: string[]
): string | undefined => {
  if (dataViewConfiguration && dataViewId != null) {
    return `This rule is attempting to query data from a Kibana Data View listed in the "Data View" section of the rule definition matching: ${JSON.stringify(
      dataViewId
    )}. However, data view support has been disabled in Advanced Settings. Rule will fall back to using the index pattern listed in the "Index Patterns" section of the rule definition matching ${JSON.stringify(
      pattern
    )}.`;
  } else {
    return undefined;
  }
};
