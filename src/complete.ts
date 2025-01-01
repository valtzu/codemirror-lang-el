import { EditorView } from "@codemirror/view";
import { Completion, CompletionContext, CompletionResult, insertCompletionText } from "@codemirror/autocomplete";
import { ELFunction, ELIdentifier, ExpressionLanguageConfig } from "./types";
import { EditorState } from "@codemirror/state";
import { SyntaxNode } from "@lezer/common";
import { getExpressionLanguageConfig, keywords, resolveTypes } from "./utils";
import { syntaxTree } from "@codemirror/language";

const autocompleteFunction = (x: ELFunction): Completion => ({
  label: `${x.name}(${x.args?.map(x => x.name)?.join(',') || ''})`,
  apply: (view: EditorView, completion: Completion, from: number, to: number) => {
    view.dispatch(
      {
        ...insertCompletionText(view.state, `${x.name}()`, from, to),
        selection: { anchor: from + x.name.length + ((x.args?.length ?? 0) > 0 ? 1 : 2) }
      }
    );
  },
  detail: x.returnType?.join('|'),
  info: x.info,
  type: "function",
});
const autocompleteIdentifier = (x: ELIdentifier): Completion => ({
  label: x.name,
  apply: x.name,
  info: x.info,
  detail: x.detail || x.type?.join('|'),
  type: 'variable',
});

function completeOperatorKeyword(state: EditorState, config: ExpressionLanguageConfig, tree: SyntaxNode, from: number, to: number, explicit: boolean): CompletionResult {
  return {
    from,
    to,
    options: keywords.map(({ name, info, detail }) => ({
      label: name,
      apply: `${name} `,
      info: info,
      detail,
      type: "keyword"
    })) ?? [],
    validFor: (text: string) => keywords.some(({ name }) => explicit || name.includes(text)) ?? false,
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

function completeMember(state: EditorState, config: ExpressionLanguageConfig, tree: SyntaxNode, from: number, to: number, explicit: boolean): CompletionResult | null {
  if (tree.parent?.name != 'ObjectAccess' || !tree.parent.firstChild) {
    return null;
  }

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

export function expressionLanguageCompletion(context: CompletionContext): CompletionResult | null {
  const { state, pos, explicit } = context;
  const tree = syntaxTree(state);
  const lastChar = state.sliceDoc(pos - 1, pos);
  const prevNode = tree.resolveInner(pos, lastChar === ')' ? 0 : -1);
  const config = getExpressionLanguageConfig(state);

  const isIdentifier = (node: SyntaxNode | undefined) => ['Variable', 'Function'].includes(node?.name ?? '');
  const isMember = (node: SyntaxNode | undefined) => ['Property', 'Method'].includes(node?.name ?? '');

  if (prevNode.name == 'String' || prevNode.name == 'BlockComment') {
    return null;
  }

  if (prevNode.parent?.name == 'ObjectAccess' && ['ObjectAccess', 'ArrayAccess', 'Variable', 'Call', 'Application'].includes(prevNode.parent.firstChild?.name || '')) {
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
