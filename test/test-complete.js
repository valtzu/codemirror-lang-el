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
    })],
  });
  return state.languageDataAt("autocomplete", cur)[0](new CompletionContext(state, cur, !!conf.explicit));
}

describe("Expression language completion", () => {
  it("completes when explicitly requested", () => {
    let c = get("‸", {explicit: true}).options;
    ist(c.length, 0, '>');
    ist(!c.some(o => operatorKeywords.includes(o.label)));
  });

  it("completes when explicitly requested, even when non-empty", () => {
    let c = get("foo > 10 and ‸", {explicit: true}).options;
    ist(c.length, 0, '>');
    ist(!c.some(o => operatorKeywords.includes(o.label)));
  });

  it("completes operators when explicitly requested", () => {
    let c = get("foo > 10 ‸", {explicit: true}).options;
    ist(c.length, 0, '>');
    ist(c.some(o => operatorKeywords.includes(o.label)));
  });

  it("completes variables when explicitly requested, even mid-word", () => {
    let c = get("foo > 10 and foo‸", {explicit: true}).options;
    ist(c.length, 0, '>');
    ist(!c.some(o => operatorKeywords.includes(o.label)));
  });

  it("completes variables", () => {
    let c = get("foo‸").options;
    ist(c.length, 0, '>');
    ist(c.map(x => x.label).includes('foobar'));
    ist(c.map(x => x.label).includes('foobaz'));
  });

  it("completes parameterless functions", () => {
    const c = get("sm‸").options.find(x => x.label === 'smh()');
    ist(!!c);
    ist("string", c.detail);
    ist("smh()", c.label);
  });

  it("completes functions with params", () => {
    const c = get("smash‸").options.find(x => x.label === 'smash_my_head(object)');
    ist(!!c);
    ist(undefined, c.detail);
    ist("smash_my_head(object)", c.label);
  });

  it("completes operator keywords after identifiers", () => {
    const c = get("smh s‸").options;
    ist(c.some(x => x.label === 'starts with'));
  });

  it("completes operator keywords after parenthesis", () => {
    const c = get("smh() en‸").options;
    ist(c.some(x => x.label === 'ends with'));
  });

  it("completes operator keywords after string", () => {
    const c = get("'foobar' s‸").options;
    ist(c.some(x => x.label === 'starts with'));
  });

  it("does not complete anything when there's open string", () => {
    ist(null, get("'foobar s‸"));
  });

  it("does not complete operators when identifier is expected", () => {
    const c = get("smash_my_head(a‸)").options;
    ist(!c.some(x => x.label === 'and'));
  });

  it("completes object properties and methods", () => {
    const c = get("obj.‸").options;
    ist(c.length, 3);
    ist("property11", c[0].label);
    ist("property22", c[1].label);
    ist("firstMethod()", c[2].label);
  });

  it("completes object members with partial key", () => {
    const c = get("obj.property1‸").options;
    ist(c.some(x => x.label === 'property11'));
  });

  it("completes object members after function call", () => {
    const c = get("getObject().‸").options;
    ist(c.some(x => x.label === 'property11'));
    ist(c.some(x => x.label === 'firstMethod()'));
  });

  it("completes only operators after method call", () => {
    const c = get("obj.firstMethod()‸")?.options || [];
    ist(!c.find(x => x.label === 'firstMethod()'));
    ist(!c.find(x => x.label === 'obj'));
    ist(c.find(x => x.label === 'starts with'));
  });

  it("completes object members after method call", () => {
    const c = get("obj.firstMethod().‸").options;
    ist(c.length, 3);
    ist("property11", c[0].label);
    ist("property22", c[1].label);
    ist("firstMethod()", c[2].label);
  });

  it("completes object members after complex expression", () => {
    let c = get("smash_my_head(obj.firstMethod()) + obj.‸").options;
    ist(c.length, 3);
    ist("property11", c[0].label);
    ist("property22", c[1].label);
    ist("firstMethod()", c[2].label);
  });

  it("does not complete right after numbers", () => {
    ist(null, get("123‸"));
  });

  it("does not complete right after operator keywords", () => {
    ist(null, get("1 and‸"));
  });

  it("does complete after ternary expression", () => {
    let c = get("(foobar ? obj : false).‸")?.options;
    ist(c?.length, 3);
    ist("property11", c[0].label);
    ist("property22", c[1].label);
    ist("firstMethod()", c[2].label);
  });

  it("does complete after ternary expression shortcut", () => {
    let c = get("(foobar ? obj).‸")?.options;
    ist(c?.length, 3);
    ist("property11", c[0].label);
    ist("property22", c[1].label);
    ist("firstMethod()", c[2].label);
  });

  it("does complete after ternary expression shortcut 2", () => {
    let c = get("(foobar ?: obj).‸")?.options;
    ist(c?.length, 3);
    ist("property11", c[0].label);
    ist("property22", c[1].label);
    ist("firstMethod()", c[2].label);
  });

  it("no completion inside comment", () => {
    ist(null, get("1 /* o‸ */"));
  });
});
