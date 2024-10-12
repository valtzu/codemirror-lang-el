import {EditorState} from "@codemirror/state";
import ist from "ist"
import {syntaxTree} from "@codemirror/language";
import {expressionlanguage, ELLanguage} from "../dist/index.js";
import {expressionLanguageLinterSource} from "../dist/linter.js";

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
  const state = EditorState.create({
    doc,
    selection: { anchor: 0 },
    extensions: [
      ELLanguage.data.of({
        expressionLanguageConfig: config,
      }),
      expressionlanguage(config)
    ],
  });

  if (process.env.DEBUG) {
    syntaxTree(state).cursor().iterate((node) => process.stdout.write(node.name + '('), () => process.stdout.write(')'));
    process.stdout.write('\n');
  }

  return expressionLanguageLinterSource(state);
}

describe("Expression language linting", () => {
  it("detects missing variables", () => {
    const diagnostics = get("notfound / 5");

    ist(diagnostics.length, 1);
    ist(diagnostics[0].message, 'Variable "notfound" not found');
    ist(diagnostics[0].from, 0);
    ist(diagnostics[0].to, 8);
  });

  it("detects missing functions", () => {
    const diagnostics = get("obj + notfound()");

    ist(diagnostics.length, 1);
    ist(diagnostics[0].message, 'Function "notfound" not found');
    ist(diagnostics[0].from, 6);
    ist(diagnostics[0].to, 14);
  });

  it("complains about variables after variables", () => {
    const diagnostics = get("obj obj");

    ist(diagnostics.length, 1);
    ist(diagnostics[0].message, "Unexpected identifier 'obj'");
    ist(diagnostics[0].from, 4);
    ist(diagnostics[0].to, 7);
  });

  it("complains about multiple binary operators in row", () => {
    const diagnostics = get("obj ~~ obj");

    ist(diagnostics.length, 1);
    ist(diagnostics[0].from, 5);
    ist(diagnostics[0].to, 10);
    ist(diagnostics[0].message, "Expression expected");
  });

  it("complains about too many arguments", () => {
    const diagnostics = get("smash_my_head({}, 2)");

    ist(diagnostics.length, 1);
    ist(diagnostics[0].from, 18);
    ist(diagnostics[0].to, 19);
    ist(diagnostics[0].message, "Unexpected argument");
  });

  it("comments ignored in arguments", () => {
    const diagnostics = get("smh(/* comment */)");

    ist(diagnostics.length, 0);
  });

  it("accepts comments", () => {
    const diagnostics = get("1 /* comment */ + 2");

    ist(diagnostics.length, 0);
  });
});
