// @ts-ignore
import { expressionlanguage } from "@valtzu/codemirror-lang-el";
import { EditorState } from "@codemirror/state";
import { Completion, CompletionContext, CompletionSource } from "@codemirror/autocomplete";
import ist from "ist";

const operatorKeywords = ['starts with', 'ends with', 'contains', 'matches', 'in', 'not', 'or', 'xor', 'and'];

async function get(doc: string, { explicit } = { explicit: false }) {
  let cur = doc.indexOf("‸");
  doc = doc.slice(0, cur) + doc.slice(cur + "‸".length);
  let state = EditorState.create({
    doc,
    selection: { anchor: cur },
    extensions: [expressionlanguage({
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
        {name: "smh", returnType: ["string"]},
        {name: "smash_my_head", args: [{name: "object", type: ["custom44"]}]},
        {name: "getObject", returnType: ["custom44"]},
      ],
    })],
  });
  return (await state.languageDataAt<CompletionSource>("autocomplete", cur)[0](new CompletionContext(state, cur, explicit)))?.options;
}

describe("Expression language completion", () => {
  it("completes when explicitly requested", async () => {
    let c = await get("‸", {explicit: true}) ?? [];
    ist(c.length, 0, '>');
    ist(!c.some(o => operatorKeywords.includes(o.label)));
  });

  it("completes when explicitly requested, even when non-empty", async () => {
    let c = await get("foo > 10 and ‸", {explicit: true}) ?? [];
    ist(c.length, 0, '>');
    ist(!c.some(o => operatorKeywords.includes(o.label)));
  });

  it("completes operators when explicitly requested", async () => {
    let c = await get("foo > 10 ‸", {explicit: true}) ?? [];
    ist(c.length, 0, '>');
    ist(c.some(o => operatorKeywords.includes(o.label)));
  });

  it("completes variables when explicitly requested, even mid-word", async () => {
    let c = await get("foo > 10 and foo‸", {explicit: true}) ?? [];
    ist(c.length, 0, '>');
    ist(!c.some(o => operatorKeywords.includes(o.label)));
  });

  it("completes variables", async () => {
    let c = await get("foo‸") ?? [];
    ist(c.length, 0, '>');
    ist(c.map(x => x.label).includes('foobar'));
    ist(c.map(x => x.label).includes('foobaz'));
  });

  it("completes parameterless functions", async () => {
    const c = (await get("sm‸"))?.find(x => x.label === 'smh()');
    ist(!!c);
    ist("string", c?.detail);
    ist("smh()", c?.label);
  });

  it("completes functions with params", async () => {
    const c = (await get("smash‸"))?.find(x => x.label === 'smash_my_head(object)');
    ist(!!c);
    ist(undefined, c?.detail);
    ist("smash_my_head(object)", c?.label);
  });

  it("completes operator keywords after identifiers", async () => {
    const c = await get("smh s‸") ?? [];
    ist(c.some(x => x.label === 'starts with'));
  });

  it("completes operator keywords after parenthesis", async () => {
    const c = await get("smh() en‸") ?? [];
    ist(c.some(x => x.label === 'ends with'));
  });

  it("completes operator keywords after string", async () => {
    const c = await get("'foobar' s‸") ?? [];
    ist(c.some(x => x.label === 'starts with'));
  });

  it("does not complete anything when there's open string", async () => {
    ist(null, await get("'foobar s‸"));
  });

  it("does not complete operators when identifier is expected", async () => {
    const c = await get("smash_my_head(a‸)");
    ist(!c?.some(x => x.label === 'and'));
  });

  it("completes object properties and methods", async () => {
    const c = await get("obj.‸") ?? [];
    ist(c.length, 3);
    ist("property11", c[0].label);
    ist("property22", c[1].label);
    ist("firstMethod()", c[2].label);
  });

  it("completes object members with partial key", async () => {
    const c = await get("obj.property1‸") ?? [];
    ist(c.some(x => x.label === 'property11'));
  });

  it("completes object members after function call", async () => {
    const c = await get("getObject().‸") ?? [];
    ist(c.some(x => x.label === 'property11'));
    ist(c.some(x => x.label === 'firstMethod()'));
  });

  it("completes only operators after method call", async () => {
    const c = await get("obj.firstMethod() ‸") ?? [];
    ist(!c.find(x => x.label === 'firstMethod()'));
    ist(!c.find(x => x.label === 'obj'));
    ist(c.find((x: Completion) => x.label === 'starts with'));
  });

  it("completes object members after method call", async () => {
    const c = await get("obj.firstMethod().‸") ?? [];
    ist(c.length, 3);
    ist("property11", c[0].label);
    ist("property22", c[1].label);
    ist("firstMethod()", c[2].label);
  });

  it("completes object members after complex expression", async () => {
    let c = await get("smash_my_head(obj.firstMethod()) + obj.‸") ?? [];
    ist(c.length, 3);
    ist("property11", c[0].label);
    ist("property22", c[1].label);
    ist("firstMethod()", c[2].label);
  });

  it("does not complete right after numbers", async () => {
    ist(null, await get("123‸"));
  });

  it("does not complete right after operator keywords", async () => {
    ist(null, await get("1 and‸"));
  });

  it("does not complete right after closing bracket", async () => {
    ist(null, await get("(1)‸"));
  });

  it("does complete after ternary expression", async () => {
    let c = await get("(foobar ? obj : false).‸") ?? [];
    ist(c.length, 3);
    ist("property11", c[0].label);
    ist("property22", c[1].label);
    ist("firstMethod()", c[2].label);
  });

  it("does complete after ternary expression shortcut", async () => {
    let c = await get("(foobar ? obj).‸") ?? []
    ist(c.length, 3);
    ist("property11", c[0].label);
    ist("property22", c[1].label);
    ist("firstMethod()", c[2].label);
  });

  it("does complete after ternary expression shortcut 2", async () => {
    let c = await get("(foobar ?: obj).‸") ?? [];
    ist(c.length, 3);
    ist("property11", c[0].label);
    ist("property22", c[1].label);
    ist("firstMethod()", c[2].label);
  });

  it("no completion inside comment", async () => {
    ist(null, await get("1 /* o‸ */"));
  });
});
