[Alerts as data client API Interface](../alerts_client_api.md) / AlertsClient

# Class: AlertsClient

## Table of contents

### Constructors

- [constructor](alertsclient.md#constructor)

### Properties

- [auditLogger](alertsclient.md#auditlogger)
- [authorization](alertsclient.md#authorization)
- [esClient](alertsclient.md#esclient)
- [logger](alertsclient.md#logger)
- [ruleDataService](alertsclient.md#ruledataservice)

### Methods

- [fetchAlert](alertsclient.md#fetchalert)
- [get](alertsclient.md#get)
- [getAlertsIndex](alertsclient.md#getalertsindex)
- [getFullAssetName](alertsclient.md#getfullassetname)
- [update](alertsclient.md#update)

## Constructors

### constructor

• **new AlertsClient**(`__namedParameters`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `__namedParameters` | [ConstructorOptions](../interfaces/constructoroptions.md) |

#### Defined in

[alerts_client.ts:51](https://github.com/dhurley14/kibana/blob/7aeac695545/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L51)

## Properties

### auditLogger

• `Private` `Optional` `Readonly` **auditLogger**: `AuditLogger`

#### Defined in

[alerts_client.ts:48](https://github.com/dhurley14/kibana/blob/7aeac695545/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L48)

___

### authorization

• `Private` `Readonly` **authorization**: `PublicMethodsOf`<AlertingAuthorization\>

#### Defined in

[alerts_client.ts:49](https://github.com/dhurley14/kibana/blob/7aeac695545/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L49)

___

### esClient

• `Private` `Readonly` **esClient**: `ElasticsearchClient`

#### Defined in

[alerts_client.ts:50](https://github.com/dhurley14/kibana/blob/7aeac695545/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L50)

___

### logger

• `Private` `Readonly` **logger**: `Logger`

#### Defined in

[alerts_client.ts:47](https://github.com/dhurley14/kibana/blob/7aeac695545/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L47)

___

### ruleDataService

• `Private` `Readonly` **ruleDataService**: `PublicMethodsOf`<RuleDataPluginService\>

#### Defined in

[alerts_client.ts:51](https://github.com/dhurley14/kibana/blob/7aeac695545/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L51)

## Methods

### fetchAlert

▸ `Private` **fetchAlert**(`__namedParameters`): `Promise`<OutputOf<SetOptional<`Object`\>\>\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `__namedParameters` | `GetAlertParams` |

#### Returns

`Promise`<OutputOf<SetOptional<`Object`\>\>\>

#### Defined in

[alerts_client.ts:78](https://github.com/dhurley14/kibana/blob/7aeac695545/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L78)

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

[alerts_client.ts:103](https://github.com/dhurley14/kibana/blob/7aeac695545/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L103)

___

### getAlertsIndex

▸ **getAlertsIndex**(`featureIds`): `Promise`<undefined \| string[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `featureIds` | `string`[] |

#### Returns

`Promise`<undefined \| string[]\>

#### Defined in

[alerts_client.ts:71](https://github.com/dhurley14/kibana/blob/7aeac695545/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L71)

___

### getFullAssetName

▸ **getFullAssetName**(): `string`

#### Returns

`string`

#### Defined in

[alerts_client.ts:67](https://github.com/dhurley14/kibana/blob/7aeac695545/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L67)

___

### update

▸ **update**<Params\>(`__namedParameters`): `Promise`<undefined \| ``null`` \| OutputOf<SetOptional<`Object`\>\>\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Params` | `Params`: `AlertTypeParams` = `never` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `__namedParameters` | [UpdateOptions](../interfaces/updateoptions.md)<Params\> |

#### Returns

`Promise`<undefined \| ``null`` \| OutputOf<SetOptional<`Object`\>\>\>

#### Defined in

[alerts_client.ts:141](https://github.com/dhurley14/kibana/blob/7aeac695545/x-pack/plugins/rule_registry/server/alert_data_client/alerts_client.ts#L141)
