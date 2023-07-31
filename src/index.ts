import {parser} from "./syntax.grammar"
import {LRLanguage, LanguageSupport, indentNodeProp, foldNodeProp, foldInside, delimitedIndent} from "@codemirror/language"
import {styleTags, tags as t} from "@lezer/highlight"

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

export function expressionlanguage() {
  return new LanguageSupport(ELLanguage)
}
