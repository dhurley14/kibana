/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { Type, TypeOf } from '@kbn/config-schema';
import { Logger, RequestHandlerContext } from 'kibana/server';
import {
  ActionVariable,
  AlertInstanceContext,
  AlertInstanceState,
  AlertTypeParams,
  AlertTypeState,
} from '../../alerting/common';
import { ActionGroup, AlertExecutorOptions } from '../../alerting/server';
import { RacClient } from './rac_client/rac_client';
import { ScopedRuleRegistryClient } from './rule_registry/create_scoped_rule_registry_client/types';
import { DefaultFieldMap } from './rule_registry/defaults/field_map';

export type RuleParams = Type<any>;

type TypeOfRuleParams<TRuleParams extends RuleParams> = TypeOf<TRuleParams>;

type RuleExecutorServices<
  TFieldMap extends DefaultFieldMap,
  TActionVariable extends ActionVariable
> = AlertExecutorOptions<
  AlertTypeParams,
  AlertTypeState,
  AlertInstanceState,
  { [key in TActionVariable['name']]: any },
  string
>['services'] & {
  logger: Logger;
  scopedRuleRegistryClient?: ScopedRuleRegistryClient<TFieldMap>;
};

type PassthroughAlertExecutorOptions = Pick<
  AlertExecutorOptions<
    AlertTypeParams,
    AlertTypeState,
    AlertInstanceState,
    AlertInstanceContext,
    string
  >,
  'previousStartedAt' | 'startedAt' | 'state'
>;

type RuleExecutorFunction<
  TFieldMap extends DefaultFieldMap,
  TRuleParams extends RuleParams,
  TActionVariable extends ActionVariable,
  TAdditionalRuleExecutorServices extends Record<string, any>
> = (
  options: PassthroughAlertExecutorOptions & {
    services: RuleExecutorServices<TFieldMap, TActionVariable> & TAdditionalRuleExecutorServices;
    params: TypeOfRuleParams<TRuleParams>;
    rule: {
      id: string;
      uuid: string;
      name: string;
      category: string;
    };
    producer: string;
  }
) => Promise<Record<string, any>>;

interface RuleTypeBase {
  id: string;
  name: string;
  actionGroups: Array<ActionGroup<string>>;
  defaultActionGroupId: string;
  producer: string;
  minimumLicenseRequired: 'basic' | 'gold' | 'trial';
}

export type RuleType<
  TFieldMap extends DefaultFieldMap,
  TRuleParams extends RuleParams,
  TActionVariable extends ActionVariable,
  TAdditionalRuleExecutorServices extends Record<string, any> = {}
> = RuleTypeBase & {
  validate: {
    params: TRuleParams;
  };
  actionVariables: {
    context: TActionVariable[];
  };
  executor: RuleExecutorFunction<
    TFieldMap,
    TRuleParams,
    TActionVariable,
    TAdditionalRuleExecutorServices
  >;
};

/**
 * @public
 */
export interface RacApiRequestHandlerContext {
  getRacClient: () => Promise<RacClient>;
}

/**
 * @internal
 */
export interface RacRequestHandlerContext extends RequestHandlerContext {
  ruleRegistry?: RacApiRequestHandlerContext;
}
/**
 * @internal
 */
export type ContextProviderReturn = RacApiRequestHandlerContext;
