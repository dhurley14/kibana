/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { KibanaRequest } from 'kibana/server';

import { SpacesServiceSetup } from '../../../../spaces/server';
import { getSpace } from '../utils';

interface GetListItemIndexOptions {
  spaces: SpacesServiceSetup | undefined | null;
  request: KibanaRequest | undefined | null;
  listsItemsIndexName: string;
}

interface GetListItemIndexWithSpaceIdOptions {
  spaceId: string | undefined | null;
  listsItemsIndexName: string;
}

export const getListItemIndex = ({
  spaces,
  request,
  listsItemsIndexName,
}: GetListItemIndexOptions): string => `${listsItemsIndexName}-${getSpace({ request, spaces })}`;

export const getListItemIndexWithSpaceId = ({
  spaceId,
  listsItemsIndexName,
}: GetListItemIndexWithSpaceIdOptions): string => `${listsItemsIndexName}-${spaceId ?? 'default'}`;
