import {
	type CancellationToken,
	type DocumentFormattingEditProvider,
	type FormattingOptions,
	Range,
	type TextDocument,
	TextEdit,
	workspace,
} from "vscode";
import { tokenize } from "./tokenizer.ts";
import type { AbnfToken } from "./types.ts";
import { AbnfTokenKind } from "./types.ts";

interface RuleBlock {
	kind: "rule";
	name: string;
	operator: "=" | "=/";
	bodyTokens: AbnfToken[];
	trailingComment: AbnfToken | null;
}

interface StandaloneComment {
	kind: "comment";
	text: string;
}

type DocumentItem = RuleBlock | StandaloneComment;

export class AbnfFormattingProvider implements DocumentFormattingEditProvider {
	provideDocumentFormattingEdits(
		document: TextDocument,
		_options: FormattingOptions,
		_token: CancellationToken,
	): TextEdit[] {
		const text = document.getText();
		if (text.trim().length === 0) {
			return [];
		}

		const config = workspace.getConfiguration("abnf");
		const alignEquals = config.get<boolean>("formatting.alignEquals", true);
		const continuationIndent = config.get<number>(
			"formatting.continuationIndent",
			4,
		);
		const alternativeIndent = config.get<string>(
			"formatting.alternativeIndent",
			"align",
		);
		const insertFinalNewline = config.get<boolean>(
			"formatting.insertFinalNewline",
			true,
		);

		const tokens = tokenize(text);
		const items = parseDocumentItems(tokens);
		const formatted = formatItems(
			items,
			alignEquals,
			continuationIndent,
			alternativeIndent,
		);

		const result =
			insertFinalNewline && !formatted.endsWith("\n")
				? `${formatted}\n`
				: formatted;

		const fullRange = new Range(
			document.positionAt(0),
			document.positionAt(text.length),
		);

		return [TextEdit.replace(fullRange, result)];
	}
}

interface RuleBodyCollection {
	bodyTokens: AbnfToken[];
	trailingComment: AbnfToken | null;
	nextIndex: number;
}

function isNextLineRuleStart(
	tokens: AbnfToken[],
	afterNewlineIndex: number,
): boolean {
	const wsEnd = skipWhitespace(tokens, afterNewlineIndex);
	if (
		wsEnd < tokens.length &&
		tokens[wsEnd]?.kind === AbnfTokenKind.Rulename &&
		tokens[wsEnd]?.column === 0
	) {
		const afterName = skipWhitespace(tokens, wsEnd + 1);
		if (
			afterName < tokens.length &&
			(tokens[afterName]?.kind === AbnfTokenKind.DefinedAs ||
				tokens[afterName]?.kind === AbnfTokenKind.IncrementalAs)
		) {
			return true;
		}
	}
	return false;
}

function collectRuleBody(
	tokens: AbnfToken[],
	startIndex: number,
): RuleBodyCollection {
	const bodyTokens: AbnfToken[] = [];
	let trailingComment: AbnfToken | null = null;
	let i = startIndex;

	while (i < tokens.length) {
		const cur = tokens[i];
		if (cur === undefined) {
			break;
		}

		if (cur.kind === AbnfTokenKind.Comment) {
			trailingComment = cur;
			i++;
			i = consumeNewline(tokens, i);
			break;
		}

		if (cur.kind === AbnfTokenKind.Newline) {
			i++;
			const savedI = i;
			if (isNextLineRuleStart(tokens, i)) {
				i = savedI;
				break;
			}
			bodyTokens.push(cur);
			continue;
		}

		bodyTokens.push(cur);
		i++;
	}

	return { bodyTokens, trailingComment, nextIndex: i };
}

interface ParseRuleResult {
	item: DocumentItem;
	nextIndex: number;
}

function parseRuleDefinition(
	tokens: AbnfToken[],
	ruleStart: number,
	ruleName: string,
): ParseRuleResult {
	let i = ruleStart + 1; // skip rulename token
	i = skipWhitespace(tokens, i);

	if (i >= tokens.length) {
		return { item: { kind: "comment", text: ruleName }, nextIndex: i };
	}

	const opTok = tokens[i];
	if (opTok === undefined) {
		return { item: { kind: "comment", text: ruleName }, nextIndex: i };
	}

	if (
		opTok.kind !== AbnfTokenKind.DefinedAs &&
		opTok.kind !== AbnfTokenKind.IncrementalAs
	) {
		const lineText = collectLineText(tokens, ruleStart);
		return {
			item: { kind: "comment", text: lineText.text },
			nextIndex: lineText.nextIndex,
		};
	}

	const operator: "=" | "=/" =
		opTok.kind === AbnfTokenKind.IncrementalAs ? "=/" : "=";
	i++;

	const collected = collectRuleBody(tokens, i);
	return {
		item: {
			kind: "rule",
			name: ruleName,
			operator,
			bodyTokens: collected.bodyTokens,
			trailingComment: collected.trailingComment,
		},
		nextIndex: collected.nextIndex,
	};
}

function parseDocumentItems(tokens: AbnfToken[]): DocumentItem[] {
	const items: DocumentItem[] = [];
	let i = 0;

	while (i < tokens.length) {
		i = skipBlankLines(tokens, i);
		if (i >= tokens.length) {
			break;
		}

		const tok = tokens[i];
		if (tok === undefined) {
			break;
		}

		if (tok.kind === AbnfTokenKind.Comment) {
			items.push({ kind: "comment", text: tok.text });
			i++;
			i = consumeNewline(tokens, i);
			continue;
		}

		if (tok.kind === AbnfTokenKind.Rulename) {
			const result = parseRuleDefinition(tokens, i, tok.text);
			items.push(result.item);
			i = result.nextIndex;
			continue;
		}

		// Skip unknown or whitespace tokens at top level
		i++;
	}

	return items;
}

function skipWhitespace(tokens: AbnfToken[], start: number): number {
	let pos = start;
	while (
		pos < tokens.length &&
		tokens[pos]?.kind === AbnfTokenKind.Whitespace
	) {
		pos++;
	}
	return pos;
}

function skipBlankLines(tokens: AbnfToken[], start: number): number {
	let pos = start;
	while (pos < tokens.length) {
		const tok = tokens[pos];
		if (tok === undefined) {
			break;
		}
		if (tok.kind === AbnfTokenKind.Newline) {
			pos++;
			continue;
		}
		if (tok.kind === AbnfTokenKind.Whitespace) {
			// Check if the rest of this "line" is blank
			pos++;
			continue;
		}
		break;
	}
	return pos;
}

function consumeNewline(tokens: AbnfToken[], start: number): number {
	if (start < tokens.length && tokens[start]?.kind === AbnfTokenKind.Newline) {
		return start + 1;
	}
	return start;
}

interface LineCollectionResult {
	text: string;
	nextIndex: number;
}

function collectLineText(
	tokens: AbnfToken[],
	start: number,
): LineCollectionResult {
	let text = "";
	let i = start;
	while (i < tokens.length) {
		const t = tokens[i];
		if (t === undefined || t.kind === AbnfTokenKind.Newline) {
			break;
		}
		text += t.text;
		i++;
	}
	if (i < tokens.length && tokens[i]?.kind === AbnfTokenKind.Newline) {
		i++;
	}
	return { text, nextIndex: i };
}

function formatItems(
	items: DocumentItem[],
	alignEquals: boolean,
	continuationIndent: number,
	alternativeIndent: string,
): string {
	const groups = groupConsecutiveRules(items);
	const outputParts: string[] = [];

	for (const group of groups) {
		const groupLines = formatGroup(
			group,
			alignEquals,
			continuationIndent,
			alternativeIndent,
		);
		outputParts.push(groupLines);
	}

	return outputParts.join("\n");
}

type DocumentGroup = DocumentItem[];

function groupConsecutiveRules(items: DocumentItem[]): DocumentGroup[] {
	const groups: DocumentGroup[] = [];
	let currentGroup: DocumentGroup = [];

	for (const item of items) {
		if (item.kind === "comment") {
			if (currentGroup.length > 0) {
				groups.push(currentGroup);
				currentGroup = [];
			}
			groups.push([item]);
		} else {
			currentGroup.push(item);
		}
	}

	if (currentGroup.length > 0) {
		groups.push(currentGroup);
	}

	return groups;
}

function formatGroup(
	group: DocumentGroup,
	alignEquals: boolean,
	continuationIndent: number,
	alternativeIndent: string,
): string {
	const lines: string[] = [];

	const first = group[0];
	if (group.length === 1 && first?.kind === "comment") {
		lines.push(first.text);
		return lines.join("\n");
	}

	const ruleBlocks = group.filter(
		(item): item is RuleBlock => item.kind !== "comment",
	);

	let nameWidth = 0;
	if (alignEquals) {
		for (const rule of ruleBlocks) {
			if (rule.name.length > nameWidth) {
				nameWidth = rule.name.length;
			}
		}
	}

	for (let i = 0; i < ruleBlocks.length; i++) {
		const rule = ruleBlocks[i];
		if (rule === undefined) {
			continue;
		}
		const ruleText = formatRule(
			rule,
			nameWidth,
			alignEquals,
			continuationIndent,
			alternativeIndent,
		);
		if (i > 0) {
			lines.push("");
		}
		lines.push(ruleText);
	}

	return lines.join("\n");
}

function formatRule(
	rule: RuleBlock,
	nameWidth: number,
	alignEquals: boolean,
	continuationIndent: number,
	alternativeIndent: string,
): string {
	const paddedName = alignEquals ? rule.name.padEnd(nameWidth) : rule.name;

	const definitionPrefix = `${paddedName} ${rule.operator} `;
	const bodyIndent =
		alternativeIndent === "align"
			? " ".repeat(paddedName.length + 1 + rule.operator.length + 1)
			: " ".repeat(continuationIndent);

	const bodyTokens = rule.bodyTokens.filter(
		(t) =>
			t.kind !== AbnfTokenKind.Whitespace && t.kind !== AbnfTokenKind.Newline,
	);

	if (bodyTokens.length === 0) {
		const header = `${definitionPrefix.trimEnd()}`;
		if (rule.trailingComment) {
			return `${header}  ${rule.trailingComment.text}`;
		}
		return header;
	}

	const formattedBody = buildBody(
		bodyTokens,
		bodyIndent,
		continuationIndent,
		alternativeIndent,
		definitionPrefix.length,
	);

	const firstLine = `${definitionPrefix}${formattedBody.firstLine}`;
	const continuationLines = formattedBody.continuationLines;

	const allLines = [firstLine, ...continuationLines];

	if (rule.trailingComment) {
		allLines[0] = `${allLines[0]}  ${rule.trailingComment.text}`;
	}

	return allLines.join("\n");
}

interface BodyResult {
	firstLine: string;
	continuationLines: string[];
}

function needsSpaceBefore(
	current: string,
	bodyIndent: string,
	tok: AbnfToken,
	prev: AbnfToken | null,
): boolean {
	return (
		current !== "" &&
		current !== `${bodyIndent}/ ` &&
		!current.endsWith("(") &&
		!current.endsWith("[") &&
		tok.kind !== AbnfTokenKind.ParenClose &&
		tok.kind !== AbnfTokenKind.BracketClose &&
		!isRepetitionPrefix(tok, prev)
	);
}

function updateDepth(depth: number, tok: AbnfToken): number {
	if (
		tok.kind === AbnfTokenKind.ParenOpen ||
		tok.kind === AbnfTokenKind.BracketOpen
	) {
		return depth + 1;
	}
	if (
		tok.kind === AbnfTokenKind.ParenClose ||
		tok.kind === AbnfTokenKind.BracketClose
	) {
		return depth - 1;
	}
	return depth;
}

function buildBody(
	tokens: AbnfToken[],
	bodyIndent: string,
	_continuationIndent: number,
	_alternativeIndent: string,
	_definitionPrefixLength: number,
): BodyResult {
	const lines: string[] = [];
	let current = "";
	let depth = 0;

	for (let i = 0; i < tokens.length; i++) {
		const tok = tokens[i];
		if (tok === undefined) {
			break;
		}
		const prev = i > 0 ? (tokens[i - 1] ?? null) : null;

		if (tok.kind === AbnfTokenKind.Alternation && depth === 0) {
			lines.push(current);
			current = `${bodyIndent}/ `;
			continue;
		}

		if (needsSpaceBefore(current, bodyIndent, tok, prev)) {
			current += " ";
		}

		depth = updateDepth(depth, tok);

		current += tok.text;
	}

	lines.push(current);

	return {
		firstLine: lines[0] ?? "",
		continuationLines: lines.slice(1),
	};
}

function isRepetitionPrefix(tok: AbnfToken, prev: AbnfToken | null): boolean {
	if (prev === null) {
		return false;
	}
	// If previous token was Integer or Asterisk, current token might be the element - no space needed
	// Pattern: [Integer] [Asterisk] [Integer] Element
	// We want no space between repetition prefix tokens and between prefix and element
	if (
		(prev.kind === AbnfTokenKind.Asterisk ||
			prev.kind === AbnfTokenKind.Integer) &&
		(tok.kind === AbnfTokenKind.Rulename ||
			tok.kind === AbnfTokenKind.String ||
			tok.kind === AbnfTokenKind.CaseSensitiveString ||
			tok.kind === AbnfTokenKind.CaseInsensitiveString ||
			tok.kind === AbnfTokenKind.NumericValue ||
			tok.kind === AbnfTokenKind.ProseValue ||
			tok.kind === AbnfTokenKind.ParenOpen ||
			tok.kind === AbnfTokenKind.BracketOpen)
	) {
		return true;
	}
	if (
		prev.kind === AbnfTokenKind.Integer &&
		tok.kind === AbnfTokenKind.Asterisk
	) {
		return true;
	}
	if (
		prev.kind === AbnfTokenKind.Asterisk &&
		tok.kind === AbnfTokenKind.Integer
	) {
		return true;
	}
	return false;
}
