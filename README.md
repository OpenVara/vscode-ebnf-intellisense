# EBNF Syntax Highlighting and Intellisense

A VS Code extension for editing EBNF grammar files with full IDE support.

EBNF (Extended Backus-Naur Form) is a notation for defining the syntax of programming languages and data formats. This extension follows the ISO/IEC 14977 standard.

## Features

### Core Editing

- **Syntax Highlighting** -- Colors for rule names, strings, comments, operators, and special sequences
- **Snippets** -- Quick templates for common EBNF patterns (type `rule`, `grp`, `opt`, etc.)
- **Auto-closing** -- Automatically closes brackets, quotes, and comments
- **Folding** -- Collapse rules and comments to focus on specific parts of your grammar

### Navigation

- **Go to Definition** -- Click a rule name to jump to where it's defined (F12)
- **Find References** -- See everywhere a rule is used (Shift+F12)
- **Document Symbols** -- View all rules in the outline panel (Ctrl+Shift+O)
- **Workspace Symbols** -- Search for rules across all EBNF files in your project (Ctrl+T)

### Validation

- **Error Detection** -- Highlights syntax errors like missing semicolons or unmatched brackets
- **Undefined Rules** -- Warns when you reference a rule that doesn't exist
- **Duplicate Rules** -- Flags rules defined more than once
- **Unused Rules** -- Hints when a rule is defined but never referenced

### Refactoring

- **Rename** -- Change a rule name everywhere it appears (F2)
- **Quick Fixes** -- Click the lightbulb to create missing rules automatically
- **Semantic Highlighting** -- Different colors for rule definitions vs references

### Cross-file Support

- **Multi-file Navigation** -- Jump to definitions in other EBNF files
- **Workspace References** -- Find usages across your entire project

## Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=xsyetopz.vscode-ebnf-intellisense) or search for "EBNF" in VS Code extensions.

To build from source:

```bash
bun install
bun run package
code --install-extension vscode-ebnf-intellisense-*.vsix
```

## Usage

Open any `.ebnf` or `.bnf` file. The extension activates automatically.

### Example EBNF file

```ebnf
(* A simple expression grammar *)
expression = term, { ("+"|"-"), term };
term       = factor, { ("*"|"/"), factor };
factor     = number | "(", expression, ")";
number     = digit, { digit };
digit      = "0"|"1"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9";
```

### Markdown Support

Use `ebnf` code blocks in Markdown files for syntax highlighting:

````markdown
```ebnf
rule = "example";
```
````

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `ebnf.diagnostics.enable` | `true` | Enable or disable all diagnostics |
| `ebnf.diagnostics.unusedRules` | `true` | Show hints for unused rules |
| `ebnf.parser.spacedIdentifiers` | `false` | Allow spaces in rule names per ISO 14977 section 6.2 |

### Spaced Identifiers

ISO 14977 allows spaces within rule names. For example, `signed integer` is treated as a single rule name, equivalent to `signedinteger`. This feature is off by default for compatibility with common EBNF usage.

To enable:

```json
{
  "ebnf.parser.spacedIdentifiers": true
}
```

## EBNF Quick Reference

| Syntax | Meaning |
|--------|---------|
| `=` | Definition |
| `;` or `.` | End of rule |
| `\|` | Alternative (or) |
| `,` | Concatenation (sequence) |
| `[ ... ]` | Optional (zero or one) |
| `{ ... }` | Repetition (zero or more) |
| `( ... )` | Grouping |
| `"..."` or `'...'` | Terminal string |
| `(* ... *)` | Comment |
| `? ... ?` | Special sequence |
| `-` | Exception |
| `3 * rule` | Repetition (exactly 3 times) |

## Development

```bash
bun run build    # Build the extension
bun run package  # Create .vsix package
```

## License

MIT

## Links

- [GitHub Repository](https://github.com/xsyetopz/vscode-ebnf-intellisense)
- [Issue Tracker](https://github.com/xsyetopz/vscode-ebnf-intellisense/issues)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=xsyetopz.vscode-ebnf-intellisense)
