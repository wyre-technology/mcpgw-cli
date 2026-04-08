import pc from "picocolors";
import type { Tool } from "./client.js";

export interface FormatOpts {
  json?: boolean;
  noColor?: boolean;
}

let colorEnabled = true;
export function setColor(enabled: boolean) {
  colorEnabled = enabled;
}
const c = {
  bold: (s: string) => (colorEnabled ? pc.bold(s) : s),
  dim: (s: string) => (colorEnabled ? pc.dim(s) : s),
  cyan: (s: string) => (colorEnabled ? pc.cyan(s) : s),
  green: (s: string) => (colorEnabled ? pc.green(s) : s),
  yellow: (s: string) => (colorEnabled ? pc.yellow(s) : s),
  red: (s: string) => (colorEnabled ? pc.red(s) : s),
};

export function formatToolsGrouped(groups: Record<string, Tool[]>): string {
  const out: string[] = [];
  const vendors = Object.keys(groups).sort();
  for (const v of vendors) {
    const tools = groups[v]!;
    out.push(c.bold(c.cyan(v)) + c.dim(` (${tools.length})`));
    for (const t of tools.sort((a, b) => a.name.localeCompare(b.name))) {
      const shortName = t.name.includes("__") ? t.name.split("__").slice(1).join("__") : t.name;
      const desc = (t.description ?? "").split("\n")[0]!.slice(0, 80);
      out.push(`  ${c.green(shortName.padEnd(40))} ${c.dim(desc)}`);
    }
    out.push("");
  }
  return out.join("\n");
}

export function formatToolsFlat(tools: Tool[]): string {
  if (tools.length === 0) return c.dim("No tools found.");
  return tools
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => {
      const desc = (t.description ?? "").split("\n")[0]!.slice(0, 80);
      return `${c.green(t.name.padEnd(50))} ${c.dim(desc)}`;
    })
    .join("\n");
}

export function formatToolDetail(tool: Tool): string {
  const out: string[] = [];
  out.push(c.bold(c.cyan(tool.name)));
  if (tool.description) {
    out.push("");
    out.push(tool.description);
  }
  if (tool.inputSchema) {
    out.push("");
    out.push(c.bold("Input schema:"));
    out.push(JSON.stringify(tool.inputSchema, null, 2));
  }
  return out.join("\n");
}

export function formatVendors(groups: Record<string, Tool[]>): string {
  const vendors = Object.keys(groups).sort();
  const rows = vendors.map((v) => `  ${c.green(v.padEnd(30))} ${c.dim(`${groups[v]!.length} tools`)}`);
  return [c.bold(`Connected vendors (${vendors.length}):`), ...rows].join("\n");
}

export function error(msg: string): string {
  return c.red(`error: ${msg}`);
}

export function success(msg: string): string {
  return c.green(msg);
}

export function info(msg: string): string {
  return c.dim(msg);
}

export function asJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
