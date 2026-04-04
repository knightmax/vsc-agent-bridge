import * as vscode from "vscode";
import * as http from "http";
import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PositionParams {
  file: string;
  line: number;
  character: number;
}

interface DiagnosticResponse {
  file: string;
  diagnostics: SerializedDiagnostic[];
}

interface SerializedDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  message: string;
  severity: string;
  source: string | undefined;
  code: string | number | undefined;
}

interface DefinitionLocationResponse {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

interface HoverContentResponse {
  contents: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map VS Code DiagnosticSeverity enum to a human-readable string.
 */
function severityToString(severity: vscode.DiagnosticSeverity): string {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return "error";
    case vscode.DiagnosticSeverity.Warning:
      return "warning";
    case vscode.DiagnosticSeverity.Information:
      return "information";
    case vscode.DiagnosticSeverity.Hint:
      return "hint";
    default:
      return "unknown";
  }
}

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

/**
 * Read the full body of an incoming HTTP request as a string.
 */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

/**
 * Send a JSON response.
 */
function sendJson(
  res: http.ServerResponse,
  statusCode: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any,
): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * Parse and validate the required position parameters from a JSON body.
 */
function parsePositionParams(
  raw: string,
): { ok: true; params: PositionParams } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid JSON body." };
  }

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.file !== "string" || obj.file.length === 0) {
    return { ok: false, error: "'file' (string) is required." };
  }
  if (typeof obj.line !== "number" || obj.line < 0) {
    return { ok: false, error: "'line' (non-negative number) is required." };
  }
  if (typeof obj.character !== "number" || obj.character < 0) {
    return {
      ok: false,
      error: "'character' (non-negative number) is required.",
    };
  }

  return {
    ok: true,
    params: {
      file: obj.file as string,
      line: obj.line as number,
      character: obj.character as number,
    },
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * GET /diagnostics
 *
 * Optional query parameter: `file` – absolute path to restrict diagnostics to
 * a single file.  When omitted, returns diagnostics for the entire workspace.
 */
function handleGetDiagnostics(
  url: URL,
  res: http.ServerResponse,
): void {
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

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

function createServer(authToken: string): http.Server {
  const server = http.createServer(async (req, res) => {
    // ----- Auth check -----
    const token = req.headers["x-auth-token"];
    if (token !== authToken) {
      sendJson(res, 401, { error: "Unauthorized - invalid or missing x-auth-token header." });
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

      // Health-check / discovery
      if (req.method === "GET" && path === "/") {
        sendJson(res, 200, {
          name: "vsc-agent-bridge",
          version: "0.1.0",
          endpoints: [
            "GET  /diagnostics",
            "POST /definition",
            "POST /hover",
            "GET  /active-file-content",
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
