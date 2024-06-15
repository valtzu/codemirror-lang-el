import { SyntaxNode } from "@lezer/common";
import { EditorState } from "@codemirror/state";
import { ELFunction, ELIdentifier, ELKeyword, ExpressionLanguageConfig } from "./types";

export const createInfoElement = (html: string) => {
  const dom = document.createElement("div")
  dom.innerHTML = html;
  dom.className = 'cm-diagnostic';
  return dom;
};

export function resolveFunctionDefinition(node: SyntaxNode | null, state: EditorState, config: ExpressionLanguageConfig) {
  if (!node) {
    return undefined;
  }

  let identifier: string | undefined;
  if (node.name === 'ObjectAccess' && node.lastChild) {
    const leftArgument = node.firstChild?.node;
    const types = Array.from(resolveTypes(state, leftArgument, config, true));
    identifier = state.sliceDoc(node.lastChild.from, node.lastChild.to);

    return types.map(type => resolveCallable(identifier, config.types?.[type])).find(x => x);
  } else if (node.name === 'Function') {
    identifier = state.sliceDoc(node.from, node.node.firstChild ? node.node.firstChild.from - 1 : node.to);

    return resolveCallable(identifier, config);
  }
}

const resolveCallable = (identifier?: string, config?: {
  identifiers?: ELIdentifier[],
  functions?: ELFunction[]
}) => config?.functions?.find(x => x.name === identifier);

export const resolveIdentifier = (nodeName: 'Method' | 'Property' | 'Function' | 'Variable', identifier?: string, config?: {
  identifiers?: ELIdentifier[],
  functions?: ELFunction[]
}): ELIdentifier | ELFunction | undefined => {
  switch (nodeName) {
    case 'Method':
    case 'Function':
      return resolveCallable(identifier, config);
    case 'Property':
    case 'Variable':
      return config?.identifiers?.find(x => x.name === identifier);
  }
};

export function resolveTypes(state: EditorState, node: SyntaxNode | undefined, config: ExpressionLanguageConfig, matchExact: boolean): Set<string> {
  let types: Set<string> = new Set<string>();
  if (!node) {
    return types;
  }

  if (node.name === 'Call' && node.firstChild && node.lastChild) {
    resolveTypes(state, node.firstChild, config, matchExact).forEach(x => types.add(x));
  } else if (node.name === 'Variable') {
    const varName = state.sliceDoc(node.from, node.to) || '';
    // @ts-ignore
    resolveIdentifier(node.name, varName, config)?.type?.forEach((x: string) => types.add(x));
  } else if (node.name === 'Function') {
    const varName = state.sliceDoc(node.from, node.to) || '';
    // @ts-ignore
    resolveIdentifier(node.name, varName, config)?.returnType?.forEach((x: string) => types.add(x));
  } else if (node.name === 'ObjectAccess' && node.firstChild && node.lastChild?.name === 'Property') {
    const varName = state.sliceDoc(node.lastChild.from, node.lastChild.to) || '';
    resolveTypes(state, node.firstChild, config, matchExact)?.forEach(baseType => {
      // @ts-ignore
      resolveIdentifier(node.lastChild?.name, varName, config.types?.[baseType])?.type?.forEach((x: string) => types.add(x));
    });
  } else if (node.name === 'ObjectAccess' && node.firstChild && node.lastChild?.name === 'Method') {
    const varName = state.sliceDoc(node.lastChild.from, node.lastChild.to) || '';
    resolveTypes(state, node.firstChild, config, matchExact)?.forEach(baseType => {
      // @ts-ignore
      resolveIdentifier(node.lastChild?.name, varName, config.types?.[baseType])?.returnType?.forEach((x: string) => types.add(x));
    });
  } else if (node.name === 'Application' && node.firstChild) {
    resolveTypes(state, node.firstChild, config, matchExact).forEach(x => types.add(x));
  } else if (node.name === 'TernaryExpression' && node.firstChild && node.firstChild.nextSibling && node.firstChild.nextSibling.nextSibling) {
    resolveTypes(state, node.firstChild.nextSibling, config, matchExact).forEach(x => types.add(x));
    resolveTypes(state, node.firstChild.nextSibling.nextSibling, config, matchExact).forEach(x => types.add(x));
  }

  if (types.size === 0) {
    types.add('any');
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
];
