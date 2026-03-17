import {
	type Disposable,
	type FileSystemWatcher,
	type Uri,
	workspace,
} from "vscode";
import { buildAbnfSymbolTable, parseAbnf } from "./abnf/parser.ts";
import type { GrammarDocument, Rule, SymbolTable } from "./types.ts";

interface IndexedFile {
	uri: Uri;
	rules: Rule[];
	symbolTable: SymbolTable;
}

export interface IndexedRule {
	uri: Uri;
	rule: Rule;
}

export class WorkspaceIndex implements Disposable {
	private index = new Map<string, IndexedRule[]>();
	private fileToNames = new Map<string, Set<string>>();
	private fileData = new Map<string, IndexedFile>();
	private watcher: FileSystemWatcher | undefined;

	async initialize(): Promise<void> {
		const files = await workspace.findFiles("**/*.abnf");
		await Promise.all(files.map((uri) => this.indexFile(uri)));

		this.watcher = workspace.createFileSystemWatcher("**/*.abnf");
		this.watcher.onDidCreate((uri) => this.indexFile(uri));
		this.watcher.onDidChange((uri) => this.reindexFile(uri));
		this.watcher.onDidDelete((uri) => this.removeFile(uri));
	}

	private async indexFile(uri: Uri): Promise<void> {
		try {
			const content = await workspace.fs.readFile(uri);
			const text = new TextDecoder().decode(content);

			const doc: GrammarDocument = parseAbnf(text);
			const symbolTable = buildAbnfSymbolTable(doc);

			const uriStr = uri.toString();
			const names = new Set<string>();

			for (const rule of doc.rules) {
				const key = rule.name.toLowerCase();
				names.add(key);
				const existing = this.index.get(key) ?? [];
				existing.push({ uri, rule });
				this.index.set(key, existing);
			}

			this.fileToNames.set(uriStr, names);
			this.fileData.set(uriStr, { uri, rules: doc.rules, symbolTable });
		} catch {
			// File might not exist or be readable
		}
	}

	private async reindexFile(uri: Uri): Promise<void> {
		this.removeFile(uri);
		await this.indexFile(uri);
	}

	private removeFile(uri: Uri): void {
		const uriStr = uri.toString();
		const names = this.fileToNames.get(uriStr);
		if (names) {
			for (const name of names) {
				const entries = this.index.get(name);
				if (entries) {
					const filtered = entries.filter((e) => e.uri.toString() !== uriStr);
					if (filtered.length > 0) {
						this.index.set(name, filtered);
					} else {
						this.index.delete(name);
					}
				}
			}
			this.fileToNames.delete(uriStr);
		}
		this.fileData.delete(uriStr);
	}

	findDefinitions(name: string): IndexedRule[] {
		return this.index.get(name) ?? [];
	}

	getFileData(uriStr: string): IndexedFile | undefined {
		return this.fileData.get(uriStr);
	}

	getAllFiles(): IndexedFile[] {
		return Array.from(this.fileData.values());
	}

	searchSymbols(query: string): IndexedRule[] {
		const results: IndexedRule[] = [];
		const lowerQuery = query.toLowerCase();
		for (const [name, entries] of this.index) {
			if (name.toLowerCase().includes(lowerQuery)) {
				results.push(...entries);
			}
		}
		return results;
	}

	dispose(): void {
		this.watcher?.dispose();
	}
}
