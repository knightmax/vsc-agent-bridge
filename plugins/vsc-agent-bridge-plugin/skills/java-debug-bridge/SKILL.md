---
name: java-debug-bridge
description: "Query VS Code Language Server diagnostics, hover info, and go-to-definition through a local HTTP bridge. Use this skill whenever you need to debug a Java project, investigate compilation errors, find type information, look up method signatures, navigate to symbol definitions, or read the currently open file. Also use it for any language with an LSP extension installed in VS Code (Python, TypeScript, Go, etc.) when the user asks about compiler errors, type info, or code navigation."
argument-hint: "Describe the debugging task: e.g. 'check for compilation errors', 'find the definition of MyService', 'get hover info for line 42 col 8'."
compatibility: copilot
user-invocable: true
disable-model-invocation: false
---

# Java Debug Bridge — VS Code Agent Bridge Skill

This skill lets you interact with the **VS Code Agent Bridge** extension, a local HTTP server that exposes Language Server Protocol (LSP) features as REST endpoints. It is the primary way to get real-time compiler diagnostics, type information, and code navigation data from the user's VS Code editor.

## Prerequisites

The **VS Code Agent Bridge** extension must be installed and running. It starts automatically when a Java file or Java project is opened in VS Code. The server runs on `http://127.0.0.1:3003` by default.

### Authentication

Every request **must** include the header:

```
x-auth-token: <token>
```

Ask the user for the token if you don't have it. They can copy it from VS Code via the command **"Agent Bridge: Copy Auth Token to Clipboard"** in the Command Palette.

## Available Endpoints

### 1. Get Diagnostics (errors, warnings)

Retrieve all compiler errors and warnings for the workspace or a specific file. This is the most important endpoint for debugging — always start here.

```bash
# All workspace diagnostics
curl -s -H "x-auth-token: $TOKEN" http://127.0.0.1:3003/diagnostics

# Diagnostics for a specific file
curl -s -H "x-auth-token: $TOKEN" "http://127.0.0.1:3003/diagnostics?file=/absolute/path/to/File.java"
```

**Response:**

```json
[
  {
    "file": "/home/user/project/src/Main.java",
    "diagnostics": [
      {
        "range": {
          "start": { "line": 10, "character": 4 },
          "end": { "line": 10, "character": 20 }
        },
        "message": "The method foo() is undefined for the type Main",
        "severity": "error",
        "source": "Java",
        "code": "67108964"
      }
    ]
  }
]
```

### 2. Go to Definition

Find where a symbol (variable, method, class) is defined. Send the file path and cursor position.

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/File.java", "line": 15, "character": 10}' \
  http://127.0.0.1:3003/definition
```

**Response:**

```json
{
  "definitions": [
    {
      "uri": "/home/user/project/src/Utils.java",
      "range": {
        "start": { "line": 5, "character": 0 },
        "end": { "line": 5, "character": 25 }
      }
    }
  ]
}
```

### 3. Get Hover Information (type, docs)

Get the type signature, Javadoc, or documentation for a symbol at a specific position.

```bash
curl -s -X POST -H "x-auth-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"file": "/path/to/File.java", "line": 15, "character": 10}' \
  http://127.0.0.1:3003/hover
```

**Response:**

```json
{
  "contents": [
    "```java\npublic static void main(String[] args)\n```",
    "The entry point of the application."
  ]
}
```

### 4. Read Active File Content

Get the full text of whatever file is currently open in the user's editor.

```bash
curl -s -H "x-auth-token: $TOKEN" http://127.0.0.1:3003/active-file-content
```

**Response:**

```json
{
  "file": "/home/user/project/src/Main.java",
  "languageId": "java",
  "lineCount": 42,
  "content": "package com.example;\n\npublic class Main { ... }"
}
```

### 5. Health Check

Verify the bridge is running and see available endpoints.

```bash
curl -s -H "x-auth-token: $TOKEN" http://127.0.0.1:3003/
```

## Debugging Workflow

When the user asks you to debug or investigate issues in their project, follow this sequence:

1. **Get the auth token** — ask the user if you don't have it.
2. **Fetch diagnostics** — call `GET /diagnostics` to see all current errors and warnings.
3. **Investigate specific errors** — for each error, use `POST /hover` on the problematic position to understand the types involved.
4. **Navigate definitions** — use `POST /definition` to trace where symbols are defined when you need more context.
5. **Read file content** — use `GET /active-file-content` if you need the full source of the file the user is looking at.
6. **Propose fixes** — based on the diagnostic messages, type information, and definitions found, suggest concrete code changes.

## Error Handling

- **401 Unauthorized**: The `x-auth-token` header is missing or incorrect. Ask the user for the correct token.
- **404 Not Found (on /active-file-content)**: No file is currently open in the editor. Ask the user to open a file.
- **Empty results**: If `/diagnostics` returns `[]`, the project has no errors. If `/definition` returns `{"definitions": []}`, the Language Server couldn't resolve the symbol — the position might be wrong or the LSP is still loading.
- **Connection refused**: The extension is not running. Ask the user to ensure the VS Code Agent Bridge extension is installed and the workspace contains the relevant language files.

## Configuration

The default port is `3003`. If the user has changed it, they can find the correct port in VS Code settings under `vscAgentBridge.port`. Adjust your requests accordingly.
