import { SyntaxNode } from "@lezer/common";
import { EditorState } from "@codemirror/state";
import { ELFunction, ELIdentifier, ELKeyword, ELScalar, ExpressionLanguageConfig } from "./types";
import { t } from "./props";
import {
  Method,
  Function,
  Property,
  Variable,
  PropertyAccess,
  MethodAccess,
  Call,
  Application,
  TernaryExpression,
  BinaryExpression,
  UnaryExpression,
} from "./syntax.grammar.terms";

export const createInfoElement = (html: string) => {
  const dom = document.createElement("div")
  dom.innerHTML = html;
  dom.className = 'cm-diagnostic';
  return dom;
};

export const createCompletionInfoElement = (html: string) => {
  if (!html) {
    return undefined;
  }

  const dom = document.createElement("div")
  dom.innerHTML = html;
  return { dom };
};

export function resolveFunctionDefinition(node: SyntaxNode | null, state: EditorState, config: ExpressionLanguageConfig) {
  if (!node) {
    return undefined;
  }

  let identifier: string | undefined;
  if ((node.type.is(PropertyAccess) || node.type.is(MethodAccess)) && node.lastChild) {
    const leftArgument = node.firstChild?.node;
    const types = Array.from(resolveTypes(state, leftArgument, config));
    identifier = state.sliceDoc(node.lastChild.from, node.lastChild.to);

    return types.map(type => resolveCallable(identifier, config.types?.[type])).find(x => x);
  } else if (node.type.is(Function)) {
    identifier = state.sliceDoc(node.from, node.node.firstChild ? node.node.firstChild.from - 1 : node.to);

    return resolveCallable(identifier, config);
  }
}

const resolveCallable = (identifier?: string, config?: {
  identifiers?: ELIdentifier[],
  functions?: ELFunction[]
}) => config?.functions?.find(x => x.name === identifier);

export const resolveIdentifier = (nodeTypeId: typeof Method | typeof Property | typeof Function | typeof Variable, identifier?: string, config?: {
  identifiers?: ELIdentifier[],
  functions?: ELFunction[]
}): ELIdentifier | ELFunction | undefined => {
  switch (nodeTypeId) {
    case Method:
    case Function:
      return resolveCallable(identifier, config);
    case Property:
    case Variable:
      return config?.identifiers?.find(x => x.name === identifier);
  }
};

export function resolveTypes(state: EditorState, node: SyntaxNode | undefined | null, config: ExpressionLanguageConfig): Set<string> {
  let types: Set<string> = new Set<string>();
  if (!node) {
    return types;
  }

  let type;
  if (typeof (type = node.type.prop(t)) !== "undefined") {
    types.add(type);
  } else if (node.type.is(Call) && node.firstChild && node.lastChild) {
    resolveTypes(state, node.firstChild, config).forEach(x => types.add(x));
  } else if (node.type.is(Variable)) {
    const varName = state.sliceDoc(node.from, node.to) || '';
    // @ts-ignore
    resolveIdentifier(node.type.id, varName, config)?.type?.forEach((x: string) => types.add(x));
  } else if (node.type.is(Function)) {
    const varName = state.sliceDoc(node.from, node.to) || '';
    // @ts-ignore
    resolveIdentifier(node.type.id, varName, config)?.returnType?.forEach((x: string) => types.add(x));
  } else if (node.type.is(PropertyAccess) && node.firstChild && node.lastChild?.type.is(Property)) {
    const varName = state.sliceDoc(node.lastChild.from, node.lastChild.to) || '';
    resolveTypes(state, node.firstChild, config)?.forEach(baseType => {
      // @ts-ignore
      resolveIdentifier(node.lastChild?.type.id, varName, config.types?.[baseType])?.type?.forEach((x: string) => types.add(x));
    });
  } else if (node.type.is(MethodAccess) && node.firstChild && node.lastChild?.type.is(Method)) {
    const varName = state.sliceDoc(node.lastChild.from, node.lastChild.to) || '';
    resolveTypes(state, node.firstChild, config)?.forEach(baseType => {
      // @ts-ignore
      resolveIdentifier(node.lastChild?.type.id, varName, config.types?.[baseType])?.returnType?.forEach((x: string) => types.add(x));
    });
  } else if (node.type.is(Application) && node.firstChild) {
    resolveTypes(state, node.firstChild, config).forEach(x => types.add(x));
  } else if (node.type.is(TernaryExpression) && node.firstChild && node.firstChild.nextSibling && node.firstChild.nextSibling.nextSibling) {
    resolveTypes(state, node.firstChild.nextSibling, config).forEach(x => types.add(x));
    resolveTypes(state, node.firstChild.nextSibling.nextSibling, config).forEach(x => types.add(x));
  } else if (node.type.is(BinaryExpression) && node.firstChild?.nextSibling && node.firstChild?.nextSibling?.nextSibling) {
    const operator = state.sliceDoc(node.firstChild.nextSibling.from, node.firstChild.nextSibling.to);
    if (operator == '?:' || operator == '??' || operator == '?') {
      if (operator == '?:' || operator == '??') {
        resolveTypes(state, node.firstChild, config).forEach(x => types.add(x));
      }
      resolveTypes(state, node.firstChild.nextSibling.nextSibling, config).forEach(x => types.add(x));
    } else if (['||', '&&', '==', '!=', '===', '!==', '>=', '<=', '>', '<'].includes(operator) || keywords.find(x => x.name == operator)) {
      types.add(ELScalar.Bool);
    } else if (['**', '|', '^', '&', '<<', '>>', '+', '-', '*', '/', '%'].includes(operator)) {
      types.add(ELScalar.Number);
    }
  } else if (node.type.is(UnaryExpression) && node.firstChild) {
    const operator = state.sliceDoc(node.firstChild.from, node.firstChild.to);
    if (['not', '!'].includes(operator)) {
      types.add(ELScalar.Bool);
    } else if (['+', '-'].includes(operator)) {
      types.add(ELScalar.Number);
    }
  }

  if (types.size === 0) {
    types.add(ELScalar.Any);
  }

  return types;
}

export function getExpressionLanguageConfig(state: EditorState): ExpressionLanguageConfig {
  return state.languageDataAt<ExpressionLanguageConfig>('expressionLanguageConfig', 0)[0];
}

export const keywords: ELKeyword[] = [
  { name: 'starts with', info: 'Check if a string starts with a specific string' },
  { name: 'ends with', info: 'Check if a string ends with a specific string' },
  { name: 'contains', info: 'Check if a string is not included in another string' },
  { name: 'matches', info: 'Check if a string matches a regex pattern' },
  { name: 'not in', info: 'Check if a value is not included in an array' },
  { name: 'in', info: 'Check if a value is included in an array' },
  { name: 'not' },
  { name: 'or' },
  { name: 'and' },
  { name: 'xor' },
];
