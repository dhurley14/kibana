/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';

import {
  superUser,
  globalRead,
  obsOnly,
  obsOnlyRead,
  obsSec,
  obsSecRead,
  secOnly,
  secOnlyRead,
} from '../../../../common/lib/authentication/users';
import type { User } from '../../../../common/lib/authentication/types';
import { FtrProviderContext } from '../../../../common/ftr_provider_context';
import { getSpaceUrlPrefix } from '../../../../common/lib/authentication/spaces';

/*
 * Note - these tests focus on ensuring that the correct access
 * is granted based on spaces
 * For read/write and index specific testing see tests in the /spaces folder
 */

// eslint-disable-next-line import/no-default-export
export default ({ getService }: FtrProviderContext) => {
  const supertestWithoutAuth = getService('supertestWithoutAuth');
  const esArchiver = getService('esArchiver');

  const TEST_URL = '/internal/rac/alerts';
  const ALERTS_INDEX_URL = `${TEST_URL}/index`;
  const SPACE1 = 'space1';
  const SPACE2 = 'space2';
  const APM_ALERT_ID = 'NoxgpHkBqbdrfX07MqXV';
  const SECURITY_SOLUTION_ALERT_ID = '020202';

  const getAPMIndexName = async (user: User) => {
    const {
      body: indexNames,
    }: { body: { index_name: string[] | undefined } } = await supertestWithoutAuth
      .get(`${getSpaceUrlPrefix(SPACE1)}${ALERTS_INDEX_URL}`)
      .auth(user.username, user.password)
      .set('kbn-xsrf', 'true')
      .expect(200);
    const observabilityIndex = indexNames?.index_name?.find(
      (indexName) => indexName === '.alerts-observability-apm'
    );
    expect(observabilityIndex).to.eql('.alerts-observability-apm');
    return observabilityIndex;
  };

  const getSecuritySolutionIndexName = async (user: User) => {
    const {
      body: indexNames,
    }: { body: { index_name: string[] | undefined } } = await supertestWithoutAuth
      .get(`${getSpaceUrlPrefix(SPACE1)}${ALERTS_INDEX_URL}`)
      .auth(user.username, user.password)
      .set('kbn-xsrf', 'true')
      .expect(200);
    const securitySolution = indexNames?.index_name?.find(
      (indexName) => indexName === '.alerts-security-solution'
    );
    expect(securitySolution).to.eql('.alerts-security-solution');
    return securitySolution;
  };

  describe('Get alert - RBAC - spaces', () => {
    before(async () => {
      await esArchiver.load('x-pack/test/functional/es_archives/rule_registry/alerts');
    });

    xdescribe('Security Solution', () => {
      let securitySolutionIndex: string | undefined;

      before(async () => {
        securitySolutionIndex = await getSecuritySolutionIndexName(superUser);
      });

      // these users have access to spaces: ['*']
      [superUser, globalRead]
        .map((role) => ({
          user: role,
        }))
        .forEach(({ user }) => {
          it(`${user.username} should be able to access alerts in ${SPACE1}`, async () => {
            await supertestWithoutAuth
              .get(
                `${getSpaceUrlPrefix(
                  SPACE1
                )}${TEST_URL}?id=${SECURITY_SOLUTION_ALERT_ID}&index=${securitySolutionIndex}`
              )
              .auth(user.username, user.password)
              .set('kbn-xsrf', 'true')
              .expect(200);
          });
        });

      // these users have access to spaces: ['*']
      [superUser, globalRead]
        .map((role) => ({
          user: role,
        }))
        .forEach(({ user }) => {
          it(`${user.username} should be able to access alerts in ${SPACE2}`, async () => {
            await supertestWithoutAuth
              .get(
                `${getSpaceUrlPrefix(
                  SPACE2
                )}${TEST_URL}?id=${SECURITY_SOLUTION_ALERT_ID}&index=${securitySolutionIndex}`
              )
              .auth(user.username, user.password)
              .set('kbn-xsrf', 'true')
              .expect(200);
          });
        });

      // these users have access to Security Solution alerts spaces: ['space1']
      [secOnly, secOnlyRead, obsSec, obsSecRead]
        .map((role) => ({
          user: role,
        }))
        .forEach(({ user }) => {
          it(`${user.username} with right to access space1 APM alerts, should be able to access the APM alert in ${SPACE1}`, async () => {
            await supertestWithoutAuth
              .get(
                `${getSpaceUrlPrefix(
                  SPACE1
                )}${TEST_URL}?id=${SECURITY_SOLUTION_ALERT_ID}&index=${securitySolutionIndex}`
              )
              .auth(user.username, user.password)
              .set('kbn-xsrf', 'true')
              .expect(200);
          });
        });

      // these users have access to Security Solution alerts spaces: ['space1']
      [secOnly, secOnlyRead, obsSec, obsSecRead]
        .map((role) => ({
          user: role,
        }))
        .forEach(({ user }) => {
          it(`${user.username} with right to access space1 APM alerts, should NOT be able to access the APM alert in ${SPACE2}`, async () => {
            await supertestWithoutAuth
              .get(
                `${getSpaceUrlPrefix(
                  SPACE2
                )}${TEST_URL}?id=${SECURITY_SOLUTION_ALERT_ID}&index=${securitySolutionIndex}`
              )
              .auth(user.username, user.password)
              .set('kbn-xsrf', 'true')
              .expect(403);
          });
        });
    });

    describe('APM', () => {
      let apmIndex: string | undefined;

      before(async () => {
        apmIndex = await getAPMIndexName(superUser);
      });

      [
        // these users have access to spaces: ['*']
        superUser,
        globalRead,
      ]
        .map((role) => ({
          user: role,
        }))
        .forEach(({ user }) => {
          it(`${user.username} should be able to access alerts in ${SPACE1}`, async () => {
            await supertestWithoutAuth
              .get(`${getSpaceUrlPrefix(SPACE1)}${TEST_URL}?id=${APM_ALERT_ID}&index=${apmIndex}`)
              .auth(user.username, user.password)
              .set('kbn-xsrf', 'true')
              .expect(200);
          });
        });

      [
        // these users have access to spaces: ['*']
        superUser,
        globalRead,
      ]
        .map((role) => ({
          user: role,
        }))
        .forEach(({ user }) => {
          it(`${user.username} should be able to access alerts in ${SPACE2}`, async () => {
            await supertestWithoutAuth
              .get(`${getSpaceUrlPrefix(SPACE2)}${TEST_URL}?id=${APM_ALERT_ID}&index=${apmIndex}`)
              .auth(user.username, user.password)
              .set('kbn-xsrf', 'true')
              .expect(200);
          });
        });

      // these users have access to APM alerts spaces: ['space1']
      [obsOnly, obsOnlyRead, obsSec, obsSecRead]
        .map((role) => ({
          user: role,
        }))
        .forEach(({ user }) => {
          it(`${user.username} with right to access space1 APM alerts, should be able to access the APM alert in ${SPACE1}`, async () => {
            await supertestWithoutAuth
              .get(`${getSpaceUrlPrefix(SPACE1)}${TEST_URL}?id=${APM_ALERT_ID}&index=${apmIndex}`)
              .auth(user.username, user.password)
              .set('kbn-xsrf', 'true')
              .expect(200);
          });
        });

      // these users have access to APM alerts spaces: ['space1']
      [obsOnly, obsOnlyRead, obsSec, obsSecRead]
        .map((role) => ({
          user: role,
        }))
        .forEach(({ user }) => {
          it(`${user.username} with right to access space1 APM alerts, should NOT be able to access the APM alert in ${SPACE2}`, async () => {
            await supertestWithoutAuth
              .get(`${getSpaceUrlPrefix(SPACE2)}${TEST_URL}?id=${APM_ALERT_ID}&index=${apmIndex}`)
              .auth(user.username, user.password)
              .set('kbn-xsrf', 'true')
              .expect(403);
          });
        });
    });
  });
};
