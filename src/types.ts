/**
 * Represents a variable or a property of an object
 */
export interface ELIdentifier {
  name: string;
  detail?: string;
  info?: string;
  type?: string[];
}

/**
 * Represents a function or a method of an object
 */
export interface ELFunction {
  name: string;
  args: ELParameter[];
  info?: string;
  returnType?: string[];
}

export interface ELParameter {
  name: string;
  type?: string[];
  info?: string;
  optional?: boolean;
}

export interface ELType {
  identifiers?: ELIdentifier[];
  functions?: ELFunction[];
  info?: string;
}

export interface ExpressionLanguageConfig {
  types?: { [key: string]: ELType };
  identifiers?: ELIdentifier[];
  functions?: ELFunction[];
}

export interface ELKeyword {
  name: string;
  detail?: string;
  info?: string;
}

export enum ELScalar {
  Bool = 'bool',
  Number = 'number',
  String = 'string',
  Null = 'null',
  Any = 'any', // not really scalar but meh
}
