import { describe, it, expect } from "vitest";
import {
  severityToString,
  parsePositionParams,
  sendJson,
  readBody,
} from "../helpers";
import { PassThrough } from "stream";
import * as http from "http";

// ---------------------------------------------------------------------------
// severityToString
// ---------------------------------------------------------------------------

describe("severityToString", () => {
  it("returns 'error' for severity 0", () => {
    expect(severityToString(0)).toBe("error");
  });

  it("returns 'warning' for severity 1", () => {
    expect(severityToString(1)).toBe("warning");
  });

  it("returns 'information' for severity 2", () => {
    expect(severityToString(2)).toBe("information");
  });

  it("returns 'hint' for severity 3", () => {
    expect(severityToString(3)).toBe("hint");
  });

  it("returns 'unknown' for unrecognized severity", () => {
    expect(severityToString(99)).toBe("unknown");
    expect(severityToString(-1)).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// parsePositionParams
// ---------------------------------------------------------------------------

describe("parsePositionParams", () => {
  it("parses valid JSON with all required fields", () => {
    const result = parsePositionParams(
      JSON.stringify({ file: "/path/to/File.java", line: 10, character: 5 }),
    );
    expect(result).toEqual({
      ok: true,
      params: { file: "/path/to/File.java", line: 10, character: 5 },
    });
  });

  it("accepts line 0 and character 0", () => {
    const result = parsePositionParams(
      JSON.stringify({ file: "/a.java", line: 0, character: 0 }),
    );
    expect(result).toEqual({
      ok: true,
      params: { file: "/a.java", line: 0, character: 0 },
    });
  });

  it("rejects invalid JSON", () => {
    const result = parsePositionParams("not json");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Invalid JSON/);
    }
  });

  it("rejects missing file field", () => {
    const result = parsePositionParams(
      JSON.stringify({ line: 1, character: 0 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/file/);
    }
  });

  it("rejects empty file string", () => {
    const result = parsePositionParams(
      JSON.stringify({ file: "", line: 1, character: 0 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/file/);
    }
  });

  it("rejects missing line field", () => {
    const result = parsePositionParams(
      JSON.stringify({ file: "/a.java", character: 0 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/line/);
    }
  });

  it("rejects negative line", () => {
    const result = parsePositionParams(
      JSON.stringify({ file: "/a.java", line: -1, character: 0 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/line/);
    }
  });

  it("rejects missing character field", () => {
    const result = parsePositionParams(
      JSON.stringify({ file: "/a.java", line: 0 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/character/);
    }
  });

  it("rejects negative character", () => {
    const result = parsePositionParams(
      JSON.stringify({ file: "/a.java", line: 0, character: -5 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/character/);
    }
  });
});

// ---------------------------------------------------------------------------
// readBody
// ---------------------------------------------------------------------------

describe("readBody", () => {
  it("reads request body as a string", async () => {
    const stream = new PassThrough();
    stream.end(Buffer.from("hello world"));
    const body = await readBody(stream as unknown as http.IncomingMessage);
    expect(body).toBe("hello world");
  });

  it("handles empty body", async () => {
    const stream = new PassThrough();
    stream.end(Buffer.alloc(0));
    const body = await readBody(stream as unknown as http.IncomingMessage);
    expect(body).toBe("");
  });

  it("handles multi-chunk body", async () => {
    const stream = new PassThrough();
    stream.write(Buffer.from("chunk1"));
    stream.write(Buffer.from("chunk2"));
    stream.end();
    const body = await readBody(stream as unknown as http.IncomingMessage);
    expect(body).toBe("chunk1chunk2");
  });

  it("rejects on stream error", async () => {
    const stream = new PassThrough();
    const promise = readBody(stream as unknown as http.IncomingMessage);
    stream.destroy(new Error("test error"));
    await expect(promise).rejects.toThrow("test error");
  });
});

// ---------------------------------------------------------------------------
// sendJson
// ---------------------------------------------------------------------------

describe("sendJson", () => {
  it("sends JSON with correct content-type and status code", () => {
    let writtenStatus = 0;
    let writtenHeaders: Record<string, string> = {};
    let writtenBody = "";

    const res = {
      writeHead(code: number, headers: Record<string, string>) {
        writtenStatus = code;
        writtenHeaders = headers;
      },
      end(body: string) {
        writtenBody = body;
      },
    } as unknown as http.ServerResponse;

    sendJson(res, 200, { message: "ok" });

    expect(writtenStatus).toBe(200);
    expect(writtenHeaders["Content-Type"]).toBe("application/json");
    expect(JSON.parse(writtenBody)).toEqual({ message: "ok" });
  });

  it("sends error responses", () => {
    let writtenStatus = 0;
    let writtenBody = "";

    const res = {
      writeHead(code: number, _headers: Record<string, string>) {
        writtenStatus = code;
      },
      end(body: string) {
        writtenBody = body;
      },
    } as unknown as http.ServerResponse;

    sendJson(res, 400, { error: "bad request" });

    expect(writtenStatus).toBe(400);
    expect(JSON.parse(writtenBody)).toEqual({ error: "bad request" });
  });
});
