/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type SuperTest from 'supertest';
import type { ToolingLog } from '@kbn/dev-utils';
import { DETECTION_ENGINE_INDEX_URL } from '../../../plugins/security_solution/common/constants';
import { countDownTest } from './count_down_test';

/**
 * Deletes the signals index for use inside of afterEach blocks of tests
 * @param supertest The supertest client library
 */
export const deleteSignalsIndex = async (
  supertest: SuperTest.SuperTest<SuperTest.Test>,
  log: ToolingLog
): Promise<void> => {
  await countDownTest(
    async () => {
      await supertest.delete(DETECTION_ENGINE_INDEX_URL).set('kbn-xsrf', 'true').send();
      return {
        passed: true,
      };
    },
    'deleteSignalsIndex',
    log
  );
};
