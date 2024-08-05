/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import {
  ELASTIC_HTTP_VERSION_HEADER,
  X_ELASTIC_INTERNAL_ORIGIN_REQUEST,
} from '@kbn/core-http-common';
import { LIST_URL, INTERNAL_FIND_LISTS_BY_SIZE } from '@kbn/securitysolution-list-constants';
import { getCreateMinimalListSchemaMock } from '@kbn/lists-plugin/common/schemas/request/create_list_schema.mock';
import { getListResponseMockWithoutAutoGeneratedValues } from '@kbn/lists-plugin/common/schemas/response/list_schema.mock';

import TestAgent from 'supertest/lib/agent';
import {
  createListsIndex,
  deleteListsIndex,
  removeListServerGeneratedProperties,
} from '../../../utils';

import { FtrProviderContext } from '../../../../../ftr_provider_context';

export default ({ getService }: FtrProviderContext): void => {
  const log = getService('log');
  const utils = getService('securitySolutionUtils');

  describe('@ess @serverless find_lists_by_size', () => {
    let supertest: TestAgent;

    before(async () => {
      supertest = await utils.createSuperTest();
    });
    describe('find lists by size', () => {
      beforeEach(async () => {
        await createListsIndex(supertest, log);
      });

      afterEach(async () => {
        await deleteListsIndex(supertest, log);
      });

      it('should return an empty found body correctly if no lists are loaded', async () => {
        const { body } = await supertest
          .get(`${INTERNAL_FIND_LISTS_BY_SIZE}`)
          .set('kbn-xsrf', 'true')
          .set(X_ELASTIC_INTERNAL_ORIGIN_REQUEST, 'kibana')
          .set(ELASTIC_HTTP_VERSION_HEADER, '1')
          .send()
          .expect(200);

        expect(body).to.eql({
          largeLists: [],
          smallLists: [],
        });
      });

      it('should return sorted lists when lists are loaded from a find with defaults added', async () => {
        // add a small list
        await supertest
          .post(LIST_URL)
          .set('kbn-xsrf', 'true')
          .send(getCreateMinimalListSchemaMock())
          .expect(200);

        // add a large list
        await supertest
          .post(LIST_URL)
          .set('kbn-xsrf', 'true')
          .send({ ...getCreateMinimalListSchemaMock(), id: 'some-other-list-id', type: 'text' })
          .expect(200);

        // query the single list from _find_by_size
        const { body } = await supertest
          .get(`${INTERNAL_FIND_LISTS_BY_SIZE}`)
          .set('kbn-xsrf', 'true')
          .set(X_ELASTIC_INTERNAL_ORIGIN_REQUEST, 'kibana')
          .set(ELASTIC_HTTP_VERSION_HEADER, '1')
          .send()
          .expect(200);

        body.smallLists = [removeListServerGeneratedProperties(body.smallLists[0])];
        body.largeLists = [removeListServerGeneratedProperties(body.largeLists[0])];
        // cursor is a constant changing value so we have to delete it as well.
        delete body.cursor;

        const username = await utils.getUsername();
        expect(body).to.eql({
          smallLists: [getListResponseMockWithoutAutoGeneratedValues(username)],
          largeLists: [
            {
              ...getListResponseMockWithoutAutoGeneratedValues(username),
              type: 'text',
            },
          ],
        });
      });
    });
  });
};
