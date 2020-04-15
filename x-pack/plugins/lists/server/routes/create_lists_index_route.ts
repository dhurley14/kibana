/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { IRouter } from 'kibana/server';

import {
  transformError,
  buildSiemResponse,
} from '../../../../legacy/plugins/siem/server/lib/detection_engine/routes/utils';
import { getIndexExists } from '../../../../legacy/plugins/siem/server/lib/detection_engine/index/get_index_exists';
import { getPolicyExists } from '../../../../legacy/plugins/siem/server/lib/detection_engine/index/get_policy_exists';
import { setPolicy } from '../../../../legacy/plugins/siem/server/lib/detection_engine/index/set_policy';
import { getTemplateExists } from '../../../../legacy/plugins/siem/server/lib/detection_engine/index/get_template_exists';
import { createBootstrapIndex } from '../../../../legacy/plugins/siem/server/lib/detection_engine/index/create_bootstrap_index';
import { setTemplate } from '../../../../legacy/plugins/siem/server/lib/detection_engine/index/set_template';
import { LIST_INDEX } from '../../common/constants';
import listsPolicy from '../lists/lists_policy.json';
import listsItemsPolicy from '../items/lists_items_policy.json';
import { getListsTemplate } from '../lists';
import { getListsItemsTemplate } from '../items';
import { ConfigType } from '../config';

export const createListsIndexRoute = (
  router: IRouter,
  { listsIndex, listsItemsIndex }: ConfigType
): void => {
  router.post(
    {
      path: LIST_INDEX,
      validate: false,
      options: {
        tags: ['access:siem'],
      },
    },
    async (context, request, response) => {
      const siemResponse = buildSiemResponse(response);

      try {
        const clusterClient = context.core.elasticsearch.dataClient;
        const callCluster = clusterClient.callAsCurrentUser;

        const listsIndexExists = await getIndexExists(callCluster, listsIndex);
        const listsItemsIndexExists = await getIndexExists(callCluster, listsItemsIndex);

        if (listsIndexExists && listsItemsIndexExists) {
          return siemResponse.error({
            statusCode: 409,
            body: `index: "${listsIndex}" and "listsItemsIndexExists" already exists`,
          });
        } else {
          const policyExists = await getPolicyExists(callCluster, listsIndex);
          const policyListItemExists = await getPolicyExists(callCluster, listsItemsIndex);

          if (!policyExists) {
            await setPolicy(callCluster, listsIndex, listsPolicy);
          }
          if (!policyListItemExists) {
            await setPolicy(callCluster, listsItemsIndex, listsItemsPolicy);
          }

          const templateExists = await getTemplateExists(callCluster, listsIndex);
          const templateListItemsExists = await getTemplateExists(callCluster, listsItemsIndex);

          if (!templateExists) {
            const template = getListsTemplate(listsIndex);
            await setTemplate(callCluster, listsIndex, template);
          }
          if (!templateListItemsExists) {
            const template = getListsItemsTemplate(listsItemsIndex);
            await setTemplate(callCluster, listsItemsIndex, template);
          }

          if (!listsIndexExists) {
            await createBootstrapIndex(callCluster, listsIndex);
          }
          if (!listsItemsIndexExists) {
            await createBootstrapIndex(callCluster, listsItemsIndex);
          }

          return response.ok({ body: { acknowledged: true } });
        }
      } catch (err) {
        const error = transformError(err);
        return siemResponse.error({
          body: error.message,
          statusCode: error.statusCode,
        });
      }
    }
  );
};
