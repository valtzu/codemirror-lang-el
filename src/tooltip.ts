import { SyntaxNode } from "@lezer/common";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { hoverTooltip, showTooltip, Tooltip, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { createInfoElement, getExpressionLanguageConfig, keywords, resolveFunctionDefinition, resolveTypes } from "./utils";
import { Arguments, Function, Method, MethodAccess, OperatorKeyword, Property, PropertyAccess, Variable } from "./syntax.grammar.terms";

function getNodeOrdinal(node: SyntaxNode) {
  let ordinal = -1;

  // eslint-disable-next-line
  for (let c: SyntaxNode | null = node; c; c = c.prevSibling, ordinal++) {}

  return ordinal;
}

function resolveArguments(node: SyntaxNode) {
  let c: SyntaxNode | null = node;

  while (c && !c.type.is(Arguments)) {
    c = c.parent;
  }

  return c;
}

async function getCursorTooltips(state: EditorState): Promise<readonly Tooltip[]> {
  const config = getExpressionLanguageConfig(state);

  const results: Tooltip[] = [];
  for (const range of state.selection.ranges.filter(range => range.empty)) {
    const tree = syntaxTree(state);
    const node = tree.resolveInner(range.from, 0);
    const args = resolveArguments(node);
    if (!args || !args.prevSibling) {
      continue;
    }

    const fn = await resolveFunctionDefinition(args.prevSibling, state, config);
    if (!fn) {
      continue;
    }

    const n = args.childAfter(range.from - 1);
    const argName = fn.args?.[n ? getNodeOrdinal(n) : 0]?.name;
    if ((n && n.from !== range.from) || !argName) {
      continue;
    }

    results.push({
      pos: range.head,
      above: true,
      strictSide: false,
      arrow: true,
      create: () => {
        const dom = document.createElement("div");
        dom.className = "cm-tooltip-cursor";
        dom.textContent = `${argName}`;
        return { dom };
      },
    });
  }
  return results;
}

export const setCursorTooltipsEffect = StateEffect.define<readonly Tooltip[]>();

export const cursorTooltipField = [StateField.define<readonly Tooltip[]>({
  create: () => [],
  update(tooltips, tr) {
    for (const e of tr.effects) {
      if (e.is(setCursorTooltipsEffect)) return e.value;
    }
    return tooltips;
  },
  provide: f => showTooltip.computeN([f], state => state.field(f))
}), ViewPlugin.fromClass(
  class {
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet) {
        getCursorTooltips(update.view.state)
          .then(tooltips => update.view.dispatch({ effects: setCursorTooltipsEffect.of(tooltips) }));
      }
    }
  }
)];

export const keywordTooltip = hoverTooltip(async (view, pos, side) => {
  const config = getExpressionLanguageConfig(view.state);
  const tree: SyntaxNode = syntaxTree(view.state).resolveInner(pos, side);

  if (tree.type.is(OperatorKeyword)) {
    const name = view.state.sliceDoc(tree.from, tree.to);
    const info = keywords.find(x => x.name === name)?.info;
    if (info) {
      return {
        pos: tree.from,
        end: tree.to,
        above: true,
        create: () => ({ dom: createInfoElement(info) }),
      };
    }
  }

  if (![Function, Variable, Method, Property].includes(tree.type.id)) {
    return null;
  }

  const skipEmpty = (x: any) => x;
  let info: string;
  if (tree.parent?.firstChild && (tree.parent?.type.is(PropertyAccess) || tree.parent?.type.is(MethodAccess)) && tree.prevSibling) {
    const node = tree.parent.firstChild;
    const types = Array.from(await resolveTypes(view.state, node, config));
    const name = view.state.sliceDoc(tree.from, tree.to);
    const identifierInfos = await Promise.all(types.map(async type => (await config.typeResolver(type))?.identifiers?.find(x => x.name === name)?.info));
    const functionInfos = await Promise.all(types.map(async type => (await config.typeResolver(type))?.functions?.find(x => x.name === name)?.info));
    info = [
      ...identifierInfos.filter(skipEmpty),
      ...functionInfos.filter(skipEmpty),
    ].join('\n');
  } else {
    const name = view.state.sliceDoc(tree.from, tree.to);
    info = [
      ...[config.identifiers?.find(x => x.name === name)?.info].filter(skipEmpty),
      ...[config.functions?.find(x => x.name === name)?.info].filter(skipEmpty),
    ].join('\n');
  }

  if (!info) {
    return null;
  }

  return {
    pos: tree.from,
    end: tree.to,
    above: true,
    create: () => ({ dom: createInfoElement(info) }),
  };
});
