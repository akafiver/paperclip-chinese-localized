import { describe, expect, it, vi } from "vitest";
import {
  MCP_HTTP_ACCEPT,
  initializeMcpHttpSession,
  mcpHttpRequestHeaders,
  mcpHttpSessionRequest,
  parseMcpHttpResponseBody,
} from "../services/mcp-http.js";

function response(payload: unknown, headers: Record<string, string> = {}, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

describe("mcpHttpRequestHeaders", () => {
  it("advertises both JSON and SSE on every request", () => {
    expect(mcpHttpRequestHeaders()).toMatchObject({
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    });
    expect(MCP_HTTP_ACCEPT).toBe("application/json, text/event-stream");
  });

  it("preserves caller-supplied headers while keeping the required Accept value", () => {
    expect(mcpHttpRequestHeaders({ Authorization: "Bearer x", accept: "application/json" })).toMatchObject({
      accept: "application/json, text/event-stream",
      Authorization: "Bearer x",
    });
  });
});

describe("MCP Streamable HTTP session", () => {
  it("initializes before tools/list and carries the returned session id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "initialize") {
        return response(
          { jsonrpc: "2.0", id: "paperclip-mcp-initialize", result: { protocolVersion: "2025-03-26" } },
          { "mcp-session-id": "mir-test-session" },
        );
      }
      if (body.method === "notifications/initialized") return response({}, {}, 202);
      return response({ jsonrpc: "2.0", id: "catalog", result: { tools: [] } });
    });

    try {
      const session = await initializeMcpHttpSession("http://mir.test/mcp");
      await mcpHttpSessionRequest("http://mir.test/mcp", session, "tools/list", {});

      expect(fetchMock).toHaveBeenCalledTimes(3);
      const initializeBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { method?: string };
      const notificationBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as { method?: string };
      const listBody = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body)) as { method?: string };
      expect(initializeBody.method).toBe("initialize");
      expect(notificationBody.method).toBe("notifications/initialized");
      expect(listBody.method).toBe("tools/list");
      expect(fetchMock.mock.calls[2]?.[1]?.headers).toMatchObject({ "mcp-session-id": "mir-test-session" });
    } finally {
      fetchMock.mockRestore();
    }
  });
});

describe("parseMcpHttpResponseBody", () => {
  it("parses a plain application/json body", () => {
    const payload = { jsonrpc: "2.0", id: "1", result: { tools: [] } };
    expect(parseMcpHttpResponseBody(JSON.stringify(payload), "application/json")).toEqual(payload);
  });

  it("parses an SSE-framed body, extracting the JSON-RPC message", () => {
    const payload = { jsonrpc: "2.0", id: "1", result: { tools: [{ name: "kv_get" }] } };
    const body = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
    expect(parseMcpHttpResponseBody(body, "text/event-stream; charset=utf-8")).toEqual(payload);
  });

  it("skips non-JSON-RPC SSE events and returns the response message", () => {
    const ping = "event: ping\ndata: {\"type\":\"ping\"}";
    const message = { jsonrpc: "2.0", id: "1", result: { ok: true } };
    const body = `${ping}\n\nevent: message\ndata: ${JSON.stringify(message)}\n\n`;
    expect(parseMcpHttpResponseBody(body, "text/event-stream")).toEqual(message);
  });

  it("handles multi-line SSE data fields", () => {
    const payload = { jsonrpc: "2.0", id: "1", result: { note: "line" } };
    const json = JSON.stringify(payload, null, 2);
    const body = `data: ${json.split("\n").join("\ndata: ")}\n\n`;
    expect(parseMcpHttpResponseBody(body, "text/event-stream")).toEqual(payload);
  });

  it("throws when an SSE stream carries no data events", () => {
    expect(() => parseMcpHttpResponseBody("event: ping\n\n", "text/event-stream")).toThrow();
  });
});
