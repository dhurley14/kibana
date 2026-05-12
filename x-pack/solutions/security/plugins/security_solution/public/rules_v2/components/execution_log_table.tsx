/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { EuiBasicTableColumn, CriteriaWithPagination } from '@elastic/eui';
import {
  EuiBasicTable,
  EuiFlexGroup,
  EuiFlexItem,
  EuiHealth,
  EuiSuperDatePicker,
  EuiText,
  EuiTextBlockTruncate,
  EuiCallOut,
} from '@elastic/eui';
import type { UnifiedExecutionResult } from '../../../common/api/detection_engine/rule_monitoring';
import { useV2ExecutionResults } from '../hooks/use_v2_execution_results';

const STATUS_COLOR: Record<string, string> = {
  success: 'success',
  warning: 'warning',
  failure: 'danger',
};

const STATUS_LABEL: Record<string, string> = {
  success: 'Succeeded',
  warning: 'Warning',
  failure: 'Failed',
};

const formatDuration = (ms: number | null): string => {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

const columns: Array<EuiBasicTableColumn<UnifiedExecutionResult>> = [
  {
    field: 'outcome.status',
    name: 'Status',
    width: '120px',
    render: (_: unknown, record: UnifiedExecutionResult) => (
      <EuiHealth color={STATUS_COLOR[record.outcome.status] ?? 'subdued'}>
        {STATUS_LABEL[record.outcome.status] ?? record.outcome.status}
      </EuiHealth>
    ),
  },
  {
    field: 'execution_start',
    name: 'Timestamp',
    sortable: true,
    width: '220px',
    render: (value: string) => (
      <EuiText size="s">{new Date(value).toLocaleString()}</EuiText>
    ),
  },
  {
    field: 'execution_duration_ms',
    name: 'Duration',
    sortable: true,
    width: '120px',
    render: (value: number | null) => <EuiText size="s">{formatDuration(value)}</EuiText>,
  },
  {
    field: 'metrics.alert_counts.new',
    name: 'Alerts',
    width: '100px',
    render: (_: unknown, record: UnifiedExecutionResult) => (
      <EuiText size="s">{record.metrics.alert_counts?.new ?? 0}</EuiText>
    ),
  },
  {
    field: 'metrics.total_search_duration_ms',
    name: 'Search Duration',
    width: '140px',
    render: (value: number | null) => <EuiText size="s">{formatDuration(value)}</EuiText>,
  },
  {
    field: 'outcome.message',
    name: 'Message',
    render: (_: unknown, record: UnifiedExecutionResult) => (
      <EuiTextBlockTruncate lines={2}>
        {record.outcome.message ?? '—'}
      </EuiTextBlockTruncate>
    ),
  },
];

interface ExecutionLogTableProps {
  ruleId: string;
}

export const ExecutionLogTable: React.FC<ExecutionLogTableProps> = ({ ruleId }) => {
  const [dateRange, setDateRange] = useState({ start: 'now-24h', end: 'now' });
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<'execution_start' | 'execution_duration_ms'>(
    'execution_start'
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading, isError, error } = useV2ExecutionResults({
    ruleId,
    from: dateRange.start,
    to: dateRange.end,
    sortField,
    sortOrder: sortDirection,
    page: pageIndex + 1,
    perPage: pageSize,
  });

  const onTableChange = useCallback(
    ({ page, sort }: CriteriaWithPagination<UnifiedExecutionResult>) => {
      if (page) {
        setPageIndex(page.index);
        setPageSize(page.size);
      }
      if (sort) {
        setSortField(sort.field as 'execution_start' | 'execution_duration_ms');
        setSortDirection(sort.direction);
      }
    },
    []
  );

  const onTimeChange = useCallback(
    ({ start, end }: { start: string; end: string }) => {
      setDateRange({ start, end });
      setPageIndex(0);
    },
    []
  );

  const pagination = useMemo(
    () => ({
      pageIndex,
      pageSize,
      totalItemCount: data?.total ?? 0,
      pageSizeOptions: [5, 10, 25],
    }),
    [pageIndex, pageSize, data?.total]
  );

  const sorting = useMemo(
    () => ({
      sort: {
        field: sortField,
        direction: sortDirection,
      },
    }),
    [sortField, sortDirection]
  );

  if (isError) {
    return (
      <EuiCallOut title="Failed to load execution results" color="danger" iconType="error">
        {error instanceof Error ? error.message : String(error)}
      </EuiCallOut>
    );
  }

  return (
    <>
      <EuiFlexGroup justifyContent="flexEnd" gutterSize="m">
        <EuiFlexItem grow={false}>
          <EuiSuperDatePicker
            start={dateRange.start}
            end={dateRange.end}
            onTimeChange={onTimeChange}
            showUpdateButton={false}
            compressed
          />
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiBasicTable
        items={data?.data ?? []}
        columns={columns}
        loading={isLoading}
        pagination={pagination}
        sorting={sorting}
        onChange={onTableChange}
        data-test-subj="v2ExecutionLogTable"
      />
    </>
  );
};
