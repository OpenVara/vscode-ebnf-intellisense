import type { Disposable, TextDocument } from "vscode";
import { buildSymbolTable, parse } from "./parser";
import type { EbnfDocument, SymbolTable } from "./types";

interface CachedParse {
	version: number;
	document: EbnfDocument;
	symbolTable: SymbolTable;
}

export class DocumentManager implements Disposable {
	private cache = new Map<string, CachedParse>();
	private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

	get(doc: TextDocument): { document: EbnfDocument; symbolTable: SymbolTable } {
		const uri = doc.uri.toString();
		const cached = this.cache.get(uri);

		if (cached && cached.version === doc.version) {
			return { document: cached.document, symbolTable: cached.symbolTable };
		}

		const parsed = parse(doc.getText());
		const symbolTable = buildSymbolTable(parsed);

		this.cache.set(uri, {
			version: doc.version,
			document: parsed,
			symbolTable,
		});

		return { document: parsed, symbolTable };
	}

	scheduleReparse(doc: TextDocument, callback: (doc: TextDocument) => void): void {
		const uri = doc.uri.toString();
		const existing = this.debounceTimers.get(uri);
		if (existing) {
			clearTimeout(existing);
		}
		this.debounceTimers.set(
			uri,
			setTimeout(() => {
				this.debounceTimers.delete(uri);
				callback(doc);
			}, 200),
		);
	}

	remove(uri: string): void {
		this.cache.delete(uri);
		const timer = this.debounceTimers.get(uri);
		if (timer) {
			clearTimeout(timer);
			this.debounceTimers.delete(uri);
		}
	}

	dispose(): void {
		for (const timer of this.debounceTimers.values()) {
			clearTimeout(timer);
		}
		this.debounceTimers.clear();
		this.cache.clear();
	}
}
