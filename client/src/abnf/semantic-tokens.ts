import {
	type CancellationToken,
	type DocumentSemanticTokensProvider,
	Range,
	type SemanticTokens,
	SemanticTokensBuilder,
	SemanticTokensLegend,
	type TextDocument,
} from "vscode";
import type { DocumentManager } from "../document-manager.ts";
import type { SymbolTable } from "../types.ts";
import { CORE_RULE_NAMES } from "./core-rules.ts";
import { tokenize } from "./tokenizer.ts";
import type { AbnfToken } from "./types.ts";
import { AbnfTokenKind } from "./types.ts";

const TOKEN_TYPES = [
	"type",
	"parameter",
	"variable",
	"string",
	"comment",
	"number",
	"operator",
	"regexp",
] as const;

const TOKEN_MODIFIERS = [
	"declaration",
	"definition",
	"readonly",
	"defaultLibrary",
] as const;

export const ABNF_SEMANTIC_TOKENS_LEGEND = new SemanticTokensLegend(
	[...TOKEN_TYPES],
	[...TOKEN_MODIFIERS],
);

const TOKEN_TYPE_INDEX = {
	type: 0,
	parameter: 1,
	variable: 2,
	string: 3,
	comment: 4,
	number: 5,
	operator: 6,
	regexp: 7,
} as const;

const TOKEN_MODIFIER_INDEX = {
	declaration: 0,
	definition: 1,
	readonly: 2,
	defaultLibrary: 3,
} as const;

type TokenTypeName = keyof typeof TOKEN_TYPE_INDEX;
type TokenModifierName = keyof typeof TOKEN_MODIFIER_INDEX;

interface TokenClassification {
	typeName: TokenTypeName;
	modifiers: TokenModifierName[];
}

function collectDefinitionIndices(tokens: AbnfToken[]): Set<number> {
	const indices = new Set<number>();
	for (let i = 0; i < tokens.length; i++) {
		const tok = tokens[i];
		if (!tok || tok.kind !== AbnfTokenKind.Rulename || tok.column !== 0) {
			continue;
		}
		let j = i + 1;
		while (j < tokens.length && tokens[j]?.kind === AbnfTokenKind.Whitespace) {
			j++;
		}
		const after = tokens[j];
		if (
			after !== undefined &&
			(after.kind === AbnfTokenKind.DefinedAs ||
				after.kind === AbnfTokenKind.IncrementalAs)
		) {
			indices.add(i);
		}
	}
	return indices;
}

function classifyRulename(
	token: AbnfToken,
	index: number,
	definitionIndices: Set<number>,
	symbolTable: SymbolTable,
): TokenClassification {
	if (definitionIndices.has(index)) {
		return { typeName: "type", modifiers: ["declaration", "definition"] };
	}
	const key = token.text.toLowerCase();
	if (CORE_RULE_NAMES.has(key)) {
		return { typeName: "variable", modifiers: ["readonly", "defaultLibrary"] };
	}
	if (symbolTable.definitions.has(key)) {
		return { typeName: "parameter", modifiers: [] };
	}
	return { typeName: "type", modifiers: [] };
}

function classifyToken(
	token: AbnfToken,
	index: number,
	definitionIndices: Set<number>,
	symbolTable: SymbolTable,
): TokenClassification | null {
	switch (token.kind) {
		case AbnfTokenKind.Rulename:
			return classifyRulename(token, index, definitionIndices, symbolTable);
		case AbnfTokenKind.String:
		case AbnfTokenKind.CaseSensitiveString:
		case AbnfTokenKind.CaseInsensitiveString:
			return { typeName: "string", modifiers: [] };
		case AbnfTokenKind.NumericValue:
		case AbnfTokenKind.Integer:
			return { typeName: "number", modifiers: [] };
		case AbnfTokenKind.Comment:
			return { typeName: "comment", modifiers: [] };
		case AbnfTokenKind.ProseValue:
			return { typeName: "regexp", modifiers: ["readonly"] };
		default:
			if (isOperatorKind(token.kind)) {
				return { typeName: "operator", modifiers: [] };
			}
			return null;
	}
}

function isOperatorKind(kind: AbnfTokenKind): boolean {
	return (
		kind === AbnfTokenKind.DefinedAs ||
		kind === AbnfTokenKind.IncrementalAs ||
		kind === AbnfTokenKind.Alternation ||
		kind === AbnfTokenKind.Asterisk
	);
}

export class AbnfSemanticTokensProvider
	implements DocumentSemanticTokensProvider
{
	private readonly manager: DocumentManager;
	constructor(manager: DocumentManager) {
		this.manager = manager;
	}

	provideDocumentSemanticTokens(
		doc: TextDocument,
		_token: CancellationToken,
	): SemanticTokens {
		const { symbolTable } = this.manager.get(doc);
		const builder = new SemanticTokensBuilder(ABNF_SEMANTIC_TOKENS_LEGEND);
		const tokens = tokenize(doc.getText());
		const definitionTokenIndices = collectDefinitionIndices(tokens);

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			if (token === undefined) {
				continue;
			}

			if (
				token.kind === AbnfTokenKind.Whitespace ||
				token.kind === AbnfTokenKind.Newline
			) {
				continue;
			}

			const classified = classifyToken(
				token,
				i,
				definitionTokenIndices,
				symbolTable,
			);
			if (classified === null) {
				continue;
			}

			const range = new Range(
				token.line,
				token.column,
				token.line,
				token.column + token.text.length,
			);
			builder.push(range, classified.typeName, classified.modifiers);
		}

		return builder.build();
	}
}
