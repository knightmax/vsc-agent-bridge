import { describe, it, expect, afterAll, beforeAll } from "vitest";
import * as http from "http";

// We import the createServer factory from extension.ts.  Since that module
// imports `vscode`, we need to provide a minimal mock *before* importing it.
// Vitest runs in Node — there's no vscode runtime — so we mock the module.

import { vi } from "vitest";

// Minimal vscode mock for the parts referenced by extension.ts.
vi.mock("vscode", () => ({
  languages: {
    getDiagnostics: vi.fn(() => []),
  },
  window: {
    activeTextEditor: undefined,
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_key: string, def: unknown) => def),
    })),
  },
  commands: {
    executeCommand: vi.fn(async () => []),
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
  },
  env: {
    clipboard: { writeText: vi.fn() },
  },
  Uri: {
    file: (path: string) => ({ fsPath: path, toString: () => path }),
  },
  Position: class {
    constructor(
      public line: number,
      public character: number,
    ) {}
  },
  Range: class {
    constructor(
      public start: { line: number; character: number },
      public end: { line: number; character: number },
    ) {}
  },
  DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
}));

// Now safe to import
import { createServer } from "../extension";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const AUTH_TOKEN = "test-secret-token";

function request(
  server: http.Server,
  opts: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      return reject(new Error("Server not listening"));
    }

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: addr.port,
        method: opts.method,
        path: opts.path,
        headers: {
          "x-auth-token": AUTH_TOKEN,
          "content-type": "application/json",
          ...opts.headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf-8");
          let body: unknown;
          try {
            body = JSON.parse(raw);
          } catch {
            body = raw;
          }
          resolve({ status: res.statusCode ?? 0, body });
        });
      },
    );

    req.on("error", reject);

    if (opts.body) {
      req.write(opts.body);
    }
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HTTP server", () => {
  let server: http.Server;

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        server = createServer(AUTH_TOKEN);
        server.listen(0, "127.0.0.1", () => resolve());
      }),
  );

  afterAll(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  );

  // -- Auth ----------------------------------------------------------------

  it("rejects requests without auth token", async () => {
    const { status, body } = await request(server, {
      method: "GET",
      path: "/",
      headers: { "x-auth-token": "wrong-token" },
    });
    expect(status).toBe(401);
    expect(body).toEqual({
      error: "Unauthorized - invalid or missing x-auth-token header.",
    });
  });

  it("rejects requests with missing auth header", async () => {
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("Server not listening");
    }

    const { status } = await new Promise<{
      status: number;
      body: unknown;
    }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: (addr as { port: number }).port,
          method: "GET",
          path: "/",
          // no x-auth-token header
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf-8");
            resolve({
              status: res.statusCode ?? 0,
              body: JSON.parse(raw),
            });
          });
        },
      );
      req.on("error", reject);
      req.end();
    });

    expect(status).toBe(401);
  });

  // -- Health check --------------------------------------------------------

  it("GET / returns health-check with endpoints list", async () => {
    const { status, body } = await request(server, {
      method: "GET",
      path: "/",
    });
    expect(status).toBe(200);
    const obj = body as Record<string, unknown>;
    expect(obj.name).toBe("vsc-agent-bridge");
    expect(obj.version).toBe("0.2.0");
    expect(Array.isArray(obj.endpoints)).toBe(true);
    const endpoints = obj.endpoints as string[];
    expect(endpoints).toContain("POST /references");
    expect(endpoints).toContain("POST /type-definition");
    expect(endpoints).toContain("POST /implementation");
    expect(endpoints).toContain("POST /document-symbols");
    expect(endpoints).toContain("POST /code-actions");
    expect(endpoints).toContain("POST /signature-help");
    expect(endpoints).toContain("POST /rename-preview");
  });

  // -- 404 -----------------------------------------------------------------

  it("returns 404 for unknown route", async () => {
    const { status, body } = await request(server, {
      method: "GET",
      path: "/unknown",
    });
    expect(status).toBe(404);
    expect(body).toEqual({
      error: "Route not found: GET /unknown",
    });
  });

  // -- GET /diagnostics (mocked empty) ------------------------------------

  it("GET /diagnostics returns empty array when no diagnostics", async () => {
    const { status, body } = await request(server, {
      method: "GET",
      path: "/diagnostics",
    });
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  // -- GET /active-file-content (no active editor) -------------------------

  it("GET /active-file-content returns 404 when no editor open", async () => {
    const { status, body } = await request(server, {
      method: "GET",
      path: "/active-file-content",
    });
    expect(status).toBe(404);
    const obj = body as Record<string, unknown>;
    expect(obj.error).toMatch(/No active text editor/);
  });

  // -- POST /definition with valid params (mocked empty) -------------------

  it("POST /definition returns empty definitions for mocked provider", async () => {
    const { status, body } = await request(server, {
      method: "POST",
      path: "/definition",
      body: JSON.stringify({
        file: "/path/to/File.java",
        line: 10,
        character: 5,
      }),
    });
    expect(status).toBe(200);
    const obj = body as Record<string, unknown>;
    expect(obj.definitions).toEqual([]);
  });

  // -- POST /definition with invalid body ----------------------------------

  it("POST /definition returns 400 for invalid body", async () => {
    const { status, body } = await request(server, {
      method: "POST",
      path: "/definition",
      body: "not json",
    });
    expect(status).toBe(400);
    const obj = body as Record<string, unknown>;
    expect(obj.error).toMatch(/Invalid JSON/);
  });

  // -- POST /hover with valid params (mocked empty) ------------------------

  it("POST /hover returns empty contents for mocked provider", async () => {
    const { status, body } = await request(server, {
      method: "POST",
      path: "/hover",
      body: JSON.stringify({
        file: "/path/to/File.java",
        line: 1,
        character: 0,
      }),
    });
    expect(status).toBe(200);
    const obj = body as Record<string, unknown>;
    expect(obj.contents).toEqual([]);
  });

  // -- POST /hover with invalid body ---------------------------------------

  it("POST /hover returns 400 for missing required fields", async () => {
    const { status, body } = await request(server, {
      method: "POST",
      path: "/hover",
      body: JSON.stringify({ file: "/a.java" }),
    });
    expect(status).toBe(400);
    const obj = body as Record<string, unknown>;
    expect(obj.error).toMatch(/line/);
  });

  // -- POST /references (mocked empty) ------------------------------------

  it("POST /references returns empty references for mocked provider", async () => {
    const { status, body } = await request(server, {
      method: "POST",
      path: "/references",
      body: JSON.stringify({
        file: "/path/to/File.java",
        line: 10,
        character: 5,
      }),
    });
    expect(status).toBe(200);
    const obj = body as Record<string, unknown>;
    expect(obj.references).toEqual([]);
  });

  it("POST /references returns 400 for invalid body", async () => {
    const { status, body } = await request(server, {
      method: "POST",
      path: "/references",
      body: "not json",
    });
    expect(status).toBe(400);
    const obj = body as Record<string, unknown>;
    expect(obj.error).toMatch(/Invalid JSON/);
  });

  // -- POST /type-definition (mocked empty) --------------------------------

  it("POST /type-definition returns empty definitions for mocked provider", async () => {
    const { status, body } = await request(server, {
      method: "POST",
      path: "/type-definition",
      body: JSON.stringify({
        file: "/path/to/File.java",
        line: 10,
        character: 5,
      }),
    });
    expect(status).toBe(200);
    const obj = body as Record<string, unknown>;
    expect(obj.definitions).toEqual([]);
  });

  // -- POST /implementation (mocked empty) ---------------------------------

  it("POST /implementation returns empty implementations for mocked provider", async () => {
    const { status, body } = await request(server, {
      method: "POST",
      path: "/implementation",
      body: JSON.stringify({
        file: "/path/to/File.java",
        line: 10,
        character: 5,
      }),
    });
    expect(status).toBe(200);
    const obj = body as Record<string, unknown>;
    expect(obj.implementations).toEqual([]);
  });

  // -- POST /document-symbols (mocked empty) -------------------------------

  it("POST /document-symbols returns empty symbols for mocked provider", async () => {
    const { status, body } = await request(server, {
      method: "POST",
      path: "/document-symbols",
      body: JSON.stringify({ file: "/path/to/File.java" }),
    });
    expect(status).toBe(200);
    const obj = body as Record<string, unknown>;
    expect(obj.symbols).toEqual([]);
  });

  it("POST /document-symbols returns 400 for missing file", async () => {
    const { status, body } = await request(server, {
      method: "POST",
      path: "/document-symbols",
      body: JSON.stringify({}),
    });
    expect(status).toBe(400);
    const obj = body as Record<string, unknown>;
    expect(obj.error).toMatch(/file/);
  });

  // -- POST /code-actions (mocked empty) -----------------------------------

  it("POST /code-actions returns empty actions for mocked provider", async () => {
    const { status, body } = await request(server, {
      method: "POST",
      path: "/code-actions",
      body: JSON.stringify({
        file: "/path/to/File.java",
        startLine: 0,
        startCharacter: 0,
        endLine: 10,
        endCharacter: 0,
      }),
    });
    expect(status).toBe(200);
    const obj = body as Record<string, unknown>;
    expect(obj.actions).toEqual([]);
  });

  it("POST /code-actions returns 400 for missing range fields", async () => {
    const { status, body } = await request(server, {
      method: "POST",
      path: "/code-actions",
      body: JSON.stringify({ file: "/a.java", startLine: 0 }),
    });
    expect(status).toBe(400);
    const obj = body as Record<string, unknown>;
    expect(obj.error).toMatch(/startCharacter/);
  });

  // -- POST /signature-help (mocked empty) ---------------------------------

  it("POST /signature-help returns empty signatures for mocked provider", async () => {
    const { status, body } = await request(server, {
      method: "POST",
      path: "/signature-help",
      body: JSON.stringify({
        file: "/path/to/File.java",
        line: 10,
        character: 5,
      }),
    });
    expect(status).toBe(200);
    const obj = body as Record<string, unknown>;
    expect(obj.signatures).toEqual([]);
  });

  // -- POST /rename-preview (mocked empty) ---------------------------------

  it("POST /rename-preview returns empty changes for mocked provider", async () => {
    const { status, body } = await request(server, {
      method: "POST",
      path: "/rename-preview",
      body: JSON.stringify({
        file: "/path/to/File.java",
        line: 10,
        character: 5,
        newName: "newVariable",
      }),
    });
    expect(status).toBe(200);
    const obj = body as Record<string, unknown>;
    expect(obj.changes).toEqual([]);
  });

  it("POST /rename-preview returns 400 for missing newName", async () => {
    const { status, body } = await request(server, {
      method: "POST",
      path: "/rename-preview",
      body: JSON.stringify({
        file: "/path/to/File.java",
        line: 10,
        character: 5,
      }),
    });
    expect(status).toBe(400);
    const obj = body as Record<string, unknown>;
    expect(obj.error).toMatch(/newName/);
  });
});
