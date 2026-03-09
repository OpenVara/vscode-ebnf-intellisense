# EBNF Syntax Highlighting and Intellisense

A VS Code extension providing comprehensive ISO/IEC 14977 EBNF grammar support.

## Features

- **Syntax Highlighting** — Accurate TextMate grammar with proper scoping for all EBNF constructs
- **Go to Definition** — Navigate to rule definitions within your EBNF files
- **Hover Information** — View rule details and docstrings on hover
- **Completions** — Intelligent autocompletion for rule names and operators
- **Diagnostics** — Real-time syntax validation and error reporting
- **Find References** — Locate all usages of a rule definition
- **Rename** — Refactor rule names across your files
- **Document Symbols** — Quick navigation via the outline view
- **Markdown Support** — EBNF syntax highlighting in markdown code blocks

## Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com) or build locally:

```bash
bun install
bun run package
```

## Usage

Create or open `.ebnf` or `.bnf` files. The extension automatically provides:

- Syntax highlighting as you type
- Diagnostics for malformed grammar
- Completions when writing rule references
- Navigation via go-to-definition and references

## Configuration

Enable or disable diagnostics in VS Code settings:

```json
{
  "ebnf.diagnostics.enable": true
}
```

## Development

### Building

```bash
bun run build
```

### Packaging

```bash
bun run package
```

## License

MIT

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Community

- [GitHub Issues](https://github.com/xsyetopz/ebnf-syntax-and-intellisense/issues)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=xsyetopz.ebnf-syntax-and-intellisense)
