import { EditorState } from "@codemirror/state";
import { Diagnostic, linter } from "@codemirror/lint";
import { syntaxTree } from "@codemirror/language";
import { getExpressionLanguageConfig, resolveFunctionDefinition, resolveIdentifier, resolveTypes } from "./utils";
import { ELScalar } from "./types";
import { Arguments, Method, Property, Variable, Function, BlockComment } from "./syntax.grammar.terms";

/**
 * @internal
 */
export const expressionLanguageLinterSource = (state: EditorState) => {
  const config = getExpressionLanguageConfig(state);
  let diagnostics: Diagnostic[] = [];

  syntaxTree(state).cursor().iterate(node => {
    const { from, to, type: { id } } = node;

    let identifier: string | undefined;
    switch (id) {
      case 0:
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
      case Arguments:
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
            diagnostics.push({ from: n.from, to: n.to, severity: 'error', message: `<code>${typesExpected.join('|')}</code> expected, got <code>${typesUsed.join('|')}</code>` });
          }
          i++;
        }

        if (i < argCountMin) {
          diagnostics.push({ from: node.from, to: node.to, severity: 'error', message: `Too few arguments – ${argumentCountHintFn()}` });
        }

        break;
      case Property:
      case Method:
        const leftArgument = node.node.parent?.firstChild?.node;
        const types = Array.from(resolveTypes(state, leftArgument, config));
        identifier = state.sliceDoc(from, to);

        if (!types.find(type => resolveIdentifier(id, identifier, config.types?.[type]))) {
          diagnostics.push({ from, to, severity: 'error', message: `${node.name} <code>${identifier}</code> not found in <code>${types.join('|')}</code>` });
        }

        break;

      case Variable:
      case Function:
        identifier = state.sliceDoc(from, node.node.firstChild ? node.node.firstChild.from - 1 : to);
        if (!resolveIdentifier(id, identifier, config)) {
          diagnostics.push({ from, to, severity: 'error', message: `${node.node.name} <code>${identifier}</code> not found` });
        }

        break;
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
