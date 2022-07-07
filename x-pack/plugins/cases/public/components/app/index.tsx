/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { APP_OWNER } from '../../../common/constants';
import { ExternalReferenceAttachmentTypeRegistry } from '../../client/attachment_framework/external_reference_registry';
import { getCasesLazy } from '../../client/ui/get_cases';
import { useApplicationCapabilities } from '../../common/lib/kibana';

import { Wrapper } from '../wrappers';
import { CasesRoutesProps } from './types';

export type CasesProps = CasesRoutesProps;

interface CasesAppProps {
  externalReferenceAttachmentTypeRegistry: ExternalReferenceAttachmentTypeRegistry;
}

const CasesAppComponent: React.FC<CasesAppProps> = ({
  externalReferenceAttachmentTypeRegistry,
}) => {
  const userCapabilities = useApplicationCapabilities();

  return (
    <Wrapper data-test-subj="cases-app">
      {getCasesLazy({
        externalReferenceAttachmentTypeRegistry,
        owner: [APP_OWNER],
        useFetchAlertData: () => [false, {}],
        permissions: userCapabilities.generalCases,
        basePath: '/',
        features: { alerts: { enabled: false } },
        releasePhase: 'experimental',
      })}
    </Wrapper>
  );
};

CasesAppComponent.displayName = 'CasesApp';

export const CasesApp = React.memo(CasesAppComponent);
