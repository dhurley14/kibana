/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { IRouter } from 'kibana/server';

import { LIST_INDEX } from '../../common/constants';
import { transformError, buildSiemResponse } from '../siem_server_deps';

import { getListClient } from '.';

/**
 * Deletes all of the indexes, template, ilm policies, and aliases. You can check
 * this by looking at each of these settings from ES after a deletion:
 *
 * GET /_template/.lists-default
 * GET /.lists-default-000001/
 * GET /_ilm/policy/.lists-default
 * GET /_alias/.lists-default
 *
 * GET /_template/.items-default
 * GET /.items-default-000001/
 * GET /_ilm/policy/.items-default
 * GET /_alias/.items-default
 *
 * And ensuring they're all gone
 */
export const deleteListsIndexRoute = (router: IRouter): void => {
  router.delete(
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

        if (!listsIndexExists && !listsItemsIndexExists) {
          return siemResponse.error({
            statusCode: 404,
            body: `index: "${lists.getListIndex()}" and "${lists.getListItemIndex()}" does not exist`,
          });
        } else {
          if (listsIndexExists) {
            await lists.deleteListIndex();
          }
          if (listsItemsIndexExists) {
            await lists.deleteListItemIndex();
          }

          const listsPolicyExists = await lists.getListPolicyExists();
          const listsItemsPolicyExists = await lists.getListItemPolicyExists();

          if (listsPolicyExists) {
            await lists.deleteListPolicy();
          }
          if (listsItemsPolicyExists) {
            await lists.deleteListItemPolicy();
          }

          const listsTemplateExists = await lists.getListTemplateExists();
          const listsItemsTemplateExists = await lists.getListItemTemplateExists();

          if (listsTemplateExists) {
            await lists.deleteListTemplate();
          }
          if (listsItemsTemplateExists) {
            await lists.deleteListItemTemplate();
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
