import {
	type CancellationToken,
	FoldingRange,
	type FoldingRangeProvider,
	type TextDocument,
} from "vscode";
import type { DocumentManager } from "../document-manager.ts";

export class AbnfFoldingRangeProvider implements FoldingRangeProvider {
	private readonly manager: DocumentManager;
	constructor(manager: DocumentManager) {
		this.manager = manager;
	}

	provideFoldingRanges(
		doc: TextDocument,
		_context: unknown,
		_token: CancellationToken,
	): FoldingRange[] {
		const { document } = this.manager.get(doc);
		const ranges: FoldingRange[] = [];

		for (const rule of document.rules) {
			const startLine = rule.definitionRange.start.line;
			const endLine = rule.definitionRange.end.line;
			if (endLine > startLine) {
				ranges.push(new FoldingRange(startLine, endLine));
			}
		}

		return ranges;
	}
}
