import {
	type CancellationToken,
	type DefinitionProvider,
	Location,
	type Position,
	type TextDocument,
} from "vscode";
import type { DocumentManager } from "../document-manager.ts";
import type { WorkspaceIndex } from "../workspace-index.ts";
import { getWordLookup } from "./word-at-position.ts";

export class AbnfDefinitionProvider implements DefinitionProvider {
	private readonly manager: DocumentManager;
	private readonly workspaceIndex: WorkspaceIndex | undefined;
	constructor(manager: DocumentManager, workspaceIndex?: WorkspaceIndex) {
		this.manager = manager;
		this.workspaceIndex = workspaceIndex;
	}

	provideDefinition(
		doc: TextDocument,
		position: Position,
		_token: CancellationToken,
	): Location[] | undefined {
		const lookup = getWordLookup(doc, position, this.manager);
		if (!lookup) {
			return undefined;
		}

		const definitions = lookup.symbolTable.definitions.get(lookup.word);
		if (definitions && definitions.length > 0) {
			return definitions.map((rule) => new Location(doc.uri, rule.nameRange));
		}

		// Fall back to workspace-wide search
		if (this.workspaceIndex) {
			const workspaceDefs = this.workspaceIndex.findDefinitions(lookup.word);
			if (workspaceDefs.length > 0) {
				return workspaceDefs.map(
					(entry) => new Location(entry.uri, entry.rule.nameRange),
				);
			}
		}

		return undefined;
	}
}
