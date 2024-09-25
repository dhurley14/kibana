/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import expect from '@kbn/expect';

import { FtrProviderContext } from '../../../ftr_provider_context';

export default function ({ getService, getPageObjects }: FtrProviderContext) {
  const filterBar = getService('filterBar');
  const renderable = getService('renderable');
  const embedding = getService('embedding');
  const retry = getService('retry');
  const { visualize, visEditor, visChart, header, timePicker } = getPageObjects([
    'visualize',
    'visEditor',
    'visChart',
    'header',
    'timePicker',
  ]);

  describe('embedding', () => {
    describe('a data table', () => {
      before(async function () {
        await visualize.initTests();
        await visualize.navigateToNewAggBasedVisualization();
        await visualize.clickDataTable();
        await visualize.clickNewSearch();
        await timePicker.setDefaultAbsoluteRange();
        await visEditor.clickBucket('Split rows');
        await visEditor.selectAggregation('Date Histogram');
        await visEditor.selectField('@timestamp');
        await visEditor.toggleOpenEditor(2, 'false');
        await visEditor.clickBucket('Split rows');
        await visEditor.selectAggregation('Histogram');
        await visEditor.selectField('bytes');
        await visEditor.setInterval('2000', { type: 'numeric', aggNth: 3 });
        await visEditor.clickGo();
      });

      it('should allow opening table vis in embedded mode', async () => {
        await embedding.openInEmbeddedMode();
        await renderable.waitForRender();

        const data = await visChart.getTableVisContent();
        expect(data).to.be.eql([
          ['2015-09-20 00:00', '0B', '5'],
          ['2015-09-20 00:00', '1.953KB', '5'],
          ['2015-09-20 00:00', '3.906KB', '9'],
          ['2015-09-20 00:00', '5.859KB', '4'],
          ['2015-09-20 00:00', '7.813KB', '14'],
          ['2015-09-20 03:00', '0B', '32'],
          ['2015-09-20 03:00', '1.953KB', '33'],
          ['2015-09-20 03:00', '3.906KB', '45'],
          ['2015-09-20 03:00', '5.859KB', '31'],
          ['2015-09-20 03:00', '7.813KB', '48'],
        ]);
      });

      it('should allow to filter in embedded mode', async () => {
        await filterBar.addFilter({
          field: '@timestamp',
          operation: 'is between',
          value: { from: '2015-09-21', to: '2015-09-23' },
        });
        await header.waitUntilLoadingHasFinished();
        await renderable.waitForRender();

        const data = await visChart.getTableVisContent();
        expect(data).to.be.eql([
          ['2015-09-21 00:00', '0B', '7'],
          ['2015-09-21 00:00', '1.953KB', '9'],
          ['2015-09-21 00:00', '3.906KB', '9'],
          ['2015-09-21 00:00', '5.859KB', '6'],
          ['2015-09-21 00:00', '7.813KB', '10'],
          ['2015-09-21 00:00', '11.719KB', '1'],
          ['2015-09-21 03:00', '0B', '28'],
          ['2015-09-21 03:00', '1.953KB', '39'],
          ['2015-09-21 03:00', '3.906KB', '36'],
          ['2015-09-21 03:00', '5.859KB', '43'],
        ]);
      });

      it('should allow to change timerange from the visualization in embedded mode', async () => {
        await retry.try(async () => {
          await visChart.filterOnTableCell(0, 6);
          await header.waitUntilLoadingHasFinished();
          await renderable.waitForRender();

          const data = await visChart.getTableVisContent();
          expect(data).to.be.eql([
            ['03:00', '0B', '1'],
            ['03:00', '1.953KB', '1'],
            ['03:00', '3.906KB', '1'],
            ['03:00', '5.859KB', '2'],
            ['03:10', '0B', '1'],
            ['03:10', '5.859KB', '1'],
            ['03:10', '7.813KB', '1'],
            ['03:15', '0B', '1'],
            ['03:15', '1.953KB', '1'],
            ['03:20', '1.953KB', '1'],
          ]);
        });
      });
    });
  });
}
