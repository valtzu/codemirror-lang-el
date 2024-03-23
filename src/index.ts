import { parser } from "./syntax.grammar";
import { LRLanguage, LanguageSupport, indentNodeProp, foldNodeProp, foldInside, delimitedIndent, syntaxTree } from "@codemirror/language";
import { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { styleTags, tags as t } from "@lezer/highlight";
import {SyntaxNode, SyntaxNodeRef} from "@lezer/common";
import { EditorState } from "@codemirror/state";
import { linter, Diagnostic } from "@codemirror/lint";
import { hoverTooltip } from "@codemirror/view";

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
  syntaxTree(view.state).cursor().iterate(node => {
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
  });

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
        OpeningBracket: t.paren,
        ClosingBracket: t.paren,
        '[': t.squareBracket,
        ']': t.squareBracket,
        OperatorKeyword: t.operatorKeyword,
        Operator: t.operator,
        NullSafe: t.operator,
        NullCoalescing: t.operator,
        Punctuation: t.punctuation,
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
  let { state, pos, explicit } = context;
  let tree = syntaxTree(state).resolveInner(pos, -1);
  const isOperator = (node: SyntaxNode) => ['Operator', 'OperatorKeyword', 'Punctuation', 'NullSafe', 'NullCoalescing', 'OpeningBracket'].includes(node.name)
  const isIdentifier = (node: SyntaxNode) => node.name === 'Identifier';

  if (tree.name == 'String') {
    return null;
  }

  if (tree.prevSibling && !isOperator(tree.prevSibling) && (!explicit || !isOperator(tree.node))) {
    return completeOperatorKeyword(state, config, tree, tree.from, pos, explicit);
  }

  if ((!tree.prevSibling || !isIdentifier(tree.prevSibling) || isOperator(tree.node)) && (explicit || isIdentifier(tree.node))) {
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
