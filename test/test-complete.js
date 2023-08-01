import {EditorState} from "@codemirror/state";
import {CompletionContext} from "@codemirror/autocomplete";
import {expressionlanguage} from "../dist/index.js";
import ist from "ist";

const operatorKeywords = ['starts with', 'ends with', 'contains', 'matches', 'in', 'not', 'or', 'and'];

function get(doc, conf = {}) {
  let cur = doc.indexOf("‸");
  doc = doc.slice(0, cur) + doc.slice(cur + "‸".length);
  let state = EditorState.create({
    doc,
    selection: { anchor: cur },
    extensions: [expressionlanguage({
      identifiers: ["foobar", "foobaz"],
      functions: {smh: [], smash_my_head: ["object"]},
    })],
  });
  return state.languageDataAt("autocomplete", cur)[0](new CompletionContext(state, cur, !!conf.explicit));
}

describe("Expression language completion", () => {
  // it("completes when explicitly requested", () => {
  //   let c = get("‸", {explicit: true}).options;
  //   ist(c.length, 0, '>');
  //   ist(!c.some(o => operatorKeywords.includes(o.label)));
  // });
  //
  // it("completes when explicitly requested, even when non-empty", () => {
  //   let c = get("foo > 10 and ‸", {explicit: true}).options;
  //   ist(c.length, 0, '>');
  //   ist(c.some(o => operatorKeywords.includes(o.label)));
  // });

  it("completes variables", () => {
    let c = get("foo‸").options;
    ist(c.length, 2);
    ist("foobar", c[0].label);
    ist("foobaz", c[1].label);
    ist(!c.some(o => /\W/.test(o.label)));
  });

  it("completes variables only when found", () => {
    let c = get("zoo‸").options;
    ist(c.length, 0);
  });

  it("completes parameterless functions", () => {
    let c = get("sm‸").options;
    ist(c.length, 0, '>');
    ist("smh()", c[0].label);
    ist("smh()", c[0].apply);
  });

  it("completes functions with params", () => {
    let c = get("smash‸").options;
    ist(c.length, 1);
    ist("smash_my_head(object)", c[0].label);
    ist("smash_my_head(", c[0].apply);
  });

  it("completes operator keywords after identifiers", () => {
    let c = get("smh s‸").options;
    ist(c.length, 1);
    ist("starts with", c[0].label);
  });

  it("completes operator keywords after parenthesis", () => {
    let c = get("smh() en‸").options;
    ist(c.length, 1);
    ist("ends with", c[0].label);
  });
});
