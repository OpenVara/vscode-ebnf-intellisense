import {
	type CancellationToken,
	CodeAction,
	type CodeActionContext,
	CodeActionKind,
	type CodeActionProvider,
	Position,
	type Range,
	type TextDocument,
	WorkspaceEdit,
} from "vscode";

const UNDEFINED_RULE_RE = /"([^"]+)" is not defined/;

export class AbnfCodeActionProvider implements CodeActionProvider {
	static readonly metadata = {
		providedCodeActionKinds: [CodeActionKind.QuickFix],
	};

	provideCodeActions(
		doc: TextDocument,
		_range: Range,
		context: CodeActionContext,
		_token: CancellationToken,
	): CodeAction[] | undefined {
		const actions: CodeAction[] = [];

		for (const diag of context.diagnostics) {
			const match = diag.message.match(UNDEFINED_RULE_RE);
			if (!match) {
				continue;
			}
			const name = match[1] ?? "";
			const action = new CodeAction(
				`Create rule '${name}'`,
				CodeActionKind.QuickFix,
			);

			const edit = new WorkspaceEdit();
			const lastLine = doc.lineCount - 1;
			const lastLineText = doc.lineAt(lastLine).text;
			const insertPos = new Position(lastLine, lastLineText.length);

			const prefix = lastLineText.length > 0 ? "\n\n" : "\n";
			edit.insert(doc.uri, insertPos, `${prefix}${name} = \n    `);

			action.edit = edit;
			action.diagnostics = [diag];
			action.isPreferred = true;
			actions.push(action);
		}

		return actions.length > 0 ? actions : undefined;
	}
}
