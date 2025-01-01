import { SyntaxNode } from "@lezer/common";
import { EditorState, StateField } from "@codemirror/state";
import { hoverTooltip, showTooltip, Tooltip } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { createInfoElement, getExpressionLanguageConfig, keywords, resolveFunctionDefinition, resolveTypes } from "./utils";
import { Arguments, Function, Method, MethodAccess, OperatorKeyword, Property, PropertyAccess, Variable } from "./syntax.grammar.terms";

function getNodeOrdinal(node: SyntaxNode) {
  let ordinal = -1;

  // noinspection StatementWithEmptyBodyJS
  for (let c: SyntaxNode | null = node; c; c = c.prevSibling, ordinal++) ;

  return ordinal;
}

function resolveArguments(node: SyntaxNode) {
  let c: SyntaxNode | null = node;

  while (c && !c.type.is(Arguments)) {
    c = c.parent;
  }

  return c;
}

function getCursorTooltips(state: EditorState): readonly Tooltip[] {
  const config = getExpressionLanguageConfig(state);

  // @ts-ignore
  return state.selection.ranges
    .filter(range => range.empty)
    .map(range => {
      const tree = syntaxTree(state);
      const node = tree.resolveInner(range.from, 0);
      const args = resolveArguments(node);
      if (!args || !args.prevSibling) {
        return null;
      }

      const fn = resolveFunctionDefinition(args.prevSibling, state, config);
      if (!fn) {
        return null;
      }

      const n = args.childAfter(range.from - 1);
      const argName = fn.args?.[n ? getNodeOrdinal(n) : 0]?.name;
      if (n && n.from !== range.from || !argName) {
        return null;
      }

      return {
        pos: range.head,
        above: true,
        strictSide: false,
        arrow: true,
        create: () => {
          let dom = document.createElement("div");
          dom.className = "cm-tooltip-cursor";
          dom.textContent = `${argName}`;
          return { dom };
        },
      };
    }).filter(x => x);
}

export const cursorTooltipField = StateField.define<readonly Tooltip[]>({
  create: (state) => getCursorTooltips(state),

  update(tooltips, tr) {
    if (!tr.docChanged && !tr.selection) {
      return tooltips;
    }

    return getCursorTooltips(tr.state);
  },

  provide: f => showTooltip.computeN([f], state => state.field(f))
});

export const keywordTooltip = hoverTooltip((view, pos, side) => {
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
    const types = Array.from(resolveTypes(view.state, node, config, true));
    const name = view.state.sliceDoc(tree.from, tree.to);
    info = [
      ...types.map(type => config.types?.[type]?.identifiers?.find(x => x.name === name)?.info).filter(skipEmpty),
      ...types.map(type => config.types?.[type]?.functions?.find(x => x.name === name)?.info).filter(skipEmpty),
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
