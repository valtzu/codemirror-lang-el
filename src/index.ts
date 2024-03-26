import { parser } from "./syntax.grammar";
import { LRLanguage, LanguageSupport, indentNodeProp, foldNodeProp, foldInside, delimitedIndent, syntaxTree } from "@codemirror/language";
import { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { styleTags, tags as t } from "@lezer/highlight";
import { SyntaxNode } from "@lezer/common";
import { EditorState } from "@codemirror/state";
import { linter, Diagnostic } from "@codemirror/lint";
import { hoverTooltip } from "@codemirror/view";

export interface ELIdentifier {
  name: string;
  detail?: string;
  info?: string;
  type?: string[];
}

export interface ELFunction {
  name: string;
  args: string[]; // maybe these could be ELIdentifier[] ?
  info?: string;
  returnType?: string[];
}

export interface ExpressionLanguageConfig {
  types?: {[key:string]: {identifiers?: ELIdentifier[], functions?: ELFunction[], type?: string, info?: string}};
  identifiers?: ELIdentifier[];
  functions?: ELFunction[];
  operatorKeywords?: readonly { name: string; detail?: string, info?: string }[];
}

const isFunction = (identifier: string, config: ExpressionLanguageConfig) => config.functions?.find(fn => fn.name === identifier);
const isVariable = (identifier: string, config: ExpressionLanguageConfig) => config.identifiers?.find(variable => variable.name === identifier);

const autocompleteFunction = (x: ELFunction) => ({ label: `${x.name}(${x.args?.join(',') || ''})`, apply: `${x.name}(${!x.args?.length ? ')' : ''}`, detail: x.returnType?.join('|'), info: x.info, type: "function" });
const autocompleteIdentifier = (x: ELIdentifier) => ({ label: x.name, apply: x.name, info: x.info, detail: x.detail || x.type?.join('|'), type: 'variable' });

export const expressionLanguageLinterSource = (config: ExpressionLanguageConfig) => (state: EditorState) => {
  let diagnostics: Diagnostic[] = [];

  syntaxTree(state).cursor().iterate(node => {
    const { from, to, name } = node;
    if (node.node.parent?.name == 'ObjectAccess' && node.node.parent?.firstChild && node.name == "Identifier" && node.node.prevSibling) {
      const leftArgument = node.node.parent.firstChild.node;
      const types = Array.from(resolveTypes(state, leftArgument, config, true));
      const identifier = state.sliceDoc(node.from,  node.to);
      const isMethodName = node.node.parent?.parent?.name === 'FunctionCall' && !node.node.parent.prevSibling;

      if (isMethodName) {
        if (!types.find(type => config.types?.[type]?.functions?.find(x => x.name === identifier))) {
          diagnostics.push({ from, to, severity: 'error', message: `Method '${identifier}' not found in ${types.join('|')}` });
        }
      }

      if (!isMethodName && types.length > 0) {
        if (!types.find(type => config.types?.[type]?.identifiers?.find(x => x.name === identifier))) {
          diagnostics.push({ from, to, severity: 'warning', message: `Property '${identifier}' not found in ${types.join('|')}` });
        }
      }

      return;
    }

    if (name == "Identifier") {
      const identifier = state.sliceDoc(node.from, node.to);
      const isFunctionName = node.node.parent?.name == 'FunctionCall' && !node.node.prevSibling;

      if (node.node.parent?.type.isError) {
        diagnostics.push({ from, to, severity: 'error', message: `Unexpected identifier '${identifier}'` });
      }

      if (!isFunctionName && !isVariable(identifier, config)) {
        diagnostics.push({ from, to, severity: 'error', message: `Variable "${identifier}" not found` });
      }
      if (isFunctionName && !isFunction(identifier, config)) {
        diagnostics.push({ from, to, severity: 'error', message: `Function "${identifier}" not found` });
      }
    }
  });

  return diagnostics;
};

const expressionLanguageLinter = (config: ExpressionLanguageConfig) => linter(view => expressionLanguageLinterSource(config)(view.state));

export const keywordTooltip = (config: ExpressionLanguageConfig) => hoverTooltip((view, pos, side) => {
  const tree = syntaxTree(view.state).resolveInner(pos, side);

  if (tree.name !== 'Identifier') {
    return null;
  }

  const skipEmpty = (x: any) => x;
  let info: string;
  if (tree.parent?.firstChild && tree.parent?.name === 'ObjectAccess' && tree.prevSibling) {
    const node = tree.parent.firstChild;
    const types = resolveTypes(view.state, node, config, true);
    const name = view.state.sliceDoc(tree.from, tree.to);
    info = [
      ...Array.from(types).map(type => config.types?.[type]?.identifiers?.find(x => x.name === name)?.info).filter(skipEmpty),
      ...Array.from(types).map(type => config.types?.[type]?.functions?.find(x => x.name === name)?.info).filter(skipEmpty),
    ].join('\n');
  } else {
    const name = view.state.sliceDoc(tree.from, tree.to);
    info = [
      ...[config.identifiers?.find(x => x.name === name)?.info].filter(skipEmpty),
      ...[config.functions?.find(x => x.name === name)?.info].filter(skipEmpty),
    ].join('\n');
  }

  if (!info) {
    return null;
  }

  return {
    pos: tree.from,
    end: tree.to,
    above: true,
    create(view) {
      let dom = document.createElement("div")
      dom.textContent = info;
      dom.className = 'cm-diagnostic';
      return { dom };
    },
  };
});

export const ELLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        Application: delimitedIndent({closing: ")", align: false})
      }),
      foldNodeProp.add({
        Application: foldInside
      }),
      styleTags({
        Identifier: t.variableName,
        Boolean: t.bool,
        String: t.string,
        Number: t.number,
        '(': t.paren,
        ')': t.paren,
        '[': t.squareBracket,
        ']': t.squareBracket,
        OperatorKeyword: t.operatorKeyword,
        Operator: t.operator,
        MemberOf: t.operator,
        NullSafeMemberOf: t.operator,
      })
    ]
  }),
  languageData: {
  }
})

function completeOperatorKeyword(state: EditorState, config: ExpressionLanguageConfig, tree: SyntaxNode, from: number, to: number, explicit: boolean): CompletionResult {
  const text = state.sliceDoc(from, to);

  return {
    from,
    to,
    options: config.operatorKeywords?.filter(({ name }) => explicit || name.startsWith(text)).map(({ name, info, detail }) => ({ label: name, apply: `${name} `, info, detail, type: "keyword" })) ?? [],
    validFor: (text: string) => config.operatorKeywords?.some(({ name }) => explicit || name.startsWith(text)) ?? false,
  };
}

function completeIdentifier(state: EditorState, config: ExpressionLanguageConfig, tree: SyntaxNode, from: number, to: number, explicit: boolean): CompletionResult {
  const text = state.sliceDoc(from, to).toLowerCase();
  const identifiers = config.identifiers?.filter(({ name }) => explicit || name.toLowerCase().startsWith(text)) ?? [];
  const functions = config.functions?.filter(({ name }) => explicit || name.toLowerCase().startsWith(text)) ?? [];

  return {
    from,
    to,
    options: [...(identifiers.map(autocompleteIdentifier)), ...(functions.map(autocompleteFunction))],
    // validFor: identifier,
    filter: false,
  };
}

function resolveTypes(state: EditorState, node: SyntaxNode, config: ExpressionLanguageConfig, matchExact: boolean): Set<string>  {
  let types: Set<string> = new Set<string>();

  if (node.name === 'FunctionCall' && node.firstChild && node.lastChild) {
    resolveTypes(state, node.firstChild, config, matchExact).forEach(x => types.add(x));
  } else if (node.name === 'Identifier') {
    const varName = state.sliceDoc(node.from, node.to) || '';
    config.functions?.find(x => x.name == varName)?.returnType?.forEach(x => types.add(x));
    config.identifiers?.find(x => x.name == varName)?.type?.forEach(x => types.add(x));
  } else if (node.name === 'ObjectAccess' && node.firstChild && node.lastChild?.name === 'Identifier') {
    const baseTypes = resolveTypes(state, node.firstChild, config, matchExact);
    const varName = state.sliceDoc(node.lastChild.from, node.lastChild.to) || '';

    for (const baseType of baseTypes) {
      const type = config.types?.[baseType];
      type?.functions
        ?.filter(x => matchExact ? x.name === varName : x.name.startsWith(varName))
        ?.forEach(def => (def.returnType || ['any']).forEach(x => types.add(x)));
      type?.identifiers
        ?.filter(x => matchExact ? x.name === varName : x.name.startsWith(varName))
        ?.forEach(def => (def.type || ['any']).forEach(x => types.add(x)));
    }
  }

  if (types.size === 0) {
    types.add('any');
  }

  return types;
}

function completeMember(state: EditorState, config: ExpressionLanguageConfig, tree: SyntaxNode, from: number, to: number, explicit: boolean): CompletionResult | null {
  if (tree.parent?.name != 'ObjectAccess' || !tree.parent.firstChild) {
    return null;
  }

  const types = resolveTypes(state, tree.parent.firstChild.node, config, false);
  if (!types?.size) {
    return null;
  }

  const varName = state.sliceDoc(from, to);
  let options = [];
  for (const type of types) {
    const typeDeclaration = config.types?.[type];
    options.push(
      ...(typeDeclaration?.identifiers?.filter(x => x.name.startsWith(varName)).map(autocompleteIdentifier) || []),
      ...(typeDeclaration?.functions?.filter(x => x.name.startsWith(varName)).map(autocompleteFunction) || []),
    );
  }

  return {
    from,
    to,
    options,
    filter: false,
  };
}

function expressionLanguageCompletionFor(config: ExpressionLanguageConfig, context: CompletionContext): CompletionResult | null {
  const { state, pos, explicit } = context;
  const tree = syntaxTree(state).resolveInner(pos, -1);
  const isOperator = (node: SyntaxNode|undefined) => node && ['Operator', 'OperatorKeyword'].includes(node.name);
  const isIdentifier = (node: SyntaxNode|undefined) => node?.name === 'Identifier';
  const prevNode = tree.parent?.node.type.isError ? tree.parent.prevSibling : tree.prevSibling;

  if (tree.name == 'String') {
    return null;
  }

  if (tree.parent?.name == 'ObjectAccess' && ['ObjectAccess', 'ArrayAccess', 'Identifier', 'FunctionCall'].includes(tree.parent.firstChild?.name || '')) {
    return completeMember(state, config, tree, isIdentifier(tree.node) ? tree.from : pos, pos, explicit);
  }

  // No idea what's going on here, just added conditions until all the tests passed :)
  if (prevNode && !isOperator(prevNode.node) && (tree.parent?.node.type.isError || tree.node.parent?.name === 'BinaryExpression') || (tree.name === 'Expression' && !tree.lastChild?.type?.isError && !isOperator(tree.lastChild?.node))) {
    return completeOperatorKeyword(state, config, tree, tree.name !== 'Expression' ? tree.from : pos, pos, explicit);
  }

  if (tree.name === 'Expression' || isIdentifier(tree.node) || (tree.name === 'BinaryExpression' && isOperator(tree.lastChild?.prevSibling?.node) && explicit)) {
    return completeIdentifier(state, config, tree, isIdentifier(tree.node) ? tree.from : pos, pos, explicit);
  }

  return null;
}

function expressionLanguageCompletionSourceWith(config: ExpressionLanguageConfig) {
  config.operatorKeywords ??= [
    { name: 'starts with' },
    { name: 'ends with' },
    { name: 'contains' },
    { name: 'matches' },
    { name: 'not in' },
    { name: 'in' },
    { name: 'not' },
    { name: 'or' },
    { name: 'and' },
  ];

  return (context: CompletionContext) => expressionLanguageCompletionFor(config, context);
}

export function expressionlanguage(config: ExpressionLanguageConfig = {}, extensions: Array<any> = []) {
  return new LanguageSupport(ELLanguage, [
    ELLanguage.data.of({ autocomplete: expressionLanguageCompletionSourceWith(config) }),
    expressionLanguageLinter(config),
    keywordTooltip(config),
    ...extensions,
  ]);
}
