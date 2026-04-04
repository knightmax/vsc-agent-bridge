# VS Code Agent Bridge

A VS Code extension that starts a **local HTTP server** exposing Language Server Protocol (LSP) features as REST endpoints. Designed to let AI assistants interact with VS Code's code intelligence without MCP support.

Works with **any programming language** that has a Language Server extension installed in VS Code.

## Features

| Endpoint | Method | Description |
|---|---|---|
| `/diagnostics` | `GET` | Errors, warnings, hints from the language server. |
| `/definition` | `POST` | Go to definition of a symbol. |
| `/declaration` | `POST` | Go to declaration of a symbol. |
| `/hover` | `POST` | Type signature and documentation for a symbol. |
| `/references` | `POST` | Find all references to a symbol. |
| `/type-definition` | `POST` | Go to the type definition of a symbol. |
| `/implementation` | `POST` | Find implementations of an interface/abstract. |
| `/document-symbols` | `POST` | List all symbols (classes, methods, etc.) in a file. |
| `/code-actions` | `POST` | Get available quick fixes and refactorings for a range. |
| `/signature-help` | `POST` | Parameter hints for a function call. |
| `/rename-preview` | `POST` | Preview edits from renaming a symbol. |
| `/call-hierarchy` | `POST` | Incoming and outgoing calls for a symbol. |
| `/type-hierarchy` | `POST` | Supertypes and subtypes for a class or interface. |
| `/workspace-symbols` | `POST` | Search symbols across the entire workspace. |
| `/completion` | `POST` | Code completion suggestions at a position. |
| `/inlay-hints` | `POST` | Inlay hints (type annotations, parameter names) for a range. |
| `/folding-ranges` | `POST` | Folding ranges for a file. |
| `/active-file-content` | `GET` | Full text and metadata of the active editor. |
| `/` | `GET` | Health-check that lists all available endpoints. |

## Getting Started

### Prerequisites

- VS Code **1.85+**
- A Language Server extension for your target language (e.g. *Language Support for Java™ by Red Hat*, *Pylance* for Python, *TypeScript and JavaScript Language Features*, etc.)

### Installation

1. Clone this repository.
2. Run `npm install` then `npm run compile`.
3. Press **F5** in VS Code to launch the Extension Development Host.

### Configuration

Open VS Code settings and search for `vscAgentBridge`:

| Setting | Default | Description |
|---|---|---|
| `vscAgentBridge.port` | `3003` | Port for the local HTTP server. |
| `vscAgentBridge.authToken` | *(empty - auto-generated)* | Static auth token. If left empty, a random token is generated each time the extension activates. |

### Activation

The extension activates automatically when VS Code starts (`onStartupFinished`). All endpoints delegate to the standard VS Code API, so they work with **any** installed Language Server.

## Authentication

Every request must include the header:

```
x-auth-token: <your-token>
```

Copy the auto-generated token via the command **"Agent Bridge: Copy Auth Token to Clipboard"** (Command Palette).

## API Reference

All POST endpoints accept a JSON body with `Content-Type: application/json`.

### `GET /diagnostics`

Returns all diagnostics (errors, warnings, hints, info) for the workspace.

**Optional query parameter:** `?file=/absolute/path/to/file.py` to filter to a single file.

**Response:**

```json
[
  {
    "file": "/home/user/project/src/main.py",
    "diagnostics": [
      {
        "range": {
          "start": { "line": 10, "character": 4 },
          "end": { "line": 10, "character": 20 }
        },
        "message": "Cannot find name 'foo'",
        "severity": "error",
        "source": "Pylance",
        "code": "reportUndefinedVariable"
      }
    ]
  }
]
```

### `POST /definition`

**Body:** `{ "file": "<path>", "line": <n>, "character": <n> }`

**Response:** `{ "definitions": [{ "uri": "<path>", "range": { "start": {...}, "end": {...} } }] }`

### `POST /hover`

**Body:** `{ "file": "<path>", "line": <n>, "character": <n> }`

**Response:** `{ "contents": ["type signature", "documentation"] }`

### `POST /references`

**Body:** `{ "file": "<path>", "line": <n>, "character": <n> }`

**Response:** `{ "references": [{ "uri": "<path>", "range": { "start": {...}, "end": {...} } }] }`

### `POST /type-definition`

**Body:** `{ "file": "<path>", "line": <n>, "character": <n> }`

**Response:** `{ "definitions": [{ "uri": "<path>", "range": { "start": {...}, "end": {...} } }] }`

### `POST /implementation`

**Body:** `{ "file": "<path>", "line": <n>, "character": <n> }`

**Response:** `{ "implementations": [{ "uri": "<path>", "range": { "start": {...}, "end": {...} } }] }`

### `POST /document-symbols`

**Body:** `{ "file": "<path>" }`

**Response:** `{ "symbols": [{ "name": "MyClass", "kind": "Class", "range": {...}, "selectionRange": {...}, "children": [...] }] }`

### `POST /code-actions`

**Body:** `{ "file": "<path>", "startLine": <n>, "startCharacter": <n>, "endLine": <n>, "endCharacter": <n> }`

**Response:** `{ "actions": [{ "title": "Import 'os'", "kind": "quickfix", "isPreferred": true }] }`

### `POST /signature-help`

**Body:** `{ "file": "<path>", "line": <n>, "character": <n> }`

**Response:** `{ "signatures": [{ "label": "fn(a: int, b: str)", "documentation": "...", "parameters": [...] }], "activeSignature": 0, "activeParameter": 0 }`

### `POST /rename-preview`

**Body:** `{ "file": "<path>", "line": <n>, "character": <n>, "newName": "newVar" }`

**Response:** `{ "changes": [{ "file": "<path>", "edits": [{ "range": {...}, "newText": "newVar" }] }] }`

### `POST /declaration`

**Body:** `{ "file": "<path>", "line": <n>, "character": <n> }`

**Response:** `{ "declarations": [{ "uri": "<path>", "range": { "start": {...}, "end": {...} } }] }`

### `POST /call-hierarchy`

Returns the call hierarchy item at the given position along with its incoming and outgoing calls.

**Body:** `{ "file": "<path>", "line": <n>, "character": <n> }`

**Response:**

```json
{
  "item": { "name": "myFunc", "kind": "Function", "uri": "<path>", "range": {...}, "selectionRange": {...} },
  "incomingCalls": [
    { "from": { "name": "caller", "kind": "Method", "uri": "<path>", "range": {...}, "selectionRange": {...} }, "fromRanges": [{...}] }
  ],
  "outgoingCalls": [
    { "to": { "name": "callee", "kind": "Function", "uri": "<path>", "range": {...}, "selectionRange": {...} }, "fromRanges": [{...}] }
  ]
}
```

### `POST /type-hierarchy`

Returns the type hierarchy item at the given position along with its supertypes and subtypes.

**Body:** `{ "file": "<path>", "line": <n>, "character": <n> }`

**Response:**

```json
{
  "item": { "name": "MyClass", "kind": "Class", "uri": "<path>", "range": {...}, "selectionRange": {...} },
  "supertypes": [{ "name": "BaseClass", "kind": "Class", "uri": "<path>", "range": {...}, "selectionRange": {...} }],
  "subtypes": [{ "name": "ChildClass", "kind": "Class", "uri": "<path>", "range": {...}, "selectionRange": {...} }]
}
```

### `POST /workspace-symbols`

Search for symbols across the entire workspace by name.

**Body:** `{ "query": "MyClass" }`

**Response:** `{ "symbols": [{ "name": "MyClass", "kind": "Class", "containerName": "src/models", "location": { "uri": "<path>", "range": {...} } }] }`

### `POST /completion`

Returns code completion suggestions at the given position.

**Body:** `{ "file": "<path>", "line": <n>, "character": <n> }`

**Response:** `{ "items": [{ "label": "toString", "kind": "Method", "detail": "(): string", "documentation": "...", "sortText": "...", "filterText": "...", "insertText": "..." }] }`

### `POST /inlay-hints`

Returns inlay hints (type annotations, parameter names) for the given range.

**Body:** `{ "file": "<path>", "startLine": <n>, "startCharacter": <n>, "endLine": <n>, "endCharacter": <n> }`

**Response:** `{ "hints": [{ "position": { "line": 5, "character": 10 }, "label": ": string", "kind": "Type" }] }`

### `POST /folding-ranges`

Returns folding ranges for a file, showing logical code blocks.

**Body:** `{ "file": "<path>" }`

**Response:** `{ "ranges": [{ "startLine": 10, "endLine": 25, "kind": "Region" }] }`

### `GET /active-file-content`

**Response:** `{ "file": "<path>", "languageId": "python", "lineCount": 42, "content": "..." }`

## Copilot Plugin

This repository includes a Copilot plugin that teaches AI assistants how to use the bridge. See `plugins/vsc-agent-bridge-plugin/` for the plugin structure and `SKILL.md` for the skill definition.

## Development

```bash
npm install       # Install dependencies
npm run compile   # Build
npm run lint      # Lint
npm test          # Run tests (93 tests)
npm run watch     # Watch mode
```

## License

[MIT](LICENSE)
