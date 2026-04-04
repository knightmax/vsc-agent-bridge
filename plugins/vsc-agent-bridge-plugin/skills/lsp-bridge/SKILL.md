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

## API Reference

The full API is described in the **OpenAPI 3.0 specification**:

📄 **[references/openapi.yaml](references/openapi.yaml)**

All POST endpoints expect a JSON body with `Content-Type: application/json`.

### Quick reference

| Endpoint | Method | Description |
|---|---|---|
| `/diagnostics` | `GET` | Errors, warnings, hints. Filter with `?file=`. |
| `/definition` | `POST` | Go to definition of a symbol. |
| `/declaration` | `POST` | Go to declaration of a symbol. |
| `/hover` | `POST` | Type signature and documentation. |
| `/references` | `POST` | Find all references to a symbol. |
| `/type-definition` | `POST` | Go to the type definition. |
| `/implementation` | `POST` | Find implementations of an interface/abstract. |
| `/document-symbols` | `POST` | List symbols in a file. |
| `/code-actions` | `POST` | Quick fixes and refactorings for a range. |
| `/signature-help` | `POST` | Parameter hints for a function call. |
| `/rename-preview` | `POST` | Preview rename edits. |
| `/call-hierarchy` | `POST` | Incoming and outgoing calls. |
| `/type-hierarchy` | `POST` | Supertypes and subtypes. |
| `/workspace-symbols` | `POST` | Search symbols across the workspace. |
| `/completion` | `POST` | Code completion suggestions. |
| `/inlay-hints` | `POST` | Type annotations and parameter name hints. |
| `/folding-ranges` | `POST` | Folding ranges (code blocks). |
| `/active-file-content` | `GET` | Full text of the open file. |
| `/` | `GET` | Health-check / endpoint discovery. |

### Common request bodies

**Position-based endpoints** (definition, declaration, hover, references, type-definition, implementation, signature-help, call-hierarchy, type-hierarchy, completion):

```json
{ "file": "/absolute/path/to/file.ts", "line": 15, "character": 10 }
```

**Range-based endpoints** (code-actions, inlay-hints):

```json
{ "file": "/absolute/path/to/file.ts", "startLine": 10, "startCharacter": 0, "endLine": 10, "endCharacter": 30 }
```

**File-only endpoints** (document-symbols, folding-ranges):

```json
{ "file": "/absolute/path/to/file.ts" }
```

**Rename** (rename-preview):

```json
{ "file": "/absolute/path/to/file.ts", "line": 5, "character": 10, "newName": "newVariableName" }
```

**Workspace search** (workspace-symbols):

```json
{ "query": "UserService" }
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
