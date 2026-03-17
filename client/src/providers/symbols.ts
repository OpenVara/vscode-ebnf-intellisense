import {
	type CancellationToken,
	DocumentSymbol,
	type DocumentSymbolProvider,
	SymbolKind,
	type TextDocument,
} from "vscode";
import type { DocumentManager } from "../document-manager.ts";

export class AbnfDocumentSymbolProvider implements DocumentSymbolProvider {
	private readonly manager: DocumentManager;
	constructor(manager: DocumentManager) {
		this.manager = manager;
	}

	provideDocumentSymbols(
		doc: TextDocument,
		_token: CancellationToken,
	): DocumentSymbol[] {
		const { document } = this.manager.get(doc);

		return document.rules.map(
			(rule) =>
				new DocumentSymbol(
					rule.name,
					rule.definitionText,
					SymbolKind.Function,
					rule.definitionRange,
					rule.nameRange,
				),
		);
	}
}
