import * as vscode from "vscode";
import * as http from "http";
import * as crypto from "crypto";

import {
  type DiagnosticResponse,
  type DefinitionLocationResponse,
  type HoverContentResponse,
  type ReferenceLocationResponse,
  type DocumentSymbolResponse,
  type CodeActionResponse,
  type SerializedDiagnostic,
  severityToString,
  symbolKindToString,
  readBody,
  sendJson,
  parsePositionParams,
  parseRangeParams,
  parseRenameParams,
  parseFileParams,
} from "./helpers";

// ---------------------------------------------------------------------------
// Serialization (depends on vscode types)
// ---------------------------------------------------------------------------

/**
 * Serialize a VS Code Diagnostic into a plain JSON-safe object.
 */
function serializeDiagnostic(d: vscode.Diagnostic): SerializedDiagnostic {
  return {
    range: {
      start: { line: d.range.start.line, character: d.range.start.character },
      end: { line: d.range.end.line, character: d.range.end.character },
    },
    message: d.message,
    severity: severityToString(d.severity),
    source: d.source,
    code:
      typeof d.code === "object" && d.code !== null
        ? String(d.code.value)
        : d.code !== undefined
          ? d.code
          : undefined,
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * GET /diagnostics
 *
 * Optional query parameter: `file` - absolute path to restrict diagnostics to
 * a single file.  When omitted, returns diagnostics for the entire workspace.
 */
function handleGetDiagnostics(url: URL, res: http.ServerResponse): void {
  const fileFilter = url.searchParams.get("file");

  const allDiagnostics = vscode.languages.getDiagnostics();
  const result: DiagnosticResponse[] = [];

  for (const [uri, diagnostics] of allDiagnostics) {
    if (fileFilter && uri.fsPath !== fileFilter) {
      continue;
    }
    if (diagnostics.length === 0) {
      continue;
    }
    result.push({
      file: uri.fsPath,
      diagnostics: diagnostics.map(serializeDiagnostic),
    });
  }

  sendJson(res, 200, result);
}

/**
 * POST /definition
 *
 * Body: { "file": "<absolute path>", "line": <number>, "character": <number> }
 */
async function handlePostDefinition(
  body: string,
  res: http.ServerResponse,
): Promise<void> {
  const parsed = parsePositionParams(body);
  if (!parsed.ok) {
    sendJson(res, 400, { error: parsed.error });
    return;
  }

  const { file, line, character } = parsed.params;
  const uri = vscode.Uri.file(file);
  const position = new vscode.Position(line, character);

  const locations = await vscode.commands.executeCommand<
    vscode.Location[] | vscode.LocationLink[] | undefined
  >("vscode.executeDefinitionProvider", uri, position);

  if (!locations || locations.length === 0) {
    sendJson(res, 200, { definitions: [] });
    return;
  }

  const definitions: DefinitionLocationResponse[] = locations.map((loc) => {
    // The result can be a Location or a LocationLink.
    if ("targetUri" in loc) {
      return {
        uri: loc.targetUri.fsPath,
        range: {
          start: {
            line: loc.targetRange.start.line,
            character: loc.targetRange.start.character,
          },
          end: {
            line: loc.targetRange.end.line,
            character: loc.targetRange.end.character,
          },
        },
      };
    }
    return {
      uri: loc.uri.fsPath,
      range: {
        start: {
          line: loc.range.start.line,
          character: loc.range.start.character,
        },
        end: {
          line: loc.range.end.line,
          character: loc.range.end.character,
        },
      },
    };
  });

  sendJson(res, 200, { definitions });
}

/**
 * POST /hover
 *
 * Body: { "file": "<absolute path>", "line": <number>, "character": <number> }
 */
async function handlePostHover(
  body: string,
  res: http.ServerResponse,
): Promise<void> {
  const parsed = parsePositionParams(body);
  if (!parsed.ok) {
    sendJson(res, 400, { error: parsed.error });
    return;
  }

  const { file, line, character } = parsed.params;
  const uri = vscode.Uri.file(file);
  const position = new vscode.Position(line, character);

  const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
    "vscode.executeHoverProvider",
    uri,
    position,
  );

  if (!hovers || hovers.length === 0) {
    sendJson(res, 200, { contents: [] });
    return;
  }

  const contents: string[] = [];
  for (const hover of hovers) {
    for (const content of hover.contents) {
      if (typeof content === "string") {
        contents.push(content);
      } else {
        // MarkdownString
        contents.push(content.value);
      }
    }
  }

  const result: HoverContentResponse = { contents };
  sendJson(res, 200, result);
}

/**
 * GET /active-file-content
 *
 * Returns the full text and metadata of the currently active editor.
 */
function handleGetActiveFileContent(res: http.ServerResponse): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    sendJson(res, 404, {
      error: "No active text editor is open.",
    });
    return;
  }

  const document = editor.document;
  sendJson(res, 200, {
    file: document.uri.fsPath,
    languageId: document.languageId,
    lineCount: document.lineCount,
    content: document.getText(),
  });
}

/**
 * POST /references
 *
 * Body: { "file": "<absolute path>", "line": <number>, "character": <number> }
 */
async function handlePostReferences(
  body: string,
  res: http.ServerResponse,
): Promise<void> {
  const parsed = parsePositionParams(body);
  if (!parsed.ok) {
    sendJson(res, 400, { error: parsed.error });
    return;
  }

  const { file, line, character } = parsed.params;
  const uri = vscode.Uri.file(file);
  const position = new vscode.Position(line, character);

  const locations = await vscode.commands.executeCommand<
    vscode.Location[] | undefined
  >("vscode.executeReferenceProvider", uri, position);

  if (!locations || locations.length === 0) {
    sendJson(res, 200, { references: [] });
    return;
  }

  const references: ReferenceLocationResponse[] = locations.map((loc) => ({
    uri: loc.uri.fsPath,
    range: {
      start: {
        line: loc.range.start.line,
        character: loc.range.start.character,
      },
      end: {
        line: loc.range.end.line,
        character: loc.range.end.character,
      },
    },
  }));

  sendJson(res, 200, { references });
}

/**
 * POST /type-definition
 *
 * Body: { "file": "<absolute path>", "line": <number>, "character": <number> }
 */
async function handlePostTypeDefinition(
  body: string,
  res: http.ServerResponse,
): Promise<void> {
  const parsed = parsePositionParams(body);
  if (!parsed.ok) {
    sendJson(res, 400, { error: parsed.error });
    return;
  }

  const { file, line, character } = parsed.params;
  const uri = vscode.Uri.file(file);
  const position = new vscode.Position(line, character);

  const locations = await vscode.commands.executeCommand<
    vscode.Location[] | vscode.LocationLink[] | undefined
  >("vscode.executeTypeDefinitionProvider", uri, position);

  if (!locations || locations.length === 0) {
    sendJson(res, 200, { definitions: [] });
    return;
  }

  const definitions: DefinitionLocationResponse[] = locations.map((loc) => {
    if ("targetUri" in loc) {
      return {
        uri: loc.targetUri.fsPath,
        range: {
          start: {
            line: loc.targetRange.start.line,
            character: loc.targetRange.start.character,
          },
          end: {
            line: loc.targetRange.end.line,
            character: loc.targetRange.end.character,
          },
        },
      };
    }
    return {
      uri: loc.uri.fsPath,
      range: {
        start: {
          line: loc.range.start.line,
          character: loc.range.start.character,
        },
        end: {
          line: loc.range.end.line,
          character: loc.range.end.character,
        },
      },
    };
  });

  sendJson(res, 200, { definitions });
}

/**
 * POST /implementation
 *
 * Body: { "file": "<absolute path>", "line": <number>, "character": <number> }
 */
async function handlePostImplementation(
  body: string,
  res: http.ServerResponse,
): Promise<void> {
  const parsed = parsePositionParams(body);
  if (!parsed.ok) {
    sendJson(res, 400, { error: parsed.error });
    return;
  }

  const { file, line, character } = parsed.params;
  const uri = vscode.Uri.file(file);
  const position = new vscode.Position(line, character);

  const locations = await vscode.commands.executeCommand<
    vscode.Location[] | vscode.LocationLink[] | undefined
  >("vscode.executeImplementationProvider", uri, position);

  if (!locations || locations.length === 0) {
    sendJson(res, 200, { implementations: [] });
    return;
  }

  const implementations: DefinitionLocationResponse[] = locations.map((loc) => {
    if ("targetUri" in loc) {
      return {
        uri: loc.targetUri.fsPath,
        range: {
          start: {
            line: loc.targetRange.start.line,
            character: loc.targetRange.start.character,
          },
          end: {
            line: loc.targetRange.end.line,
            character: loc.targetRange.end.character,
          },
        },
      };
    }
    return {
      uri: loc.uri.fsPath,
      range: {
        start: {
          line: loc.range.start.line,
          character: loc.range.start.character,
        },
        end: {
          line: loc.range.end.line,
          character: loc.range.end.character,
        },
      },
    };
  });

  sendJson(res, 200, { implementations });
}

/**
 * POST /document-symbols
 *
 * Body: { "file": "<absolute path>" }
 */
async function handlePostDocumentSymbols(
  body: string,
  res: http.ServerResponse,
): Promise<void> {
  const parsed = parseFileParams(body);
  if (!parsed.ok) {
    sendJson(res, 400, { error: parsed.error });
    return;
  }

  const uri = vscode.Uri.file(parsed.params.file);

  const symbols = await vscode.commands.executeCommand<
    vscode.DocumentSymbol[] | vscode.SymbolInformation[] | undefined
  >("vscode.executeDocumentSymbolProvider", uri);

  if (!symbols || symbols.length === 0) {
    sendJson(res, 200, { symbols: [] });
    return;
  }

  function serializeDocumentSymbol(
    sym: vscode.DocumentSymbol,
  ): DocumentSymbolResponse {
    return {
      name: sym.name,
      kind: symbolKindToString(sym.kind),
      range: {
        start: {
          line: sym.range.start.line,
          character: sym.range.start.character,
        },
        end: {
          line: sym.range.end.line,
          character: sym.range.end.character,
        },
      },
      selectionRange: {
        start: {
          line: sym.selectionRange.start.line,
          character: sym.selectionRange.start.character,
        },
        end: {
          line: sym.selectionRange.end.line,
          character: sym.selectionRange.end.character,
        },
      },
      children: sym.children
        ? sym.children.map(serializeDocumentSymbol)
        : [],
    };
  }

  // Handle both DocumentSymbol[] and SymbolInformation[]
  const result: DocumentSymbolResponse[] = symbols.map((sym) => {
    if ("children" in sym) {
      return serializeDocumentSymbol(sym as vscode.DocumentSymbol);
    }
    // SymbolInformation (legacy)
    const si = sym as vscode.SymbolInformation;
    return {
      name: si.name,
      kind: symbolKindToString(si.kind),
      range: {
        start: {
          line: si.location.range.start.line,
          character: si.location.range.start.character,
        },
        end: {
          line: si.location.range.end.line,
          character: si.location.range.end.character,
        },
      },
      selectionRange: {
        start: {
          line: si.location.range.start.line,
          character: si.location.range.start.character,
        },
        end: {
          line: si.location.range.end.line,
          character: si.location.range.end.character,
        },
      },
      children: [],
    };
  });

  sendJson(res, 200, { symbols: result });
}

/**
 * POST /code-actions
 *
 * Body: { "file": "<path>", "startLine": N, "startCharacter": N, "endLine": N, "endCharacter": N }
 */
async function handlePostCodeActions(
  body: string,
  res: http.ServerResponse,
): Promise<void> {
  const parsed = parseRangeParams(body);
  if (!parsed.ok) {
    sendJson(res, 400, { error: parsed.error });
    return;
  }

  const { file, startLine, startCharacter, endLine, endCharacter } =
    parsed.params;
  const uri = vscode.Uri.file(file);
  const range = new vscode.Range(
    new vscode.Position(startLine, startCharacter),
    new vscode.Position(endLine, endCharacter),
  );

  const actions = await vscode.commands.executeCommand<
    vscode.CodeAction[] | undefined
  >("vscode.executeCodeActionProvider", uri, range);

  if (!actions || actions.length === 0) {
    sendJson(res, 200, { actions: [] });
    return;
  }

  const result: CodeActionResponse[] = actions.map((a) => ({
    title: a.title,
    kind: a.kind?.value,
    isPreferred: a.isPreferred,
  }));

  sendJson(res, 200, { actions: result });
}

/**
 * POST /signature-help
 *
 * Body: { "file": "<absolute path>", "line": <number>, "character": <number> }
 */
async function handlePostSignatureHelp(
  body: string,
  res: http.ServerResponse,
): Promise<void> {
  const parsed = parsePositionParams(body);
  if (!parsed.ok) {
    sendJson(res, 400, { error: parsed.error });
    return;
  }

  const { file, line, character } = parsed.params;
  const uri = vscode.Uri.file(file);
  const position = new vscode.Position(line, character);

  const help = await vscode.commands.executeCommand<
    vscode.SignatureHelp | undefined
  >("vscode.executeSignatureHelpProvider", uri, position);

  if (!help || !("signatures" in help) || help.signatures.length === 0) {
    sendJson(res, 200, { signatures: [], activeSignature: 0, activeParameter: 0 });
    return;
  }

  const signatures = help.signatures.map((sig) => ({
    label: sig.label,
    documentation:
      typeof sig.documentation === "string"
        ? sig.documentation
        : sig.documentation?.value ?? "",
    parameters: sig.parameters.map((p) => ({
      label: p.label,
      documentation:
        typeof p.documentation === "string"
          ? p.documentation
          : p.documentation?.value ?? "",
    })),
  }));

  sendJson(res, 200, {
    signatures,
    activeSignature: help.activeSignature,
    activeParameter: help.activeParameter,
  });
}

/**
 * POST /rename-preview
 *
 * Body: { "file": "<path>", "line": N, "character": N, "newName": "<string>" }
 * Returns the set of edits that would be applied by a rename, without actually
 * applying them.
 */
async function handlePostRenamePreview(
  body: string,
  res: http.ServerResponse,
): Promise<void> {
  const parsed = parseRenameParams(body);
  if (!parsed.ok) {
    sendJson(res, 400, { error: parsed.error });
    return;
  }

  const { file, line, character, newName } = parsed.params;
  const uri = vscode.Uri.file(file);
  const position = new vscode.Position(line, character);

  const edit = await vscode.commands.executeCommand<
    vscode.WorkspaceEdit | undefined
  >("vscode.executeDocumentRenameProvider", uri, position, newName);

  if (!edit) {
    sendJson(res, 200, { changes: [] });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const changes: any[] = [];
  for (const [changeUri, textEdits] of edit.entries()) {
    changes.push({
      file: changeUri.fsPath,
      edits: textEdits.map((te) => ({
        range: {
          start: {
            line: te.range.start.line,
            character: te.range.start.character,
          },
          end: {
            line: te.range.end.line,
            character: te.range.end.character,
          },
        },
        newText: te.newText,
      })),
    });
  }

  sendJson(res, 200, { changes });
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export function createServer(authToken: string): http.Server {
  const server = http.createServer(async (req, res) => {
    // ----- Auth check -----
    const token = req.headers["x-auth-token"];
    if (token !== authToken) {
      sendJson(res, 401, {
        error: "Unauthorized - invalid or missing x-auth-token header.",
      });
      return;
    }

    // ----- Routing -----
    const url = new URL(req.url ?? "/", `http://localhost`);
    const path = url.pathname;

    try {
      if (req.method === "GET" && path === "/diagnostics") {
        handleGetDiagnostics(url, res);
        return;
      }

      if (req.method === "POST" && path === "/definition") {
        const body = await readBody(req);
        await handlePostDefinition(body, res);
        return;
      }

      if (req.method === "POST" && path === "/hover") {
        const body = await readBody(req);
        await handlePostHover(body, res);
        return;
      }

      if (req.method === "GET" && path === "/active-file-content") {
        handleGetActiveFileContent(res);
        return;
      }

      if (req.method === "POST" && path === "/references") {
        const body = await readBody(req);
        await handlePostReferences(body, res);
        return;
      }

      if (req.method === "POST" && path === "/type-definition") {
        const body = await readBody(req);
        await handlePostTypeDefinition(body, res);
        return;
      }

      if (req.method === "POST" && path === "/implementation") {
        const body = await readBody(req);
        await handlePostImplementation(body, res);
        return;
      }

      if (req.method === "POST" && path === "/document-symbols") {
        const body = await readBody(req);
        await handlePostDocumentSymbols(body, res);
        return;
      }

      if (req.method === "POST" && path === "/code-actions") {
        const body = await readBody(req);
        await handlePostCodeActions(body, res);
        return;
      }

      if (req.method === "POST" && path === "/signature-help") {
        const body = await readBody(req);
        await handlePostSignatureHelp(body, res);
        return;
      }

      if (req.method === "POST" && path === "/rename-preview") {
        const body = await readBody(req);
        await handlePostRenamePreview(body, res);
        return;
      }

      // Health-check / discovery
      if (req.method === "GET" && path === "/") {
        sendJson(res, 200, {
          name: "vsc-agent-bridge",
          version: "0.2.0",
          endpoints: [
            "GET  /diagnostics",
            "POST /definition",
            "POST /hover",
            "GET  /active-file-content",
            "POST /references",
            "POST /type-definition",
            "POST /implementation",
            "POST /document-symbols",
            "POST /code-actions",
            "POST /signature-help",
            "POST /rename-preview",
          ],
        });
        return;
      }

      sendJson(res, 404, { error: `Route not found: ${req.method} ${path}` });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Internal server error";
      sendJson(res, 500, { error: message });
    }
  });

  return server;
}

// ---------------------------------------------------------------------------
// Extension lifecycle
// ---------------------------------------------------------------------------

let server: http.Server | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration("vscAgentBridge");
  const port = config.get<number>("port", 3003);
  const configuredToken = config.get<string>("authToken", "");

  // Use the configured token, or generate a random one.
  const authToken =
    configuredToken.length > 0
      ? configuredToken
      : crypto.randomBytes(24).toString("hex");

  server = createServer(authToken);

  server.listen(port, "127.0.0.1", () => {
    const message = `Agent Bridge server listening on http://127.0.0.1:${port}`;
    vscode.window.showInformationMessage(message);
    console.log(message);
    // Token is available via the "Agent Bridge: Copy Auth Token to Clipboard" command.
    // It is intentionally NOT logged to avoid accidental exposure.
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      vscode.window.showErrorMessage(
        `Agent Bridge: port ${port} is already in use. Change it in settings (vscAgentBridge.port).`,
      );
    } else {
      vscode.window.showErrorMessage(
        `Agent Bridge: failed to start server - ${err.message}`,
      );
    }
  });

  // Register a command to display the auth token on demand.
  const showTokenCmd = vscode.commands.registerCommand(
    "vscAgentBridge.showAuthToken",
    () => {
      vscode.env.clipboard.writeText(authToken);
      vscode.window.showInformationMessage(
        "Agent Bridge auth token copied to clipboard.",
      );
    },
  );

  context.subscriptions.push(showTokenCmd);
  context.subscriptions.push({
    dispose: () => {
      if (server) {
        server.close();
        server = undefined;
      }
    },
  });
}

export function deactivate(): void {
  if (server) {
    server.close();
    server = undefined;
  }
}
