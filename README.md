# VS Code Agent Bridge

A VS Code extension that starts a **local HTTP server** exposing Language Server features (diagnostics, hover, go-to-definition) as REST endpoints. Designed to let AI assistants interact with VS Code without MCP support.

## Features

| Endpoint | Method | Description |
|---|---|---|
| `/diagnostics` | `GET` | Returns all errors and warnings reported by the language server. |
| `/definition` | `POST` | Returns the definition location for a symbol at a given position. |
| `/hover` | `POST` | Returns hover information (type, documentation) for a given position. |
| `/active-file-content` | `GET` | Returns the full text and metadata of the currently active editor. |
| `/` | `GET` | Health-check that lists all available endpoints. |

## Getting Started

### Prerequisites

- VS Code **1.85+**
- A Language Server extension for your target language (e.g. *Language Support for Java™ by Red Hat* for Java projects)

### Installation

1. Clone this repository.
2. Run `npm install` then `npm run compile`.
3. Press **F5** in VS Code to launch the Extension Development Host.

### Configuration

Open VS Code settings and search for `vscAgentBridge`:

| Setting | Default | Description |
|---|---|---|
| `vscAgentBridge.port` | `3003` | Port for the local HTTP server. |
| `vscAgentBridge.authToken` | *(empty – auto-generated)* | Static auth token. If left empty, a random token is generated each time the extension activates and printed to the console. |

### Activation

The extension activates automatically when:
- A **Java** file is opened (`onLanguage:java`)
- The workspace contains `.java` files (`workspaceContains:**/*.java`)

> **Language-agnostic design:** The REST endpoints delegate to the standard VS Code API (`vscode.languages.getDiagnostics`, `vscode.executeDefinitionProvider`, etc.), so they work with **any** language that has a Language Server extension installed. The activation events target Java by default but can be extended to any language in `package.json`.

## Authentication

Every request must include the header:

```
x-auth-token: <your-token>
```

If you did not configure a static token, the auto-generated token is:
- Printed in the VS Code **Output** / debug console on activation.
- Copyable via the command **"Agent Bridge: Copy Auth Token to Clipboard"** (Command Palette).

## API Reference

### `GET /diagnostics`

Returns all diagnostics (errors, warnings, hints, info) for the workspace.

**Optional query parameter:** `?file=/absolute/path/to/File.java` to filter to a single file.

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
        "message": "The method foo() is undefined",
        "severity": "error",
        "source": "Java",
        "code": "67108964"
      }
    ]
  }
]
```

### `POST /definition`

**Request body:**

```json
{
  "file": "/home/user/project/src/Main.java",
  "line": 15,
  "character": 10
}
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

### `POST /hover`

**Request body:**

```json
{
  "file": "/home/user/project/src/Main.java",
  "line": 15,
  "character": 10
}
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

### `GET /active-file-content`

**Response:**

```json
{
  "file": "/home/user/project/src/Main.java",
  "languageId": "java",
  "lineCount": 42,
  "content": "package com.example;\n\npublic class Main { ... }"
}
```

## Extending to Other Languages

The endpoints are language-agnostic. To activate the extension for other languages:

1. Add `onLanguage:<languageId>` to `activationEvents` in `package.json`.
2. Optionally add `workspaceContains` patterns for the corresponding file extensions.

For example, to also support Python:

```json
"activationEvents": [
  "onLanguage:java",
  "onLanguage:python",
  "workspaceContains:**/*.java",
  "workspaceContains:**/*.py"
]
```

## License

[MIT](LICENSE)
