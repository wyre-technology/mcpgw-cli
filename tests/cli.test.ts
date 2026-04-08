import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Capture stdout
function captureStdout(fn: () => Promise<unknown>) {
  const chunks: string[] = [];
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  (process.stdout.write as any) = (s: string) => { chunks.push(String(s)); return true; };
  (process.stderr.write as any) = (s: string) => { chunks.push(String(s)); return true; };
  return fn().then((r) => {
    (process.stdout.write as any) = origOut;
    (process.stderr.write as any) = origErr;
    return { result: r, output: chunks.join("") };
  }).catch((e) => {
    (process.stdout.write as any) = origOut;
    (process.stderr.write as any) = origErr;
    throw e;
  });
}

describe("cli", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "mcpgw-cli-"));
    process.env.MCPGW_CONFIG_DIR = dir;
    process.env.NO_COLOR = "1";
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.MCPGW_CONFIG_DIR;
    delete process.env.NO_COLOR;
    vi.restoreAllMocks();
  });

  it("prints help", async () => {
    const { main } = await import("../src/cli.js?t=" + Date.now());
    const { result, output } = await captureStdout(() => main(["help"]));
    expect(result).toBe(0);
    expect(output).toContain("mcpgw");
    expect(output).toContain("tools list");
  });

  it("status reports not logged in", async () => {
    const { main } = await import("../src/cli.js?t=" + Date.now() + "a");
    const { result, output } = await captureStdout(() => main(["status"]));
    expect(result).toBe(0);
    expect(output).toContain("Not logged in");
  });

  it("status --json reports not logged in", async () => {
    const { main } = await import("../src/cli.js?t=" + Date.now() + "b");
    const { output } = await captureStdout(() => main(["status", "--json"]));
    expect(JSON.parse(output)).toEqual({ loggedIn: false });
  });

  it("tools list errors when not logged in", async () => {
    const { main } = await import("../src/cli.js?t=" + Date.now() + "c");
    const { result, output } = await captureStdout(() => main(["tools", "list"]));
    expect(result).toBe(1);
    expect(output).toContain("Not logged in");
  });

  it("tools list works with mocked fetch", async () => {
    const cfgMod = await import("../src/config.js?t=" + Date.now() + "d");
    cfgMod.saveConfig({ gatewayUrl: "https://gw.example.com", jwt: "t" });
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            tools: [
              { name: "huntress__list_incidents", description: "List incidents" },
              { name: "autotask__search_tickets", description: "Search tickets" },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as any;
    const { main } = await import("../src/cli.js?t=" + Date.now() + "e");
    const { result, output } = await captureStdout(() => main(["tools", "list", "--json"]));
    expect(result).toBe(0);
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(2);
  });

  it("tools list --vendor filters", async () => {
    const cfgMod = await import("../src/config.js?t=" + Date.now() + "f");
    cfgMod.saveConfig({ gatewayUrl: "https://gw.example.com", jwt: "t" });
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            tools: [
              { name: "huntress__list_incidents", description: "x" },
              { name: "autotask__search_tickets", description: "y" },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as any;
    const { main } = await import("../src/cli.js?t=" + Date.now() + "g");
    const { output } = await captureStdout(() =>
      main(["tools", "list", "--vendor", "huntress", "--json"]),
    );
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe("huntress__list_incidents");
  });

  it("tools show finds a tool", async () => {
    const cfgMod = await import("../src/config.js?t=" + Date.now() + "h");
    cfgMod.saveConfig({ gatewayUrl: "https://gw.example.com", jwt: "t" });
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            tools: [{ name: "huntress__list_incidents", description: "List", inputSchema: { type: "object" } }],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as any;
    const { main } = await import("../src/cli.js?t=" + Date.now() + "i");
    const { result, output } = await captureStdout(() =>
      main(["tools", "show", "huntress__list_incidents", "--json"]),
    );
    expect(result).toBe(0);
    expect(JSON.parse(output).name).toBe("huntress__list_incidents");
  });

  it("handles 401 with helpful error", async () => {
    const cfgMod = await import("../src/config.js?t=" + Date.now() + "j");
    cfgMod.saveConfig({ gatewayUrl: "https://gw.example.com", jwt: "bad" });
    globalThis.fetch = vi.fn(async () =>
      new Response("{}", { status: 401, statusText: "Unauthorized" }),
    ) as any;
    const { main } = await import("../src/cli.js?t=" + Date.now() + "k");
    const { result, output } = await captureStdout(() => main(["tools", "list"]));
    expect(result).toBe(1);
    expect(output).toContain("401");
  });

  it("vendors list groups tools", async () => {
    const cfgMod = await import("../src/config.js?t=" + Date.now() + "l");
    cfgMod.saveConfig({ gatewayUrl: "https://gw.example.com", jwt: "t" });
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            tools: [
              { name: "huntress__a" },
              { name: "huntress__b" },
              { name: "autotask__c" },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as any;
    const { main } = await import("../src/cli.js?t=" + Date.now() + "m");
    const { output } = await captureStdout(() => main(["vendors", "list", "--json"]));
    expect(JSON.parse(output)).toEqual({ huntress: 2, autotask: 1 });
  });
});
