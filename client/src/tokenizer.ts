import { type Position, Range } from "vscode";

export const enum TokenKind {
	Identifier,
	Integer,
	StringSingle,
	StringDouble,
	SpecialSequence,
	Comment,
	Equals,
	Semicolon,
	Pipe,
	Comma,
	Minus,
	Asterisk,
	ParenOpen,
	ParenClose,
	BracketOpen,
	BracketClose,
	BraceOpen,
	BraceClose,
	Whitespace,
	Unknown,
}

export interface Token {
	kind: TokenKind;
	text: string;
	range: Range;
}

function pos(line: number, character: number): Position {
	return { line, character } as Position;
}

function isWhitespace(ch: string): boolean {
	return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function isAlpha(ch: string): boolean {
	return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
}

function isDigit(ch: string): boolean {
	return ch >= "0" && ch <= "9";
}

function isAlphaNumOrHyphen(ch: string): boolean {
	return isAlpha(ch) || isDigit(ch) || ch === "-";
}

const OPERATOR_KINDS: Record<string, TokenKind> = {
	"=": TokenKind.Equals,
	";": TokenKind.Semicolon,
	"|": TokenKind.Pipe,
	",": TokenKind.Comma,
	"-": TokenKind.Minus,
	"*": TokenKind.Asterisk,
	"(": TokenKind.ParenOpen,
	")": TokenKind.ParenClose,
	"[": TokenKind.BracketOpen,
	"]": TokenKind.BracketClose,
	"{": TokenKind.BraceOpen,
	"}": TokenKind.BraceClose,
};

export function tokenize(text: string): Token[] {
	const tokens: Token[] = [];
	let line = 0;
	let column = 0;
	let i = 0;

	function advance(): void {
		if (text.charAt(i) === "\n") {
			line++;
			column = 0;
		} else {
			column++;
		}
		i++;
	}

	function currentPos(): Position {
		return pos(line, column);
	}

	function currentChar(): string {
		return text.charAt(i);
	}

	function peekChar(): string {
		return text.charAt(i + 1);
	}

	while (i < text.length) {
		const start = currentPos();
		const tokenStart = i;

		if (currentChar() === "(" && peekChar() === "*") {
			let depth = 1;
			advance();
			advance();
			while (i < text.length && depth > 0) {
				if (currentChar() === "(" && peekChar() === "*") {
					depth++;
					advance();
					advance();
				} else if (currentChar() === "*" && peekChar() === ")") {
					depth--;
					advance();
					advance();
				} else {
					advance();
				}
			}
			tokens.push({
				kind: TokenKind.Comment,
				text: text.slice(tokenStart, i),
				range: new Range(start, currentPos()),
			});
			continue;
		}

		if (currentChar() === "'") {
			advance();
			while (i < text.length && currentChar() !== "'") {
				if (currentChar() === "\n") {
					break;
				}
				advance();
			}
			if (i < text.length && currentChar() === "'") {
				advance();
			}
			tokens.push({
				kind: TokenKind.StringSingle,
				text: text.slice(tokenStart, i),
				range: new Range(start, currentPos()),
			});
			continue;
		}

		if (currentChar() === '"') {
			advance();
			while (i < text.length && currentChar() !== '"') {
				if (currentChar() === "\n") {
					break;
				}
				advance();
			}
			if (i < text.length && currentChar() === '"') {
				advance();
			}
			tokens.push({
				kind: TokenKind.StringDouble,
				text: text.slice(tokenStart, i),
				range: new Range(start, currentPos()),
			});
			continue;
		}

		if (currentChar() === "?") {
			advance();
			while (i < text.length && currentChar() !== "?") {
				advance();
			}
			if (i < text.length && currentChar() === "?") {
				advance();
			}
			tokens.push({
				kind: TokenKind.SpecialSequence,
				text: text.slice(tokenStart, i),
				range: new Range(start, currentPos()),
			});
			continue;
		}

		if (isWhitespace(currentChar())) {
			while (i < text.length && isWhitespace(currentChar())) {
				advance();
			}
			tokens.push({
				kind: TokenKind.Whitespace,
				text: text.slice(tokenStart, i),
				range: new Range(start, currentPos()),
			});
			continue;
		}

		if (isAlpha(currentChar())) {
			while (i < text.length && isAlphaNumOrHyphen(currentChar())) {
				advance();
			}
			tokens.push({
				kind: TokenKind.Identifier,
				text: text.slice(tokenStart, i),
				range: new Range(start, currentPos()),
			});
			continue;
		}

		if (isDigit(currentChar())) {
			while (i < text.length && isDigit(currentChar())) {
				advance();
			}
			tokens.push({
				kind: TokenKind.Integer,
				text: text.slice(tokenStart, i),
				range: new Range(start, currentPos()),
			});
			continue;
		}

		const c = currentChar();
		const kind = OPERATOR_KINDS[c] ?? TokenKind.Unknown;
		advance();
		tokens.push({
			kind,
			text: c,
			range: new Range(start, currentPos()),
		});
	}

	return tokens;
}
