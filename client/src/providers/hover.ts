import {
	type CancellationToken,
	Hover,
	type HoverProvider,
	MarkdownString,
	type Position,
	type TextDocument,
} from "vscode";
import type { DocumentManager } from "../document-manager.ts";
import { getWordLookup } from "./word-at-position.ts";

export class AbnfHoverProvider implements HoverProvider {
	private readonly manager: DocumentManager;
	constructor(manager: DocumentManager) {
		this.manager = manager;
	}

	provideHover(
		doc: TextDocument,
		position: Position,
		_token: CancellationToken,
	): Hover | undefined {
		const lookup = getWordLookup(doc, position, this.manager);
		if (!lookup) {
			return undefined;
		}

		const definitions = lookup.symbolTable.definitions.get(lookup.word);
		if (!definitions || definitions.length === 0) {
			return undefined;
		}

		const parts: string[] = [];

		for (const rule of definitions) {
			parts.push(`\`\`\`abnf\n${rule.name} = ${rule.definitionText}\n\`\`\``);
			if (rule.precedingComment) {
				parts.push(rule.precedingComment);
			}
		}

		const md = new MarkdownString(parts.join("\n\n---\n\n"));
		return new Hover(md, lookup.wordRange);
	}
}
