import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("config", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "mcpgw-"));
    process.env.MCPGW_CONFIG_DIR = dir;
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.MCPGW_CONFIG_DIR;
  });

  it("saves, loads, and clears config with 600 perms", async () => {
    const mod = await import("../src/config.js?t=" + Date.now());
    mod.saveConfig({ gatewayUrl: "https://x", jwt: "t" });
    expect(existsSync(mod.CONFIG_PATH)).toBe(true);
    const mode = statSync(mod.CONFIG_PATH).mode & 0o777;
    expect(mode).toBe(0o600);
    const loaded = mod.loadConfig();
    expect(loaded).toEqual({ gatewayUrl: "https://x", jwt: "t" });
    mod.clearConfig();
    expect(mod.loadConfig()).toBeNull();
  });

  it("requireConfig throws when missing", async () => {
    const mod = await import("../src/config.js?t=" + Date.now() + "b");
    expect(() => mod.requireConfig()).toThrowError(/Not logged in/);
  });
});
