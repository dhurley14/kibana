/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { memo, useState } from 'react';
import styled from 'styled-components';

import {
  EuiBadge,
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiContextMenuItem,
  EuiContextMenuPanel,
  EuiFlexGroup,
  EuiFlexItem,
  EuiTextColor,
  EuiPanel,
  EuiPopover,
  EuiText,
} from '@elastic/eui';
import type { HttpSetup } from '@kbn/core-http-browser';
import type { NamespaceType } from '@kbn/securitysolution-io-ts-list-types';
import type { ExceptionListInfo } from './use_all_exception_lists';

const StyledFlexItem = styled(EuiFlexItem)`
  border-right: 1px solid #d3dae6;
  padding: 4px 12px 4px 0;
`;

interface ExceptionsListCardProps {
  exceptionsList: ExceptionListInfo;
  http: HttpSetup;
  handleDelete: ({
    id,
    listId,
    namespaceType,
  }: {
    id: string;
    listId: string;
    namespaceType: NamespaceType;
  }) => () => Promise<void>;
  handleExport: ({
    id,
    listId,
    namespaceType,
  }: {
    id: string;
    listId: string;
    namespaceType: NamespaceType;
  }) => () => Promise<void>;
  readOnly: boolean;
}

export const ExceptionsListCard = memo<ExceptionsListCardProps>(
  ({ exceptionsList, http, handleDelete, handleExport, readOnly }) => {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    const onItemActionsClick = () => setIsPopoverOpen((isOpen) => !isOpen);
    const onClosePopover = () => setIsPopoverOpen(false);

    return (
      <EuiFlexGroup data-test-subj="exceptionsListCard">
        <EuiFlexItem>
          <EuiPanel>
            {
              <React.Fragment key={exceptionsList.list_id}>
                <EuiFlexGroup alignItems="center" gutterSize="s">
                  <EuiFlexItem grow={true}>
                    <EuiFlexGroup direction="column" alignItems="flexStart">
                      <EuiFlexItem grow={false} component={'span'}>
                        <EuiButtonEmpty flush={'left'} data-test-subj="exception-list-name">
                          {exceptionsList.name.toString()}
                        </EuiButtonEmpty>
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        <EuiText size="xs">
                          <EuiTextColor color="subdued">{exceptionsList.description}</EuiTextColor>
                        </EuiText>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiText>{'created by: '}</EuiText>
                  </EuiFlexItem>
                  <StyledFlexItem grow={false}>
                    <EuiBadge>{exceptionsList.created_by}</EuiBadge>{' '}
                  </StyledFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiText>{'created on: '}</EuiText>
                  </EuiFlexItem>
                  <StyledFlexItem grow={false}>
                    <EuiBadge>{exceptionsList.created_at}</EuiBadge>
                  </StyledFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiPopover
                      data-test-subj="exceptionsListCardOverflowActions"
                      button={
                        <EuiButtonIcon
                          isDisabled={false}
                          data-test-subj="exceptionsListCardOverflowActions"
                          aria-label="Exception item actions menu"
                          iconType="boxesHorizontal"
                          onClick={onItemActionsClick}
                        />
                      }
                      panelPaddingSize="none"
                      isOpen={isPopoverOpen}
                      closePopover={onClosePopover}
                    >
                      <EuiContextMenuPanel
                        size="s"
                        items={[
                          <EuiContextMenuItem
                            key={'delete'}
                            disabled={exceptionsList.list_id === 'endpoint_list' || readOnly}
                            data-test-subj="exceptionsTableDeleteButton"
                            icon={'trash'}
                            onClick={() => {
                              onClosePopover();
                              handleDelete({
                                id: exceptionsList.id,
                                listId: exceptionsList.list_id,
                                namespaceType: exceptionsList.namespace_type,
                              })();
                            }}
                          >
                            {'Delete exception list'}
                          </EuiContextMenuItem>,
                          <EuiContextMenuItem
                            key={'export'}
                            icon={'exportAction'}
                            data-test-subj="exceptionsTableExportButton"
                            onClick={() => {
                              onClosePopover();
                              handleExport({
                                id: exceptionsList.id,
                                listId: exceptionsList.list_id,
                                namespaceType: exceptionsList.namespace_type,
                              })();
                            }}
                          >
                            {'Export exception list'}
                          </EuiContextMenuItem>,
                        ]}
                      />
                    </EuiPopover>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </React.Fragment>
            }
          </EuiPanel>
        </EuiFlexItem>
      </EuiFlexGroup>
    );
  }
);

ExceptionsListCard.displayName = 'ExceptionsListCard';
