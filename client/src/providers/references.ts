import {
	type CancellationToken,
	Location,
	type Position,
	type ReferenceContext,
	type ReferenceProvider,
	type TextDocument,
	type Uri,
} from "vscode";
import type { DocumentManager } from "../document-manager.ts";
import type { WorkspaceIndex } from "../workspace-index.ts";
import { getWordLookup } from "./word-at-position.ts";

type SymbolTable = ReturnType<DocumentManager["get"]>["symbolTable"];

function collectLocationsFromFile(
	symbolTable: SymbolTable,
	word: string,
	uri: Uri,
	includeDeclaration: boolean,
): Location[] {
	const locations: Location[] = [];

	if (includeDeclaration) {
		const defs = symbolTable.definitions.get(word);
		if (defs) {
			for (const rule of defs) {
				locations.push(new Location(uri, rule.nameRange));
			}
		}
	}

	const refs = symbolTable.references.get(word);
	if (refs) {
		for (const ref of refs) {
			locations.push(new Location(uri, ref.range));
		}
	}

	return locations;
}

export class AbnfReferenceProvider implements ReferenceProvider {
	private readonly manager: DocumentManager;
	private readonly workspaceIndex: WorkspaceIndex | undefined;
	constructor(manager: DocumentManager, workspaceIndex?: WorkspaceIndex) {
		this.manager = manager;
		this.workspaceIndex = workspaceIndex;
	}

	provideReferences(
		doc: TextDocument,
		position: Position,
		context: ReferenceContext,
		_token: CancellationToken,
	): Location[] | undefined {
		const lookup = getWordLookup(doc, position, this.manager);
		if (!lookup) {
			return undefined;
		}

		const currentUri = doc.uri.toString();
		const locations: Location[] = collectLocationsFromFile(
			lookup.symbolTable,
			lookup.word,
			doc.uri,
			context.includeDeclaration,
		);

		if (this.workspaceIndex) {
			for (const file of this.workspaceIndex.getAllFiles()) {
				if (file.uri.toString() === currentUri) {
					continue;
				}
				const fileLocations = collectLocationsFromFile(
					file.symbolTable,
					lookup.word,
					file.uri,
					context.includeDeclaration,
				);
				locations.push(...fileLocations);
			}
		}

		return locations.length > 0 ? locations : undefined;
	}
}
