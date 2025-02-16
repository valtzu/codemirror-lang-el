// generate CONFIGURATION.md from this file by running "tsdoc --src=src/types.ts --dest=CONFIGURATION.md --noemoji --types"

/**
 * The configuration object that is passed to `expressionlanguage` function
 */
export interface ExpressionLanguageConfig {
  /** Type definitions used in `identifiers` & `functions` */
  types?: { [key: string]: ELType };
  /** Top-level variables */
  identifiers?: ELIdentifier[];
  /** Top-level functions */
  functions?: ELFunction[];
}

export interface ELType {
  /** Properties of the object */
  identifiers?: ELIdentifier[];
  /** Methods of the object */
  functions?: ELFunction[];
  info?: string;
}

/**
 * Represents a variable or a property of an object
 */
export interface ELIdentifier {
  name: string;
  /** If set, this is shown instead of `type` */
  detail?: string;
  /** Text to show in hover tooltip, autocomplete etc. */
  info?: string;
  /** All possible types for this identifier */
  type?: ELTypeName[];
}

/**
 * Represents a function or a method of an object
 */
export interface ELFunction {
  name: string;
  args?: ELParameter[];
  info?: string;
  returnType?: ELTypeName[];
}

export interface ELParameter {
  name: string;
  type?: ELTypeName[];
  info?: string;
  optional?: boolean;
}

export interface ELKeyword {
  name: string;
  detail?: string;
  info?: string;
}

export enum ELScalar {
  /** Equivalent to PHP `bool` */
  Bool = 'bool',
  /** Equivalent to PHP `int` or `float` */
  Number = 'number',
  /** Equivalent to PHP `string` */
  String = 'string',
  /** Equivalent to PHP `null` */
  Null = 'null',
  /** Equivalent to PHP `mixed` */
  Any = 'any',
}

/**
 * One of predefined types (`ELScalar`) or a custom type from `ExpressionLanguageConfig.types`
 */
export type ELTypeName = ELScalar | string;
