// @ts-expect-error TS2307
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
    {name: "any_fn", args: [{name: "anything", type: ["any"]}, {name: "optional", optional: true}], returnType: ["any"]},
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
  it("detects missing variables", async () => {
    const diagnostics = await get("notfound / 5");
    ist(diagnostics.length, 1);
    ist(diagnostics[0].message, 'Variable <code>notfound</code> not found');
    ist(diagnostics[0].from, 0);
    ist(diagnostics[0].to, 8);
  });

  it("detects missing functions", async () => {
    const diagnostics = await get("obj + notfound()");
    ist(diagnostics.length, 1);
    ist(diagnostics[0].message, 'Function <code>notfound</code> not found');
    ist(diagnostics[0].from, 6);
    ist(diagnostics[0].to, 14);
  });

  it("complains about variables after variables", async () => {
    const diagnostics = await get("obj obj");
    ist(diagnostics.length, 1);
    ist(diagnostics[0].message, "Unexpected identifier <code>obj</code>");
    ist(diagnostics[0].from, 4);
    ist(diagnostics[0].to, 7);
  });

  it("complains about multiple binary operators in row", async () => {
    const diagnostics = await get("obj +* obj");
    ist(diagnostics.length, 1);
    ist(diagnostics[0].from, 5);
    ist(diagnostics[0].to, 10);
    ist(diagnostics[0].message, "Expression expected");
  });

  it("complains about too many arguments", async () => {
    const diagnostics = await get("smash_my_head({}, 2)");
    ist(diagnostics.length, 1);
    ist(diagnostics[0].from, 18);
    ist(diagnostics[0].to, 19);
    ist(diagnostics[0].message, "Unexpected argument – <code>smash_my_head</code> takes exactly 1 argument");
  });

  it("complains about too many arguments when there are optional arguments", async () => {
    const diagnostics = await get("any_fn(1, 2, 3)");
    ist(diagnostics.length, 1);
    ist(diagnostics[0].from, 13);
    ist(diagnostics[0].to, 14);
    ist(diagnostics[0].message, "Unexpected argument – <code>any_fn</code> takes 1–2 arguments");
  });

  it("complains about too few arguments", async () => {
    const diagnostics = await get("smash_my_head()");
    ist(diagnostics.length, 1);
    ist(diagnostics[0].from, 13);
    ist(diagnostics[0].to, 15);
    ist(diagnostics[0].message, "Too few arguments – <code>smash_my_head</code> takes exactly 1 argument");
  });

  it("complains about too few arguments when there are optional arguments", async () => {
    const diagnostics = await get("any_fn()");
    ist(diagnostics.length, 1);
    ist(diagnostics[0].from, 6);
    ist(diagnostics[0].to, 8);
    ist(diagnostics[0].message, "Too few arguments – <code>any_fn</code> takes 1–2 arguments");
  });

  it("complains about wrong argument type using constant", async () => {
    const diagnostics = await get("smash_my_head(5)");
    ist(diagnostics.length, 1);
    ist(diagnostics[0].from, 14);
    ist(diagnostics[0].to, 15);
    ist(diagnostics[0].message, "<code>object</code> expected, got <code>number</code>");
  });

  it("complains about wrong argument type using resolved type", async () => {
    const diagnostics = await get("smash_my_head(smh())");
    ist(diagnostics.length, 1);
    ist(diagnostics[0].from, 14);
    ist(diagnostics[0].to, 19);
    ist(diagnostics[0].message, "<code>object</code> expected, got <code>string</code>");
  });

  it('does not complain about putting "wrong" argument type to any', async () => {
    const diagnostics = await get("any_fn(smh())");
    ist(diagnostics.length, 0);
  });

  it("comments ignored in arguments", async () => {
    const diagnostics = await get("smh(/* comment */)");
    ist(diagnostics.length, 0);
  });

  it("accepts comments", async () => {
    const diagnostics = await get("1 /* comment */ + 2");
    ist(diagnostics.length, 0);
  });

  it("complains about non-array after 'in' operator", async () => {
    const diagnostics = await get("'foo' in 'foobar'");
    ist(diagnostics.length, 1);
    ist(diagnostics[0].from, 9);
    ist(diagnostics[0].to, 17);
    ist(diagnostics[0].message, "<code>array</code> expected, got <code>string</code>");
  });

  it("complains about non-string arguments for 'contains' operator", async () => {
    // Left side not string
    let diagnostics = await get("1 contains 'foo'");
    ist(diagnostics.length, 1);
    ist(diagnostics[0].message, "<code>string</code> expected, got <code>number</code>");
    // Right side not string
    diagnostics = await get("'foo' contains 1");
    ist(diagnostics.length, 1);
    ist(diagnostics[0].message, "<code>string</code> expected, got <code>number</code>");
    // Both sides not string
    diagnostics = await get("1 contains 2");
    ist(diagnostics.length, 2);
    ist(diagnostics[0].message, "<code>string</code> expected, got <code>number</code>");
    ist(diagnostics[1].message, "<code>string</code> expected, got <code>number</code>");
    // Both sides string: no error
    diagnostics = await get("'foo' contains 'bar'");
    ist(diagnostics.length, 0);
  });
});
