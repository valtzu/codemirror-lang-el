import { EditorState } from "@codemirror/state";
import { Diagnostic, linter } from "@codemirror/lint";
import { syntaxTree } from "@codemirror/language";
import { getExpressionLanguageConfig, isNullCoalesced, resolveFunctionDefinition, resolveIdentifier, resolveTypes } from "./utils";
import { ELScalar } from "./types";
import { Arguments, Method, Property, Variable, Function, BlockComment, BinaryExpression, OperatorKeyword, ArrayAccess, PropertyAccess, MethodAccess } from "./syntax.grammar.terms";

/**
 * @internal
 */
export const expressionLanguageLinterSource = (state: EditorState) => {
  const config = getExpressionLanguageConfig(state);
  const diagnostics: Diagnostic[] = [];

  syntaxTree(state).cursor().iterate(node => {
    const { from, to, type: { id } } = node;

    let identifier: string | undefined;
    switch (id) {
      case 0: {
        if (state.doc.length === 0 || from === 0) {
          // Don't show error on empty doc (even though it is an error)
          return;
        }

        identifier = state.sliceDoc(from, to);
        if (identifier.length === 0) {
          diagnostics.push({ from, to: node.node.parent?.parent?.to ?? to, severity: 'error', message: `Expression expected` });
        } else {
          const type = /^[a-zA-Z_]+[a-zA-Z_0-9]*$/.test(identifier) ? 'identifier' : 'operator';
          diagnostics.push({ from, to, severity: 'error', message: `Unexpected ${type} <code>${identifier}</code>` });
        }

        return;
      }
      case Arguments: {
        const fn = resolveFunctionDefinition(node.node.prevSibling, state, config);
        const args = fn?.args;
        if (!args) {
          return;
        }
        const argCountMin = args.reduce((count, arg) => count + Number(!arg.optional), 0);
        const argCountMax = args.length;
        const argumentCountHintFn = () => `<code>${fn.name}</code> takes ${argCountMin == argCountMax ? `exactly ${argCountMax}` : `${argCountMin}–${argCountMax}`} argument${argCountMax == 1 ? '' : 's'}`;
        let i = 0;

        for (let n = node.node.firstChild; n != null; n = n.nextSibling) {
          if (n.type.is(BlockComment)) {
            continue;
          }

          if (i > argCountMax - 1) {
            diagnostics.push({ from: n.from, to: n.to, severity: 'warning', message: `Unexpected argument – ${argumentCountHintFn()}` });
            continue;
          }

          const typesUsed = Array.from(resolveTypes(state, n, config));
          const typesExpected = args[i].type;

          if (typesExpected && !typesExpected.includes(ELScalar.Any) && !typesUsed.some(x => typesExpected.includes(x))) {
            diagnostics.push({
              from: n.from,
              to: n.to,
              severity: 'error',
              message: `<code>${typesExpected.join('|')}</code> expected, got <code>${typesUsed.join('|')}</code>`
            });
          }
          i++;
        }

        if (i < argCountMin) {
          diagnostics.push({ from: node.from, to: node.to, severity: 'error', message: `Too few arguments – ${argumentCountHintFn()}` });
        }

        break;
      }
      case Property:
      case Method: {
        const parent = node.node.parent;
        const isPropertyAccess = parent?.type.is(PropertyAccess);
        const isMethodAccess = parent?.type.is(MethodAccess);

        // Skip validation if this is part of a PropertyAccess/MethodAccess on array type
        // (the PropertyAccess/MethodAccess case will handle the error)
        if ((isPropertyAccess || isMethodAccess) && parent?.firstChild) {
          const types = Array.from(resolveTypes(state, parent.firstChild.node, config));
          const hasArrayType = types.includes(ELScalar.Array) || types.some(x => x.endsWith('[]'));
          if (hasArrayType && !types.includes(ELScalar.Any)) {
            break; // Skip property validation, error will be reported by PropertyAccess/MethodAccess case
          }
        }

        const leftArgument = parent?.firstChild?.node;
        const types = Array.from(resolveTypes(state, leftArgument, config));
        identifier = state.sliceDoc(from, to);

        if (!types.find(type => resolveIdentifier(id, identifier, config.types?.[type]))) {
          diagnostics.push({ from, to, severity: 'error', message: `${node.name} <code>${identifier}</code> not found in <code>${types.join('|')}</code>` });
        }

        break;
      }
      case PropertyAccess:
      case MethodAccess: {
        const leftArgument = node.node.firstChild?.node;
        const types = Array.from(resolveTypes(state, leftArgument, config));
        const hasArrayType = types.includes(ELScalar.Array) || types.some(x => x.endsWith('[]'));

        if (hasArrayType && !types.includes(ELScalar.Any)) {
          const propertyOrMethod = node.node.lastChild;
          const errorFrom = propertyOrMethod?.from ?? from;
          const errorTo = propertyOrMethod?.to ?? to;
          diagnostics.push({ from: errorFrom, to: errorTo, severity: 'error', message: `Unexpected object access on <code>${types.join('|')}</code>` });
        }

        break;
      }
      case ArrayAccess: {
        const leftArgument = node.node.firstChild?.node;
        const arrayAccessor = leftArgument.nextSibling;
        const types = Array.from(resolveTypes(state, leftArgument, config));
        const allowsAny = types.includes(ELScalar.Array) || types.includes(ELScalar.Any);

        if (!allowsAny && ![...types].some(x => x.endsWith('[]'))) {
          diagnostics.push({ from: arrayAccessor.from, to, severity: 'error', message: `Unexpected array access on <code>${types.join('|')}</code>` });
        }

        break;
      }
      case Variable:
      case Function: {
        identifier = state.sliceDoc(from, node.node.firstChild ? node.node.firstChild.from - 1 : to);
        if (!resolveIdentifier(id, identifier, config)) {
          if (id === Variable && isNullCoalesced(state, node.node)) {
            diagnostics.push({ from, to, severity: 'warning', message: `${node.node.name} <code>${identifier}</code> not found – evaluates to <code>null</code>` });
          } else {
            diagnostics.push({ from, to, severity: 'error', message: `${node.node.name} <code>${identifier}</code> not found` });
          }
        }

        break;
      }
      case BinaryExpression: {
        const operatorNode = node.node.getChild(OperatorKeyword);
        if (operatorNode) {
          const operator = state.sliceDoc(operatorNode.from, operatorNode.to);
          const leftArgument = node.node.firstChild;
          const rightArgument = node.node.lastChild;
          if (operator === 'in') {
            const leftTypes = resolveTypes(state, leftArgument, config);
            const rightTypes = resolveTypes(state, rightArgument, config);
            const allowsAny = rightTypes.has(ELScalar.Array) || rightTypes.has(ELScalar.Any);
            if (!allowsAny && ![...rightTypes].some(x => x.endsWith('[]'))) {
              diagnostics.push({ from: rightArgument.from, to: rightArgument.to, severity: 'error', message: `<code>${ELScalar.Array}</code> expected, got <code>${[...rightTypes].join('|')}</code>` });
            } else if (!allowsAny && !rightTypes.has(`${ELScalar.Any}[]`) && ![...leftTypes].some(type => rightTypes.has(`${type}[]`))) {
              diagnostics.push({ from: leftArgument.from, to: rightArgument.to, severity: 'warning', message: `Expression is always <code>false</code> because <code>${[...leftTypes].join('|')}</code> not found in <code>${[...rightTypes].join('|')}</code>` });
            }
          } else if (["contains", "starts with", "ends with", "matches"].includes(operator)) {
            // Both sides must be string
            const leftTypes = resolveTypes(state, leftArgument, config);
            const rightTypes = resolveTypes(state, rightArgument, config);
            if (!leftTypes.has(ELScalar.String)) {
              diagnostics.push({ from: leftArgument.from, to: leftArgument.to, severity: 'error', message: `<code>string</code> expected, got <code>${[...leftTypes].join('|')}</code>` });
            }
            if (!rightTypes.has(ELScalar.String)) {
              diagnostics.push({ from: rightArgument.from, to: rightArgument.to, severity: 'error', message: `<code>string</code> expected, got <code>${[...rightTypes].join('|')}</code>` });
            }
          }
        }
        break;
      }
    }

    if (identifier && node.node.parent?.type.isError) {
      diagnostics.push({ from, to, severity: 'error', message: `Unexpected identifier <code>${identifier}</code>` });
    }
  });

  diagnostics.forEach(d => {
    d.renderMessage = () => {
      const span = document.createElement('span');
      span.innerHTML = d.message;
      return span;
    };
  });

  return diagnostics;
};

export const expressionLanguageLinter = linter(view => expressionLanguageLinterSource(view.state));
