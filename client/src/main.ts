import {
	type ExtensionContext,
	languages,
	type TextDocument,
	workspace,
} from "vscode";
import { AbnfCodeActionProvider } from "./abnf/code-actions.ts";
import { AbnfCompletionProvider } from "./abnf/completion.ts";
import { updateAbnfDiagnostics } from "./abnf/diagnostics.ts";
import { AbnfFormattingProvider } from "./abnf/formatter.ts";
import {
	ABNF_SEMANTIC_TOKENS_LEGEND,
	AbnfSemanticTokensProvider,
} from "./abnf/semantic-tokens.ts";
import { DocumentManager } from "./document-manager.ts";
import { AbnfDefinitionProvider } from "./providers/definition.ts";
import { AbnfFoldingRangeProvider } from "./providers/folding.ts";
import { AbnfDocumentHighlightProvider } from "./providers/highlighting.ts";
import { AbnfHoverProvider } from "./providers/hover.ts";
import { AbnfInlayHintsProvider } from "./providers/inlay-hints.ts";
import { AbnfReferenceProvider } from "./providers/references.ts";
import { AbnfRenameProvider } from "./providers/rename.ts";
import { AbnfDocumentSymbolProvider } from "./providers/symbols.ts";
import { AbnfWorkspaceSymbolProvider } from "./providers/workspace-symbols.ts";
import { WorkspaceIndex } from "./workspace-index.ts";

const SELECTOR = { language: "abnf" };

export async function activate(context: ExtensionContext): Promise<void> {
	const manager = new DocumentManager();
	const workspaceIndex = new WorkspaceIndex();
	await workspaceIndex.initialize();

	const diagnosticCollection = languages.createDiagnosticCollection("abnf");

	context.subscriptions.push(
		manager,
		workspaceIndex,
		// Shared providers - registered for ABNF
		languages.registerDocumentSymbolProvider(
			SELECTOR,
			new AbnfDocumentSymbolProvider(manager),
		),
		languages.registerDefinitionProvider(
			SELECTOR,
			new AbnfDefinitionProvider(manager, workspaceIndex),
		),
		languages.registerReferenceProvider(
			SELECTOR,
			new AbnfReferenceProvider(manager, workspaceIndex),
		),
		languages.registerHoverProvider(SELECTOR, new AbnfHoverProvider(manager)),
		languages.registerRenameProvider(SELECTOR, new AbnfRenameProvider(manager)),
		languages.registerDocumentHighlightProvider(
			SELECTOR,
			new AbnfDocumentHighlightProvider(manager),
		),
		languages.registerFoldingRangeProvider(
			SELECTOR,
			new AbnfFoldingRangeProvider(manager),
		),
		languages.registerInlayHintsProvider(
			SELECTOR,
			new AbnfInlayHintsProvider(manager),
		),
		// ABNF-specific providers
		languages.registerDocumentSemanticTokensProvider(
			SELECTOR,
			new AbnfSemanticTokensProvider(manager),
			ABNF_SEMANTIC_TOKENS_LEGEND,
		),
		languages.registerCompletionItemProvider(
			SELECTOR,
			new AbnfCompletionProvider(manager),
		),
		languages.registerCodeActionsProvider(
			SELECTOR,
			new AbnfCodeActionProvider(),
			AbnfCodeActionProvider.metadata,
		),
		languages.registerDocumentFormattingEditProvider(
			SELECTOR,
			new AbnfFormattingProvider(),
		),
		// Workspace symbol provider - no selector, handles all indexed files
		languages.registerWorkspaceSymbolProvider(
			new AbnfWorkspaceSymbolProvider(workspaceIndex),
		),
		diagnosticCollection,
	);

	function updateDocumentDiagnostics(doc: TextDocument): void {
		if (doc.languageId === "abnf") {
			updateAbnfDiagnostics(doc, manager, diagnosticCollection);
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

export function deactivate(): void {
	// No cleanup needed - subscriptions are disposed automatically by VS Code
}
