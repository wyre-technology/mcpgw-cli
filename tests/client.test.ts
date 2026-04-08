import { describe, it, expect, vi } from "vitest";
import { rpc, listTools, searchTools, filterToolsLocal, groupByVendor, GatewayError } from "../src/client.js";

const cfg = { gatewayUrl: "https://gw.example.com", jwt: "tok" };

function mockFetch(response: unknown, status = 200, statusText = "OK") {
  return vi.fn(async () =>
    new Response(typeof response === "string" ? response : JSON.stringify(response), {
      status,
      statusText,
      headers: { "content-type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}

describe("rpc", () => {
  it("posts JSON-RPC and returns result", async () => {
    const f = mockFetch({ jsonrpc: "2.0", id: 1, result: { ok: true } });
    const r = await rpc(cfg, "ping", {}, f);
    expect(r).toEqual({ ok: true });
    const call = (f as any).mock.calls[0];
    expect(call[0]).toBe("https://gw.example.com/v1/mcp");
    expect(call[1].headers.Authorization).toBe("Bearer tok");
  });

  it("throws 401 with helpful message", async () => {
    const f = mockFetch({}, 401, "Unauthorized");
    await expect(rpc(cfg, "x", {}, f)).rejects.toThrowError(/401/);
  });

  it("throws on RPC error payload", async () => {
    const f = mockFetch({ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "nope" } });
    await expect(rpc(cfg, "x", {}, f)).rejects.toThrowError(/nope/);
  });

  it("throws on network failure", async () => {
    const f = vi.fn(async () => { throw new Error("ECONN"); }) as unknown as typeof fetch;
    await expect(rpc(cfg, "x", {}, f)).rejects.toThrowError(/Network error/);
  });

  it("parses SSE-framed response", async () => {
    const sse = `event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: 1, result: { ok: 1 } })}\n\n`;
    const f = mockFetch(sse);
    const r = await rpc(cfg, "x", {}, f);
    expect(r).toEqual({ ok: 1 });
  });
});

describe("listTools", () => {
  it("returns tools array", async () => {
    const f = mockFetch({
      jsonrpc: "2.0",
      id: 1,
      result: { tools: [{ name: "a__foo", description: "x" }] },
    });
    const tools = await listTools(cfg, f);
    expect(tools).toHaveLength(1);
  });
});

describe("searchTools", () => {
  it("uses gateway__search_tools meta-tool when available", async () => {
    const f = vi.fn(async () =>
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            content: [
              { type: "text", text: JSON.stringify([{ name: "huntress__list_incidents" }]) },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as unknown as typeof fetch;
    const tools = await searchTools(cfg, "incidents", f);
    expect(tools[0]!.name).toBe("huntress__list_incidents");
  });

  it("falls back to local filter when meta-tool missing", async () => {
    let call = 0;
    const f = vi.fn(async () => {
      call++;
      if (call === 1) {
        // meta-tool call — return RPC error
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "Method not found" } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      // fallback list
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          result: {
            tools: [
              { name: "huntress__list_incidents", description: "list" },
              { name: "autotask__search_tickets", description: "tix" },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const tools = await searchTools(cfg, "incident", f);
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toContain("incidents");
  });
});

describe("helpers", () => {
  it("filterToolsLocal matches name and description", () => {
    const tools = [
      { name: "a__x", description: "hello world" },
      { name: "b__y", description: "nope" },
    ];
    expect(filterToolsLocal(tools, "hello")).toHaveLength(1);
    expect(filterToolsLocal(tools, "A__")).toHaveLength(1);
  });

  it("groupByVendor splits on __", () => {
    const groups = groupByVendor([
      { name: "huntress__a" },
      { name: "huntress__b" },
      { name: "autotask__c" },
      { name: "loose" },
    ]);
    expect(Object.keys(groups).sort()).toEqual(["(ungrouped)", "autotask", "huntress"]);
    expect(groups.huntress).toHaveLength(2);
  });
});
