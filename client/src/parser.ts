import { type Diagnostic, DiagnosticSeverity, Range } from "vscode";
import type { Token } from "./tokenizer";
import { TokenKind, tokenize } from "./tokenizer";
import type { EbnfDocument, IdentifierReference, Rule, SymbolTable } from "./types";

export const DIAGNOSTIC_SOURCE = "ebnf";

export interface ParseOptions {
	spacedIdentifiers?: boolean;
}

interface BracketEntry {
	kind: TokenKind;
	token: Token;
}

const BRACKET_OPEN_KINDS = new Set([
	TokenKind.ParenOpen,
	TokenKind.BracketOpen,
	TokenKind.BraceOpen,
]);

const BRACKET_CLOSE_KINDS = new Set([
	TokenKind.ParenClose,
	TokenKind.BracketClose,
	TokenKind.BraceClose,
]);

const BRACKET_PAIRS: Record<number, TokenKind> = {
	[TokenKind.ParenOpen]: TokenKind.ParenClose,
	[TokenKind.BracketOpen]: TokenKind.BracketClose,
	[TokenKind.BraceOpen]: TokenKind.BraceClose,
};

const BRACKET_NAMES: Record<number, string> = {
	[TokenKind.ParenOpen]: "(",
	[TokenKind.ParenClose]: ")",
	[TokenKind.BracketOpen]: "[",
	[TokenKind.BracketClose]: "]",
	[TokenKind.BraceOpen]: "{",
	[TokenKind.BraceClose]: "}",
};

function expectedClosingName(openKind: TokenKind): string {
	const closeKind = BRACKET_PAIRS[openKind];
	return closeKind !== undefined ? BRACKET_NAMES[closeKind] ?? "?" : "?";
}

function openKindForClose(closeKind: TokenKind): TokenKind | undefined {
	for (const [open, close] of Object.entries(BRACKET_PAIRS)) {
		if (close === closeKind) {
			return Number(open) as TokenKind;
		}
	}
	return undefined;
}

/**
 * Normalize a spaced identifier by collapsing internal whitespace to single spaces.
 * ISO 14977 §6.2: spaces within identifiers are not significant.
 */
function normalizeSpacedName(name: string): string {
	return name.replace(/\s+/g, " ").trim();
}

/**
 * Pass 1: Collect rule names for spaced identifier mode.
 * Looks for patterns like: IDENTIFIER (WHITESPACE IDENTIFIER)* WHITESPACE? EQUALS
 */
function collectRuleNames(tokens: Token[]): Set<string> {
	const names = new Set<string>();
	let i = 0;

	while (i < tokens.length) {
		const token = tokens[i]!;

		if (token.kind === TokenKind.Identifier) {
			// Collect consecutive identifiers (with whitespace between)
			const identifiers: Token[] = [token];
			let j = i + 1;

			while (j < tokens.length) {
				const t = tokens[j]!;
				if (t.kind === TokenKind.Whitespace) {
					j++;
					continue;
				}
				if (t.kind === TokenKind.Identifier) {
					identifiers.push(t);
					j++;
					continue;
				}
				break;
			}

			// Check if followed by equals
			while (j < tokens.length && tokens[j]!.kind === TokenKind.Whitespace) {
				j++;
			}

			if (j < tokens.length && tokens[j]!.kind === TokenKind.Equals) {
				// This is a rule definition
				const fullName = identifiers.map((id) => id.text).join(" ");
				names.add(normalizeSpacedName(fullName));
				i = j + 1;
				continue;
			}
		}

		i++;
	}

	return names;
}

interface ParsedRuleBody {
	references: IdentifierReference[];
	bodyTokens: Token[];
	bracketDiagnostics: Diagnostic[];
	semicolonToken: Token | undefined;
	nextTokenIndex: number;
}

/**
 * Parse a rule body starting after the equals sign.
 * Collects references, body tokens, and validates bracket matching.
 */
function parseRuleBody(
	tokens: Token[],
	startIndex: number,
	options: ParseOptions,
	knownNames: Set<string>,
): ParsedRuleBody {
	const references: IdentifierReference[] = [];
	const bodyTokens: Token[] = [];
	const bracketDiagnostics: Diagnostic[] = [];
	const bracketStack: BracketEntry[] = [];

	let tokenIndex = startIndex;
	const tokenCount = tokens.length;

	function nextNonWhitespace(): Token | undefined {
		while (tokenIndex < tokenCount) {
			const t = tokens[tokenIndex]!;
			if (t.kind !== TokenKind.Whitespace) {
				return t;
			}
			tokenIndex++;
		}
		return undefined;
	}

	let bodyToken = nextNonWhitespace();

	while (bodyToken && bodyToken.kind !== TokenKind.Semicolon) {
		if (bodyToken.kind !== TokenKind.Comment) {
			bodyTokens.push(bodyToken);
		}

		// Try to match longest known multi-word name
		if (bodyToken.kind === TokenKind.Identifier && options.spacedIdentifiers) {
			const match = matchLongestKnownName(tokens, tokenIndex, knownNames);
			if (match && match.consumed > 1) {
				references.push({
					name: match.name,
					range: new Range(bodyToken.range.start, match.endRange.end),
				});
				tokenIndex += match.consumed;
				bodyToken = nextNonWhitespace();
				continue;
			}
		}

		if (bodyToken.kind === TokenKind.Identifier) {
			references.push({ name: bodyToken.text, range: bodyToken.range });
		}

		if (BRACKET_OPEN_KINDS.has(bodyToken.kind)) {
			bracketStack.push({ kind: bodyToken.kind, token: bodyToken });
		} else if (BRACKET_CLOSE_KINDS.has(bodyToken.kind)) {
			const expectedOpen = openKindForClose(bodyToken.kind);
			if (bracketStack.length === 0) {
				bracketDiagnostics.push({
					message: `Unexpected "${BRACKET_NAMES[bodyToken.kind]}" without matching opening bracket`,
					range: bodyToken.range,
					severity: DiagnosticSeverity.Error,
					source: DIAGNOSTIC_SOURCE,
				});
			} else {
				const top = bracketStack[bracketStack.length - 1]!;
				if (expectedOpen === top.kind) {
					bracketStack.pop();
				} else {
					bracketDiagnostics.push({
						message: `Mismatched bracket: expected "${expectedClosingName(top.kind)}" but found "${BRACKET_NAMES[bodyToken.kind]}"`,
						range: bodyToken.range,
						severity: DiagnosticSeverity.Error,
						source: DIAGNOSTIC_SOURCE,
					});
					bracketStack.pop();
				}
			}
		}

		tokenIndex++;
		bodyToken = nextNonWhitespace();
	}

	for (const unclosed of bracketStack) {
		bracketDiagnostics.push({
			message: `Unclosed "${BRACKET_NAMES[unclosed.kind]}" — missing "${expectedClosingName(unclosed.kind)}"`,
			range: unclosed.token.range,
			severity: DiagnosticSeverity.Error,
			source: DIAGNOSTIC_SOURCE,
		});
	}

	const semicolonToken = bodyToken?.kind === TokenKind.Semicolon ? bodyToken : undefined;
	if (semicolonToken) {
		tokenIndex++;
	}

	return {
		references,
		bodyTokens,
		bracketDiagnostics,
		semicolonToken,
		nextTokenIndex: tokenIndex,
	};
}

/**
 * Try to match the longest known rule name starting at the given position.
 * Returns the matched name and number of tokens consumed (including whitespace), or undefined.
 */
function matchLongestKnownName(
	tokens: Token[],
	startIndex: number,
	knownNames: Set<string>,
): { name: string; consumed: number; endRange: Range } | undefined {
	if (startIndex >= tokens.length) {
		return undefined;
	}

	const firstToken = tokens[startIndex]!;
	if (firstToken.kind !== TokenKind.Identifier) {
		return undefined;
	}

	// Collect consecutive identifiers
	const identifiers: Token[] = [firstToken];
	const consumedIndices: number[] = [startIndex];
	let j = startIndex + 1;

	while (j < tokens.length) {
		const t = tokens[j]!;
		if (t.kind === TokenKind.Whitespace) {
			consumedIndices.push(j);
			j++;
			continue;
		}
		if (t.kind === TokenKind.Identifier) {
			identifiers.push(t);
			consumedIndices.push(j);
			j++;
			continue;
		}
		break;
	}

	// Try matching from longest to shortest
	for (let len = identifiers.length; len >= 1; len--) {
		const candidate = identifiers.slice(0, len).map((id) => id.text).join(" ");
		const normalized = normalizeSpacedName(candidate);

		if (knownNames.has(normalized)) {
			// Find how many tokens we consumed up to this identifier
			const lastIdentifier = identifiers[len - 1]!;
			let consumed = 0;
			for (const idx of consumedIndices) {
				if (tokens[idx] === lastIdentifier) {
					consumed = idx - startIndex + 1;
					break;
				}
				if (idx > startIndex && tokens[idx]!.kind === TokenKind.Identifier) {
					const idIndex = identifiers.indexOf(tokens[idx]!);
					if (idIndex >= len) {
						consumed = idx - startIndex;
						break;
					}
				}
			}
			if (consumed === 0) {
				consumed = consumedIndices[consumedIndices.length - 1]! - startIndex + 1;
			}
			// Recalculate: count indices until we've seen len identifiers
			let identsSeen = 0;
			consumed = 0;
			for (const idx of consumedIndices) {
				consumed = idx - startIndex + 1;
				if (tokens[idx]!.kind === TokenKind.Identifier) {
					identsSeen++;
					if (identsSeen === len) {
						break;
					}
				}
			}

			return {
				name: normalized,
				consumed,
				endRange: lastIdentifier.range,
			};
		}
	}

	return undefined;
}

export function parse(text: string, options: ParseOptions = {}): EbnfDocument {
	const { tokens, diagnostics: tokenDiagnostics } = tokenize(text);
	const rules: Rule[] = [];
	const diagnostics: Diagnostic[] = tokenDiagnostics.map((d) => ({
		message: d.message,
		range: d.range,
		severity: DiagnosticSeverity.Error,
		source: DIAGNOSTIC_SOURCE,
	}));

	// Pass 1: Collect rule names if spaced identifiers enabled
	const knownNames = options.spacedIdentifiers ? collectRuleNames(tokens) : new Set<string>();

	let tokenIndex = 0;
	const tokenCount = tokens.length;
	let precedingComment: Token | undefined;

	function nextNonWhitespace(): Token | undefined {
		while (tokenIndex < tokenCount) {
			const t = tokens[tokenIndex]!;
			if (t.kind !== TokenKind.Whitespace) {
				return t;
			}
			tokenIndex++;
		}
		return undefined;
	}

	/**
	 * Try to parse a spaced rule name (multiple identifiers).
	 * Returns the combined name, range, and number of tokens consumed.
	 */
	function tryParseSpacedRuleName(): { name: string; range: Range; nextIndex: number } | undefined {
		if (!options.spacedIdentifiers) {
			return undefined;
		}

		const startIdx = tokenIndex;
		const identifiers: Token[] = [];
		let j = startIdx;

		while (j < tokenCount) {
			const t = tokens[j]!;
			if (t.kind === TokenKind.Whitespace) {
				j++;
				continue;
			}
			if (t.kind === TokenKind.Identifier) {
				identifiers.push(t);
				j++;
				continue;
			}
			break;
		}

		if (identifiers.length < 2) {
			return undefined;
		}

		// Check if followed by equals
		while (j < tokenCount && tokens[j]!.kind === TokenKind.Whitespace) {
			j++;
		}

		if (j >= tokenCount || tokens[j]!.kind !== TokenKind.Equals) {
			return undefined;
		}

		const fullName = identifiers.map((id) => id.text).join(" ");
		const firstId = identifiers[0]!;
		const lastId = identifiers[identifiers.length - 1]!;

		return {
			name: normalizeSpacedName(fullName),
			range: new Range(firstId.range.start, lastId.range.end),
			nextIndex: j, // points to equals
		};
	}

	let token = nextNonWhitespace();
	while (token) {
		if (token.kind === TokenKind.Comment) {
			precedingComment = token;
			tokenIndex++;
			token = nextNonWhitespace();
			continue;
		}

		// Try spaced rule name first
		const spacedName = tryParseSpacedRuleName();
		if (spacedName) {
			const nameText = spacedName.name;
			const nameRange = spacedName.range;
			tokenIndex = spacedName.nextIndex;
			const equalsToken = tokens[tokenIndex]!;
			tokenIndex++;

			// Skip whitespace after equals
			while (tokenIndex < tokenCount && tokens[tokenIndex]!.kind === TokenKind.Whitespace) {
				tokenIndex++;
			}

			const body = parseRuleBody(tokens, tokenIndex, options, knownNames);
			tokenIndex = body.nextTokenIndex;
			diagnostics.push(...body.bracketDiagnostics);

			if (!body.semicolonToken) {
				const lastBodyToken = body.bodyTokens.length > 0 ? body.bodyTokens[body.bodyTokens.length - 1] : undefined;
				diagnostics.push({
					message: `Missing terminator (";" or ".") at end of rule "${nameText}"`,
					range: lastBodyToken?.range ?? nameRange,
					severity: DiagnosticSeverity.Error,
					source: DIAGNOSTIC_SOURCE,
				});
			}

			const lastBodyToken = body.bodyTokens.length > 0 ? body.bodyTokens[body.bodyTokens.length - 1] : undefined;
			const endRange = body.semicolonToken?.range ?? lastBodyToken?.range ?? equalsToken.range;
			const definitionText = body.bodyTokens.map((t) => t.text).join(" ");

			const isPseudoRule =
				body.bodyTokens.length === 1 &&
				body.bodyTokens[0]!.kind === TokenKind.SpecialSequence;

			let commentText: string | undefined;
			if (precedingComment) {
				commentText = precedingComment.text.slice(2, -2).trim();
			}

			rules.push({
				name: nameText,
				nameRange,
				definitionRange: new Range(nameRange.start, endRange.end),
				definitionText,
				isPseudoRule,
				precedingComment: commentText,
				references: body.references,
			});

			precedingComment = undefined;
			token = nextNonWhitespace();
			continue;
		}

		const savedIdx = tokenIndex;
		tokenIndex++;
		const nextToken = nextNonWhitespace();
		tokenIndex = savedIdx;

		if (
			token.kind === TokenKind.Identifier &&
			nextToken !== undefined &&
			nextToken.kind === TokenKind.Equals
		) {
			const nameToken = token;
			const equalsToken = nextToken;

			tokenIndex++;
			nextNonWhitespace(); // skip to equals
			tokenIndex++;

			// Skip whitespace after equals
			while (tokenIndex < tokenCount && tokens[tokenIndex]!.kind === TokenKind.Whitespace) {
				tokenIndex++;
			}

			const body = parseRuleBody(tokens, tokenIndex, options, knownNames);
			tokenIndex = body.nextTokenIndex;
			diagnostics.push(...body.bracketDiagnostics);

			if (!body.semicolonToken) {
				const lastBodyToken = body.bodyTokens.length > 0 ? body.bodyTokens[body.bodyTokens.length - 1] : undefined;
				diagnostics.push({
					message: `Missing terminator (";" or ".") at end of rule "${nameToken.text}"`,
					range: lastBodyToken?.range ?? nameToken.range,
					severity: DiagnosticSeverity.Error,
					source: DIAGNOSTIC_SOURCE,
				});
			}

			const lastBodyToken = body.bodyTokens.length > 0 ? body.bodyTokens[body.bodyTokens.length - 1] : undefined;
			const endRange = body.semicolonToken?.range ?? lastBodyToken?.range ?? equalsToken.range;
			const definitionText = body.bodyTokens.map((t) => t.text).join(" ");

			const isPseudoRule =
				body.bodyTokens.length === 1 &&
				body.bodyTokens[0]!.kind === TokenKind.SpecialSequence;

			let commentText: string | undefined;
			if (precedingComment) {
				commentText = precedingComment.text.slice(2, -2).trim();
			}

			rules.push({
				name: nameToken.text,
				nameRange: nameToken.range,
				definitionRange: new Range(nameToken.range.start, endRange.end),
				definitionText,
				isPseudoRule,
				precedingComment: commentText,
				references: body.references,
			});

			precedingComment = undefined;
			token = nextNonWhitespace();
			continue;
		}

		precedingComment = undefined;
		tokenIndex++;
		token = nextNonWhitespace();
	}

	return { rules, diagnostics };
}

export function buildSymbolTable(doc: EbnfDocument): SymbolTable {
	const definitions = new Map<string, Rule[]>();
	const references = new Map<string, IdentifierReference[]>();

	for (const rule of doc.rules) {
		const existing = definitions.get(rule.name);
		if (existing) {
			existing.push(rule);
		} else {
			definitions.set(rule.name, [rule]);
		}

		for (const ref of rule.references) {
			const existingRefs = references.get(ref.name);
			if (existingRefs) {
				existingRefs.push(ref);
			} else {
				references.set(ref.name, [ref]);
			}
		}
	}

	return { definitions, references };
}
