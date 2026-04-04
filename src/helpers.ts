import * as http from "http";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PositionParams {
  file: string;
  line: number;
  character: number;
}

export interface DiagnosticResponse {
  file: string;
  diagnostics: SerializedDiagnostic[];
}

export interface SerializedDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  message: string;
  severity: string;
  source: string | undefined;
  code: string | number | undefined;
}

export interface DefinitionLocationResponse {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface HoverContentResponse {
  contents: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a numeric diagnostic severity to a human-readable string.
 * The numeric values match the VS Code DiagnosticSeverity enum:
 *   0 = Error, 1 = Warning, 2 = Information, 3 = Hint.
 */
export function severityToString(severity: number): string {
  switch (severity) {
    case 0:
      return "error";
    case 1:
      return "warning";
    case 2:
      return "information";
    case 3:
      return "hint";
    default:
      return "unknown";
  }
}

/**
 * Read the full body of an incoming HTTP request as a string.
 */
export function readBody(req: http.IncomingMessage): Promise<string> {
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
export function sendJson(
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
export function parsePositionParams(
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
