/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  secOnly,
  secOnlyRead,
  globalRead,
  obsOnly,
  obsOnlyRead,
  obsOnlySpacesAll,
  obsOnlyReadSpacesAll,
  obsSec,
  obsSecRead,
  superUser,
  noKibanaPrivileges,
} from '../../../common/lib/authentication/users';
import { FtrProviderContext } from '../../../common/ftr_provider_context';
import { getSpaceUrlPrefix } from '../../../common/lib/authentication/spaces';

// eslint-disable-next-line import/no-default-export
export default ({ getService }: FtrProviderContext) => {
  const supertestWithoutAuth = getService('supertestWithoutAuth');
  const supertest = getService('supertest');
  const esArchiver = getService('esArchiver');

  const TEST_URL = '/api/rac/alerts';
  const SPACE1 = 'space1';
  const SPACE2 = 'space2';

  describe('rbac', () => {
    describe('Users update alert:', () => {
      beforeEach(async () => {
        await esArchiver.load('rule_registry/alerts');
      });
      afterEach(async () => {
        await esArchiver.unload('rule_registry/alerts');
      });
      it(`${superUser.username} should be able to update the APM alert in ${SPACE1}`, async () => {
        const res = await supertestWithoutAuth
          .post(`${getSpaceUrlPrefix(SPACE1)}${TEST_URL}`)
          .auth(superUser.username, superUser.password)
          .set('kbn-xsrf', 'true')
          .send({ ids: ['NoxgpHkBqbdrfX07MqXV'], status: 'closed', assetName: 'observability-apm' })
          .expect(200);
      });
      it(`${globalRead.username} should NOT be able to access the APM alert in ${SPACE1}`, async () => {
        const res = await supertestWithoutAuth
          .post(`${getSpaceUrlPrefix(SPACE1)}${TEST_URL}`)
          .auth(globalRead.username, globalRead.password)
          .set('kbn-xsrf', 'true')
          .send({ ids: ['NoxgpHkBqbdrfX07MqXV'], status: 'closed', assetName: 'observability-apm' })
          .expect(403);
      });
      it(`${obsOnlySpacesAll.username} should be able to update the APM alert in ${SPACE1}`, async () => {
        const res = await supertestWithoutAuth
          .post(`${getSpaceUrlPrefix(SPACE1)}${TEST_URL}`)
          .auth(obsOnlySpacesAll.username, obsOnlySpacesAll.password)
          .set('kbn-xsrf', 'true')
          .send({ ids: ['NoxgpHkBqbdrfX07MqXV'], status: 'closed', assetName: 'observability-apm' })
          .expect(200);
      });
      it(`${obsOnlyReadSpacesAll.username} should NOT be able to update the APM alert in ${SPACE1}`, async () => {
        const res = await supertestWithoutAuth
          .post(`${getSpaceUrlPrefix(SPACE1)}${TEST_URL}`)
          .auth(obsOnlyReadSpacesAll.username, obsOnlyReadSpacesAll.password)
          .set('kbn-xsrf', 'true')
          .send({ ids: ['NoxgpHkBqbdrfX07MqXV'], status: 'closed', assetName: 'observability-apm' })
          .expect(403);
      });

      for (const scenario of [
        {
          user: noKibanaPrivileges,
        },
        {
          user: secOnly,
        },
        {
          user: secOnlyRead,
        },
      ]) {
        it(`${scenario.user.username} should NOT be able to update the APM alert in ${SPACE1}`, async () => {
          await supertestWithoutAuth
            .post(`${getSpaceUrlPrefix(SPACE1)}${TEST_URL}`)
            .auth(scenario.user.username, scenario.user.password)
            .set('kbn-xsrf', 'true')
            .send({
              ids: ['NoxgpHkBqbdrfX07MqXV'],
              status: 'closed',
              assetName: 'observability-apm',
            })
            .expect(403);
        });
      }
    });

    describe('Space:', () => {
      beforeEach(async () => {
        await esArchiver.load('rule_registry/alerts');
      });
      afterEach(async () => {
        await esArchiver.unload('rule_registry/alerts');
      });
      it(`${superUser.username} should be able to update the APM alert in ${SPACE2}`, async () => {
        await supertestWithoutAuth
          .post(`${getSpaceUrlPrefix(SPACE2)}${TEST_URL}`)
          .auth(superUser.username, superUser.password)
          .set('kbn-xsrf', 'true')
          .send({
            ids: ['NoxgpHkBqbdrfX07MqXV'],
            status: 'closed',
            assetName: 'observability-apm',
          })
          .expect(200);
      });
      it(`${globalRead.username} should NOT be able to update the APM alert in ${SPACE2}`, async () => {
        await supertestWithoutAuth
          .post(`${getSpaceUrlPrefix(SPACE2)}${TEST_URL}`)
          .auth(globalRead.username, globalRead.password)
          .set('kbn-xsrf', 'true')
          .send({
            ids: ['NoxgpHkBqbdrfX07MqXV'],
            status: 'closed',
            assetName: 'observability-apm',
          })
          .expect(403);
      });

      for (const scenario of [
        { user: secOnly },
        { user: secOnlyRead },
        { user: obsSec },
        { user: obsSecRead },
        {
          user: noKibanaPrivileges,
        },
        {
          user: obsOnly,
        },
        {
          user: obsOnlyRead,
        },
      ]) {
        it(`${scenario.user.username} with right to access space1 only, should NOT be able to update the APM alert in ${SPACE2}`, async () => {
          await supertestWithoutAuth
            .post(`${getSpaceUrlPrefix(SPACE2)}${TEST_URL}`)
            .auth(scenario.user.username, scenario.user.password)
            .set('kbn-xsrf', 'true')
            .send({
              ids: ['NoxgpHkBqbdrfX07MqXV'],
              status: 'closed',
              assetName: 'observability-apm',
            })
            .expect(403);
        });
      }
    });

    describe('extra params', () => {
      beforeEach(async () => {
        await esArchiver.load('rule_registry/alerts');
      });
      afterEach(async () => {
        await esArchiver.unload('rule_registry/alerts');
      });
      it('should NOT allow to pass a filter query parameter', async () => {
        await supertest
          .post(`${getSpaceUrlPrefix(SPACE1)}${TEST_URL}`)
          .set('kbn-xsrf', 'true')
          .send({
            ids: ['NoxgpHkBqbdrfX07MqXV'],
            status: 'closed',
            sortOrder: 'asc',
            namespaces: '*',
            assetName: 'observability-apm',
          })
          .expect(400);
      });

      it('should NOT allow to pass a non supported query parameter', async () => {
        await supertest
          .post(`${getSpaceUrlPrefix(SPACE1)}${TEST_URL}`)
          .set('kbn-xsrf', 'true')
          .send({
            ids: ['NoxgpHkBqbdrfX07MqXV'],
            status: 'closed',
            notExists: 'something',
            assetName: 'observability-apm',
          })
          .expect(400);
      });
    });
  });
};
