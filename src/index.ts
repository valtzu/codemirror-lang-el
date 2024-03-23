import { parser } from "./syntax.grammar";
import { LRLanguage, LanguageSupport, indentNodeProp, foldNodeProp, foldInside, delimitedIndent, syntaxTree } from "@codemirror/language";
import { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { styleTags, tags as t } from "@lezer/highlight";
import {SyntaxNode, SyntaxNodeRef} from "@lezer/common";
import { EditorState } from "@codemirror/state";
import { linter, Diagnostic } from "@codemirror/lint";
import { hoverTooltip } from "@codemirror/view";
//
// enum PhpValue {
//   Object = "object",
//   Integer = "int",
//   Float = "float",
//   String = "string",
//   Boolean = "bool",
//   Null = "null",
// }
//
// export interface ELType {
//   name: PhpValue;
//   properties?: [];
//   methods?: [];
// }
//
// export interface ELIdentifier {
//   name: string;
//   detail?: string;
//   info?: string;
//   type?: string|string[];
// }
//
// export interface ELFunction {
//   name: string;
//   args: string[]; // maybe these could be ELIdentifier[] ?
//   info?: string;
//   returnType?: string|string[];
// }

export interface ExpressionLanguageConfig {
  identifiers?: readonly { name: string; detail?: string; info?: string }[];
  functions?: readonly { name: string; args: string[]; info?: string }[];
  operatorKeywords?: readonly { name: string; detail?: string, info?: string }[];
}

const identifier = /^[a-zA-Z_]+[a-zA-Z_0-9]*$/;
const isFunction = (identifier: string, config: ExpressionLanguageConfig) => config.functions?.find(fn => fn.name === identifier);
const isVariable = (identifier: string, config: ExpressionLanguageConfig) => config.identifiers?.find(variable => variable.name === identifier);

const expressionLanguageLinter = (config: ExpressionLanguageConfig) => linter(view => {
  let diagnostics: Diagnostic[] = [];
  let previousNode: SyntaxNode|null = null;
  let indent = 0;
  syntaxTree(view.state).cursor().iterate(node => {
    console.log(`${'  '.repeat(indent++)} ${node.name}`);
    if (node.name == "Identifier") {
      if (previousNode?.name == "Identifier" && node.node.parent?.name != 'Array') {
        diagnostics.push({
          from: node.from,
          to: node.to,
          severity: 'error',
          message: `Unexpected identifier after another identifier`,
        });
      }

      const identifier = view.state.sliceDoc(node.from,  node.to);

      if (!isFunction(identifier, config) && !isVariable(identifier, config)) {
        diagnostics.push({
          from: node.from,
          to: node.to,
          severity: 'error',
          message: `Identifier "${identifier}" not found`,
        });
      }
    }
    previousNode = node.node;
  }, ()=>indent--);

  return diagnostics;
});

export const keywordTooltip = (config: ExpressionLanguageConfig) => hoverTooltip((view, pos, side) => {
  let { from, to, text } = view.state.doc.lineAt(pos);
  let start = pos, end = pos;
  while (start > from && /\w/.test(text[start - from - 1])) start--;
  while (end < to && /\w/.test(text[end - from])) end++;
  if (start == pos && side < 0 || end == pos && side > 0) {
    return null;
  }
  const keyword = text.slice(start - from, end - from);
  const info = (isFunction(keyword, config) ?? isVariable(keyword, config))?.info;
  if (!info) {
    return null;
  }

  return {
    pos: start,
    end,
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
  const text = state.sliceDoc(from, to);
  const identifiers = config.identifiers?.filter(({ name }) => explicit || name.startsWith(text)) ?? [];
  const functions = config.functions?.filter(({ name }) => explicit || name.startsWith(text)) ?? [];
  const prevName = tree.prevSibling?.name;
  const apply = (name: string) => !prevName || !['OpeningBracket', 'Operator', 'OperatorKeyword', 'Punctuation'].includes(prevName) ? `${name} ` : name;

  return {
    from,
    to,
    options: [
      ...(identifiers.map(({ name, info, detail }) => ({ label: name, apply: apply(name), info, detail, type: 'variable' })) ?? []),
      ...(functions.map(({ name, args = [], info}) => ({ label: name, detail: `(${args.join(',')})`, apply: `${name}(${args.length == 0 ? ')' : ''}`, info, type: "function" })) ?? []),
    ],
    validFor: identifier,
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
