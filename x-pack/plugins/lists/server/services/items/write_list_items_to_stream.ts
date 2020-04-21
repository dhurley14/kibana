/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { PassThrough } from 'stream';

import { SearchResponse } from 'elasticsearch';

import { SearchEsListItemSchema } from '../../../common/schemas';
import { DataClient } from '../../types';
import { ErrorWithStatusCode } from '../../error_with_status_code';

/**
 * How many results to page through from the network at a time
 * using search_after
 */
export const SIZE = 100;

interface ExportListItemsToStreamOptions {
  listId: string;
  dataClient: DataClient;
  listItemIndex: string;
  stream: PassThrough;
  stringToAppend: string | null | undefined;
}

export const exportListItemsToStream = ({
  listId,
  dataClient,
  stream,
  listItemIndex,
  stringToAppend,
}: ExportListItemsToStreamOptions): void => {
  // Use a timeout to start the reading process on the next tick.
  // and prevent the async await from bubbling up to the caller
  setTimeout(async () => {
    let searchAfter = await writeNextResponse({
      dataClient,
      listId,
      listItemIndex,
      searchAfter: undefined,
      stream,
      stringToAppend,
    });
    while (searchAfter != null) {
      searchAfter = await writeNextResponse({
        dataClient,
        listId,
        listItemIndex,
        searchAfter,
        stream,
        stringToAppend,
      });
    }
    stream.end();
  });
};

interface WriteNextResponseOptions {
  listId: string;
  dataClient: DataClient;
  listItemIndex: string;
  stream: PassThrough;
  searchAfter: string[] | undefined;
  stringToAppend: string | null | undefined;
}

export const writeNextResponse = async ({
  listId,
  dataClient,
  stream,
  listItemIndex,
  searchAfter,
  stringToAppend,
}: WriteNextResponseOptions): Promise<string[] | undefined> => {
  const response = await getResponse({
    dataClient,
    listId,
    listItemIndex,
    searchAfter,
  });

  if (response.hits.hits.length) {
    writeResponseHitsToStream({ response, stream, stringToAppend });
    return getSearchAfterFromResponse({ response });
  } else {
    return undefined;
  }
};

export const getSearchAfterFromResponse = <T>({
  response,
}: {
  response: SearchResponse<T>;
}): string[] | undefined => {
  return response.hits.hits[response.hits.hits.length - 1].sort;
};

interface GetResponseOptions {
  dataClient: DataClient;
  listId: string;
  searchAfter: undefined | string[];
  listItemIndex: string;
  size?: number;
}

export const getResponse = async ({
  dataClient,
  searchAfter,
  listId,
  listItemIndex,
  size = SIZE,
}: GetResponseOptions): Promise<SearchResponse<SearchEsListItemSchema>> => {
  return dataClient.callAsCurrentUser('search', {
    body: {
      query: {
        term: {
          list_id: listId,
        },
      },
      search_after: searchAfter,
      sort: [{ tie_breaker_id: 'asc' }],
    },
    ignoreUnavailable: true,
    index: listItemIndex,
    size,
  });
};

interface WriteResponseHitsToStreamOptions {
  response: SearchResponse<SearchEsListItemSchema>;
  stream: PassThrough;
  stringToAppend: string | null | undefined;
}

export const writeResponseHitsToStream = ({
  response,
  stream,
  stringToAppend,
}: WriteResponseHitsToStreamOptions): void => {
  response.hits.hits.forEach(hit => {
    if (hit._source.ip != null) {
      stream.push(hit._source.ip);
    } else if (hit._source.keyword != null) {
      stream.push(hit._source.keyword);
    } else {
      throw new ErrorWithStatusCode(
        `Encountered an error where hit._source was an unexpected type: ${hit._source}`,
        400
      );
    }
    if (stringToAppend != null) {
      stream.push(stringToAppend);
    }
  });
};
