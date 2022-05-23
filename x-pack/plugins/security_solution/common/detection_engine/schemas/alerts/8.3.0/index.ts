/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { AlertWithCommonFields800 } from '@kbn/rule-registry-plugin/common/schemas/8.0.0';
import { ALERT_RULE_INDICES } from '../../../../field_maps/field_names';
import type {
  Ancestor800,
  BaseFields800,
  WrappedFields800,
  EqlBuildingBlockFields800,
  EqlShellFields800,
  EqlBuildingBlockAlert800,
  EqlShellAlert800,
} from '../8.0.0';

export type {
  Ancestor800 as Ancestor830,
  WrappedFields800 as WrappedFields830,
  EqlBuildingBlockFields800 as EqlBuildingBlockFields830,
  EqlShellFields800 as EqlShellFields830,
};

/* DO NOT MODIFY THIS SCHEMA TO ADD NEW FIELDS. These types represent the alerts that shipped in 8.3.0.
Any changes to these types should be bug fixes so the types more accurately represent the alerts from 8.3.0.
If you are adding new fields for a new release of Kibana, create a new sibling folder to this one
for the version to be released and add the field(s) to the schema in that folder.
Then, update `../index.ts` to import from the new folder that has the latest schemas, add the
new schemas to the union of all alert schemas, and re-export the new schemas as the `*Latest` schemas.
*/

export interface BaseFields830 extends BaseFields800 {
  [ALERT_RULE_INDICES]: string[];
}

export type GenericAlert830 = AlertWithCommonFields800<BaseFields830>;

// This is the type of the final generated alert including base fields, common fields
// added by the alertWithPersistence function, and arbitrary fields copied from source documents
export type DetectionAlert830 = GenericAlert830 | EqlShellAlert800 | EqlBuildingBlockAlert800;
