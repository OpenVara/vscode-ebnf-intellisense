import type { Position, Range, TextDocument } from "vscode";
import type { DocumentManager } from "../document-manager";
import type { SymbolTable } from "../types";

export const IDENTIFIER_PATTERN = /[a-zA-Z][a-zA-Z0-9-]*/;

export interface WordLookup {
	word: string;
	wordRange: Range;
	symbolTable: SymbolTable;
}

export function getWordLookup(
	doc: TextDocument,
	position: Position,
	manager: DocumentManager,
): WordLookup | undefined {
	const wordRange = doc.getWordRangeAtPosition(position, IDENTIFIER_PATTERN);
	if (!wordRange) {
		return undefined;
	}

	const word = doc.getText(wordRange);
	const { symbolTable } = manager.get(doc);
	return { word, wordRange, symbolTable };
}
