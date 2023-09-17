import { parser } from "./syntax.grammar";
import { LRLanguage, LanguageSupport, indentNodeProp, foldNodeProp, foldInside, delimitedIndent, syntaxTree } from "@codemirror/language";
import { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { styleTags, tags as t } from "@lezer/highlight";
import { SyntaxNode } from "@lezer/common";
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
  syntaxTree(view.state).cursor().iterate(node => {
    if (node.name == "Identifier") {
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

function completeOperatorKeyword(state: EditorState, config: ExpressionLanguageConfig, tree: SyntaxNode, from: number, to: number): CompletionResult {
  const text = state.sliceDoc(from, to);

  return {
    from,
    to,
    options: config.operatorKeywords?.filter(({ name }) => name.startsWith(text)).map(({ name, info, detail }) => ({ label: name, apply: `${name} `, info, detail, type: "keyword" })) ?? [],
    validFor: (text: string) => config.operatorKeywords?.some(({ name }) => name.startsWith(text)) ?? false,
  };
}

function completeIdentifier(state: EditorState, config: ExpressionLanguageConfig, tree: SyntaxNode, from: number, to: number): CompletionResult {
  const text = state.sliceDoc(from, to);
  const identifiers = config.identifiers?.filter(({ name }) => name.startsWith(text)) ?? [];
  const functions = config.functions?.filter(({ name }) => name.startsWith(text)) ?? [];

  return {
    from,
    to,
    options: [
      ...(identifiers.map(({ name, info, detail }) => ({ label: name, info, detail, type: 'variable' })) ?? []),
      ...(functions.map(({ name, args = [], info}) => ({ label: name, detail: `(${args.join(',')})`, apply: `${name}(${args.length == 0 ? ')' : ''}`, info, type: "function" })) ?? []),
    ],
    validFor: identifier,
  };
}

function expressionLanguageCompletionFor(config: ExpressionLanguageConfig, context: CompletionContext): CompletionResult | null {
  let {state, pos} = context;
  let tree = syntaxTree(state).resolveInner(pos, -1);

  if (tree.name == 'String') {
    return null;
  }

  if (tree.prevSibling && !['Operator', 'OperatorKeyword', 'Punctuation', 'NullSafe', 'NullCoalescing', 'OpeningBracket'].includes(tree.prevSibling.name)) {
    return completeOperatorKeyword(state, config, tree, tree.from, pos);
  }

  if (tree.name == "Identifier") {
    return completeIdentifier(state, config, tree, tree.from, pos)
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
