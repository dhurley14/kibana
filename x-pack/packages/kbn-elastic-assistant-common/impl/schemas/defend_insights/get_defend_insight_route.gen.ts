/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/*
 * NOTICE: Do not edit this file manually.
 * This file is automatically generated by the OpenAPI Generator, @kbn/openapi-generator.
 *
 * info:
 *   title: Get Defend Insight API endpoint
 *   version: 1
 */

import { z } from '@kbn/zod';

import { NonEmptyString } from '../common_attributes.gen';
import { DefendInsightsResponse } from './common_attributes.gen';

export type DefendInsightGetRequestParams = z.infer<typeof DefendInsightGetRequestParams>;
export const DefendInsightGetRequestParams = z.object({
  /**
   * The Defend insight id
   */
  id: NonEmptyString,
});
export type DefendInsightGetRequestParamsInput = z.input<typeof DefendInsightGetRequestParams>;

export type DefendInsightGetResponse = z.infer<typeof DefendInsightGetResponse>;
export const DefendInsightGetResponse = z.object({
  data: DefendInsightsResponse.nullable().optional(),
});
