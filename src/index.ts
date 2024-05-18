import { parser } from "./syntax.grammar";
import { LRLanguage, LanguageSupport, indentNodeProp, foldNodeProp, delimitedIndent, syntaxTree } from "@codemirror/language";
import { Completion, CompletionContext, CompletionResult, insertCompletionText } from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";
import { styleTags, tags as t } from "@lezer/highlight";
import { SyntaxNode } from "@lezer/common";
import { EditorState, StateField } from "@codemirror/state";
import { linter, Diagnostic } from "@codemirror/lint";
import { hoverTooltip, Tooltip, showTooltip } from "@codemirror/view";


export interface ELIdentifier {
  name: string;
  detail?: string;
  info?: string;
  type?: string[];
}

export interface ELFunction {
  name: string;
  args: string[]; // maybe these could be ELIdentifier[] ?
  info?: string;
  returnType?: string[];
}

export interface ExpressionLanguageConfig {
  types?: {[key:string]: {identifiers?: ELIdentifier[], functions?: ELFunction[], type?: string, info?: string}};
  identifiers?: ELIdentifier[];
  functions?: ELFunction[];
  operatorKeywords?: readonly { name: string; detail?: string, info?: string }[];
  htmlTooltip?: boolean,
}

const autocompleteFunction = (x: ELFunction) => ({
  label: `${x.name}(${x.args?.join(',') || ''})`,
  apply: (view: EditorView, completion: Completion, from: number, to: number) => {
    view.dispatch(
      {
        ...insertCompletionText(view.state, `${x.name}()`, from, to),
        selection: { anchor: from + x.name.length + (x.args?.length > 0 ? 1 : 2) }
      }
    );
  },
  detail: x.returnType?.join('|'),
  info: x.info, type: "function"
});
const autocompleteIdentifier = (x: ELIdentifier) => ({ label: x.name, apply: x.name, info: x.info, detail: x.detail || x.type?.join('|'), type: 'variable' });

const resolveCallable = (identifier?: string, config?: { identifiers?: ELIdentifier[], functions?: ELFunction[] }) => config?.functions?.find(x => x.name === identifier);

const resolveIdentifier = (nodeName: 'Method' | 'Property' | 'Function' | 'Variable', identifier?: string, config?: { identifiers?: ELIdentifier[], functions?: ELFunction[] }): ELIdentifier|ELFunction|undefined => {
  switch (nodeName) {
    case 'Method':
    case 'Function':
      return resolveCallable(identifier, config);
    case 'Property':
    case 'Variable':
      return config?.identifiers?.find(x => x.name === identifier);
  }
};
const cursorTooltipBaseTheme = EditorView.baseTheme({
  ".cm-tooltip.cm-tooltip-cursor": {
    boxShadow: 'rgba(0, 0, 0, .15) 0 1px 2px',
    border: "1px solid rgba(127, 127, 127, .2)",
    padding: "2px 7px",
    borderRadius: "4px",
    "& .cm-tooltip-arrow:before": {
    },
    "& .cm-tooltip-arrow:after": {
      borderTopColor: "transparent"
    }
  }
});

function getNodeOrdinal(node: SyntaxNode) {
  let ordinal = -1;

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

function resolveFunctionDefinition(node: SyntaxNode|null, state: EditorState, config: ExpressionLanguageConfig) {
  if (!node) {
    return undefined;
  }

  let identifier: string|undefined;
  if (node.name === 'ObjectAccess' && node.lastChild) {
    const leftArgument = node.firstChild?.node;
    const types = Array.from(resolveTypes(state, leftArgument, config, true));
    identifier = state.sliceDoc(node.lastChild.from, node.lastChild.to);

    return types.map(type => resolveCallable(identifier, config.types?.[type])).find(x => x);
  } else if (node.name === 'Function') {
    identifier = state.sliceDoc(node.from, node.node.firstChild ? node.node.firstChild.from - 1 : node.to);

    return resolveCallable(identifier, config);
  }
}

function getCursorTooltips(state: EditorState, config: ExpressionLanguageConfig): readonly Tooltip[] {
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

const cursorTooltipField = (config: ExpressionLanguageConfig) => StateField.define<readonly Tooltip[]>({
  create: (state) => getCursorTooltips(state, config),

  update(tooltips, tr) {
    if (!tr.docChanged && !tr.selection) {
      return tooltips;
    }

    return getCursorTooltips(tr.state, config);
  },

  provide: f => showTooltip.computeN([f], state => state.field(f))
});

export const expressionLanguageLinterSource = (config: ExpressionLanguageConfig) => (state: EditorState) => {
  let diagnostics: Diagnostic[] = [];

  syntaxTree(state).cursor().iterate(node => {
    const { from, to, name } = node;

    let identifier: string|undefined;
    switch (name) {
      case '⚠':
        if (state.doc.length === 0 || from === 0) {
          // Don't show error on empty doc (even though it is an error)
          return;
        }

        identifier = state.sliceDoc(from,  to);
        if (identifier.length === 0) {
          diagnostics.push({from, to: node.node.parent?.parent?.to ?? to, severity: 'error', message: `Expression expected`});
        } else {
          const type = /^[a-zA-Z_]+[a-zA-Z_0-9]*$/.test(identifier) ? 'identifier' : 'operator';
          diagnostics.push({from, to, severity: 'error', message: `Unexpected ${type} '${identifier}'`});
        }

        return;
      case 'Arguments':
        const args = resolveFunctionDefinition(node.node.prevSibling, state, config)?.args;
        if (!args) {
          return;
        }

        let i = 0;
        let n = node.node.firstChild;
        while (n) {
          if (++i > args.length) {
            diagnostics.push({ from: n.from, to: n.to, severity: 'error', message: `Unexpected argument` });
          }

          n = n.nextSibling;
        }

        break;
      case 'Property':
      case 'Method':
        const leftArgument = node.node.parent?.firstChild?.node;
        const types = Array.from(resolveTypes(state, leftArgument, config, true));
        identifier = state.sliceDoc(from,  to);

        if (!types.find(type => resolveIdentifier(name, identifier, config.types?.[type]))) {
          diagnostics.push({ from, to, severity: 'error', message: `${node.name} "${identifier}" not found in ${types.join('|')}` });
        }

        break;

      case 'Variable':
      case 'Function':
        identifier = state.sliceDoc(from, node.node.firstChild ? node.node.firstChild.from - 1 : to);
        if (!resolveIdentifier(name, identifier, config)) {
          diagnostics.push({ from, to, severity: 'error', message: `${node.node.name} "${identifier}" not found` });
        }

        break;
    }

    if (identifier && node.node.parent?.type.isError) {
      diagnostics.push({ from, to, severity: 'error', message: `Unexpected identifier "${identifier}"` });
    }
  });

  return diagnostics;
};

const expressionLanguageLinter = (config: ExpressionLanguageConfig) => linter(view => expressionLanguageLinterSource(config)(view.state));

export const keywordTooltip = (config: ExpressionLanguageConfig) => hoverTooltip((view, pos, side) => {
  const tree = syntaxTree(view.state).resolveInner(pos, side);

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
      dom[config.htmlTooltip ? 'innerHTML' : 'textContent'] = info;
      dom.className = 'cm-diagnostic';
      return { dom };
    },
  };
});

export const ELLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        Application: delimitedIndent({ closing: ")", align: false }),
        Arguments: delimitedIndent({ closing: ")", align: false }),
        Object: delimitedIndent({ closing: "}", align: false }),
      }),
      foldNodeProp.add({
        Application: ({ from, to }) => ({ from: from + 1, to: to - 1 }),
        Arguments: ({ from, to }) => ({ from: from + 1, to: to - 1 }),
        Object: ({ from, to }) => ({ from: from + 1, to: to - 1 }),
      }),
      styleTags({
        Property: t.propertyName,
        Variable: t.variableName,
        Function: t.function(t.variableName),
        Method: t.function(t.propertyName),
        Boolean: t.bool,
        String: t.string,
        Number: t.number,
        '(': t.paren,
        ')': t.paren,
        '[': t.squareBracket,
        ']': t.squareBracket,
        ',': t.punctuation,
        MemberOf: t.punctuation,
        NullSafeMemberOf: t.punctuation,
        OperatorKeyword: t.operatorKeyword,
        UnaryOperator: t.operator,
        Operator: t.operator,
      })
    ]
  }),
  languageData: {
  }
})

function completeOperatorKeyword(state: EditorState, config: ExpressionLanguageConfig, tree: SyntaxNode, from: number, to: number, explicit: boolean): CompletionResult {
  return {
    from,
    to,
    options: config.operatorKeywords?.map(({ name, info, detail }) => ({ label: name, apply: `${name} `, info, detail, type: "keyword" })) ?? [],
    validFor: (text: string) => config.operatorKeywords?.some(({ name }) => explicit || name.includes(text)) ?? false,
  };
}

function completeIdentifier(state: EditorState, config: ExpressionLanguageConfig, tree: SyntaxNode, from: number, to: number): CompletionResult {
  const identifiers = config.identifiers ?? [];//?.filter(({ name }) => explicit || name.toLowerCase().startsWith(text)) ?? [];
  const functions = config.functions ?? [];//?.filter(({ name }) => explicit || name.toLowerCase().startsWith(text)) ?? [];

  return {
    from,
    to,
    options: [...(identifiers.map(autocompleteIdentifier)), ...(functions.map(autocompleteFunction))],
    validFor: /^[a-zA-Z_]+[a-zA-Z_0-9]*$/,
  };
}

function resolveTypes(state: EditorState, node: SyntaxNode|undefined, config: ExpressionLanguageConfig, matchExact: boolean): Set<string>  {
  let types: Set<string> = new Set<string>();
  if (!node) {
    return types;
  }

  if (node.name === 'Call' && node.firstChild && node.lastChild) {
    resolveTypes(state, node.firstChild, config, matchExact).forEach(x => types.add(x));
  } else if (node.name === 'Variable') {
    const varName = state.sliceDoc(node.from, node.to) || '';
    // @ts-ignore
    resolveIdentifier(node.name, varName, config)?.type?.forEach((x: string) => types.add(x));
  } else if (node.name === 'Function') {
    const varName = state.sliceDoc(node.from, node.to) || '';
    // @ts-ignore
    resolveIdentifier(node.name, varName, config)?.returnType?.forEach((x: string) => types.add(x));
  } else if (node.name === 'ObjectAccess' && node.firstChild && node.lastChild?.name === 'Property') {
    const varName = state.sliceDoc(node.lastChild.from, node.lastChild.to) || '';
    resolveTypes(state, node.firstChild, config, matchExact)?.forEach(baseType => {
      // @ts-ignore
      resolveIdentifier(node.lastChild?.name, varName, config.types?.[baseType])?.type?.forEach((x: string) => types.add(x));
    });
  } else if (node.name === 'ObjectAccess' && node.firstChild && node.lastChild?.name === 'Method') {
    const varName = state.sliceDoc(node.lastChild.from, node.lastChild.to) || '';
    resolveTypes(state, node.firstChild, config, matchExact)?.forEach(baseType => {
      // @ts-ignore
      resolveIdentifier(node.lastChild?.name, varName, config.types?.[baseType])?.returnType?.forEach((x: string) => types.add(x));
    });
  } else if (node.name === 'Application' && node.firstChild) {
    resolveTypes(state, node.firstChild, config, matchExact).forEach(x => types.add(x));
  }

  if (types.size === 0) {
    types.add('any');
  }

  return types;
}

function completeMember(state: EditorState, config: ExpressionLanguageConfig, tree: SyntaxNode, from: number, to: number, explicit: boolean): CompletionResult | null {
  if (tree.parent?.name != 'ObjectAccess' || !tree.parent.firstChild) {
    return null;
  }

  const varName = state.sliceDoc(from, to);
  const types = resolveTypes(state, tree.parent.firstChild.node, config, false);
  if (!types?.size) {
    return null;
  }

  let options = [];
  for (const type of types) {
    const typeDeclaration = config.types?.[type];
    options.push(
      ...(typeDeclaration?.identifiers?.map(autocompleteIdentifier) || []),
      ...(typeDeclaration?.functions?.map(autocompleteFunction) || []),
    );
  }

  return {
    from,
    to,
    options,
    validFor: /^[a-zA-Z_]+[a-zA-Z_0-9]*$/,
  };
}

function expressionLanguageCompletionFor(config: ExpressionLanguageConfig, context: CompletionContext): CompletionResult | null {
  const { state, pos, explicit } = context;
  const tree = syntaxTree(state);
  const lastChar = state.sliceDoc(pos - 1, pos);
  const prevNode = tree.resolveInner(pos, lastChar === ')' ? 0 : -1);

  const isIdentifier = (node: SyntaxNode|undefined) => ['Variable', 'Function'].includes(node?.name ?? '');
  const isMember = (node: SyntaxNode|undefined) => ['Property', 'Method'].includes(node?.name ?? '');

  if (prevNode.name == 'String') {
    return null;
  }

  if (prevNode.parent?.name == 'ObjectAccess' && ['ObjectAccess', 'ArrayAccess', 'Variable', 'Call'].includes(prevNode.parent.firstChild?.name || '')) {
    return completeMember(state, config, prevNode, isIdentifier(prevNode) || isMember(prevNode) ? prevNode.from : pos, pos, explicit);
  }

  if (
    ['Expression', 'UnaryExpression', 'BinaryExpression', 'TernaryExpression'].includes(prevNode.name) && prevNode.lastChild && !prevNode.lastChild?.type.isError
    || ['Arguments', 'Array'].includes(prevNode.name) && prevNode.lastChild && !prevNode.lastChild?.type.isError
    || ['Expression', 'UnaryExpression', 'BinaryExpression', 'TernaryExpression'].includes(prevNode.parent?.name ?? '') && prevNode.type.isError
    || ['Variable', 'Function'].includes(prevNode.parent?.name ?? '') && prevNode.type.isError
  ) {
    return completeOperatorKeyword(state, config, prevNode, !['Expression', 'UnaryExpression', 'BinaryExpression', 'TernaryExpression', 'Arguments'].includes(prevNode.name) ? prevNode.from : pos, pos, explicit);
  }

  if (
    !/[0-9]/.test(lastChar) && !['OperatorKeyword'].includes(prevNode.name ?? '') && (
      ['Expression', 'UnaryExpression', 'BinaryExpression', 'TernaryExpression'].includes(prevNode.name) && prevNode.lastChild?.type.isError
      || ['Expression', 'UnaryExpression', 'BinaryExpression', 'TernaryExpression', 'Arguments'].includes(prevNode.parent?.name ?? '') && !prevNode.type.isError
      || ['Arguments', 'Array'].includes(prevNode.name ?? '')
    )
  ) {
    return completeIdentifier(state, config, prevNode, isIdentifier(prevNode) ? prevNode.from : pos, pos);
  }

  return null;
}

function expressionLanguageCompletionSourceWith(config: ExpressionLanguageConfig) {
  config.operatorKeywords ??= [
    { name: 'starts with' },
    { name: 'ends with' },
    { name: 'contains' },
    { name: 'matches' },
    { name: 'not in' },
    { name: 'in' },
    { name: 'not' },
    { name: 'or' },
    { name: 'and' },
  ];

  return (context: CompletionContext) => expressionLanguageCompletionFor(config, context);
}

export function expressionlanguage(config: ExpressionLanguageConfig = {}, extensions: Array<any> = []) {
  return new LanguageSupport(ELLanguage, [
    ELLanguage.data.of({ autocomplete: expressionLanguageCompletionSourceWith(config) }),
    expressionLanguageLinter(config),
    keywordTooltip(config),
    ...extensions,
    [cursorTooltipField(config), cursorTooltipBaseTheme],
  ]);
}
