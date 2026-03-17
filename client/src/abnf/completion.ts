import {
	type CancellationToken,
	CompletionItem,
	CompletionItemKind,
	type CompletionItemProvider,
	type Position,
	type TextDocument,
} from "vscode";
import type { DocumentManager } from "../document-manager.ts";
import { CORE_RULES } from "./core-rules.ts";

export class AbnfCompletionProvider implements CompletionItemProvider {
	private readonly manager: DocumentManager;
	constructor(manager: DocumentManager) {
		this.manager = manager;
	}

	provideCompletionItems(
		doc: TextDocument,
		_position: Position,
		_token: CancellationToken,
	): CompletionItem[] {
		const { symbolTable } = this.manager.get(doc);
		const items: CompletionItem[] = [];

		for (const [, rules] of symbolTable.definitions) {
			const rule = rules[0];
			if (rule?.isCoreRule) {
				continue;
			}
			const displayName = rule?.name ?? "";
			const item = new CompletionItem(displayName, CompletionItemKind.Function);
			if (rule) {
				item.detail = `${rule.name} = ${rule.definitionText}`;
				if (rule.precedingComment) {
					item.documentation = rule.precedingComment;
				}
			}
			items.push(item);
		}

		for (const [, rule] of CORE_RULES) {
			const item = new CompletionItem(rule.name, CompletionItemKind.Constant);
			item.detail = `${rule.name} = ${rule.definitionText}`;
			item.documentation = "Core rule (RFC 5234 Appendix B)";
			items.push(item);
		}

		return items;
	}
}
