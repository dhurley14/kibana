/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { mount } from 'enzyme';
import { unifiedSearchPluginMock } from '@kbn/unified-search-plugin/public/mocks';
import { fields } from '@kbn/data-plugin/common/mocks';
import { EuiThemeProvider } from '@kbn/kibana-react-plugin/common';
import { coreMock } from '@kbn/core/public/mocks';
import type { DataView } from '@kbn/data-views-plugin/common';
import { createStubDataView } from '@kbn/data-views-plugin/common/data_view.stub';

import { getExceptionListItemSchemaMock } from '../../../../common/schemas/response/exception_list_item_schema.mock';
import { getEntryMatchMock } from '../../../../common/schemas/types/entry_match.mock';
import { getEntryMatchAnyMock } from '../../../../common/schemas/types/entry_match_any.mock';

import { BuilderExceptionListItemComponent } from './exception_item_renderer';

const getMockIndexPattern = (): DataView => ({
  ...createStubDataView({
    spec: { id: '1234', title: 'logstash-*' },
  }),
  // @ts-expect-error fields does not contain toSpec, it's okay
  fields,
});

const mockKibanaHttpService = coreMock.createStart().http;
const { autocomplete: autocompleteStartMock } = unifiedSearchPluginMock.createStartContract();

describe('BuilderExceptionListItemComponent', () => {
  const getValueSuggestionsMock = jest.fn().mockResolvedValue(['value 1', 'value 2']);

  afterEach(() => {
    getValueSuggestionsMock.mockClear();
  });

  describe('and badge logic', () => {
    test('it renders "and" badge with extra top padding for the first exception item when "andLogicIncluded" is "true"', () => {
      const exceptionItem = {
        ...getExceptionListItemSchemaMock(),
        entries: [getEntryMatchMock(), getEntryMatchMock()],
      };
      const wrapper = mount(
        <EuiThemeProvider>
          <BuilderExceptionListItemComponent
            allowLargeValueLists={true}
            andLogicIncluded={true}
            autocompleteService={autocompleteStartMock}
            exceptionItem={exceptionItem}
            exceptionItemIndex={0}
            httpService={mockKibanaHttpService}
            indexPattern={getMockIndexPattern()}
            isOnlyItem={false}
            listType="detection"
            onChangeExceptionItem={jest.fn()}
            onDeleteExceptionItem={jest.fn()}
            setErrorsExist={jest.fn()}
            setWarningsExist={jest.fn()}
          />
        </EuiThemeProvider>
      );

      expect(
        wrapper.find('[data-test-subj="exceptionItemEntryFirstRowAndBadge"]').exists()
      ).toBeTruthy();
    });

    test('it renders "and" badge when more than one exception item entry exists and it is not the first exception item', () => {
      const exceptionItem = getExceptionListItemSchemaMock();
      exceptionItem.entries = [getEntryMatchMock(), getEntryMatchMock()];
      const wrapper = mount(
        <EuiThemeProvider>
          <BuilderExceptionListItemComponent
            allowLargeValueLists={true}
            andLogicIncluded={true}
            autocompleteService={autocompleteStartMock}
            exceptionItem={exceptionItem}
            exceptionItemIndex={1}
            httpService={mockKibanaHttpService}
            indexPattern={getMockIndexPattern()}
            isOnlyItem={false}
            listType="detection"
            onChangeExceptionItem={jest.fn()}
            onDeleteExceptionItem={jest.fn()}
            setErrorsExist={jest.fn()}
            setWarningsExist={jest.fn()}
          />
        </EuiThemeProvider>
      );

      expect(wrapper.find('[data-test-subj="exceptionItemEntryAndBadge"]').exists()).toBeTruthy();
    });

    test('it renders indented "and" badge when "andLogicIncluded" is "true" and only one entry exists', () => {
      const exceptionItem = getExceptionListItemSchemaMock();
      exceptionItem.entries = [getEntryMatchMock()];
      const wrapper = mount(
        <EuiThemeProvider>
          <BuilderExceptionListItemComponent
            allowLargeValueLists={true}
            andLogicIncluded={true}
            autocompleteService={autocompleteStartMock}
            exceptionItem={exceptionItem}
            exceptionItemIndex={1}
            httpService={mockKibanaHttpService}
            indexPattern={getMockIndexPattern()}
            isOnlyItem={false}
            listType="detection"
            onChangeExceptionItem={jest.fn()}
            onDeleteExceptionItem={jest.fn()}
            setErrorsExist={jest.fn()}
            setWarningsExist={jest.fn()}
          />
        </EuiThemeProvider>
      );

      expect(
        wrapper.find('[data-test-subj="exceptionItemEntryInvisibleAndBadge"]').exists()
      ).toBeTruthy();
    });

    test('it renders no "and" badge when "andLogicIncluded" is "false"', () => {
      const exceptionItem = getExceptionListItemSchemaMock();
      exceptionItem.entries = [getEntryMatchMock()];
      const wrapper = mount(
        <EuiThemeProvider>
          <BuilderExceptionListItemComponent
            allowLargeValueLists={true}
            andLogicIncluded={false}
            autocompleteService={autocompleteStartMock}
            exceptionItem={exceptionItem}
            exceptionItemIndex={1}
            httpService={mockKibanaHttpService}
            indexPattern={getMockIndexPattern()}
            isOnlyItem={false}
            listType="detection"
            onChangeExceptionItem={jest.fn()}
            onDeleteExceptionItem={jest.fn()}
            setErrorsExist={jest.fn()}
            setWarningsExist={jest.fn()}
          />
        </EuiThemeProvider>
      );

      expect(
        wrapper.find('[data-test-subj="exceptionItemEntryInvisibleAndBadge"]').exists()
      ).toBeFalsy();
      expect(wrapper.find('[data-test-subj="exceptionItemEntryAndBadge"]').exists()).toBeFalsy();
      expect(
        wrapper.find('[data-test-subj="exceptionItemEntryFirstRowAndBadge"]').exists()
      ).toBeFalsy();
    });
  });

  describe('delete button logic', () => {
    test('it renders delete button disabled when it is only entry left in builder', () => {
      const exceptionItem = {
        ...getExceptionListItemSchemaMock(),
        entries: [{ ...getEntryMatchMock(), field: '' }],
      };
      const wrapper = mount(
        <BuilderExceptionListItemComponent
          allowLargeValueLists={true}
          andLogicIncluded={false}
          autocompleteService={autocompleteStartMock}
          exceptionItem={exceptionItem}
          exceptionItemIndex={0}
          httpService={mockKibanaHttpService}
          indexPattern={getMockIndexPattern()}
          isOnlyItem={true}
          listType="detection"
          onChangeExceptionItem={jest.fn()}
          onDeleteExceptionItem={jest.fn()}
          setErrorsExist={jest.fn()}
          setWarningsExist={jest.fn()}
        />
      );

      expect(
        wrapper.find('[data-test-subj="builderItemEntryDeleteButton"] button').props().disabled
      ).toBeTruthy();
    });

    test('it does not render delete button disabled when it is not the only entry left in builder', () => {
      const exceptionItem = getExceptionListItemSchemaMock();
      exceptionItem.entries = [getEntryMatchMock()];

      const wrapper = mount(
        <BuilderExceptionListItemComponent
          allowLargeValueLists={true}
          andLogicIncluded={false}
          autocompleteService={autocompleteStartMock}
          exceptionItem={exceptionItem}
          exceptionItemIndex={0}
          httpService={mockKibanaHttpService}
          indexPattern={getMockIndexPattern()}
          isOnlyItem={false}
          listType="detection"
          onChangeExceptionItem={jest.fn()}
          onDeleteExceptionItem={jest.fn()}
          setErrorsExist={jest.fn()}
          setWarningsExist={jest.fn()}
        />
      );

      expect(
        wrapper.find('[data-test-subj="builderItemEntryDeleteButton"] button').props().disabled
      ).toBeFalsy();
    });

    test('it does not render delete button disabled when "exceptionItemIndex" is not "0"', () => {
      const exceptionItem = getExceptionListItemSchemaMock();
      exceptionItem.entries = [getEntryMatchMock()];
      const wrapper = mount(
        <BuilderExceptionListItemComponent
          allowLargeValueLists={true}
          andLogicIncluded={false}
          autocompleteService={autocompleteStartMock}
          exceptionItem={exceptionItem}
          exceptionItemIndex={1}
          httpService={mockKibanaHttpService}
          indexPattern={getMockIndexPattern()}
          // if exceptionItemIndex is not 0, wouldn't make sense for
          // this to be true, but done for testing purposes
          isOnlyItem={true}
          listType="detection"
          onChangeExceptionItem={jest.fn()}
          onDeleteExceptionItem={jest.fn()}
          setErrorsExist={jest.fn()}
          setWarningsExist={jest.fn()}
        />
      );

      expect(
        wrapper.find('[data-test-subj="builderItemEntryDeleteButton"] button').props().disabled
      ).toBeFalsy();
    });

    test('it does not render delete button disabled when more than one entry exists', () => {
      const exceptionItem = getExceptionListItemSchemaMock();
      exceptionItem.entries = [getEntryMatchMock(), getEntryMatchMock()];
      const wrapper = mount(
        <BuilderExceptionListItemComponent
          allowLargeValueLists={true}
          andLogicIncluded={false}
          autocompleteService={autocompleteStartMock}
          exceptionItem={exceptionItem}
          exceptionItemIndex={0}
          httpService={mockKibanaHttpService}
          indexPattern={getMockIndexPattern()}
          isOnlyItem={true}
          listType="detection"
          onChangeExceptionItem={jest.fn()}
          onDeleteExceptionItem={jest.fn()}
          setErrorsExist={jest.fn()}
          setWarningsExist={jest.fn()}
        />
      );

      expect(
        wrapper.find('[data-test-subj="builderItemEntryDeleteButton"] button').at(0).props()
          .disabled
      ).toBeFalsy();
    });

    test('it invokes "onChangeExceptionItem" when delete button clicked', () => {
      const mockOnDeleteExceptionItem = jest.fn();
      const exceptionItem = getExceptionListItemSchemaMock();
      exceptionItem.entries = [getEntryMatchMock(), getEntryMatchAnyMock()];
      const wrapper = mount(
        <BuilderExceptionListItemComponent
          allowLargeValueLists={true}
          andLogicIncluded={false}
          autocompleteService={autocompleteStartMock}
          exceptionItem={exceptionItem}
          exceptionItemIndex={0}
          httpService={mockKibanaHttpService}
          indexPattern={getMockIndexPattern()}
          isOnlyItem={true}
          listType="detection"
          onChangeExceptionItem={jest.fn()}
          onDeleteExceptionItem={mockOnDeleteExceptionItem}
          setErrorsExist={jest.fn()}
          setWarningsExist={jest.fn()}
        />
      );

      wrapper
        .find('[data-test-subj="builderItemEntryDeleteButton"] button')
        .at(0)
        .simulate('click');

      expect(mockOnDeleteExceptionItem).toHaveBeenCalledWith(
        {
          ...exceptionItem,
          entries: [getEntryMatchAnyMock()],
        },
        0
      );
    });
  });
});
