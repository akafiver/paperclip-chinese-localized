// Helpers for talking to remote MCP servers over the Streamable HTTP transport.
//
// The MCP Streamable HTTP spec requires the client to advertise that it accepts
// BOTH a single JSON response and an SSE stream on every POST:
//
//   Accept: application/json, text/event-stream
//
// Spec-compliant servers reject requests missing this header with 406 Not
// Acceptable, and when the header is present they are free to answer with an
// SSE stream (`event: message\ndata: {…}`) instead of a bare JSON body. So any
// code path that POSTs JSON-RPC to a remote `/mcp` endpoint must (a) send the
// Accept header and (b) be able to read an SSE-framed response.

/** The Accept header value required by the MCP Streamable HTTP transport. */
export const MCP_HTTP_ACCEPT = "application/json, text/event-stream";

export type McpHttpSession = {
  protocolVersion: string;
  sessionId: string | null;
};

type McpHttpFetchOptions = Omit<RequestInit, "body" | "headers" | "method">;

export class McpHttpResponseError extends Error {
  constructor(
    message: string,
    public readonly response: Response,
  ) {
    super(message);
  }
}

function sessionHeaders(headers: Record<string, string>, session: McpHttpSession): Record<string, string> {
  return session.sessionId
    ? { ...headers, "mcp-session-id": session.sessionId }
    : headers;
}

/**
 * Open a Streamable HTTP MCP session.
 *
 * Streamable HTTP servers may be stateless, but a server that returns an
 * mcp-session-id requires every subsequent request to use that session. The
 * initialize handshake is therefore mandatory before tools/list or
 * tools/call; callers must not guess that an endpoint is stateless.
 */
export async function initializeMcpHttpSession(
  endpoint: string,
  headers: Record<string, string> = {},
  options: McpHttpFetchOptions = {},
): Promise<McpHttpSession> {
  const response = await fetch(endpoint, {
    ...options,
    method: "POST",
    headers: mcpHttpRequestHeaders(headers),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "paperclip-mcp-initialize",
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "paperclip", version: "0.3.1" },
      },
    }),
  });
  if (!response.ok) {
    throw new McpHttpResponseError(`MCP initialize failed with HTTP ${response.status}`, response);
  }

  const payload = parseMcpHttpResponseBody(await response.text(), response.headers.get("content-type"));
  const record = payload as { error?: unknown; result?: unknown };
  if (record.error !== undefined) {
    throw new Error(`MCP initialize returned a JSON-RPC error: ${JSON.stringify(record.error)}`);
  }
  const result = record.result as { protocolVersion?: unknown } | undefined;
  if (!result || typeof result.protocolVersion !== "string") {
    throw new Error("MCP initialize returned an invalid result");
  }

  const session: McpHttpSession = {
    protocolVersion: result.protocolVersion,
    sessionId: response.headers.get("mcp-session-id"),
  };

  // The initialized notification completes the MCP lifecycle handshake. A
  // server may answer with 202 or an empty 200 response, so no body is read.
  const initialized = await fetch(endpoint, {
    ...options,
    method: "POST",
    headers: mcpHttpRequestHeaders(sessionHeaders(headers, session)),
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    }),
  });
  if (!initialized.ok) {
    throw new McpHttpResponseError(`MCP initialized notification failed with HTTP ${initialized.status}`, initialized);
  }

  return session;
}

export async function mcpHttpSessionRequest(
  endpoint: string,
  session: McpHttpSession,
  method: "tools/list" | "tools/call",
  params: Record<string, unknown>,
  headers: Record<string, string> = {},
  options: McpHttpFetchOptions = {},
  requestId = `paperclip-mcp-${method.replace("/", "-")}`,
): Promise<Response> {
  return fetch(endpoint, {
    ...options,
    method: "POST",
    headers: mcpHttpRequestHeaders(sessionHeaders(headers, session)),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: requestId,
      method,
      params,
    }),
  });
}

/**
 * Default headers for an MCP Streamable HTTP JSON-RPC POST. Caller-supplied
 * headers (e.g. resolved credentials) are preserved, while the required
 * Streamable HTTP Accept value is kept authoritative.
 */
export function mcpHttpRequestHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "content-type": "application/json",
    ...extra,
    accept: MCP_HTTP_ACCEPT,
  };
}

function looksLikeJsonRpcMessage(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return "result" in record || "error" in record || "method" in record || "id" in record;
}

/**
 * Parse the body of an MCP Streamable HTTP response into its JSON-RPC payload.
 *
 * Handles both response shapes the transport allows:
 *  - `application/json`: the body is the JSON-RPC message directly.
 *  - `text/event-stream`: one or more SSE events; we return the JSON payload of
 *    the first `data:` event that parses as a JSON-RPC message.
 *
 * Falls back to a plain JSON parse when the content type is unknown so we stay
 * compatible with non-compliant servers that ignore the Accept header.
 */
export function parseMcpHttpResponseBody(bodyText: string, contentType: string | null): unknown {
  const isEventStream = (contentType ?? "").toLowerCase().includes("text/event-stream");
  if (!isEventStream) {
    return JSON.parse(bodyText) as unknown;
  }

  // Split the SSE stream into events on blank lines, then collect each event's
  // `data:` lines (which may span multiple lines per the SSE spec).
  const events = bodyText.replace(/\r\n/g, "\n").split(/\n\n+/);
  let lastError: unknown = null;
  let firstParsed: unknown;
  let sawData = false;
  for (const event of events) {
    const dataLines = event
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).replace(/^ /, ""));
    if (dataLines.length === 0) continue;
    const data = dataLines.join("\n");
    let parsed: unknown;
    try {
      parsed = JSON.parse(data) as unknown;
    } catch (error) {
      lastError = error;
      continue;
    }
    if (!sawData) {
      firstParsed = parsed;
      sawData = true;
    }
    if (looksLikeJsonRpcMessage(parsed)) {
      return parsed;
    }
  }
  if (sawData) return firstParsed;
  if (lastError) throw lastError;
  throw new SyntaxError("MCP SSE response contained no data events");
}
