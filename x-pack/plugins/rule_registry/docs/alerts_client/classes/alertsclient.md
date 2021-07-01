[Alerts as data client API Interface](../alerts_client_api.md) / AlertsClient

# Class: AlertsClient

Provides apis to interact with alerts as data
ensures the request is authorized to perform read / write actions
on alerts as data.

## Table of contents

### Constructors

- [constructor](alertsclient.md#constructor)

### Properties

- [auditLogger](alertsclient.md#auditlogger)
- [authorization](alertsclient.md#authorization)
- [esClient](alertsclient.md#esclient)
- [logger](alertsclient.md#logger)

### Methods

- [fetchAlert](alertsclient.md#fetchalert)
- [get](alertsclient.md#get)
- [getAlertsIndex](alertsclient.md#getalertsindex)
- [getAuthorizedAlertsIndices](alertsclient.md#getauthorizedalertsindices)
- [update](alertsclient.md#update)

## Constructors

### constructor

• **new AlertsClient**(`__namedParameters`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `__namedParameters` | [ConstructorOptions](../interfaces/constructoroptions.md) |

#### Defined in

[rule_registry/server/alert_data_client/alerts_client.ts:73](https://github.com/dhurley14/kibana/blob/fbd3905673e/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L73)

## Properties

### auditLogger

• `Private` `Optional` `Readonly` **auditLogger**: `AuditLogger`

#### Defined in

[rule_registry/server/alert_data_client/alerts_client.ts:71](https://github.com/dhurley14/kibana/blob/fbd3905673e/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L71)

___

### authorization

• `Private` `Readonly` **authorization**: `PublicMethodsOf`<AlertingAuthorization\>

#### Defined in

[rule_registry/server/alert_data_client/alerts_client.ts:72](https://github.com/dhurley14/kibana/blob/fbd3905673e/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L72)

___

### esClient

• `Private` `Readonly` **esClient**: `ElasticsearchClient`

#### Defined in

[rule_registry/server/alert_data_client/alerts_client.ts:73](https://github.com/dhurley14/kibana/blob/fbd3905673e/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L73)

___

### logger

• `Private` `Readonly` **logger**: `Logger`

#### Defined in

[rule_registry/server/alert_data_client/alerts_client.ts:70](https://github.com/dhurley14/kibana/blob/fbd3905673e/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L70)

## Methods

### fetchAlert

▸ `Private` **fetchAlert**(`__namedParameters`): `Promise`<AlertType\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `__namedParameters` | `GetAlertParams` |

#### Returns

`Promise`<AlertType\>

#### Defined in

[rule_registry/server/alert_data_client/alerts_client.ts:93](https://github.com/dhurley14/kibana/blob/fbd3905673e/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L93)

___

### get

▸ **get**(`__namedParameters`): `Promise`<OutputOf<SetOptional<`Object`\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `__namedParameters` | `GetAlertParams` |

#### Returns

`Promise`<OutputOf<SetOptional<`Object`\>\>\>

#### Defined in

[rule_registry/server/alert_data_client/alerts_client.ts:122](https://github.com/dhurley14/kibana/blob/fbd3905673e/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L122)

___

### getAlertsIndex

▸ **getAlertsIndex**(`featureIds`, `operations`): `Promise`<`Object`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `featureIds` | `string`[] |
| `operations` | (`ReadOperations` \| `WriteOperations`)[] |

#### Returns

`Promise`<`Object`\>

#### Defined in

[rule_registry/server/alert_data_client/alerts_client.ts:82](https://github.com/dhurley14/kibana/blob/fbd3905673e/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L82)

___

### getAuthorizedAlertsIndices

▸ **getAuthorizedAlertsIndices**(`featureIds`): `Promise`<undefined \| string[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `featureIds` | `string`[] |

#### Returns

`Promise`<undefined \| string[]\>

#### Defined in

[rule_registry/server/alert_data_client/alerts_client.ts:214](https://github.com/dhurley14/kibana/blob/fbd3905673e/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L214)

___

### update

▸ **update**<Params\>(`__namedParameters`): `Promise`<`Object`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Params` | `Params`: `AlertTypeParams` = `never` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `__namedParameters` | [UpdateOptions](../interfaces/updateoptions.md)<Params\> |

#### Returns

`Promise`<`Object`\>

#### Defined in

[rule_registry/server/alert_data_client/alerts_client.ts:160](https://github.com/dhurley14/kibana/blob/fbd3905673e/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L160)
