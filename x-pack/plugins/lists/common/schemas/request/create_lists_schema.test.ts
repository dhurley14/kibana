/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { left } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/pipeable';

import { getPaths, foldLeftRight, exactCheck } from '../../siem_common_deps';

import { getListRequest } from './__mocks__/utils';
import { createListsSchema } from './create_lists_schema';

describe('lists', () => {
  // TODO: Finish the tests for this
  test('it should validate a typical lists request', () => {
    const payload = getListRequest();
    const decoded = createListsSchema.decode(payload);
    const checked = exactCheck(payload, decoded);
    const message = pipe(checked, foldLeftRight);

    expect(getPaths(left(message.errors))).toEqual([]);
    expect(message.schema).toEqual({
      description: 'Description of a list item',
      id: 'some-list-id',
      name: 'Name of a list item',
      type: 'ip',
    });
  });
});
