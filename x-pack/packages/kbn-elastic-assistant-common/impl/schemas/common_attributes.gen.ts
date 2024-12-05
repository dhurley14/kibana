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
 *   title: Common Elastic AI Assistant Attributes
 *   version: not applicable
 */

import { z } from '@kbn/zod';
import { isNonEmptyString } from '@kbn/zod-helpers';

/**
 * A string that does not contain only whitespace
 */
export type NonEmptyString = z.infer<typeof NonEmptyString>;
export const NonEmptyString = z.string().min(1).superRefine(isNonEmptyString);

/**
 * A universally unique identifier
 */
export type UUID = z.infer<typeof UUID>;
export const UUID = z.string().uuid();

/**
 * Could be any string, not necessarily a UUID
 */
export type User = z.infer<typeof User>;
export const User = z.object({
  /**
   * User id
   */
  id: z.string().optional(),
  /**
   * User name
   */
  name: z.string().optional(),
});

export type SortOrder = z.infer<typeof SortOrder>;
export const SortOrder = z.enum(['asc', 'desc']);
export type SortOrderEnum = typeof SortOrder.enum;
export const SortOrderEnum = SortOrder.enum;
