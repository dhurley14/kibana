/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { fields } from '../../../common/__mocks__/artificial_logs/fields';
import { filteredFrequentItemSets } from '../../../common/__mocks__/artificial_logs/filtered_frequent_item_sets';

import { getSimpleHierarchicalTree } from './get_simple_hierarchical_tree';
import { getSimpleHierarchicalTreeLeaves } from './get_simple_hierarchical_tree_leaves';

describe('getSimpleHierarchicalTreeLeaves', () => {
  it('returns the hierarchical tree leaves', () => {
    const simpleHierarchicalTree = getSimpleHierarchicalTree(
      filteredFrequentItemSets,
      true,
      false,
      fields
    );
    const leaves = getSimpleHierarchicalTreeLeaves(simpleHierarchicalTree.root, []);
    expect(leaves).toEqual([
      {
        id: '40215074',
        group: [
          {
            fieldName: 'response_code',
            fieldValue: '500',
            docCount: 792,
            pValue: 0.010770456205312423,
          },
          { fieldName: 'url', fieldValue: 'home.php', docCount: 792, pValue: 0.010770456205312423 },
        ],
        docCount: 792,
        pValue: 0.010770456205312423,
      },
      {
        id: '47022118',
        group: [
          {
            docCount: 792,
            fieldName: 'url',
            fieldValue: 'home.php',
            pValue: 0.010770456205312423,
          },
          {
            docCount: 634,
            fieldName: 'user',
            fieldValue: 'Peter',
            pValue: 0.010770456205312423,
          },
        ],
        docCount: 634,
        pValue: 0.010770456205312423,
      },
    ]);
  });
});
