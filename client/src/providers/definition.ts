import {
	type CancellationToken,
	type DefinitionProvider,
	Location,
	type Position,
	type TextDocument,
} from "vscode";
import type { DocumentManager } from "../document-manager";
import { getWordLookup } from "./word-at-position";

export class EbnfDefinitionProvider implements DefinitionProvider {
	constructor(private readonly manager: DocumentManager) {}

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
		if (!definitions || definitions.length === 0) {
			return undefined;
		}

		return definitions.map((rule) => new Location(doc.uri, rule.nameRange));
	}
}
