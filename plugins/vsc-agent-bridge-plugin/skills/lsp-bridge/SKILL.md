---
name: lsp-bridge
description: "Query VS Code Language Server features through a local HTTP bridge. Use this skill whenever you need to investigate compilation errors, find references to a symbol, look up type information or documentation, navigate to definitions or implementations, list document symbols, get available code actions (quick fixes, refactorings), check function signatures, preview rename edits, or read the currently open file. Works with ANY programming language that has an LSP extension in VS Code — Java, Python, TypeScript, JavaScript, Go, Rust, C#, C++, Ruby, and more. Always use this skill when the user mentions compiler errors, diagnostics, code navigation, type checking, or symbol lookup in a VS Code workspace."
argument-hint: "Describe what you need: e.g. 'check for compilation errors', 'find all references to UserService', 'get hover info at line 42', 'list all symbols in this file'."
compatibility: copilot
user-invocable: true
disable-model-invocation: false
---

# LSP Bridge — VS Code Agent Bridge Skill

This skill lets you interact with the **VS Code Agent Bridge** extension, a local HTTP server that exposes Language Server Protocol (LSP) features as REST endpoints. It provides real-time compiler diagnostics, type information, code navigation, refactoring support, and more from the user's VS Code editor.

It works with **any programming language** that has a Language Server extension installed in VS Code (Java, Python, TypeScript, Go, Rust, C#, C++, etc.).

## Prerequisites

The **VS Code Agent Bridge** extension must be installed and running. It activates automatically when VS Code starts. The server runs on `http://127.0.0.1:3003` by default.

### Authentication

Every request **must** include the header:

```
x-auth-token: <token>
```

Ask the user for the token if you don't have it. They can copy it from VS Code via the command **"Agent Bridge: Copy Auth Token to Clipboard"** in the Command Palette.

## Available Endpoints

All POST endpoints expect a JSON body with `Content-Type: application/json`.

### 1. GET /diagnostics — Errors and Warnings

Retrieve all compiler errors, warnings, and hints for the workspace or a specific file. **Always start debugging here.**

```bash
# All workspace diagnostics
curl -s -H "x-auth-token: $TOKEN" http://127.0.0.1:3003/diagnostics

# Single file
curl -s -H "x-auth-token: $TOKEN" "http://127.0.0.1:3003/diagnostics?file=/absolute/path/to/file.py"
```

**Response:** Array of `{ file, diagnostics: [{ range, message, severity, source, code }] }`

### 2. POST /definition — Go to Definition

Find where a symbol is defined.

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "line": 15, "character": 10}' \
  http://127.0.0.1:3003/definition
```

**Response:** `{ definitions: [{ uri, range }] }`

### 3. POST /hover — Type and Documentation

Get the type signature and documentation for a symbol.

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "line": 15, "character": 10}' \
  http://127.0.0.1:3003/hover
```

**Response:** `{ contents: ["type signature", "documentation text"] }`

### 4. POST /references — Find All References

Find every location where a symbol is used across the project.

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "line": 15, "character": 10}' \
  http://127.0.0.1:3003/references
```

**Response:** `{ references: [{ uri, range }] }`

### 5. POST /type-definition — Go to Type Definition

Jump to the type definition of a symbol (e.g., from a variable to its class/interface).

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "line": 15, "character": 10}' \
  http://127.0.0.1:3003/type-definition
```

**Response:** `{ definitions: [{ uri, range }] }`

### 6. POST /implementation — Go to Implementation

Find concrete implementations of an interface, abstract method, or protocol.

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "line": 15, "character": 10}' \
  http://127.0.0.1:3003/implementation
```

**Response:** `{ implementations: [{ uri, range }] }`

### 7. POST /document-symbols — List Symbols in a File

Get all classes, methods, functions, variables, and other symbols defined in a file.

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts"}' \
  http://127.0.0.1:3003/document-symbols
```

**Response:** `{ symbols: [{ name, kind, range, selectionRange, children }] }`

Kinds include: File, Module, Namespace, Package, Class, Method, Property, Field, Constructor, Enum, Interface, Function, Variable, Constant, String, Number, Boolean, Array, Object, Key, Null, EnumMember, Struct, Event, Operator, TypeParameter.

### 8. POST /code-actions — Quick Fixes and Refactorings

Get available code actions for a specific range (e.g., quick fixes for an error, extract method, organize imports).

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "startLine": 10, "startCharacter": 0, "endLine": 10, "endCharacter": 30}' \
  http://127.0.0.1:3003/code-actions
```

**Response:** `{ actions: [{ title, kind, isPreferred }] }`

### 9. POST /signature-help — Function Signatures

Get parameter hints and documentation for a function call at a given position.

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "line": 15, "character": 20}' \
  http://127.0.0.1:3003/signature-help
```

**Response:** `{ signatures: [{ label, documentation, parameters: [{ label, documentation }] }], activeSignature, activeParameter }`

### 10. POST /rename-preview — Preview Rename Edits

Preview all the edits that would result from renaming a symbol, without applying them.

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "line": 5, "character": 10, "newName": "newVariableName"}' \
  http://127.0.0.1:3003/rename-preview
```

**Response:** `{ changes: [{ file, edits: [{ range, newText }] }] }`

### 11. GET /active-file-content — Read Open File

Get the full text and metadata of the file currently open in the user's editor.

```bash
curl -s -H "x-auth-token: $TOKEN" http://127.0.0.1:3003/active-file-content
```

**Response:** `{ file, languageId, lineCount, content }`

### 12. GET / — Health Check

Verify the bridge is running and list all available endpoints.

```bash
curl -s -H "x-auth-token: $TOKEN" http://127.0.0.1:3003/
```

## Workflow: Debugging Compilation Errors

1. **Get the auth token** — ask the user if you don't have it.
2. **Fetch diagnostics** — `GET /diagnostics` to see all errors and warnings.
3. **Investigate errors** — use `POST /hover` on the problematic position to understand the types involved.
4. **Navigate definitions** — use `POST /definition` to trace where symbols are defined.
5. **Find references** — use `POST /references` to see where a symbol is used.
6. **Check implementations** — use `POST /implementation` to find concrete implementations of interfaces.
7. **Get code actions** — use `POST /code-actions` on the error range to see available quick fixes.
8. **Read file content** — use `GET /active-file-content` for the full source.
9. **Propose fixes** — suggest concrete code changes based on all the information gathered.

## Workflow: Understanding Code Structure

1. **List symbols** — `POST /document-symbols` to get an overview of classes, methods, and variables in a file.
2. **Inspect types** — `POST /hover` on interesting symbols to see their types.
3. **Trace definitions** — `POST /definition` and `POST /type-definition` to understand the type hierarchy.
4. **Find usages** — `POST /references` to see how symbols are used across the project.

## Error Handling

- **401 Unauthorized**: The `x-auth-token` header is missing or incorrect. Ask the user for the correct token.
- **400 Bad Request**: Missing or invalid parameters in the request body. Check the required fields.
- **404 Not Found (on /active-file-content)**: No file is currently open in the editor.
- **Empty results**: If endpoints return empty arrays, the Language Server may still be loading, or the position/file may be incorrect.
- **Connection refused**: The extension is not running. Ask the user to ensure VS Code Agent Bridge is installed and active.

## Configuration

The default port is `3003`. If changed, find it in VS Code settings under `vscAgentBridge.port`.
