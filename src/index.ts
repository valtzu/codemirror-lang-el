import { parser } from "./syntax.grammar";
import { LRLanguage, LanguageSupport, indentNodeProp, foldNodeProp, foldInside, delimitedIndent, syntaxTree } from "@codemirror/language";
import { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { styleTags, tags as t } from "@lezer/highlight";
import { SyntaxNode } from "@lezer/common"
import { EditorState } from "@codemirror/state"

export interface ExpressionLanguageConfig {
  identifiers?: readonly string[];
  functions?: Record<string, readonly string[]>;
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
  const identifiers = config.identifiers?.filter(i => i.startsWith(text)) ?? [];
  const functions = Object.entries(config.functions ?? {}).filter(([fn]) => fn.startsWith(text));

  return {
    from,
    to,
    options: [
      ...(identifiers.map(identifier => ({ label: identifier, type: "property" })) ?? []),
      ...(functions.map(([fn, args]) => ({ label: `${fn}(${args.join(',')})`, apply: `${fn}(${args.length == 0 ? ')' : ''}`, type: "function" })) ?? []),
    ],
    validFor: identifier,
  };
}

function expressionLanguageCompletionFor(config: ExpressionLanguageConfig, context: CompletionContext): CompletionResult | null {
  let {state, pos} = context;
  let tree = syntaxTree(state).resolveInner(pos, -1);
  // let around = tree.resolve(pos);
  // for (let scan = pos, before; around == tree && (before = tree.childBefore(scan));) {
  //   let last = before.lastChild;
  //   if (!last || !last.type.isError || last.from < last.to) break;
  //   around = tree = before;
  //   scan = last.from;
  // }

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
