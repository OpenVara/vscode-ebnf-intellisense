import {
	type CancellationToken,
	Location,
	type Position,
	type ReferenceContext,
	type ReferenceProvider,
	type TextDocument,
} from "vscode";
import type { DocumentManager } from "../document-manager";
import { getWordLookup } from "./word-at-position";

export class EbnfReferenceProvider implements ReferenceProvider {
	constructor(private readonly manager: DocumentManager) {}

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

		const locations: Location[] = [];

		if (context.includeDeclaration) {
			const defs = lookup.symbolTable.definitions.get(lookup.word);
			if (defs) {
				for (const rule of defs) {
					locations.push(new Location(doc.uri, rule.nameRange));
				}
			}
		}

		const refs = lookup.symbolTable.references.get(lookup.word);
		if (refs) {
			for (const ref of refs) {
				locations.push(new Location(doc.uri, ref.range));
			}
		}

		return locations.length > 0 ? locations : undefined;
	}
}
