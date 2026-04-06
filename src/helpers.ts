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

export interface ReferenceLocationResponse {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface DocumentSymbolResponse {
  name: string;
  kind: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  selectionRange: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  children: DocumentSymbolResponse[];
}

export interface CodeActionResponse {
  title: string;
  kind: string | undefined;
  isPreferred: boolean | undefined;
}

export interface RangeParams {
  file: string;
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}

export interface RenameParams {
  file: string;
  line: number;
  character: number;
  newName: string;
}

export interface FileParams {
  file: string;
}

export interface WorkspaceSymbolParams {
  query: string;
  folder?: string;
}

export interface WorkspaceSymbolResponse {
  name: string;
  kind: string;
  containerName: string;
  location: {
    uri: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  };
}

export interface CallHierarchyItemResponse {
  name: string;
  kind: string;
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  selectionRange: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface CallHierarchyCallResponse {
  from: CallHierarchyItemResponse;
  fromRanges: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  }[];
}

export interface CallHierarchyOutgoingCallResponse {
  to: CallHierarchyItemResponse;
  fromRanges: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  }[];
}

export interface TypeHierarchyItemResponse {
  name: string;
  kind: string;
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  selectionRange: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface CompletionItemResponse {
  label: string;
  kind: string;
  detail: string | undefined;
  documentation: string | undefined;
  sortText: string | undefined;
  filterText: string | undefined;
  insertText: string | undefined;
}

export interface InlayHintResponse {
  position: { line: number; character: number };
  label: string;
  kind: string | undefined;
}

export interface FoldingRangeResponse {
  startLine: number;
  endLine: number;
  kind: string | undefined;
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

/**
 * Map a numeric SymbolKind to a human-readable string.
 * Values match the VS Code SymbolKind enum.
 */
export function symbolKindToString(kind: number): string {
  const kinds: Record<number, string> = {
    0: "File",
    1: "Module",
    2: "Namespace",
    3: "Package",
    4: "Class",
    5: "Method",
    6: "Property",
    7: "Field",
    8: "Constructor",
    9: "Enum",
    10: "Interface",
    11: "Function",
    12: "Variable",
    13: "Constant",
    14: "String",
    15: "Number",
    16: "Boolean",
    17: "Array",
    18: "Object",
    19: "Key",
    20: "Null",
    21: "EnumMember",
    22: "Struct",
    23: "Event",
    24: "Operator",
    25: "TypeParameter",
  };
  return kinds[kind] ?? "Unknown";
}

/**
 * Parse and validate range parameters from a JSON body.
 */
export function parseRangeParams(
  raw: string,
): { ok: true; params: RangeParams } | { ok: false; error: string } {
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
  if (typeof obj.startLine !== "number" || obj.startLine < 0) {
    return { ok: false, error: "'startLine' (non-negative number) is required." };
  }
  if (typeof obj.startCharacter !== "number" || obj.startCharacter < 0) {
    return { ok: false, error: "'startCharacter' (non-negative number) is required." };
  }
  if (typeof obj.endLine !== "number" || obj.endLine < 0) {
    return { ok: false, error: "'endLine' (non-negative number) is required." };
  }
  if (typeof obj.endCharacter !== "number" || obj.endCharacter < 0) {
    return { ok: false, error: "'endCharacter' (non-negative number) is required." };
  }

  return {
    ok: true,
    params: {
      file: obj.file as string,
      startLine: obj.startLine as number,
      startCharacter: obj.startCharacter as number,
      endLine: obj.endLine as number,
      endCharacter: obj.endCharacter as number,
    },
  };
}

/**
 * Parse and validate rename parameters from a JSON body.
 */
export function parseRenameParams(
  raw: string,
): { ok: true; params: RenameParams } | { ok: false; error: string } {
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
    return { ok: false, error: "'character' (non-negative number) is required." };
  }
  if (typeof obj.newName !== "string" || obj.newName.length === 0) {
    return { ok: false, error: "'newName' (non-empty string) is required." };
  }

  return {
    ok: true,
    params: {
      file: obj.file as string,
      line: obj.line as number,
      character: obj.character as number,
      newName: obj.newName as string,
    },
  };
}

/**
 * Parse and validate file-only parameters from a JSON body.
 */
export function parseFileParams(
  raw: string,
): { ok: true; params: FileParams } | { ok: false; error: string } {
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

  return {
    ok: true,
    params: { file: obj.file as string },
  };
}

/**
 * Parse and validate workspace symbol search parameters from a JSON body.
 */
export function parseWorkspaceSymbolParams(
  raw: string,
): { ok: true; params: WorkspaceSymbolParams } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid JSON body." };
  }

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.query !== "string") {
    return { ok: false, error: "'query' (string) is required." };
  }

  if (obj.folder !== undefined && typeof obj.folder !== "string") {
    return { ok: false, error: "'folder' must be a string if provided." };
  }

  return {
    ok: true,
    params: {
      query: obj.query as string,
      ...(typeof obj.folder === "string" ? { folder: obj.folder } : {}),
    },
  };
}

/**
 * Map a numeric CompletionItemKind to a human-readable string.
 * Values match the VS Code CompletionItemKind enum.
 */
export function completionItemKindToString(kind: number): string {
  const kinds: Record<number, string> = {
    0: "Text",
    1: "Method",
    2: "Function",
    3: "Constructor",
    4: "Field",
    5: "Variable",
    6: "Class",
    7: "Interface",
    8: "Module",
    9: "Property",
    10: "Unit",
    11: "Value",
    12: "Enum",
    13: "Keyword",
    14: "Snippet",
    15: "Color",
    16: "File",
    17: "Reference",
    18: "Folder",
    19: "EnumMember",
    20: "Constant",
    21: "Struct",
    22: "Event",
    23: "Operator",
    24: "TypeParameter",
    25: "User",
    26: "Issue",
  };
  return kinds[kind] ?? "Unknown";
}

/**
 * Map a numeric InlayHintKind to a human-readable string.
 */
export function inlayHintKindToString(kind: number | undefined): string | undefined {
  if (kind === undefined || kind === null) { return undefined; }
  switch (kind) {
    case 1:
      return "Type";
    case 2:
      return "Parameter";
    default:
      return "Unknown";
  }
}

/**
 * Map a numeric FoldingRangeKind to a human-readable string.
 */
export function foldingRangeKindToString(kind: number | undefined): string | undefined {
  if (kind === undefined || kind === null) { return undefined; }
  switch (kind) {
    case 1:
      return "Comment";
    case 2:
      return "Imports";
    case 3:
      return "Region";
    default:
      return "Unknown";
  }
}
