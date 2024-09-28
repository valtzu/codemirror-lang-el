import { parser } from "./syntax.grammar";
import { LRLanguage, LanguageSupport, indentNodeProp, foldNodeProp, delimitedIndent } from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import { ELFunction, ELIdentifier, ExpressionLanguageConfig } from "./types";
import { expressionLanguageLinter } from "./linter";
import { expressionLanguageCompletion } from "./complete";
import { cursorTooltipField, keywordTooltip } from "./tooltip";
import { Extension } from "@codemirror/state";
import { baseTheme } from "./theme";

export { ELFunction, ELIdentifier, ExpressionLanguageConfig };

export const ELLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        Application: delimitedIndent({ closing: ")", align: false }),
        Arguments: delimitedIndent({ closing: ")", align: false }),
        Object: delimitedIndent({ closing: "}", align: false }),
      }),
      foldNodeProp.add({
        Application: ({ from, to }) => ({ from: from + 1, to: to - 1 }),
        Arguments: ({ from, to }) => ({ from: from + 1, to: to - 1 }),
        Object: ({ from, to }) => ({ from: from + 1, to: to - 1 }),
      }),
      styleTags({
        Property: t.propertyName,
        Variable: t.variableName,
        Function: t.function(t.variableName),
        Method: t.function(t.propertyName),
        Boolean: t.bool,
        String: t.string,
        Number: t.number,
        '(': t.paren,
        ')': t.paren,
        '[': t.squareBracket,
        ']': t.squareBracket,
        ',': t.punctuation,
        MemberOf: t.punctuation,
        NullSafeMemberOf: t.punctuation,
        OperatorKeyword: t.operatorKeyword,
        UnaryOperator: t.operator,
        Operator: t.operator,
        BlockComment: t.comment,
      })
    ]
  }),
  languageData: {},
});

export function expressionlanguage(config: ExpressionLanguageConfig = {}, extensions: Extension[] = []) {
  return new LanguageSupport(ELLanguage, [
    ELLanguage.data.of({
      autocomplete: expressionLanguageCompletion,
      expressionLanguageConfig: config,
    }),
    expressionLanguageLinter,
    keywordTooltip,
    cursorTooltipField,
    baseTheme,
    ...extensions,
  ]);
}
