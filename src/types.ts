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
  args: string[]; // maybe these could be ELIdentifier[] ?
  info?: string;
  returnType?: string[];
}

export interface ELType {
  identifiers?: ELIdentifier[];
  functions?: ELFunction[];
  info?: string;
}

export interface ExpressionLanguageConfig {
  types?: {[key: string]: ELType};
  identifiers?: ELIdentifier[];
  functions?: ELFunction[];
  operatorKeywords?: readonly { name: string; detail?: string, info?: string }[];
  htmlTooltip?: boolean,
}
