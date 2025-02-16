
## Enum

- [ELScalar](#elscalar)

### ELScalar



| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `Bool` | `'bool'` | Equivalent to PHP `bool` |
| `Number` | `'number'` | Equivalent to PHP `int` or `float` |
| `String` | `'string'` | Equivalent to PHP `string` |
| `Null` | `'null'` | Equivalent to PHP `null` |
| `Any` | `'any'` | Equivalent to PHP `mixed` |


## Interfaces

- [ExpressionLanguageConfig](#expressionlanguageconfig)
- [ELType](#eltype)
- [ELIdentifier](#elidentifier)
- [ELFunction](#elfunction)
- [ELParameter](#elparameter)
- [ELKeyword](#elkeyword)

### ExpressionLanguageConfig

The configuration object that is passed to `expressionlanguage` function

| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `types` | `{ [key: string]: ELType; } or undefined` | Type definitions used in `identifiers` and `functions` |
| `identifiers` | `ELIdentifier[] or undefined` | Top-level variables |
| `functions` | `ELFunction[] or undefined` | Top-level functions |


### ELType



| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `identifiers` | `ELIdentifier[] or undefined` | Properties of the object |
| `functions` | `ELFunction[] or undefined` | Methods of the object |
| `info` | `string or undefined` |  |


### ELIdentifier

Represents a variable or a property of an object

| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `name` | `string` |  |
| `detail` | `string or undefined` | If set, this is shown instead of `type` |
| `info` | `string or undefined` | Text to show in hover tooltip, autocomplete etc. |
| `type` | `string[] or undefined` | All possible types for this identifier |


### ELFunction

Represents a function or a method of an object

| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `name` | `string` |  |
| `args` | `ELParameter[] or undefined` |  |
| `info` | `string or undefined` |  |
| `returnType` | `string[] or undefined` |  |


### ELParameter



| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `name` | `string` |  |
| `type` | `string[] or undefined` |  |
| `info` | `string or undefined` |  |
| `optional` | `boolean or undefined` |  |


### ELKeyword



| Property | Type | Description |
| ---------- | ---------- | ---------- |
| `name` | `string` |  |
| `detail` | `string or undefined` |  |
| `info` | `string or undefined` |  |


## Types

- [ELTypeName](#eltypename)

### ELTypeName

One of predefined types (`ELScalar`) or a custom type from `ExpressionLanguageConfig.types`

| Type | Type |
| ---------- | ---------- |
| `ELTypeName` | `ELScalar or string` |

