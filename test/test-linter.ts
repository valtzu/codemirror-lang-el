// @ts-ignore
import { expressionlanguage, ELLanguage, _linter } from "@valtzu/codemirror-lang-el";
import { EditorState } from "@codemirror/state";
import ist from "ist"
import { syntaxTree } from "@codemirror/language";

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
    {name: "obj", type: ["custom44"]}
  ],
  functions: [
    {name: "smh", args: [], returnType: ["string"]},
    {name: "any_fn", args: [{name: "anything", type: ["any"]}], returnType: ["any"]},
    {name: "smash_my_head", args: [{name: "object", type: ["object"]}]},
    {name: "getObject", returnType: ["custom44"]},
  ],
};

function get(doc: string) {
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

  return _linter.expressionLanguageLinterSource(state);
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
    const diagnostics = get("obj +* obj");

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

  it("complains about wrong argument type using constant", () => {
    const diagnostics = get("smash_my_head(5)");

    ist(diagnostics.length, 1);
    ist(diagnostics[0].from, 14);
    ist(diagnostics[0].to, 15);
    ist(diagnostics[0].message, "<code>object</code> expected, got <code>number</code>");
  });

  it("complains about wrong argument type using resolved type", () => {
    const diagnostics = get("smash_my_head(smh())");

    ist(diagnostics.length, 1);
    ist(diagnostics[0].from, 14);
    ist(diagnostics[0].to, 19);
    ist(diagnostics[0].message, "<code>object</code> expected, got <code>string</code>");
  });

  it('does not complain about putting "wrong" argument type to any', () => {
    const diagnostics = get("any_fn(smh())");

    ist(diagnostics.length, 0);
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
