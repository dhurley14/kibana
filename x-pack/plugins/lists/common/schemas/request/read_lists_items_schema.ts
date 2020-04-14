/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

/* eslint-disable @typescript-eslint/camelcase */

import * as t from 'io-ts';

import { list_id, id, value } from '../common/schemas';

// TODO: Type Dependent check where there has to be at least ip or another field present?
export const readListsItemsSchema = t.exact(t.partial({ id, list_id, value }));

export type ReadListsItemsSchema = t.TypeOf<typeof readListsItemsSchema>;
