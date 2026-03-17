import {
	type Diagnostic,
	type DiagnosticCollection,
	DiagnosticSeverity,
	type TextDocument,
	workspace,
} from "vscode";
import type { DocumentManager } from "../document-manager.ts";
import { CORE_RULE_NAMES } from "./core-rules.ts";
import { tokenize } from "./tokenizer.ts";
import { AbnfTokenKind } from "./types.ts";

const DIAGNOSTIC_SOURCE = "abnf";

type ManagerResult = ReturnType<DocumentManager["get"]>;

/**
 * Returns a set of lowercase rule names whose definitions use `=/` (incremental alternative).
 * A rule name that appears at least once with `=/` is considered intentionally incremental.
 */
function collectIncrementalRuleNames(text: string): Set<string> {
	const tokens = tokenize(text);
	const incremental = new Set<string>();

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
		if (after !== undefined && after.kind === AbnfTokenKind.IncrementalAs) {
			incremental.add(tok.text.toLowerCase());
		}
	}

	return incremental;
}

function checkUndefinedReferences(
	document: ManagerResult["document"],
	symbolTable: ManagerResult["symbolTable"],
): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	for (const rule of document.rules) {
		for (const ref of rule.references) {
			const key = ref.name.toLowerCase();
			if (!(symbolTable.definitions.has(key) || CORE_RULE_NAMES.has(key))) {
				diagnostics.push({
					message: `"${ref.name}" is not defined as a rule in this file`,
					range: ref.range,
					severity: DiagnosticSeverity.Error,
					source: DIAGNOSTIC_SOURCE,
				});
			}
		}
	}
	return diagnostics;
}

function checkUnusedRules(
	document: ManagerResult["document"],
	symbolTable: ManagerResult["symbolTable"],
): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	const firstRuleKey = document.rules[0]?.name.toLowerCase();

	for (const [name, rules] of symbolTable.definitions) {
		if (name === firstRuleKey) {
			continue;
		}
		const hasReferences =
			(symbolTable.references.get(name)?.length ?? 0) > 0 ||
			CORE_RULE_NAMES.has(name);
		if (!hasReferences) {
			for (const rule of rules) {
				diagnostics.push({
					message: `Rule '${rule.name}' is defined but never referenced`,
					range: rule.nameRange,
					severity: DiagnosticSeverity.Hint,
					source: DIAGNOSTIC_SOURCE,
				});
			}
		}
	}
	return diagnostics;
}

function checkDuplicateDefinitions(
	symbolTable: ManagerResult["symbolTable"],
	text: string,
): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	const incrementalNames = collectIncrementalRuleNames(text);

	for (const [name, rules] of symbolTable.definitions) {
		if (rules.length <= 1) {
			continue;
		}
		if (incrementalNames.has(name)) {
			continue;
		}
		for (const rule of rules) {
			diagnostics.push({
				message: `Duplicate definition of rule "${rule.name}"`,
				range: rule.nameRange,
				severity: DiagnosticSeverity.Warning,
				source: DIAGNOSTIC_SOURCE,
			});
		}
	}
	return diagnostics;
}

export function updateAbnfDiagnostics(
	doc: TextDocument,
	manager: DocumentManager,
	collection: DiagnosticCollection,
): void {
	const config = workspace.getConfiguration("abnf");

	if (!config.get<boolean>("diagnostics.enable", true)) {
		collection.set(doc.uri, []);
		return;
	}

	const { document, symbolTable } = manager.get(doc);
	const diagnostics: Diagnostic[] = [...document.diagnostics];

	if (config.get<boolean>("diagnostics.undefinedReferences", true)) {
		diagnostics.push(...checkUndefinedReferences(document, symbolTable));
	}

	if (config.get<boolean>("diagnostics.unusedRules", true)) {
		diagnostics.push(...checkUnusedRules(document, symbolTable));
	}

	diagnostics.push(...checkDuplicateDefinitions(symbolTable, doc.getText()));

	collection.set(doc.uri, diagnostics);
}
