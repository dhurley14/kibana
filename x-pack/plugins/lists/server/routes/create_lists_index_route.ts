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
import { LIST_INDEX } from '../../common/constants';

import { getListClient } from '.';

export const createListsIndexRoute = (router: IRouter): void => {
  router.post(
    {
      path: LIST_INDEX,
      validate: false,
      options: {
        tags: ['access:list'],
      },
    },
    async (context, _, response) => {
      const siemResponse = buildSiemResponse(response);

      try {
        const lists = getListClient(context);
        const listsIndexExists = await lists.getListIndexExists();
        const listsItemsIndexExists = await lists.getListItemIndexExists();

        if (listsIndexExists && listsItemsIndexExists) {
          return siemResponse.error({
            statusCode: 409,
            body: `index: "${lists.getListIndex()}" and "${lists.getListItemIndex()}" already exists`,
          });
        } else {
          const policyExists = await lists.getListPolicyExists();
          const policyListItemExists = await lists.getListItemPolicyExists();

          if (!policyExists) {
            await lists.setListPolicy();
          }
          if (!policyListItemExists) {
            await lists.setListItemPolicy();
          }

          const templateExists = await lists.getListTemplateExists();
          const templateListItemsExists = await lists.getListItemTemplateExists();

          if (!templateExists) {
            await lists.setListTemplate();
          }

          if (!templateListItemsExists) {
            await lists.setListItemTemplate();
          }

          if (!listsIndexExists) {
            await lists.createListBootStrapIndex();
          }
          if (!listsItemsIndexExists) {
            await lists.createListItemBootStrapIndex();
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
