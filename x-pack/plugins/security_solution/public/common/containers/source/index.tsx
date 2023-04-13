/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { isEmpty, keyBy, pick } from 'lodash/fp';
import memoizeOne from 'memoize-one';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DataViewBase } from '@kbn/es-query';
import type { BrowserField, BrowserFields, IndexField } from '@kbn/timelines-plugin/common';
import type { IIndexPatternFieldList } from '@kbn/data-views-plugin/common';
import { getCategory } from '@kbn/triggers-actions-ui-plugin/public';

import { useKibana } from '../../lib/kibana';
import * as i18n from './translations';
import { getDataViewStateFromIndexFields } from './use_data_view';
import { useAppToasts } from '../../hooks/use_app_toasts';

export type { BrowserField, BrowserFields };

export function getAllBrowserFields(browserFields: BrowserFields): Array<Partial<BrowserField>> {
  const result: Array<Partial<BrowserField>> = [];
  for (const namespace of Object.values(browserFields)) {
    if (namespace.fields) {
      result.push(...Object.values(namespace.fields));
    }
  }
  return result;
}

/**
 * @deprecated use EcsFlat from `@kbn/ecs`
 * @param browserFields
 * @returns
 */
export const getAllFieldsByName = (
  browserFields: BrowserFields
): { [fieldName: string]: Partial<BrowserField> } =>
  keyBy('name', getAllBrowserFields(browserFields));

export const getIndexFields = memoizeOne(
  (
    title: string,
    fields: IIndexPatternFieldList,
    _includeUnmapped: boolean = false
  ): DataViewBase =>
    fields && fields.length > 0
      ? {
          fields: fields.map((field) =>
            pick(
              [
                'name',
                'searchable',
                'type',
                'aggregatable',
                'esTypes',
                'subType',
                'conflictDescriptions',
              ],
              field
            )
          ),
          title,
        }
      : { fields: [], title },
  (newArgs, lastArgs) =>
    newArgs[0] === lastArgs[0] &&
    newArgs[1].length === lastArgs[1].length &&
    newArgs[2] === lastArgs[2]
);

/**
 * HOT Code path where the fields can be 16087 in length or larger. This is
 * VERY mutatious on purpose to improve the performance of the transform.
 */
export const getBrowserFields = memoizeOne(
  (_title: string, fields: IndexField[]): BrowserFields => {
    // Adds two dangerous casts to allow for mutations within this function
    type DangerCastForMutation = Record<string, {}>;
    type DangerCastForBrowserFieldsMutation = Record<
      string,
      Omit<BrowserField, 'fields'> & { fields: Record<string, BrowserField> }
    >;

    // We mutate this instead of using lodash/set to keep this as fast as possible
    return fields.reduce<DangerCastForBrowserFieldsMutation>((accumulator, field) => {
      const category = getCategory(field.name);
      if (accumulator[category] == null) {
        (accumulator as DangerCastForMutation)[category] = {};
      }
      if (accumulator[category].fields == null) {
        accumulator[category].fields = {};
      }
      accumulator[category].fields[field.name] = field as unknown as BrowserField;
      return accumulator;
    }, {});
  },
  (newArgs, lastArgs) => newArgs[0] === lastArgs[0] && newArgs[1].length === lastArgs[1].length
);

const DEFAULT_BROWSER_FIELDS = {};
const DEFAULT_INDEX_PATTERNS = { fields: [], title: '' };
interface FetchIndexReturn {
  /**
   * @deprecated use fields list on dataview / "indexPattern"
   */
  browserFields: BrowserFields;
  indexes: string[];
  indexExists: boolean;
  indexPatterns: DataViewBase;
}

/**
 * Independent index fields hook/request
 * returns state directly, no redux
 */
export const useFetchIndex = (
  indexNames: string[],
  onlyCheckIfIndicesExist: boolean = false,
  strategy: string = 'indexFields',
  includeUnmapped: boolean = false
): [boolean, FetchIndexReturn] => {
  const { data } = useKibana().services;
  const abortCtrl = useRef(new AbortController());
  const [isLoading, setLoading] = useState(false);

  const [state, setState] = useState<FetchIndexReturn>({
    browserFields: DEFAULT_BROWSER_FIELDS,
    indexes: indexNames,
    indexExists: true,
    indexPatterns: DEFAULT_INDEX_PATTERNS,
  });
  const { addError } = useAppToasts();

  const indexFieldsSearch = useCallback(
    (iNames) => {
      const asyncSearch = async () => {
        try {
          abortCtrl.current = new AbortController();
          setLoading(true);
          const dv = await data.dataViews.create({ title: iNames.join(','), allowNoIndex: true });
          const { browserFields } = getDataViewStateFromIndexFields(
            iNames,
            dv.fields,
            includeUnmapped
          );

          setState({
            browserFields,
            indexes: dv.getIndexPattern().split(','),
            indexExists: dv.getIndexPattern().split(',').length > 0,
            indexPatterns: getIndexFields(dv.getIndexPattern(), dv.fields, includeUnmapped),
          });
          setLoading(false);
        } catch (exc) {
          addError(exc?.message, { title: i18n.ERROR_INDEX_FIELDS_SEARCH });
        }
      };

      asyncSearch();
    },
    [addError, data.dataViews, includeUnmapped]
  );

  useEffect(() => {
    if (!isEmpty(indexNames)) {
      indexFieldsSearch(indexNames);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexNames]);

  return [isLoading, state];
};
