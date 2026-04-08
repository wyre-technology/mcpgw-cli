import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, chmodSync, existsSync, unlinkSync } from "node:fs";

export interface Config {
  gatewayUrl: string;
  jwt: string;
}

export const CONFIG_DIR = process.env.MCPGW_CONFIG_DIR ?? join(homedir(), ".mcpgw");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export function loadConfig(): Config | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Config;
  } catch {
    return null;
  }
}

export function saveConfig(cfg: Config): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  chmodSync(CONFIG_PATH, 0o600);
}

export function clearConfig(): void {
  if (existsSync(CONFIG_PATH)) unlinkSync(CONFIG_PATH);
}

export function requireConfig(): Config {
  const cfg = loadConfig();
  if (!cfg) {
    throw new Error("Not logged in. Run `mcpgw login` first.");
  }
  return cfg;
}
