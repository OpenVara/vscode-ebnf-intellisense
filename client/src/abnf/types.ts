import type { Range } from "vscode";

export enum AbnfTokenKind {
	Rulename = 0,
	DefinedAs = 1,
	IncrementalAs = 2,
	Alternation = 3,
	String = 4,
	CaseSensitiveString = 5,
	CaseInsensitiveString = 6,
	NumericValue = 7,
	ProseValue = 8,
	Comment = 9,
	ParenOpen = 10,
	ParenClose = 11,
	BracketOpen = 12,
	BracketClose = 13,
	Integer = 14,
	Asterisk = 15,
	Whitespace = 16,
	Newline = 17,
	Unknown = 18,
}

export interface AbnfToken {
	kind: AbnfTokenKind;
	text: string;
	offset: number;
	line: number;
	column: number;
}

export type AbnfExpression =
	| AbnfAlternation
	| AbnfConcatenation
	| AbnfRepetition
	| AbnfGroup
	| AbnfOptional
	| AbnfRulename
	| AbnfString
	| AbnfNumeric
	| AbnfProse;

export interface AbnfAlternation {
	kind: "alternation";
	alternatives: AbnfExpression[];
}

export interface AbnfConcatenation {
	kind: "concatenation";
	elements: AbnfExpression[];
}

export interface AbnfRepetition {
	kind: "repetition";
	min: number;
	max: number | null;
	element: AbnfExpression;
}

export interface AbnfGroup {
	kind: "group";
	expression: AbnfExpression;
}

export interface AbnfOptional {
	kind: "optional";
	expression: AbnfExpression;
}

export interface AbnfRulename {
	kind: "rulename";
	name: string;
	range: Range;
}

export interface AbnfString {
	kind: "string";
	value: string;
	caseSensitive: boolean;
}

export interface AbnfNumeric {
	kind: "numeric";
	base: "d" | "x" | "b";
	text: string;
}

export interface AbnfProse {
	kind: "prose";
	text: string;
}
