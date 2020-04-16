/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { IRouter } from 'kibana/server';

import { LIST_URL } from '../../common/constants';
import {
  transformError,
  buildSiemResponse,
  buildRouteValidationIoTS,
} from '../../../../legacy/plugins/siem/server/lib/detection_engine/routes/utils';
import { ReadListsSchema, readListsSchema } from '../../common/schemas';

import { getListClient } from '.';

export const readListsRoute = (router: IRouter): void => {
  router.get(
    {
      path: LIST_URL,
      validate: {
        query: buildRouteValidationIoTS<ReadListsSchema>(readListsSchema),
      },
      options: {
        tags: ['access:list'],
      },
    },
    async (context, request, response) => {
      const siemResponse = buildSiemResponse(response);
      try {
        const { id } = request.query;
        const lists = getListClient(context);
        const list = await lists.getList({ id });
        if (list == null) {
          return siemResponse.error({
            statusCode: 404,
            body: `list id: "${id}" does not exist`,
          });
        } else {
          // TODO: outbound validation
          return response.ok({ body: list });
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
