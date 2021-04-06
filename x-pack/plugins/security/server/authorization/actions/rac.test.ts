/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { RacActions } from './rac';

const version = '1.0.0-zeta1';

describe('#get', () => {
  [null, undefined, '', 1, true, {}].forEach((operation: any) => {
    test(`operation of ${JSON.stringify(operation)} throws error`, () => {
      const racActions = new RacActions(version);
      expect(() => racActions.get('consumer', operation)).toThrowErrorMatchingSnapshot();
    });
  });

  [null, '', 1, true, undefined, {}].forEach((consumer: any) => {
    test(`consumer of ${JSON.stringify(consumer)} throws error`, () => {
      const racActions = new RacActions(version);
      expect(() => racActions.get(consumer, 'operation')).toThrowErrorMatchingSnapshot();
    });
  });

  test('returns `rac:${owner}/${operation}`', () => {
    const racActions = new RacActions(version);
    expect(racActions.get('owner', 'bar-operation')).toBe('rac:1.0.0-zeta1:owner/bar-operation');
  });
});
