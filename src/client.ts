import type { Config } from "./config.js";

export interface Tool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export class GatewayError extends Error {
  constructor(message: string, public status?: number, public rpcError?: JsonRpcError) {
    super(message);
    this.name = "GatewayError";
  }
}

let idCounter = 0;

export async function rpc<T = unknown>(
  cfg: Config,
  method: string,
  params?: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const url = cfg.gatewayUrl.replace(/\/$/, "") + "/v1/mcp";
  const body = {
    jsonrpc: "2.0" as const,
    id: ++idCounter,
    method,
    ...(params !== undefined ? { params } : {}),
  };
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${cfg.jwt}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new GatewayError(`Network error: ${(e as Error).message}`);
  }

  if (res.status === 401) {
    throw new GatewayError("Gateway returned 401 — JWT may be expired. Run `mcpgw login` to refresh.", 401);
  }
  if (!res.ok) {
    throw new GatewayError(`Gateway returned ${res.status} ${res.statusText}`, res.status);
  }

  const text = await res.text();
  // Handle SSE-style framed responses too.
  let json: any;
  if (text.startsWith("event:") || text.includes("\ndata:")) {
    const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
    json = dataLine ? JSON.parse(dataLine.slice(5).trim()) : null;
  } else {
    json = JSON.parse(text);
  }
  if (json?.error) {
    throw new GatewayError(`RPC error: ${json.error.message}`, res.status, json.error);
  }
  return json.result as T;
}

export async function initialize(cfg: Config, fetchImpl: typeof fetch = fetch) {
  return rpc(
    cfg,
    "initialize",
    {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "mcpgw-cli", version: "0.1.0" },
    },
    fetchImpl,
  );
}

export async function listTools(cfg: Config, fetchImpl: typeof fetch = fetch): Promise<Tool[]> {
  const result = await rpc<{ tools: Tool[] }>(cfg, "tools/list", {}, fetchImpl);
  return result.tools ?? [];
}

export async function callTool(
  cfg: Config,
  name: string,
  args: Record<string, unknown> = {},
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  return rpc(cfg, "tools/call", { name, arguments: args }, fetchImpl);
}

export async function searchTools(
  cfg: Config,
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Tool[]> {
  // Prefer server-side meta-tool; fall back to local filter.
  try {
    const result: any = await callTool(cfg, "gateway__search_tools", { query }, fetchImpl);
    const content = result?.content;
    if (Array.isArray(content)) {
      const textNode = content.find((c: any) => c.type === "text");
      if (textNode?.text) {
        try {
          const parsed = JSON.parse(textNode.text);
          if (Array.isArray(parsed)) return parsed as Tool[];
          if (Array.isArray(parsed?.tools)) return parsed.tools as Tool[];
        } catch {
          // fall through
        }
      }
    }
  } catch (e) {
    if (!(e instanceof GatewayError) || e.status === 401) throw e;
    // meta-tool not available — fall through to local
  }
  const all = await listTools(cfg, fetchImpl);
  return filterToolsLocal(all, query);
}

export function filterToolsLocal(tools: Tool[], query: string): Tool[] {
  const q = query.toLowerCase();
  return tools.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      (t.description ?? "").toLowerCase().includes(q),
  );
}

export function groupByVendor(tools: Tool[]): Record<string, Tool[]> {
  const groups: Record<string, Tool[]> = {};
  for (const t of tools) {
    const idx = t.name.indexOf("__");
    const vendor = idx > 0 ? t.name.slice(0, idx) : "(ungrouped)";
    (groups[vendor] ??= []).push(t);
  }
  return groups;
}
