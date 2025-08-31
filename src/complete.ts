import { EditorView } from "@codemirror/view";
import { Completion, CompletionContext, CompletionResult, insertCompletionText } from "@codemirror/autocomplete";
import { ELFunction, ELIdentifier, ExpressionLanguageConfig } from "./types";
import { EditorState } from "@codemirror/state";
import { SyntaxNode } from "@lezer/common";
import { createCompletionInfoElement, getExpressionLanguageConfig, keywords, resolveTypes } from "./utils";
import { syntaxTree } from "@codemirror/language";
import {
  Arguments,
  BinaryExpression,
  Expression,
  Function,
  MethodAccess,
  OperatorKeyword,
  PropertyAccess,
  TernaryExpression,
  UnaryExpression,
  Variable,
  String,
  BlockComment,
  ArrayAccess,
  Call,
  Application,
  Property,
  Method,
  Array,
} from "./syntax.grammar.terms";

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
  info: () => createCompletionInfoElement(x.info),
  type: "function",
});
const autocompleteIdentifier = (x: ELIdentifier): Completion => ({
  label: x.name,
  apply: x.name,
  info: () => createCompletionInfoElement(x.info),
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
      info: () => createCompletionInfoElement(info),
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

function completeMember(state: EditorState, config: ExpressionLanguageConfig, tree: SyntaxNode, from: number, to: number): CompletionResult | null {
  if (!(tree.parent?.type.is(PropertyAccess) || tree.parent?.type.is(MethodAccess)) || !tree.parent?.firstChild) {
    return null;
  }

  const types = resolveTypes(state, tree.parent.firstChild.node, config);
  if (!types?.size) {
    return null;
  }

  const options = [];
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

  const isIdentifier = (node: SyntaxNode | undefined) => node?.type.is(Variable) || node?.type.is(Function);
  const isMember = (node: SyntaxNode | undefined) => node?.type.is(Property) || node?.type.is(Method);

  if (prevNode.type.is(String) || prevNode.type.is(BlockComment)) {
    return null;
  }

  if ((prevNode.parent?.type.is(PropertyAccess) || prevNode.parent?.type.is(MethodAccess)) && [PropertyAccess, MethodAccess, ArrayAccess, Variable, Call, Application].includes(prevNode.parent.firstChild?.type.id)) {
    return completeMember(state, config, prevNode, isIdentifier(prevNode) || isMember(prevNode) ? prevNode.from : pos, pos);
  }

  if (
    /^[\sa-z]*$/.test(lastChar) && (
      [Expression, UnaryExpression, BinaryExpression, TernaryExpression].includes(prevNode.type.id) && prevNode.lastChild && !prevNode.lastChild?.type.isError
      || [Arguments, Array].includes(prevNode.type.id) && prevNode.lastChild && !prevNode.lastChild?.type.isError
      || [Expression, UnaryExpression, BinaryExpression, TernaryExpression].includes(prevNode.parent?.type.id) && prevNode.type.isError
      || [Variable, Function].includes(prevNode.parent?.type.id) && prevNode.type.isError
    )
  ) {
    return completeOperatorKeyword(state, config, prevNode, ![Expression, UnaryExpression, BinaryExpression, TernaryExpression, Arguments].includes(prevNode.type.id) ? prevNode.from : pos, pos, explicit);
  }

  if (
    !/[0-9]/.test(lastChar) && !prevNode.type.is(OperatorKeyword) && (
      [Expression, UnaryExpression, BinaryExpression, TernaryExpression].includes(prevNode.type.id) && prevNode.lastChild?.type.isError
      || [Expression, UnaryExpression, BinaryExpression, TernaryExpression, Arguments].includes(prevNode.parent?.type.id ?? -1) && !prevNode.type.isError
      || prevNode.type.is(Arguments) || prevNode.type.is(Array)
    )
  ) {
    return completeIdentifier(state, config, prevNode, isIdentifier(prevNode) ? prevNode.from : pos, pos);
  }

  return null;
}
