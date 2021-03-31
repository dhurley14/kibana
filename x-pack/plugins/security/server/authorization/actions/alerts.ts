/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { isString } from 'lodash';

export class AlertsActions {
  private readonly prefix: string;

  constructor(versionNumber: string) {
    this.prefix = `alerts:${versionNumber}:`;
  }

  public get(spaceId: string, owner: string, operation: string): string {
    if (!spaceId || !isString(spaceId)) {
      throw new Error('"spaceId" is required and must be a string');
    }

    if (!operation || !isString(operation)) {
      throw new Error('"operation" is required and must be a string');
    }

    if (!owner || !isString(owner)) {
      throw new Error('"owner" is required and must be a string');
    }

    return `${this.prefix}${spaceId}/${owner}/${operation}`;
  }
}
