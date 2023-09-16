import { parser } from "./syntax.grammar";
import { LRLanguage, LanguageSupport, indentNodeProp, foldNodeProp, foldInside, delimitedIndent, syntaxTree } from "@codemirror/language";
import { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { styleTags, tags as t } from "@lezer/highlight";
import { SyntaxNode } from "@lezer/common"
import { EditorState } from "@codemirror/state"

export interface ExpressionLanguageConfig {
  identifiers?: readonly { name: string; detail?: string; info?: string }[];
  functions?: readonly { name: string; args: string[]; info?: string }[];
  operatorKeywords?: readonly string[];
}

const identifier = /^[a-zA-Z_]+[a-zA-Z_0-9]*$/;

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
    options: config.operatorKeywords?.filter(value => value.startsWith(text)).map(keyword => ({ label: keyword, type: "property" })) ?? [],
    validFor: (text: string) => config.operatorKeywords?.some(value => value.startsWith(text)) ?? false,
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

  if (tree.prevSibling && !['Operator', 'OperatorKeyword', 'Punctuation', 'NullSafe', 'NullCoalescing'].includes(tree.prevSibling.name)) {
    return completeOperatorKeyword(state, config, tree, tree.from, pos);
  }

  if (tree.name == "Identifier") {
    return completeIdentifier(state, config, tree, tree.from, pos)
  }

  return null;
}

function expressionLanguageCompletionSourceWith(config: ExpressionLanguageConfig) {
  config.operatorKeywords ??= ['starts with', 'ends with', 'contains', 'matches', 'not in', 'in', 'not', 'or', 'and'];

  return (context: CompletionContext) => expressionLanguageCompletionFor(config, context);
}

export function expressionlanguage(config: ExpressionLanguageConfig = {}, extensions: Array<any> = []) {
  return new LanguageSupport(ELLanguage, [ELLanguage.data.of({ autocomplete: expressionLanguageCompletionSourceWith(config) }), ...extensions]);
}
