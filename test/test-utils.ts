// @ts-expect-error TS2307
import { ELLanguage, expressionlanguage, _utils } from "@valtzu/codemirror-lang-el";
import { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import * as assert from "node:assert";

const config = {
  types: {
    "custom44": {
      identifiers: [
        {name: "property11", type: ["any"]},
        {name: "property22", type: ["any"]},
      ],
      functions: [
        {name: "firstMethod", args: [], returnType: ["custom44"]},
      ]
    }
  },
  identifiers: [
    {name: "foobar"},
    {name: "foobaz"},
    {name: "obj", type: ["custom44"]},
    // Typed array examples
    {name: "arr",  type: ["string[]"]},
    {name: "arr2", type: ["string[][]"]}
  ],
  functions: [
    {name: "smh", args: [], returnType: ["string"]},
    {name: "smash_my_head", args: [{name: "object"}]},
    {name: "getObject", returnType: ["custom44"]},
  ],
};

function get(doc: string) {
  return EditorState.create({
    doc,
    selection: {anchor: 0},
    extensions: [
      ELLanguage.data.of({
        expressionLanguageConfig: config,
      }),
      expressionlanguage(config)
    ],
  });
}

describe("Type resolving", () => {
  [
    ['obj', 'custom44'],
    ['true', 'bool'],
    ['true || true', 'bool'],
    ['obj ?? true', 'custom44|bool'],
    ['(obj ?? true)', 'custom44|bool'],
    ['true or false', 'bool'],
    ['1 + 2', 'number'],
    ['not 1', 'bool'],
    ['!1', 'bool'],
    ['+false', 'number'],
    ['-true', 'number'],
    // Typed array indexing should yield element type
    ['arr[0]', 'string'],
    // Nested array indexing: string[][] -> string[] then string
    ['arr2[0]', 'string[]'],
    ['arr2[0][0]', 'string'],
  ].forEach(([doc, type]) =>
    it(`${doc} -> ${type}`, () => {
      const state = get(doc);
      const types = _utils.resolveTypes(state, syntaxTree(state).topNode.firstChild, config, true);
      assert.equal(type, [...types].join('|'));
    }),
  );
});
