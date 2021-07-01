Alerts as data client API Interface

# Alerts as data client API Interface

## Table of contents

### Classes

- [AlertsClient](classes/alertsclient.md)

### Interfaces

- [ConstructorOptions](interfaces/constructoroptions.md)
- [UpdateOptions](interfaces/updateoptions.md)

### Type aliases

- [ValidFeatureId](alerts_client_api.md#validfeatureid)

### Variables

- [mapConsumerToIndexName](alerts_client_api.md#mapconsumertoindexname)
- [validFeatureIds](alerts_client_api.md#validfeatureids)

### Functions

- [isValidFeatureId](alerts_client_api.md#isvalidfeatureid)

## Type aliases

### ValidFeatureId

Ƭ **ValidFeatureId**: keyof typeof [mapConsumerToIndexName](alerts_client_api.md#mapconsumertoindexname)

#### Defined in

[rule_registry/server/alert_data_client/alerts_client.ts:59](https://github.com/dhurley14/kibana/blob/fbd3905673e/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L59)

## Variables

### mapConsumerToIndexName

• `Const` **mapConsumerToIndexName**: `Object`

registering a new instance of the rule data client
in a new plugin will require updating the below data structure
to include the index name where the alerts as data will be written to.

#### Type declaration

| Name | Type |
| :------ | :------ |
| `apm` | `string` |
| `observability` | `string` |
| `siem` | `string`[] |

#### Defined in

[rule_registry/server/alert_data_client/alerts_client.ts:54](https://github.com/dhurley14/kibana/blob/fbd3905673e/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L54)

___

### validFeatureIds

• `Const` **validFeatureIds**: `string`[]

#### Defined in

[rule_registry/server/alert_data_client/alerts_client.ts:61](https://github.com/dhurley14/kibana/blob/fbd3905673e/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L61)

## Functions

### isValidFeatureId

▸ `Const` **isValidFeatureId**(`a`): a is "apm" \| "observability" \| "siem"

#### Parameters

| Name | Type |
| :------ | :------ |
| `a` | `string` |

#### Returns

a is "apm" \| "observability" \| "siem"

#### Defined in

[rule_registry/server/alert_data_client/alerts_client.ts:62](https://github.com/dhurley14/kibana/blob/fbd3905673e/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L62)
