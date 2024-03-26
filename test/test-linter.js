import {EditorState} from "@codemirror/state";
import {expressionlanguage, expressionLanguageLinterSource} from "../dist/index.js";
import ist from "ist"

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
    {name: "smh", returnType: ["string"]},
    {name: "smash_my_head", args: ["object"]},
    {name: "getObject", returnType: ["custom44"]},
  ],
};

function get(doc) {
  const elLinter = expressionLanguageLinterSource(config);
  const state = EditorState.create({
    doc,
    extensions: [expressionlanguage(config)],
  });

  return elLinter(state);
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
});
