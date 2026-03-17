import type { Diagnostic, Range } from "vscode";

export interface IdentifierReference {
	name: string;
	range: Range;
}

export interface Rule {
	name: string;
	nameRange: Range;
	definitionRange: Range;
	definitionText: string;
	precedingComment?: string | undefined;
	references: IdentifierReference[];
	isIncremental?: boolean;
	isCoreRule?: boolean;
}

export interface GrammarDocument {
	rules: Rule[];
	diagnostics: Diagnostic[];
}

export interface SymbolTable {
	definitions: Map<string, Rule[]>;
	references: Map<string, IdentifierReference[]>;
}
