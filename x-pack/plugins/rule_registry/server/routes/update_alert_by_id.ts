/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { IRouter } from 'kibana/server';
import { id as _id } from '@kbn/securitysolution-io-ts-list-types';
import { transformError } from '@kbn/securitysolution-es-utils';
import { schema } from '@kbn/config-schema';

import { RacRequestHandlerContext } from '../types';
import { BASE_RAC_ALERTS_API_PATH } from '../../common/constants';

export const updateAlertByIdRoute = (router: IRouter<RacRequestHandlerContext>) => {
  router.post(
    {
      path: BASE_RAC_ALERTS_API_PATH,
      validate: {
        body: schema.object({
          status: schema.string(),
          ids: schema.arrayOf(schema.string()),
          assetName: schema.string(),
        }),
      },
      options: {
        tags: ['access:rac'],
      },
    },
    async (context, req, response) => {
      try {
        const racClient = await context.rac.getAlertsClient();
        const { status, ids, assetName } = req.body;

        const thing = await racClient?.update({
          id: ids[0],
          data: { status },
          assetName,
        });
        return response.ok({ body: { success: true, alerts: thing } });
      } catch (exc) {
        const err = transformError(exc);

        const contentType = {
          'content-type': 'application/json',
        };
        const defaultedHeaders = {
          ...contentType,
        };

        return response.custom({
          headers: defaultedHeaders,
          statusCode: err.statusCode,
          body: Buffer.from(
            JSON.stringify({
              message: err.message,
              status_code: err.statusCode,
            })
          ),
        });
      }
    }
  );
};
