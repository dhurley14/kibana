/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EuiFlexGroup, EuiFlexItem, EuiSpacer, EuiFormRow, EuiLoadingSpinner } from '@elastic/eui';
import type { DataViewSpec } from '@kbn/data-views-plugin/common';
import { DataView } from '@kbn/data-views-plugin/common';

import type { ThreatMapEntries } from '../../../../common/components/threat_match/types';
import { ThreatMatchComponent } from '../../../../common/components/threat_match';
import type { BrowserField } from '../../../../common/containers/source';
import type { FieldHook } from '../../../../shared_imports';
import {
  Field,
  getUseField,
  UseField,
  getFieldValidityAndErrorMessage,
} from '../../../../shared_imports';
import type { DefineStepRule } from '../../../pages/detection_engine/rules/types';
import { schema } from '../step_define_rule/schema';
import { QueryBarDefineRule } from '../query_bar';
import * as i18n from '../step_define_rule/translations';
import { MyLabelButton } from '../step_define_rule';
import { useKibana } from '../../../../common/lib/kibana';

const CommonUseField = getUseField({ component: Field });

interface ThreatMatchInputProps {
  threatMapping: FieldHook;
  threatBrowserFields: Readonly<Record<string, Partial<BrowserField>>>;
  threatIndexPatterns: DataViewSpec;
  indexPatterns: DataViewSpec;
  threatIndexPatternsLoading: boolean;
  threatIndexModified: boolean;
  handleResetThreatIndices: () => void;
  onValidityChange?: (isValid: boolean) => void;
}

const ThreatMatchInputComponent: React.FC<ThreatMatchInputProps> = ({
  threatIndexModified,
  handleResetThreatIndices,
  threatMapping,
  indexPatterns,
  threatIndexPatterns,
  threatIndexPatternsLoading,
  threatBrowserFields,
  onValidityChange,
}: ThreatMatchInputProps) => {
  const { setValue, value: threatItems } = threatMapping;
  const { fieldFormats } = useKibana().services;

  const { isInvalid: isThreatMappingInvalid, errorMessage } =
    getFieldValidityAndErrorMessage(threatMapping);
  const [isThreatIndexPatternValid, setIsThreatIndexPatternValid] = useState(false);

  useEffect(() => {
    if (onValidityChange) {
      onValidityChange(!isThreatMappingInvalid && isThreatIndexPatternValid);
    }
  }, [isThreatIndexPatternValid, isThreatMappingInvalid, onValidityChange]);

  const handleBuilderOnChange = useCallback(
    ({ entryItems }: { entryItems: ThreatMapEntries[] }): void => {
      setValue(entryItems);
    },
    [setValue]
  );

  const dataViewMemo = useMemo(() => {
    if (indexPatterns != null) {
      return new DataView({ spec: indexPatterns, fieldFormats });
    } else {
      return null;
    }
  }, [indexPatterns, fieldFormats]);

  const threatDataViewMemo = useMemo(() => {
    if (threatIndexPatterns != null && !threatIndexPatternsLoading) {
      return new DataView({ spec: threatIndexPatterns, fieldFormats });
    } else {
      return null;
    }
  }, [threatIndexPatterns, threatIndexPatternsLoading, fieldFormats]);

  return (
    <>
      <EuiSpacer size="m" />
      <EuiFlexGroup direction="column">
        <EuiFlexItem grow={true}>
          <CommonUseField<string[], DefineStepRule>
            path="threatIndex"
            config={{
              ...schema.threatIndex,
              labelAppend: threatIndexModified ? (
                <MyLabelButton onClick={handleResetThreatIndices} iconType="refresh">
                  {i18n.RESET_DEFAULT_INDEX}
                </MyLabelButton>
              ) : null,
            }}
            componentProps={{
              idAria: 'detectionEngineStepDefineRuleThreatMatchIndices',
              'data-test-subj': 'detectionEngineStepDefineRuleThreatMatchIndices',
              euiFieldProps: {
                fullWidth: true,
                isDisabled: false,
                placeholder: '',
              },
            }}
          />
        </EuiFlexItem>
        <EuiFlexItem grow={true}>
          {threatDataViewMemo != null ? (
            <UseField
              path="threatQueryBar"
              config={{
                ...schema.threatQueryBar,
                labelAppend: null,
              }}
              component={QueryBarDefineRule}
              componentProps={{
                browserFields: threatBrowserFields,
                idAria: 'detectionEngineStepDefineThreatRuleQueryBar',
                indexPattern: threatDataViewMemo,
                isDisabled: false,
                isLoading: threatIndexPatternsLoading,
                dataTestSubj: 'detectionEngineStepDefineThreatRuleQueryBar',
                openTimelineSearch: false,
                onValidityChange: setIsThreatIndexPatternValid,
              }}
            />
          ) : (
            <EuiLoadingSpinner />
          )}
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="m" />
      <EuiFormRow
        label={threatMapping.label}
        labelAppend={threatMapping.labelAppend}
        helpText={threatMapping.helpText}
        error={errorMessage}
        isInvalid={isThreatMappingInvalid}
        fullWidth
      >
        {dataViewMemo != null && threatDataViewMemo != null ? (
          <ThreatMatchComponent
            listItems={threatItems as ThreatMapEntries[]}
            indexPatterns={indexPatterns}
            threatIndexPatterns={threatIndexPatterns}
            data-test-subj="threatmatch-builder"
            id-aria="threatmatch-builder"
            onChange={handleBuilderOnChange}
          />
        ) : (
          <EuiLoadingSpinner />
        )}
      </EuiFormRow>
      <EuiSpacer size="m" />
    </>
  );
};

export const ThreatMatchInput = React.memo(ThreatMatchInputComponent);
