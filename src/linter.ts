import { EditorState } from "@codemirror/state";
import { Diagnostic, linter } from "@codemirror/lint";
import { syntaxTree } from "@codemirror/language";
import { getExpressionLanguageConfig, resolveFunctionDefinition, resolveIdentifier, resolveTypes } from "./utils";

/**
 * @internal
 */
export const expressionLanguageLinterSource = (state: EditorState) => {
  const config = getExpressionLanguageConfig(state);
  let diagnostics: Diagnostic[] = [];

  syntaxTree(state).cursor().iterate(node => {
    const { from, to, name } = node;

    let identifier: string | undefined;
    switch (name) {
      case '⚠':
        if (state.doc.length === 0 || from === 0) {
          // Don't show error on empty doc (even though it is an error)
          return;
        }

        identifier = state.sliceDoc(from, to);
        if (identifier.length === 0) {
          diagnostics.push({ from, to: node.node.parent?.parent?.to ?? to, severity: 'error', message: `Expression expected` });
        } else {
          const type = /^[a-zA-Z_]+[a-zA-Z_0-9]*$/.test(identifier) ? 'identifier' : 'operator';
          diagnostics.push({ from, to, severity: 'error', message: `Unexpected ${type} '${identifier}'` });
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
          if (n.name !== 'BlockComment' && ++i > args.length) {
            diagnostics.push({ from: n.from, to: n.to, severity: 'error', message: `Unexpected argument` });
          }

          n = n.nextSibling;
        }

        break;
      case 'Property':
      case 'Method':
        const leftArgument = node.node.parent?.firstChild?.node;
        const types = Array.from(resolveTypes(state, leftArgument, config, true));
        identifier = state.sliceDoc(from, to);

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

export const expressionLanguageLinter = linter(view => expressionLanguageLinterSource(view.state));
