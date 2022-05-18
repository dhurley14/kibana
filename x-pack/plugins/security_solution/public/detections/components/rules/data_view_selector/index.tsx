/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { EuiComboBox, EuiComboBoxOptionOption, EuiFormRow } from '@elastic/eui';

import { DataViewListItem } from '@kbn/data-views-plugin/common';
import { DataViewBase } from '@kbn/es-query';
import { FieldHook, getFieldValidityAndErrorMessage } from '../../../../shared_imports';
import * as i18n from './translations';
import { useKibana } from '../../../../common/lib/kibana';
import { DefineStepRule } from '../../../pages/detection_engine/rules/types';

interface DataViewSelectorProps {
  kibanaDataViews: { [x: string]: DataViewListItem };
  field: FieldHook<DefineStepRule['dataViewId']>;
  setIndexPattern: (indexPattern: DataViewBase) => void;
}

export const DataViewSelector = ({
  kibanaDataViews,
  field,
  setIndexPattern,
}: DataViewSelectorProps) => {
  const { data } = useKibana().services;
  const { isInvalid, errorMessage } = getFieldValidityAndErrorMessage(field);
  const fieldValue = field.value;

  const [selectedOptions, setSelectedOptions] = useState<Array<EuiComboBoxOptionOption<string>>>(
    fieldValue != null && fieldValue.length > 0 ? [{ label: fieldValue }] : []
  );
  const [selectedDataView, setSelectedDataView] = useState<DataViewListItem>();

  // TODO: optimize this, pass down array of data view ids
  // at the same time we grab the data views in the top level form component
  const dataViewOptions = useMemo(() => {
    return kibanaDataViews != null && Object.keys(kibanaDataViews).length > 0
      ? Object.keys(kibanaDataViews).map((dvId) => ({
          label: dvId,
          id: dvId,
        }))
      : [];
  }, [kibanaDataViews]);

  // Fetch the individual dataview selected - returns all info
  // regarding data view, including fields
  useEffect(() => {
    const fetchSingleDataView = async () => {
      if (selectedDataView != null) {
        const dv = await data.dataViews.get(selectedDataView.id);
        setIndexPattern(dv);
      }
    };

    fetchSingleDataView();
  }, [data.dataViews, selectedDataView, setIndexPattern]);
  const onChangeDataViews = useCallback(
    (options: Array<EuiComboBoxOptionOption<string>>) => {
      const dataView = options;

      setSelectedOptions(options);
      setSelectedDataView(kibanaDataViews[dataView[0].label]);
      field.setValue(dataView[0].label);
    },
    [field, kibanaDataViews]
  );

  return (
    <EuiFormRow
      label={field.label}
      helpText={field.helpText}
      error={errorMessage}
      isInvalid={isInvalid}
      data-test-subj="pick-rule-data-source"
    >
      <EuiComboBox
        isClearable
        singleSelection={{ asPlainText: true }}
        onChange={onChangeDataViews}
        options={dataViewOptions}
        selectedOptions={selectedOptions}
        aria-label={i18n.PICK_INDEX_PATTERNS}
        placeholder={i18n.PICK_INDEX_PATTERNS}
        data-test-subj="detectionsDataViewSelectorDropdown"
      />
    </EuiFormRow>
  );
};
