/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import type { EuiSearchBarProps } from '@elastic/eui';

import {
  EuiButtonEmpty,
  EuiContextMenuItem,
  EuiContextMenuPanel,
  EuiPagination,
  EuiPopover,
  EuiFlyoutFooter,
  EuiTextColor,
  EuiFlyout,
  EuiFilePicker,
  EuiFlyoutBody,
  EuiFlyoutHeader,
  EuiText,
  EuiTitle,
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiLoadingContent,
  EuiProgress,
  EuiSpacer,
  EuiPageHeader,
  EuiHorizontalRule,
  useGeneratedHtmlId,
  EuiCheckbox,
} from '@elastic/eui';

import type {
  NamespaceType,
  ExceptionListFilter,
  BulkErrorSchema,
  ImportExceptionsResponseSchema,
} from '@kbn/securitysolution-io-ts-list-types';
import { useApi, useExceptionLists } from '@kbn/securitysolution-list-hooks';
import { useAppToasts } from '../../../../../../common/hooks/use_app_toasts';
import { AutoDownload } from '../../../../../../common/components/auto_download/auto_download';
import { useKibana } from '../../../../../../common/lib/kibana';
import { Loader } from '../../../../../../common/components/loader';

import * as i18n from './translations';
import { ExceptionsTableUtilityBar } from './exceptions_table_utility_bar';
import { useAllExceptionLists } from './use_all_exception_lists';
import { ReferenceErrorModal } from '../../../../../components/value_lists_management_flyout/reference_error_modal';
import { patchRule } from '../../../../../containers/detection_engine/rules/api';
import { ExceptionsSearchBar } from './exceptions_search_bar';
import { getSearchFilters } from '../helpers';
import { useUserData } from '../../../../../components/user_info';
import { useListsConfig } from '../../../../../containers/detection_engine/lists/use_lists_config';
import { MissingPrivilegesCallOut } from '../../../../../components/callouts/missing_privileges_callout';
import { ALL_ENDPOINT_ARTIFACT_LIST_IDS } from '../../../../../../../common/endpoint/service/artifacts/constants';
import { ExceptionsListCard } from './exceptions_list_card';
import { useImportExceptionList } from './use_import_exception_list';

export type Func = () => Promise<void>;

interface ReferenceModalState {
  contentText: string;
  rulesReferences: string[];
  isLoading: boolean;
  listId: string;
  listNamespaceType: NamespaceType;
}

const exceptionReferenceModalInitialState: ReferenceModalState = {
  contentText: '',
  rulesReferences: [],
  isLoading: false,
  listId: '',
  listNamespaceType: 'single',
};

export const ExceptionListsTable = React.memo(() => {
  const [{ loading: userInfoLoading }] = useUserData();

  const { loading: listsConfigLoading } = useListsConfig();
  const loading = userInfoLoading || listsConfigLoading;

  const {
    services: { http, notifications, timelines },
  } = useKibana();
  const { exportExceptionList, deleteExceptionList } = useApi(http);

  const [showReferenceErrorModal, setShowReferenceErrorModal] = useState(false);
  const [referenceModalState, setReferenceModalState] = useState<ReferenceModalState>(
    exceptionReferenceModalInitialState
  );
  const [filters, setFilters] = useState<ExceptionListFilter | undefined>(undefined);
  const [loadingExceptions, exceptions, pagination, setPagination, refreshExceptions] =
    useExceptionLists({
      errorMessage: i18n.ERROR_EXCEPTION_LISTS,
      filterOptions: filters,
      http,
      namespaceTypes: ['single', 'agnostic'],
      notifications,
      hideLists: ALL_ENDPOINT_ARTIFACT_LIST_IDS,
    });
  const [loadingTableInfo, exceptionListsWithRuleRefs, exceptionsListsRef] = useAllExceptionLists({
    exceptionLists: exceptions ?? [],
  });

  const [initLoading, setInitLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const filePickerRef = useRef<EuiFilePicker | null>(null);

  const [exportDownload, setExportDownload] = useState<{ name?: string; blob?: Blob }>({});
  const [displayImportListFlyout, setDisplayImportListFlyout] = useState(false);
  const { addError, addSuccess } = useAppToasts();

  const handleDeleteSuccess = useCallback(
    (listId?: string) => () => {
      notifications.toasts.addSuccess({
        title: i18n.exceptionDeleteSuccessMessage(listId ?? referenceModalState.listId),
      });
    },
    [notifications.toasts, referenceModalState.listId]
  );

  const handleDeleteError = useCallback(
    (err: Error & { body?: { message: string } }): void => {
      addError(err, {
        title: i18n.EXCEPTION_DELETE_ERROR,
      });
    },
    [addError]
  );

  const handleDelete = useCallback(
    ({ id, listId, namespaceType }: { id: string; listId: string; namespaceType: NamespaceType }) =>
      async () => {
        try {
          if (refreshExceptions != null) {
            refreshExceptions();
          }

          if (exceptionsListsRef[id] != null && exceptionsListsRef[id].rules.length === 0) {
            await deleteExceptionList({
              id,
              namespaceType,
              onError: handleDeleteError,
              onSuccess: handleDeleteSuccess(listId),
            });

            if (refreshExceptions != null) {
              refreshExceptions();
            }
          } else {
            setReferenceModalState({
              contentText: i18n.referenceErrorMessage(exceptionsListsRef[id].rules.length),
              rulesReferences: exceptionsListsRef[id].rules.map(({ name }) => name),
              isLoading: true,
              listId: id,
              listNamespaceType: namespaceType,
            });
            setShowReferenceErrorModal(true);
          }
          // route to patch rules with associated exception list
        } catch (error) {
          handleDeleteError(error);
        }
      },
    [
      deleteExceptionList,
      exceptionsListsRef,
      handleDeleteError,
      handleDeleteSuccess,
      refreshExceptions,
    ]
  );

  const handleExportSuccess = useCallback(
    (listId: string) =>
      (blob: Blob): void => {
        addSuccess(i18n.EXCEPTION_EXPORT_SUCCESS);
        setExportDownload({ name: listId, blob });
      },
    [addSuccess]
  );

  const handleExportError = useCallback(
    (err: Error) => {
      addError(err, { title: i18n.EXCEPTION_EXPORT_ERROR });
    },
    [addError]
  );

  const handleExport = useCallback(
    ({ id, listId, namespaceType }: { id: string; listId: string; namespaceType: NamespaceType }) =>
      async () => {
        await exportExceptionList({
          id,
          listId,
          namespaceType,
          onError: handleExportError,
          onSuccess: handleExportSuccess(listId),
        });
      },
    [exportExceptionList, handleExportError, handleExportSuccess]
  );

  const handleRefresh = useCallback((): void => {
    if (refreshExceptions != null) {
      setLastUpdated(Date.now());
      refreshExceptions();
    }
  }, [refreshExceptions]);

  useEffect(() => {
    if (initLoading && !loading && !loadingExceptions && !loadingTableInfo) {
      setInitLoading(false);
    }
  }, [initLoading, loading, loadingExceptions, loadingTableInfo]);

  const handleSearch = useCallback(
    async ({
      query,
      queryText,
    }: Parameters<NonNullable<EuiSearchBarProps['onChange']>>[0]): Promise<void> => {
      const filterOptions = {
        name: null,
        list_id: null,
        created_by: null,
        type: null,
        tags: null,
      };
      const searchTerms = getSearchFilters({
        defaultSearchTerm: 'name',
        filterOptions,
        query,
        searchValue: queryText,
      });
      setFilters(searchTerms);
    },
    []
  );

  const handleCloseReferenceErrorModal = useCallback((): void => {
    setShowReferenceErrorModal(false);
    setReferenceModalState({
      contentText: '',
      rulesReferences: [],
      isLoading: false,
      listId: '',
      listNamespaceType: 'single',
    });
  }, []);

  const handleReferenceDelete = useCallback(async (): Promise<void> => {
    const exceptionListId = referenceModalState.listId;
    const exceptionListNamespaceType = referenceModalState.listNamespaceType;
    const relevantRules = exceptionsListsRef[exceptionListId].rules;

    try {
      await Promise.all(
        relevantRules.map((rule) => {
          const abortCtrl = new AbortController();
          const exceptionLists = (rule.exceptions_list ?? []).filter(
            ({ id }) => id !== exceptionListId
          );

          return patchRule({
            ruleProperties: {
              rule_id: rule.rule_id,
              exceptions_list: exceptionLists,
            },
            signal: abortCtrl.signal,
          });
        })
      );

      await deleteExceptionList({
        id: exceptionListId,
        namespaceType: exceptionListNamespaceType,
        onError: handleDeleteError,
        onSuccess: handleDeleteSuccess(),
      });
    } catch (err) {
      handleDeleteError(err);
    } finally {
      setReferenceModalState(exceptionReferenceModalInitialState);
      setShowReferenceErrorModal(false);
      if (refreshExceptions != null) {
        refreshExceptions();
      }
    }
  }, [
    referenceModalState.listId,
    referenceModalState.listNamespaceType,
    exceptionsListsRef,
    deleteExceptionList,
    handleDeleteError,
    handleDeleteSuccess,
    refreshExceptions,
  ]);

  const handleOnDownload = useCallback(() => {
    setExportDownload({});
  }, []);

  const filePickerId = useGeneratedHtmlId({ prefix: 'filePicker' });
  const [file, setFile] = useState<File | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [asNewList, setAsNewList] = useState(false);

  const resetForm = useCallback(() => {
    if (filePickerRef.current?.fileInput) {
      filePickerRef.current.fileInput.value = '';
      filePickerRef.current.handleChange();
    }
    setFile(null);
    setAlreadyExistingItem(false);
    setAsNewList(false);
    setOverwrite(false);
  }, []);
  const { start: importExceptionList, ...importExceptionListState } = useImportExceptionList();
  const ctrl = useRef(new AbortController());

  const handleImportExceptionList = useCallback(() => {
    if (!importExceptionListState.loading && file) {
      ctrl.current = new AbortController();

      importExceptionList({
        file,
        http,
        signal: ctrl.current.signal,
        overwrite,
        overwriteExceptions: overwrite,
        asNewList,
      });
    }
  }, [asNewList, file, http, importExceptionList, importExceptionListState.loading, overwrite]);

  const handleImportSuccess = useCallback(
    (response: ImportExceptionsResponseSchema) => {
      resetForm();
      addSuccess({
        text: i18n.uploadSuccessMessage(file?.name ?? ''),
        title: i18n.UPLOAD_SUCCESS_TITLE,
      });
      handleRefresh();
    },
    // looking for file.name but we don't wan't to render success every time file name changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resetForm, addSuccess, handleRefresh]
  );
  const handleImportError = useCallback(
    (errors: BulkErrorSchema[]) => {
      errors.forEach((error) => {
        if (!error.error.message.includes('AbortError')) {
          addError(error, { title: i18n.UPLOAD_ERROR });
        }
      });
    },
    [addError]
  );
  const [alreadyExistingItem, setAlreadyExistingItem] = useState(false);

  useEffect(() => {
    if (!importExceptionListState.loading && importExceptionListState?.result?.success) {
      handleImportSuccess(importExceptionListState?.result);
    } else if (!importExceptionListState.loading && importExceptionListState.result?.errors) {
      handleImportError(importExceptionListState?.result?.errors);
      setAlreadyExistingItem(true);
    }
  }, [
    handleImportError,
    handleImportSuccess,
    importExceptionListState.error,
    importExceptionListState.loading,
    importExceptionListState.result,
    setAlreadyExistingItem,
  ]);
  const handleFileChange = useCallback((files: FileList | null) => {
    setFile(files?.item(0) ?? null);
  }, []);
  const [activePage, setActivePage] = useState(0);
  const [rowSize, setRowSize] = useState(5);
  const [isRowSizePopoverOpen, setIsRowSizePopoverOpen] = useState(false);
  const onRowSizeButtonClick = () => setIsRowSizePopoverOpen((val) => !val);
  const closeRowSizePopover = () => setIsRowSizePopoverOpen(false);

  const rowSizeButton = (
    <EuiButtonEmpty
      size="xs"
      color="text"
      iconType="arrowDown"
      iconSide="right"
      onClick={onRowSizeButtonClick}
    >
      {`Rows per page: ${rowSize}`}
    </EuiButtonEmpty>
  );

  const getIconType = (size: number) => {
    return size === rowSize ? 'check' : 'empty';
  };

  const rowSizeItems = [
    <EuiContextMenuItem
      key="5 rows"
      icon={getIconType(5)}
      onClick={() => {
        closeRowSizePopover();
        setRowSize(5);
      }}
    >
      {'5 rows'}
    </EuiContextMenuItem>,
    <EuiContextMenuItem
      key="10 rows"
      icon={getIconType(10)}
      onClick={() => {
        closeRowSizePopover();
        setRowSize(10);
      }}
    >
      {'10 rows'}
    </EuiContextMenuItem>,
    <EuiContextMenuItem
      key="25 rows"
      icon={getIconType(25)}
      onClick={() => {
        closeRowSizePopover();
        setRowSize(25);
      }}
    >
      {'25 rows'}
    </EuiContextMenuItem>,
  ];

  useEffect(() => {
    setPagination({
      page: activePage + 1, // off-by-one error
      perPage: rowSize,
      total: 0,
    });
  }, [activePage, rowSize, setPagination]);

  const goToPage = (pageNumber: number) => setActivePage(pageNumber);

  return (
    <>
      <MissingPrivilegesCallOut />
      <EuiFlexGroup>
        <EuiFlexItem>
          <EuiPageHeader
            pageTitle={i18n.ALL_EXCEPTIONS}
            description={
              <p>{timelines.getLastUpdated({ showUpdating: loading, updatedAt: lastUpdated })}</p>
            }
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButton iconType={'importAction'} onClick={() => setDisplayImportListFlyout(true)}>
            {'Import exception list'}
          </EuiButton>
        </EuiFlexItem>
      </EuiFlexGroup>

      {displayImportListFlyout && (
        <EuiFlyout ownFocus size="s" onClose={() => setDisplayImportListFlyout(false)}>
          <EuiFlyoutHeader hasBorder>
            <EuiTitle size="m">
              <h2>{'Import shared exception list'}</h2>
            </EuiTitle>
          </EuiFlyoutHeader>
          <EuiFlyoutBody>
            <EuiText>{'Select shared exception lists to import'}</EuiText>
            <EuiFilePicker
              id={filePickerId}
              multiple
              ref={filePickerRef}
              initialPromptText="Select or drag and drop multiple files"
              onChange={handleFileChange}
              display={'large'}
              aria-label="Use aria labels when no actual label is in use"
            />

            {alreadyExistingItem && (
              <>
                <EuiSpacer />
                <EuiTextColor color={'danger'}>
                  {'We found a pre-existing list with that id'}
                </EuiTextColor>
                <EuiSpacer />
                <EuiCheckbox
                  id={'basicCheckboxId'}
                  label="Overwrite the existing list"
                  checked={overwrite}
                  onChange={(e) => {
                    setOverwrite(!overwrite);
                    setAsNewList(false);
                  }}
                />
                <EuiCheckbox
                  id={'createNewListCheckbox'}
                  label="Create new list"
                  checked={asNewList}
                  onChange={(e) => {
                    setAsNewList(!asNewList);
                    setOverwrite(false);
                  }}
                />
              </>
            )}
          </EuiFlyoutBody>
          <EuiFlyoutFooter>
            <EuiFlexGroup justifyContent="spaceBetween">
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty
                  iconType="cross"
                  onClick={() => setDisplayImportListFlyout(false)}
                  flush="left"
                >
                  {'Close'}
                </EuiButtonEmpty>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButton
                  data-test-subj="exception-lists-form-import-action"
                  onClick={handleImportExceptionList}
                  disabled={file == null || importExceptionListState.loading}
                >
                  {i18n.UPLOAD_BUTTON}
                </EuiButton>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiFlyoutFooter>
        </EuiFlyout>
      )}

      <EuiHorizontalRule />
      <div data-test-subj="allExceptionListsPanel">
        {loadingTableInfo && (
          <EuiProgress
            data-test-subj="loadingRulesInfoProgress"
            size="xs"
            position="absolute"
            color="accent"
          />
        )}
        {!initLoading && <ExceptionsSearchBar onSearch={handleSearch} />}
        <EuiSpacer size="m" />

        {loadingTableInfo && !initLoading && !showReferenceErrorModal && (
          <Loader data-test-subj="loadingPanelAllRulesTable" overlay size="xl" />
        )}

        {initLoading || loadingTableInfo ? (
          <EuiLoadingContent data-test-subj="initialLoadingPanelAllRulesTable" lines={10} />
        ) : (
          <>
            <ExceptionsTableUtilityBar
              totalExceptionLists={exceptionListsWithRuleRefs.length}
              onRefresh={handleRefresh}
            />
            {exceptionListsWithRuleRefs.map((excList) => (
              <ExceptionsListCard
                http={http}
                exceptionsList={excList}
                handleDelete={handleDelete}
                handleExport={handleExport}
              />
            ))}
          </>
        )}
        <EuiPopover
          button={rowSizeButton}
          isOpen={isRowSizePopoverOpen}
          closePopover={closeRowSizePopover}
        >
          <EuiContextMenuPanel items={rowSizeItems} />
        </EuiPopover>
        <EuiPagination
          aria-label={'Custom pagination example'}
          pageCount={Math.ceil(pagination.total / rowSize)}
          activePage={activePage}
          onPageClick={goToPage}
        />

        <AutoDownload
          blob={exportDownload.blob}
          name={`${exportDownload.name}.ndjson`}
          onDownload={handleOnDownload}
        />
        <ReferenceErrorModal
          cancelText={i18n.REFERENCE_MODAL_CANCEL_BUTTON}
          confirmText={i18n.REFERENCE_MODAL_CONFIRM_BUTTON}
          contentText={referenceModalState.contentText}
          onCancel={handleCloseReferenceErrorModal}
          onClose={handleCloseReferenceErrorModal}
          onConfirm={handleReferenceDelete}
          references={referenceModalState.rulesReferences}
          showModal={showReferenceErrorModal}
          titleText={i18n.REFERENCE_MODAL_TITLE}
        />
      </div>
    </>
  );
});

ExceptionListsTable.displayName = 'ExceptionListsTable';
