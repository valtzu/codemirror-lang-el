import { SyntaxNode } from "@lezer/common";
import { EditorState, StateField } from "@codemirror/state";
import { EditorView, hoverTooltip, showTooltip, Tooltip } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { getExpressionLanguageConfig, keywords, resolveFunctionDefinition, resolveTypes } from "./utils";
import { ExpressionLanguageConfig } from "./types";

function getNodeOrdinal(node: SyntaxNode) {
  let ordinal = -1;

  // noinspection StatementWithEmptyBodyJS
  for (let c: SyntaxNode|null = node; c; c = c.prevSibling, ordinal++);

  return ordinal;
}

function resolveArguments(node: SyntaxNode) {
  let c: SyntaxNode|null = node;

  while (c && c.name !== 'Arguments') {
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
      const argName = fn.args?.[n ? getNodeOrdinal(n) : 0];
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
          return {dom};
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

  if (tree.name === 'OperatorKeyword') {
    const name = view.state.sliceDoc(tree.from, tree.to);
    const info = keywords.find(x => x.name === name)?.info;
    if (info) {
      return {
        pos: tree.from,
        end: tree.to,
        above: true,
        create(view) {
          const dom = document.createElement("div")
          dom[config.htmlTooltip !== false ? 'innerHTML' : 'textContent'] = info;
          dom.className = 'cm-diagnostic';
          return { dom };
        },
      };
    }
  }

  if (!['Function', 'Variable', 'Method', 'Property'].includes(tree.name)) {
    return null;
  }

  const skipEmpty = (x: any) => x;
  let info: string;
  if (tree.parent?.firstChild && tree.parent?.name === 'ObjectAccess' && tree.prevSibling) {
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
    create(view) {
      const dom = document.createElement("div")
      dom[config.htmlTooltip !== false ? 'innerHTML' : 'textContent'] = info;
      dom.className = 'cm-diagnostic';
      return { dom };
    },
  };
});

export const cursorTooltipBaseTheme = EditorView.baseTheme({
  ".cm-tooltip.cm-tooltip-cursor": {
    boxShadow: 'rgba(0, 0, 0, .15) 0 1px 2px',
    border: "1px solid rgba(127, 127, 127, .2)",
    padding: "2px 7px",
    borderRadius: "4px",
    "& .cm-tooltip-arrow:before": {},
    "& .cm-tooltip-arrow:after": {
      borderTopColor: "transparent"
    }
  }
});
