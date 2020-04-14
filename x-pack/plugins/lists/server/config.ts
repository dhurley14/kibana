/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { schema, TypeOf } from '@kbn/config-schema';

export const ConfigSchema = schema.object({
  // TODO: Change this enable to default to false
  enabled: schema.boolean({ defaultValue: true }),
  listsIndex: schema.string({ defaultValue: '.siem-lists' }),
  listsItemsIndex: schema.string({ defaultValue: '.siem-items' }),
});

export type ConfigType = TypeOf<typeof ConfigSchema>;
