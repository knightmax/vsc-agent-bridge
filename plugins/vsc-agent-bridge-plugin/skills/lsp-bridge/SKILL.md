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

The **VS Code Agent Bridge** extension must be installed and running. It activates automatically when VS Code starts.

### Instance Discovery (recommended)

The extension writes a JSON discovery file to `~/.vsc-agent-bridge/` when it starts. Each VS Code instance writes its own file containing the port, auth token, and workspace folders.

**To find the right instance automatically:**

1. List files in `~/.vsc-agent-bridge/*.json`
2. Read each file to find the one whose `workspaceFolders` contains your project path
3. Use the `port` and `token` from that file

Example discovery file:

```json
{
  "port": 54321,
  "token": "abc123...",
  "pid": 12345,
  "version": "0.4.0",
  "workspaceFolders": ["/Users/dev/projects/my-app"],
  "startedAt": "2026-04-06T10:30:00Z"
}
```

You can also call `GET /info` (no auth required) on any port to verify which VS Code instance is running there.

### Authentication

Every request (except `GET /info`) **must** include the header:

```
x-auth-token: <token>
```

The token is available from the discovery file (`~/.vsc-agent-bridge/*.json`). If discovery files are not available, ask the user to copy it from VS Code via the command **"Agent Bridge: Copy Connection Info to Clipboard"** in the Command Palette.

### Language-specific prerequisites

#### JavaScript / CommonJS

For cross-file navigation (`/definition`, `/references`, `/implementation`, `/rename-preview`) to work correctly, a `jsconfig.json` must exist at the project root:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "src/*": ["src/*"] }
  },
  "include": ["src/**/*"]
}
```

Without this file, tsserver limits resolution to the current file only. The following endpoints degrade:
- `/definition` — resolves to the local `require(...)` line instead of the source file
- `/references` — only finds references within the same file
- `/implementation` — only finds implementations within the same file
- `/rename-preview` — only renames within the same file (**dangerous**: partial rename can break the project)
- `/call-hierarchy` — `incomingCalls` always empty
- `/inlay-hints` — empty unless `javascript.inlayHints.*` settings are enabled in VS Code

#### TypeScript

Works out of the box when `tsconfig.json` is present.

#### Java

No additional configuration required. JDT.LS resolves cross-module.

## API Reference

The full API is described in the **OpenAPI 3.0 specification**:

📄 **[references/openapi.yaml](references/openapi.yaml)**

All POST endpoints expect a JSON body with `Content-Type: application/json`.

### Quick reference

| Endpoint | Method | Description |
|---|---|---|
| `/info` | `GET` | Instance info (no auth). Port, PID, workspace folders. |
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

Use the optional `folder` parameter to scope results to a specific project and exclude symbols from other projects, dependencies, or Markdown files:

```json
{ "query": "UserService", "folder": "/absolute/path/to/project" }
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

- **401 Unauthorized**: The `x-auth-token` header is missing or incorrect. Read the token from the discovery file or ask the user.
- **400 Bad Request**: Missing or invalid parameters in the request body. Check the required fields.
- **404 Not Found**: The file path does not exist, or (on `/active-file-content`) no file is currently open.
- **Empty results**: If endpoints return empty arrays, the Language Server may still be loading, the position/file may be incorrect, or the Language Server does not support the feature for this language.
- **Connection refused**: The extension is not running. Ask the user to ensure VS Code Agent Bridge is installed and active.

> **Note:** The `/diagnostics` endpoint returns a **root-level JSON array** `[...]`, not wrapped in an object, unlike other endpoints.

## Language Server Limitations

The quality and completeness of results depends on the Language Server behind each language. Known limitations:

### Java (JDT.LS / Red Hat Java)
- **`/declaration`**: Always returns empty. Java does not distinguish declaration from definition. Use `/definition` instead.
- **`/type-hierarchy`**: May return `item: null` for many positions. The cursor must be precisely on the type name in its declaration. Consider `/implementation` as an alternative.
- **`/inlay-hints`**: The `kind` field is not provided by JDT.LS. The bridge applies a heuristic: labels ending with `:` → `Parameter`, labels starting with `:` → `Type`. Some hints may still have no `kind`.
- **`/folding-ranges`**: Only import blocks have `kind: "Imports"`. Other code blocks have no `kind` value.
- **`/hover`**: Contents may include VS Code internal `command:` links (automatically stripped by the bridge).

### JavaScript / CommonJS (tsserver)
- **`/declaration`**: Always returns empty (same as Java).
- **`/type-definition`**: Always empty for pure JavaScript without JSDoc `@type` annotations.
- **`/type-hierarchy`**: Returns `item: null` systematically.
- **`/document-symbols`**: `module.exports = ...` appears as `<unknown>` symbol names.
- **`/workspace-symbols`**: Results are global and may include symbols from other projects, dependencies, and Markdown files in the workspace. Use the `folder` parameter to scope results.

### General Notes
- Optional fields (`kind`, `documentation`, `isPreferred`) may be absent from responses when the Language Server does not provide them.
- Cross-file features degrade without proper project configuration (see Language-specific prerequisites).
- **`_warning` field**: Cross-file endpoints (`/definition`, `/references`, `/implementation`, `/rename-preview`, `/call-hierarchy`) include a `_warning` string when no `jsconfig.json` or `tsconfig.json` is found for a JS/TS file. This signals that results may be limited to the current file.

## Configuration

By default the extension picks a **random available port** (port `0`). The actual port is written to the discovery file at `~/.vsc-agent-bridge/<workspace-id>.json`.

To use a fixed port, set `vscAgentBridge.port` in VS Code settings. Use `0` for automatic assignment (recommended for multi-instance support).
