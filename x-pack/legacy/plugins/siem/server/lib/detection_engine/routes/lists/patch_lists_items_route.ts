/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { IRouter } from '../../../../../../../../../src/core/server';
import { DETECTION_ENGINE_LIST_ITEM_URL } from '../../../../../common/constants';
import { transformError, buildSiemResponse, buildRouteValidationIoTS } from '../utils';
import {
  patchListsItemsSchema,
  PatchListsItemsSchema,
} from '../schemas/request/patch_lists_items_schema';
import { updateListItem } from '../../lists/update_list_item';
import { getList } from '../../lists/get_list';

// TODO: Make sure you write updateListItemRoute and update_list_item.sh routes

export const patchListsItemsRoute = (router: IRouter): void => {
  router.patch(
    {
      path: DETECTION_ENGINE_LIST_ITEM_URL,
      validate: {
        body: buildRouteValidationIoTS<PatchListsItemsSchema>(patchListsItemsSchema),
      },
      options: {
        tags: ['access:siem'],
      },
    },
    async (context, request, response) => {
      const siemResponse = buildSiemResponse(response);
      try {
        const { value, list_id: listId } = request.body;
        const clusterClient = context.core.elasticsearch.dataClient;
        const siemClient = context.siem?.getSiemClient();
        if (!siemClient) {
          return siemResponse.error({ statusCode: 404 });
        }
        const { listsIndex, listsItemsIndex } = siemClient;
        const list = await getList({ id: listId, clusterClient, listsIndex });
        if (list == null) {
          return siemResponse.error({
            statusCode: 404,
            body: `list id: "${listId}" does not exist`,
          });
        } else {
          const listItem = await updateListItem({
            listId,
            type: list.type, // You cannot change a list type once created
            value,
            clusterClient,
            listsItemsIndex,
          });
          if (listItem == null) {
            return siemResponse.error({
              statusCode: 404,
              body: `list_id: "${listId}" found found`,
            });
          } else {
            // TODO: Transform and check the list on exit as well as validate it
            return response.ok({ body: listItem });
          }
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
