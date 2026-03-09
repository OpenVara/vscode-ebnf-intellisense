import {
	type ExtensionContext,
	type TextDocument,
	languages,
	workspace,
} from "vscode";
import { DocumentManager } from "./document-manager";
import { EbnfCompletionProvider } from "./providers/completion";
import { EbnfDefinitionProvider } from "./providers/definition";
import { updateDiagnostics } from "./providers/diagnostics";
import { EbnfDocumentHighlightProvider } from "./providers/highlighting";
import { EbnfHoverProvider } from "./providers/hover";
import { EbnfReferenceProvider } from "./providers/references";
import { EbnfRenameProvider } from "./providers/rename";
import { EbnfDocumentSymbolProvider } from "./providers/symbols";

const SELECTOR = { language: "ebnf" };

export function activate(context: ExtensionContext): void {
	const manager = new DocumentManager();
	const diagnosticCollection = languages.createDiagnosticCollection("ebnf");

	context.subscriptions.push(
		manager,
		languages.registerDocumentSymbolProvider(SELECTOR, new EbnfDocumentSymbolProvider(manager)),
		languages.registerDefinitionProvider(SELECTOR, new EbnfDefinitionProvider(manager)),
		languages.registerReferenceProvider(SELECTOR, new EbnfReferenceProvider(manager)),
		languages.registerHoverProvider(SELECTOR, new EbnfHoverProvider(manager)),
		languages.registerCompletionItemProvider(SELECTOR, new EbnfCompletionProvider(manager)),
		languages.registerRenameProvider(SELECTOR, new EbnfRenameProvider(manager)),
		languages.registerDocumentHighlightProvider(SELECTOR, new EbnfDocumentHighlightProvider(manager)),
		diagnosticCollection,
	);

	function updateDocumentDiagnostics(doc: TextDocument): void {
		if (doc.languageId !== "ebnf") {
			return;
		}
		const config = workspace.getConfiguration("ebnf");
		if (config.get<boolean>("diagnostics.enable", true)) {
			updateDiagnostics(doc, manager, diagnosticCollection);
		} else {
			diagnosticCollection.delete(doc.uri);
		}
	}

	context.subscriptions.push(
		workspace.onDidOpenTextDocument((doc) => {
			updateDocumentDiagnostics(doc);
		}),
		workspace.onDidChangeTextDocument((event) => {
			manager.scheduleReparse(event.document, updateDocumentDiagnostics);
		}),
		workspace.onDidCloseTextDocument((doc) => {
			const uri = doc.uri.toString();
			manager.remove(uri);
			diagnosticCollection.delete(doc.uri);
		}),
	);

	for (const doc of workspace.textDocuments) {
		updateDocumentDiagnostics(doc);
	}
}

export function deactivate(): void {}
