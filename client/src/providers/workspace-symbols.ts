import {
	type CancellationToken,
	Location,
	SymbolInformation,
	SymbolKind,
	type WorkspaceSymbolProvider,
} from "vscode";
import type { WorkspaceIndex } from "../workspace-index.ts";

export class AbnfWorkspaceSymbolProvider implements WorkspaceSymbolProvider {
	private readonly index: WorkspaceIndex;
	constructor(index: WorkspaceIndex) {
		this.index = index;
	}

	provideWorkspaceSymbols(
		query: string,
		_token: CancellationToken,
	): SymbolInformation[] {
		if (!query) {
			return [];
		}

		return this.index
			.searchSymbols(query)
			.map(
				(entry) =>
					new SymbolInformation(
						entry.rule.name,
						SymbolKind.Function,
						"",
						new Location(entry.uri, entry.rule.nameRange),
					),
			);
	}
}
