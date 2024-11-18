/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  EuiModal,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiModalBody,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSwitch,
  EuiModalFooter,
  EuiButton,
  EuiHorizontalRule,
  EuiText,
  EuiButtonEmpty,
  EuiBetaBadge,
  EuiToolTip,
} from '@elastic/eui';
import React, { useState } from 'react';
import { FormattedMessage } from '@kbn/i18n-react';
import { TECHNICAL_PREVIEW, TECHNICAL_PREVIEW_TOOLTIP } from '../../../../common/translations';
import {
  ENABLEMENT_DESCRIPTION_RISK_ENGINE_ONLY,
  ENABLEMENT_DESCRIPTION_ENTITY_STORE_ONLY,
} from '../translations';
import { useMissingRiskEnginePrivileges } from '../../../hooks/use_missing_risk_engine_privileges';
import { RiskEnginePrivilegesCallOut } from '../../risk_engine_privileges_callout';

export interface Enablements {
  riskScore: boolean;
  entityStore: boolean;
}

interface EntityStoreEnablementModalProps {
  visible: boolean;
  toggle: (visible: boolean) => void;
  enableStore: (enablements: Enablements) => () => void;
  riskScore: {
    disabled?: boolean;
    checked?: boolean;
  };
  entityStore: {
    disabled?: boolean;
    checked?: boolean;
  };
}

export const EntityStoreEnablementModal: React.FC<EntityStoreEnablementModalProps> = ({
  visible,
  toggle,
  enableStore,
  riskScore,
  entityStore,
}) => {
  const [enablements, setEnablements] = useState({
    riskScore: !!riskScore.checked,
    entityStore: !!entityStore.checked,
  });
  const riskEnginePrivileges = useMissingRiskEnginePrivileges();

  if (!visible) {
    return null;
  }
  const hasRiskEnginePrivileges =
    !riskEnginePrivileges.isLoading && riskEnginePrivileges?.hasAllRequiredPrivileges;

  return (
    <EuiModal onClose={() => toggle(false)}>
      <EuiModalHeader>
        <EuiModalHeaderTitle>
          <FormattedMessage
            id="xpack.securitySolution.entityAnalytics.enablements.modal.title"
            defaultMessage="Entity Analytics Enablement"
          />
        </EuiModalHeaderTitle>
      </EuiModalHeader>

      <EuiModalBody>
        <EuiFlexGroup direction="column">
          <EuiFlexItem>
            <EuiSwitch
              label={
                <FormattedMessage
                  id="xpack.securitySolution.entityAnalytics.enablements.modal.risk"
                  defaultMessage="Risk Score"
                />
              }
              checked={enablements.riskScore && hasRiskEnginePrivileges}
              disabled={riskScore.disabled || !hasRiskEnginePrivileges}
              onChange={() => setEnablements((prev) => ({ ...prev, riskScore: !prev.riskScore }))}
            />
          </EuiFlexItem>
          {!riskEnginePrivileges.isLoading && !riskEnginePrivileges.hasAllRequiredPrivileges && (
            <EuiFlexItem>
              <RiskEnginePrivilegesCallOut privileges={riskEnginePrivileges} />
            </EuiFlexItem>
          )}
          <EuiFlexItem>
            <EuiText>{ENABLEMENT_DESCRIPTION_RISK_ENGINE_ONLY}</EuiText>
          </EuiFlexItem>
          <EuiHorizontalRule margin="none" />
          <EuiFlexItem>
            <EuiFlexGroup justifyContent="flexStart">
              <EuiSwitch
                label={
                  <FormattedMessage
                    id="xpack.securitySolution.entityAnalytics.enablements.modal.store"
                    defaultMessage="Entity Store"
                  />
                }
                checked={enablements.entityStore}
                disabled={entityStore.disabled}
                onChange={() =>
                  setEnablements((prev) => ({ ...prev, entityStore: !prev.entityStore }))
                }
              />
              <EuiToolTip content={TECHNICAL_PREVIEW_TOOLTIP}>
                <EuiBetaBadge label={TECHNICAL_PREVIEW} />
              </EuiToolTip>
            </EuiFlexGroup>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiText>{ENABLEMENT_DESCRIPTION_ENTITY_STORE_ONLY}</EuiText>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiModalBody>

      <EuiModalFooter>
        <EuiButtonEmpty onClick={() => toggle(false)}>{'Cancel'}</EuiButtonEmpty>
        <EuiButton onClick={enableStore(enablements)} fill>
          <FormattedMessage
            id="xpack.securitySolution.entityAnalytics.enablements.modal.enable"
            defaultMessage="Enable"
          />
        </EuiButton>
      </EuiModalFooter>
    </EuiModal>
  );
};
