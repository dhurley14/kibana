/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

/* eslint-disable @typescript-eslint/camelcase */

import * as t from 'io-ts';

export const name = t.string;
export const description = t.string;
export const list_id = t.string;
export const item = t.string;
export const meta = t.object;
export const created_at = t.string; // TODO: Make this into an ISO Date string check
export const updated_at = t.string; // TODO: Make this into an ISO Date string check
export const type = t.string; // TODO: Make this an enum of possible type values such as ip, string, etc...
export const file = t.object;
export const id = t.string;
export const value = t.string;
export const tie_breaker_id = t.string; // TODO: Use UUID for this instead of a string for validation
