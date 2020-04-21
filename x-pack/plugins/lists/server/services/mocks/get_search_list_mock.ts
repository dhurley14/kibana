/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { SearchResponse } from 'elasticsearch';

import { SearchEsListSchema } from '../../../common/schemas';

import { getShardMock } from './get_shard_mock';
import { LISTS_INDEX } from './lists_services_mock_constants';
import { getListResponseMock } from './get_list_response_mock';

export const getSearchListMock = (): SearchResponse<SearchEsListSchema> => {
  const data: SearchResponse<SearchEsListSchema> = {
    _scroll_id: '123',
    _shards: getShardMock(),
    hits: {
      hits: [
        {
          _id: '123',
          _index: LISTS_INDEX,
          _score: 0,
          _source: getListResponseMock(),
          _type: '',
        },
      ],
      max_score: 0,
      total: 1,
    },
    timed_out: false,
    took: 10,
  };
  return data;
};
