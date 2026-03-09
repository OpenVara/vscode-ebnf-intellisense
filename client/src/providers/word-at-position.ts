import type { Position, Range, TextDocument } from "vscode";
import type { DocumentManager } from "../document-manager";
import type { SymbolTable } from "../types";

export const IDENTIFIER_PATTERN = /[a-zA-Z][a-zA-Z0-9-]*/;

export interface WordLookup {
	word: string;
	wordRange: Range;
	symbolTable: SymbolTable;
}

/**
 * Check if a position falls within a range.
 */
function positionInRange(pos: Position, range: Range): boolean {
	if (pos.line < range.start.line || pos.line > range.end.line) {
		return false;
	}
	if (pos.line === range.start.line && pos.character < range.start.character) {
		return false;
	}
	if (pos.line === range.end.line && pos.character > range.end.character) {
		return false;
	}
	return true;
}

/**
 * Try to find a multi-word identifier range that contains the position.
 * This handles spaced identifiers where the range spans multiple words.
 */
function findSpacedIdentifierRange(
	doc: TextDocument,
	position: Position,
	manager: DocumentManager,
): { word: string; wordRange: Range; symbolTable: SymbolTable } | undefined {
	const { document: ebnfDoc, symbolTable } = manager.get(doc);

	// Check rule name ranges
	for (const rule of ebnfDoc.rules) {
		if (positionInRange(position, rule.nameRange)) {
			return {
				word: rule.name,
				wordRange: rule.nameRange,
				symbolTable,
			};
		}

		// Check reference ranges
		for (const ref of rule.references) {
			if (positionInRange(position, ref.range)) {
				return {
					word: ref.name,
					wordRange: ref.range,
					symbolTable,
				};
			}
		}
	}

	return undefined;
}

export function getWordLookup(
	doc: TextDocument,
	position: Position,
	manager: DocumentManager,
): WordLookup | undefined {
	// First try to find a multi-word identifier range (for spaced identifiers)
	const spacedResult = findSpacedIdentifierRange(doc, position, manager);
	if (spacedResult) {
		return spacedResult;
	}

	// Fall back to single-word regex matching
	const wordRange = doc.getWordRangeAtPosition(position, IDENTIFIER_PATTERN);
	if (!wordRange) {
		return undefined;
	}

	const word = doc.getText(wordRange);
	const { symbolTable } = manager.get(doc);
	return { word, wordRange, symbolTable };
}
