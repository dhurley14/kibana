/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

/* eslint-disable @typescript-eslint/camelcase */

import * as t from 'io-ts';

import {
  meta,
  updated_at,
  updated_by,
  list_id,
  created_at,
  created_by,
  tie_breaker_id,
  esDataTypeUnion,
} from '../common/schemas';

export const createEsListsItemsSchema = t.intersection([
  t.exact(
    t.type({
      list_id,
      created_at,
      created_by,
      updated_at,
      updated_by,
      tie_breaker_id,
    })
  ),
  esDataTypeUnion,
  t.exact(t.partial({ meta })),
]);

export type CreateEsListsItemsSchema = t.TypeOf<typeof createEsListsItemsSchema>;
