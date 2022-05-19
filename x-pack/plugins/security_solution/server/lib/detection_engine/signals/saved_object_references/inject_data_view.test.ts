/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { loggingSystemMock } from '@kbn/core/server/mocks';
import { SavedObjectReference } from '@kbn/core/server';
import { injectDataViewReferences } from './inject_data_view';

describe('inject_data_view', () => {
  type FuncReturn = ReturnType<typeof injectDataViewReferences>;
  let logger = loggingSystemMock.create().get('security_solution');
  const mockSavedObjectReferences = (): SavedObjectReference[] => [
    {
      id: 'logs-*',
      name: 'dataViewId_0',
      type: 'index-pattern',
    },
  ];

  beforeEach(() => {
    logger = loggingSystemMock.create().get('security_solution');
  });

  test('returns undefined given an empty "dataViewId" and "savedObjectReferences"', () => {
    expect(
      injectDataViewReferences({
        logger,
        dataViewId: ' ',
        savedObjectReferences: [],
      })
    ).toBeUndefined();
  });

  test('returns undefined given undefined for "dataViewId"', () => {
    expect(
      injectDataViewReferences({
        logger,
        dataViewId: undefined,
        savedObjectReferences: [],
      })
    ).toBeUndefined();
  });

  test('returns undefined given null for "dataViewId"', () => {
    expect(
      injectDataViewReferences({
        logger,
        dataViewId: null,
        savedObjectReferences: [],
      })
    ).toBeUndefined();
  });

  test('returns "dataViewId given an empty array for "savedObjectReferences"', () => {
    expect(
      injectDataViewReferences({
        logger,
        dataViewId: 'logs-*',
        savedObjectReferences: [],
      })
    ).toEqual<FuncReturn>('logs-*');
  });

  test('returns parameters from the saved object if found', () => {
    expect(
      injectDataViewReferences({
        logger,
        dataViewId: 'logs-*',
        savedObjectReferences: mockSavedObjectReferences(),
      })
    ).toEqual<FuncReturn>('logs-*');
  });

  test('returns parameters from the saved object if found with a different saved object reference id', () => {
    expect(
      injectDataViewReferences({
        logger,
        dataViewId: 'logs-*',
        savedObjectReferences: [{ ...mockSavedObjectReferences()[0], id: 'auditbeat-*' }],
      })
    ).toEqual<FuncReturn>('auditbeat-*');
  });

  test('returns exceptionItem if the saved object reference cannot match as a fall back', () => {
    expect(
      injectDataViewReferences({
        logger,
        dataViewId: 'logs-*',
        savedObjectReferences: [{ ...mockSavedObjectReferences()[0], name: 'other-name_0' }],
      })
    ).toEqual<FuncReturn>('logs-*');
  });

  test('logs an error if the saved object type could not be found', () => {
    injectDataViewReferences({
      logger,
      dataViewId: 'logs-*',
      savedObjectReferences: [{ ...mockSavedObjectReferences()[0], name: 'other-name_0' }],
    });
    expect(logger.error).toBeCalledWith(
      'The saved object references were not found for our dataViewId when we were expecting to find it. Kibana migrations might not have run correctly or someone might have removed the saved object references manually. Returning the last known good dataViewId which might not work. Value being returned is: \"logs-*\"'
    );
  });
});
