# VS Code Agent Bridge

A VS Code extension that starts a **local HTTP server** exposing Language Server Protocol (LSP) features as REST endpoints. Designed to let AI assistants interact with VS Code's code intelligence without MCP support.

Works with **any programming language** that has a Language Server extension installed in VS Code.

## How it works

```
┌──────────────────────────────────────────────────────────────────┐
│                         VS Code                                  │
│                                                                  │
│  ┌──────────────┐    ┌──────────────────┐    ┌────────────────┐  │
│  │  Language    │◄──►│  VS Code Agent   │◄──►│  Discovery     │  │
│  │  Server      │    │  Bridge (ext)    │    │  File          │  │
│  │  (LSP)       │    │                  │    │  ~/.vsc-agent- │  │
│  │              │    │  HTTP server on  │    │  bridge/*.json │  │
│  │  Java/TS/    │    │  localhost:PORT  │    └────────────────┘  │
│  │  Python/...  │    └────────┬─────────┘                        │
│  └──────────────┘             │                                  │
└───────────────────────────────┼──────────────────────────────────┘
                                │  REST API (JSON)
                                │  x-auth-token header
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
  ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐
  │  AI Agent     │   │  CLI Script   │   │  Another Tool     │
  │  (Copilot,    │   │  (curl, etc.) │   │  (IDE plugin,     │
  │   Claude...)  │   │               │   │   custom client)  │
  └───────────────┘   └───────────────┘   └───────────────────┘
```

1. **VS Code** loads the extension on startup
2. The extension starts an **HTTP server** on a random port (or configured port)
3. It writes a **discovery file** (`~/.vsc-agent-bridge/<hash>.json`) with port, token, and workspace info
4. **External clients** read the discovery file to find the port and auth token
5. Clients send HTTP requests → the bridge delegates to the **Language Server** via VS Code API → returns JSON

## Features

| Endpoint | Method | Description |
|---|---|---|
| `/info` | `GET` | Instance info (no auth required): port, PID, workspace folders. |
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
| `/workspace-symbols` | `POST` | Search symbols across the entire workspace. Supports optional `folder` filter. |
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
| `vscAgentBridge.port` | `0` (auto) | Port for the local HTTP server. Use `0` for automatic assignment (allows multiple VS Code instances). |
| `vscAgentBridge.authToken` | *(empty - auto-generated)* | Static auth token. If left empty, a random token is generated each time the extension activates. |

### Activation

The extension activates automatically when VS Code starts (`onStartupFinished`). All endpoints delegate to the standard VS Code API, so they work with **any** installed Language Server.

## Authentication

Every request (except `GET /info`) must include the header:

```
x-auth-token: <your-token>
```

### Automatic Discovery (recommended)

The extension writes a JSON discovery file to `~/.vsc-agent-bridge/` on startup. Each VS Code instance gets its own file containing:

```json
{
  "port": 54321,
  "token": "abc123...",
  "pid": 12345,
  "version": "0.4.0",
  "workspaceFolders": ["/home/user/project"],
  "startedAt": "2026-04-06T10:30:00Z"
}
```

Agents should read these files to automatically find the port and token for the target workspace.

### Manual Copy

Copy the auto-generated token via **"Agent Bridge: Copy Auth Token to Clipboard"** or the full connection info via **"Agent Bridge: Copy Connection Info to Clipboard"** (Command Palette).

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

> **Note:** Cross-file resolution depends on the Language Server and project configuration. JavaScript/CommonJS projects require a `jsconfig.json`. When no config is found, the response includes a `_warning` field.

**Body:** `{ "file": "<path>", "line": <n>, "character": <n> }`

**Response:** `{ "definitions": [{ "uri": "<path>", "range": { "start": {...}, "end": {...} } }], "_warning": "No jsconfig.json..." }`

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

Search for symbols across the entire workspace by name. Use the optional `folder` parameter to scope results to a specific project folder.

**Body:** `{ "query": "MyClass" }` or `{ "query": "MyClass", "folder": "/path/to/project" }`

**Response:** `{ "symbols": [{ "name": "MyClass", "kind": "Class", "containerName": "src/models", "location": { "uri": "<path>", "range": {...} } }] }`

### `POST /completion`

Returns code completion suggestions at the given position.

**Body:** `{ "file": "<path>", "line": <n>, "character": <n> }`

**Response:** `{ "items": [{ "label": "toString", "kind": "Method", "detail": "(): string", "documentation": "...", "sortText": "...", "filterText": "...", "insertText": "..." }] }`

### `POST /inlay-hints`

Returns inlay hints (type annotations, parameter names) for the given range.

**Body:** `{ "file": "<path>", "startLine": <n>, "startCharacter": <n>, "endLine": <n>, "endCharacter": <n> }`

**Response:** `{ "hints": [{ "position": { "line": 5, "character": 10 }, "label": ": string", "kind": "Type" }] }`

> **Note:** When the Language Server does not provide a `kind`, the bridge applies a heuristic: labels ending with `:` → `Parameter`, labels starting with `:` → `Type`. The field may still be absent if the heuristic cannot determine the kind.

### `POST /folding-ranges`

Returns folding ranges for a file, showing logical code blocks.

**Body:** `{ "file": "<path>" }`

**Response:** `{ "ranges": [{ "startLine": 10, "endLine": 25, "kind": "Region" }] }`

> **Note:** `kind` may be absent for code blocks. Only import blocks typically have `kind: "Imports"`.

### `GET /active-file-content`

**Response:** `{ "file": "<path>", "languageId": "python", "lineCount": 42, "content": "..." }`

## Copilot Plugin

This repository includes a Copilot plugin that teaches AI assistants how to use the bridge. See `plugins/vsc-agent-bridge-plugin/` for the plugin structure and `SKILL.md` for the skill definition.

## Installation from source

### Prerequisites

- Node.js + npm
- VS Code (version ≥ the one specified in `package.json` under `engines.vscode`)
- The `code` CLI in your PATH (Command Palette → **"Shell Command: Install 'code' command in PATH"**)

### 1. Install & compile

```bash
npm install
npm run compile
```

### 2. Package the .vsix

Use `vsce` via npx (no global install needed):

```bash
npx @vscode/vsce@latest package
```

This produces a file like `vsc-agent-bridge-X.X.X.vsix`.

### 3. Install in VS Code

```bash
code --install-extension vsc-agent-bridge-X.X.X.vsix
```

Or open VS Code → Extensions view → `···` menu → **"Install from VSIX…"**.

### 4. Verify

```bash
code --list-extensions | grep knightmax
```

Or search for **"VS Code Agent Bridge"** in the Extensions view.

> **Tip:** For development, press **F5** to launch the Extension Development Host — no packaging needed.

## Development

```bash
npm install       # Install dependencies
npm run compile   # Build
npm run lint      # Lint
npm test          # Run tests
npm run watch     # Watch mode
```

## License

[MIT](LICENSE)
