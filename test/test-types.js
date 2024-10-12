import {resolveTypes} from "../dist/utils.js";
import {ELLanguage, expressionlanguage} from "../dist/index.js";
import {EditorState} from "@codemirror/state";
import {syntaxTree} from "@codemirror/language";
import * as assert from "node:assert";

const config = {
  types: {
    "custom44": {
      identifiers: [
        {name: "property11", type: ["mixed"]},
        {name: "property22", type: ["mixed"]},
      ],
      functions: [
        {name: "firstMethod", args: [], returnType: ["custom44"]},
      ]
    }
  },
  identifiers: [
    {name: "foobar"},
    {name: "foobaz"},
    {name: "obj", type: ["custom44"]}
  ],
  functions: [
    {name: "smh", args: [], returnType: ["string"]},
    {name: "smash_my_head", args: [{name: "object"}]},
    {name: "getObject", returnType: ["custom44"]},
  ],
};

function get(doc) {
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
  ].forEach(([doc, type]) =>
    it(`${doc} -> ${type}`, () => {
      const state = get(doc);
      const types = resolveTypes(state, syntaxTree(state).topNode.firstChild, config, true);
      assert.equal(type, [...types].join('|'));
    }),
  );
});
