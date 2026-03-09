import {
	type CancellationToken,
	type Position,
	type Range,
	type RenameProvider,
	type TextDocument,
	WorkspaceEdit,
} from "vscode";
import type { DocumentManager } from "../document-manager";
import { getWordLookup } from "./word-at-position";

export class EbnfRenameProvider implements RenameProvider {
	constructor(private readonly manager: DocumentManager) {}

	provideRenameEdits(
		doc: TextDocument,
		position: Position,
		newName: string,
		_token: CancellationToken,
	): WorkspaceEdit | undefined {
		const lookup = getWordLookup(doc, position, this.manager);
		if (!lookup) {
			return undefined;
		}

		const edit = new WorkspaceEdit();

		const defs = lookup.symbolTable.definitions.get(lookup.word);
		if (defs) {
			for (const rule of defs) {
				edit.replace(doc.uri, rule.nameRange, newName);
			}
		}

		const refs = lookup.symbolTable.references.get(lookup.word);
		if (refs) {
			for (const ref of refs) {
				edit.replace(doc.uri, ref.range, newName);
			}
		}

		return edit;
	}

	prepareRename(
		doc: TextDocument,
		position: Position,
		_token: CancellationToken,
	): { range: Range; placeholder: string } | undefined {
		const lookup = getWordLookup(doc, position, this.manager);
		if (!lookup) {
			return undefined;
		}
		return { range: lookup.wordRange, placeholder: lookup.word };
	}
}
