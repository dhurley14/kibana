/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

// Component being re-implemented in 8.5

/* eslint complexity: ["error", 35]*/

import React, { memo, useEffect, useState, useCallback, useMemo } from 'react';
import styled, { css } from 'styled-components';
import type { EuiComboBoxOptionOption } from '@elastic/eui';
import {
  EuiFlyout,
  EuiFlyoutHeader,
  EuiTitle,
  EuiFlyoutFooter,
  EuiFlyoutBody,
  EuiButton,
  EuiButtonEmpty,
  EuiHorizontalRule,
  EuiCheckbox,
  EuiSpacer,
  EuiFormRow,
  EuiText,
  EuiCallOut,
  EuiComboBox,
  EuiFlexGroup,
} from '@elastic/eui';
import type {
  ExceptionListType,
  OsTypeArray,
  ExceptionListItemSchema,
  CreateExceptionListItemSchema,
} from '@kbn/securitysolution-io-ts-list-types';
import type { ExceptionsBuilderExceptionItem } from '@kbn/securitysolution-list-utils';
import { getExceptionBuilderComponentLazy } from '@kbn/lists-plugin/public';
import type { DataViewBase } from '@kbn/es-query';
import { useRuleIndices } from '../../../../detections/containers/detection_engine/rules/use_rule_indices';
import { hasEqlSequenceQuery, isEqlRule } from '../../../../../common/detection_engine/utils';
import type { Status } from '../../../../../common/detection_engine/schemas/common/schemas';
import * as i18nCommon from '../../../../common/translations';
import * as i18n from './translations';
import * as sharedI18n from '../../utils/translations';
import { useAppToasts } from '../../../../common/hooks/use_app_toasts';
import { useKibana } from '../../../../common/lib/kibana';
import { Loader } from '../../../../common/components/loader';
import { useAddOrUpdateException } from '../../logic/use_add_exception';
import { useSignalIndex } from '../../../../detections/containers/detection_engine/alerts/use_signal_index';
import { useRuleAsync } from '../../../../detections/containers/detection_engine/rules/use_rule_async';
import { useFetchOrCreateRuleExceptionList } from '../../logic/use_fetch_or_create_rule_exception_list';
import { ExceptionItemComments } from '../item_comments';
import {
  enrichNewExceptionItemsWithComments,
  enrichExceptionItemsWithOS,
  lowercaseHashValues,
  defaultEndpointExceptionItems,
  entryHasListType,
  entryHasNonEcsType,
  retrieveAlertOsTypes,
  filterIndexPatterns,
} from '../../utils/helpers';
import type { ErrorInfo } from '../error_callout';
import { ErrorCallout } from '../error_callout';
import type { AlertData } from '../../utils/types';
import { useFetchIndex } from '../../../../common/containers/source';
import { ruleTypesThatAllowLargeValueLists } from '../../utils/constants';

export interface AddExceptionFlyoutProps {
  ruleName: string;
  ruleId: string;
  exceptionListType: ExceptionListType;
  ruleIndices: string[];
  dataViewId?: string;
  alertData?: AlertData;
  /**
   * The components that use this may or may not define `alertData`
   * If they do, they need to fetch it async. In that case `alertData` will be
   * undefined while `isAlertDataLoading` will be true. In the case that `alertData`
   *  is not used, `isAlertDataLoading` will be undefined
   */
  isAlertDataLoading?: boolean;
  alertStatus?: Status;
  onCancel: () => void;
  onConfirm: (didCloseAlert: boolean, didBulkCloseAlert: boolean) => void;
  onRuleChange?: () => void;
}

const FlyoutHeader = styled(EuiFlyoutHeader)`
  ${({ theme }) => css`
    border-bottom: 1px solid ${theme.eui.euiColorLightShade};
  `}
`;

const FlyoutSubtitle = styled.div`
  ${({ theme }) => css`
    color: ${theme.eui.euiColorMediumShade};
  `}
`;

const FlyoutBodySection = styled.section`
  ${({ theme }) => css`
    padding: ${theme.eui.euiSizeS} ${theme.eui.euiSizeL};

    &.builder-section {
      overflow-y: scroll;
    }
  `}
`;

const FlyoutCheckboxesSection = styled(EuiFlyoutBody)`
  overflow-y: inherit;
  height: auto;

  .euiFlyoutBody__overflowContent {
    padding-top: 0;
  }
`;

const FlyoutFooterGroup = styled(EuiFlexGroup)`
  ${({ theme }) => css`
    padding: ${theme.eui.euiSizeS};
  `}
`;

export const AddSingleExceptionFlyout = memo(function AddExceptionFlyout({
  ruleName,
  ruleId,
  ruleIndices,
  dataViewId,
  exceptionListType,
  alertData,
  isAlertDataLoading,
  onCancel,
  onConfirm,
  onRuleChange,
  alertStatus,
}: AddExceptionFlyoutProps) {
  const { http, unifiedSearch, data } = useKibana().services;

  return (
    <EuiFlyout
      ownFocus
      maskProps={{ style: 'z-index: 5000' }} // For an edge case to display above the timeline flyout
      size="l"
      onClose={onCancel}
      data-test-subj="add-exception-flyout"
    >
      <FlyoutHeader>
        <EuiTitle>
          <h2 data-test-subj="exception-flyout-title">{'add exception message'}</h2>
        </EuiTitle>
        <EuiSpacer size="xs" />
        <FlyoutSubtitle className="eui-textTruncate" title={'my title'}>
          {'flyout subtitle'}
        </FlyoutSubtitle>
        <EuiSpacer size="m" />
      </FlyoutHeader>
      {true && (
        <>
          <FlyoutBodySection className="builder-section">
            <EuiText>{i18n.EXCEPTION_BUILDER_INFO}</EuiText>
            <EuiSpacer />
            {getExceptionBuilderComponentLazy({
              allowLargeValueLists,
              httpService: http,
              autocompleteService: unifiedSearch.autocomplete,
              exceptionListItems: initialExceptionItems,
              listType: exceptionListType,
              listId: ruleExceptionList.list_id,
              listNamespaceType: ruleExceptionList.namespace_type,
              listTypeSpecificIndexPatternFilter: filterIndexPatterns,
              indexPatterns: indexPattern,
              isOrDisabled: isExceptionBuilderFormDisabled,
              isAndDisabled: isExceptionBuilderFormDisabled,
              isNestedDisabled: isExceptionBuilderFormDisabled,
              dataTestSubj: 'alert-exception-builder',
              idAria: 'alert-exception-builder',
              onChange: handleBuilderOnChange,
              isDisabled: isExceptionBuilderFormDisabled,
            })}

            <EuiSpacer />

            <ExceptionItemComments newCommentValue={comment} newCommentOnChange={onCommentChange} />
          </FlyoutBodySection>
          <EuiHorizontalRule />
          <FlyoutCheckboxesSection>
            {alertData != null && alertStatus !== 'closed' && (
              <EuiFormRow fullWidth>
                <EuiCheckbox
                  data-test-subj="close-alert-on-add-add-exception-checkbox"
                  id="close-alert-on-add-add-exception-checkbox"
                  label="Close this alert"
                  checked={shouldCloseAlert}
                  onChange={onCloseAlertCheckboxChange}
                />
              </EuiFormRow>
            )}
            <EuiFormRow fullWidth>
              <EuiCheckbox
                data-test-subj="bulk-close-alert-on-add-add-exception-checkbox"
                id="bulk-close-alert-on-add-add-exception-checkbox"
                label={
                  shouldDisableBulkClose ? i18n.BULK_CLOSE_LABEL_DISABLED : i18n.BULK_CLOSE_LABEL
                }
                checked={shouldBulkCloseAlert}
                onChange={onBulkCloseAlertCheckboxChange}
                disabled={shouldDisableBulkClose}
              />
            </EuiFormRow>
            {exceptionListType === 'endpoint' && (
              <>
                <EuiSpacer size="s" />
                <EuiText data-test-subj="add-exception-endpoint-text" color="subdued" size="s">
                  {i18n.ENDPOINT_QUARANTINE_TEXT}
                </EuiText>
              </>
            )}
          </FlyoutCheckboxesSection>
        </>
      )}
      {fetchOrCreateListError == null && (
        <EuiFlyoutFooter>
          <FlyoutFooterGroup justifyContent="spaceBetween">
            <EuiButtonEmpty data-test-subj="cancelExceptionAddButton" onClick={onCancel}>
              {i18n.CANCEL}
            </EuiButtonEmpty>

            <EuiButton
              data-test-subj="add-exception-confirm-button"
              onClick={onAddExceptionConfirm}
              isLoading={addExceptionIsLoading}
              isDisabled={isSubmitButtonDisabled}
              fill
            >
              {addExceptionMessage}
            </EuiButton>
          </FlyoutFooterGroup>
        </EuiFlyoutFooter>
      )}
    </EuiFlyout>
  );
});
