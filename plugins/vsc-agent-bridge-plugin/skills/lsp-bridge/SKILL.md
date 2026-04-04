---
name: lsp-bridge
description: "Query VS Code Language Server features through a local HTTP bridge. Use this skill whenever you need to investigate compilation errors, find references to a symbol, look up type information or documentation, navigate to definitions, declarations, or implementations, list document or workspace symbols, get available code actions (quick fixes, refactorings), check function signatures, preview rename edits, explore call hierarchies, understand type hierarchies, get code completion suggestions, inspect inlay hints, get folding ranges, or read the currently open file. Works with ANY programming language that has an LSP extension in VS Code — Java, Python, TypeScript, JavaScript, Go, Rust, C#, C++, Ruby, and more. Always use this skill when the user mentions compiler errors, diagnostics, code navigation, type checking, symbol lookup, call graphs, or code structure analysis in a VS Code workspace."
argument-hint: "Describe what you need: e.g. 'check for compilation errors', 'find all references to UserService', 'get hover info at line 42', 'list all symbols in this file', 'who calls this function', 'what are the subtypes of Animal'."
compatibility: copilot
user-invocable: true
disable-model-invocation: false
---

# LSP Bridge — VS Code Agent Bridge Skill

This skill lets you interact with the **VS Code Agent Bridge** extension, a local HTTP server that exposes Language Server Protocol (LSP) features as REST endpoints. It provides real-time compiler diagnostics, type information, code navigation, call hierarchies, type hierarchies, code completion, refactoring support, and more from the user's VS Code editor.

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

### 3. POST /declaration — Go to Declaration

Find where a symbol is declared (differs from definition in languages like C/C++ where declaration and definition are separate).

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "line": 15, "character": 10}' \
  http://127.0.0.1:3003/declaration
```

**Response:** `{ declarations: [{ uri, range }] }`

### 4. POST /hover — Type and Documentation

Get the type signature and documentation for a symbol.

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "line": 15, "character": 10}' \
  http://127.0.0.1:3003/hover
```

**Response:** `{ contents: ["type signature", "documentation text"] }`

### 5. POST /references — Find All References

Find every location where a symbol is used across the project.

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "line": 15, "character": 10}' \
  http://127.0.0.1:3003/references
```

**Response:** `{ references: [{ uri, range }] }`

### 6. POST /type-definition — Go to Type Definition

Jump to the type definition of a symbol (e.g., from a variable to its class/interface).

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "line": 15, "character": 10}' \
  http://127.0.0.1:3003/type-definition
```

**Response:** `{ definitions: [{ uri, range }] }`

### 7. POST /implementation — Go to Implementation

Find concrete implementations of an interface, abstract method, or protocol.

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "line": 15, "character": 10}' \
  http://127.0.0.1:3003/implementation
```

**Response:** `{ implementations: [{ uri, range }] }`

### 8. POST /document-symbols — List Symbols in a File

Get all classes, methods, functions, variables, and other symbols defined in a file.

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts"}' \
  http://127.0.0.1:3003/document-symbols
```

**Response:** `{ symbols: [{ name, kind, range, selectionRange, children }] }`

Kinds include: File, Module, Namespace, Package, Class, Method, Property, Field, Constructor, Enum, Interface, Function, Variable, Constant, String, Number, Boolean, Array, Object, Key, Null, EnumMember, Struct, Event, Operator, TypeParameter.

### 9. POST /code-actions — Quick Fixes and Refactorings

Get available code actions for a specific range (e.g., quick fixes for an error, extract method, organize imports).

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "startLine": 10, "startCharacter": 0, "endLine": 10, "endCharacter": 30}' \
  http://127.0.0.1:3003/code-actions
```

**Response:** `{ actions: [{ title, kind, isPreferred }] }`

### 10. POST /signature-help — Function Signatures

Get parameter hints and documentation for a function call at a given position.

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "line": 15, "character": 20}' \
  http://127.0.0.1:3003/signature-help
```

**Response:** `{ signatures: [{ label, documentation, parameters: [{ label, documentation }] }], activeSignature, activeParameter }`

### 11. POST /rename-preview — Preview Rename Edits

Preview all the edits that would result from renaming a symbol, without applying them.

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "line": 5, "character": 10, "newName": "newVariableName"}' \
  http://127.0.0.1:3003/rename-preview
```

**Response:** `{ changes: [{ file, edits: [{ range, newText }] }] }`

### 12. POST /call-hierarchy — Incoming and Outgoing Calls

Discover who calls a function (incoming) and what functions it calls (outgoing). Essential for understanding code flow and impact analysis.

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "line": 15, "character": 10}' \
  http://127.0.0.1:3003/call-hierarchy
```

**Response:** `{ item: { name, kind, uri, range, selectionRange }, incomingCalls: [{ from: { name, kind, uri, range, selectionRange }, fromRanges }], outgoingCalls: [{ to: { name, kind, uri, range, selectionRange }, fromRanges }] }`

### 13. POST /type-hierarchy — Supertypes and Subtypes

Navigate the class/interface hierarchy — find parent types (supertypes) and child types (subtypes). Crucial for understanding OOP structures.

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "line": 15, "character": 10}' \
  http://127.0.0.1:3003/type-hierarchy
```

**Response:** `{ item: { name, kind, uri, range, selectionRange }, supertypes: [{ name, kind, uri, range, selectionRange }], subtypes: [{ name, kind, uri, range, selectionRange }] }`

### 14. POST /workspace-symbols — Search Symbols Across Workspace

Search for classes, functions, variables, and other symbols across the entire workspace. Unlike `/document-symbols` which is file-scoped, this searches globally.

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"query": "UserService"}' \
  http://127.0.0.1:3003/workspace-symbols
```

**Response:** `{ symbols: [{ name, kind, containerName, location: { uri, range } }] }`

### 15. POST /completion — Code Completion Suggestions

Get code completion suggestions at a given position (autocomplete items the language server would propose).

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "line": 15, "character": 10}' \
  http://127.0.0.1:3003/completion
```

**Response:** `{ items: [{ label, kind, detail, documentation, sortText, filterText, insertText }] }`

### 16. POST /inlay-hints — Inline Type and Parameter Hints

Get inlay hints for a range — these are the inline annotations like type hints, parameter names, and other decorations that the language server provides.

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts", "startLine": 0, "startCharacter": 0, "endLine": 50, "endCharacter": 0}' \
  http://127.0.0.1:3003/inlay-hints
```

**Response:** `{ hints: [{ position: { line, character }, label, kind }] }`

Kind values: "Type" (inferred type annotations), "Parameter" (parameter name hints).

### 17. POST /folding-ranges — Code Structure Folding

Get the folding ranges of a file, showing logical code blocks (functions, classes, imports, comments, regions).

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/file.ts"}' \
  http://127.0.0.1:3003/folding-ranges
```

**Response:** `{ ranges: [{ startLine, endLine, kind }] }`

Kind values: "Comment", "Imports", "Region", or undefined for code blocks.

### 18. GET /active-file-content — Read Open File

Get the full text and metadata of the file currently open in the user's editor.

```bash
curl -s -H "x-auth-token: $TOKEN" http://127.0.0.1:3003/active-file-content
```

**Response:** `{ file, languageId, lineCount, content }`

### 19. GET / — Health Check

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
7. **Explore call hierarchy** — use `POST /call-hierarchy` to understand who calls the problematic code and what it calls.
8. **Get code actions** — use `POST /code-actions` on the error range to see available quick fixes.
9. **Read file content** — use `GET /active-file-content` for the full source.
10. **Propose fixes** — suggest concrete code changes based on all the information gathered.

## Workflow: Understanding Code Structure

1. **List symbols** — `POST /document-symbols` to get an overview of classes, methods, and variables in a file.
2. **Search workspace** — `POST /workspace-symbols` to find symbols across the entire project by name.
3. **Inspect types** — `POST /hover` on interesting symbols to see their types. Use `POST /inlay-hints` for a range overview of type annotations.
4. **Trace definitions** — `POST /definition`, `POST /declaration`, and `POST /type-definition` to understand the type hierarchy.
5. **Explore hierarchy** — `POST /type-hierarchy` to see supertypes and subtypes. `POST /call-hierarchy` to trace call graphs.
6. **Find usages** — `POST /references` to see how symbols are used across the project.
7. **View code blocks** — `POST /folding-ranges` to understand the logical structure of a file.
8. **Get completions** — `POST /completion` to see what the language server suggests at a specific position.

## Error Handling

- **401 Unauthorized**: The `x-auth-token` header is missing or incorrect. Ask the user for the correct token.
- **400 Bad Request**: Missing or invalid parameters in the request body. Check the required fields.
- **404 Not Found (on /active-file-content)**: No file is currently open in the editor.
- **Empty results**: If endpoints return empty arrays, the Language Server may still be loading, or the position/file may be incorrect.
- **Connection refused**: The extension is not running. Ask the user to ensure VS Code Agent Bridge is installed and active.

## Configuration

The default port is `3003`. If changed, find it in VS Code settings under `vscAgentBridge.port`.
