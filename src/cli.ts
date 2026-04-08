import { loadConfig, saveConfig, clearConfig, requireConfig } from "./config.js";
import {
  initialize,
  listTools,
  searchTools,
  groupByVendor,
  GatewayError,
  type Tool,
} from "./client.js";
import {
  formatToolsGrouped,
  formatToolsFlat,
  formatToolDetail,
  formatVendors,
  error,
  success,
  info,
  asJson,
  setColor,
} from "./format.js";
import { prompt, promptSecret } from "./prompt.js";

interface Flags {
  json: boolean;
  noColor: boolean;
  vendor?: string;
  category?: string;
}

function parseArgs(argv: string[]): { command: string[]; flags: Flags; positional: string[] } {
  const command: string[] = [];
  const positional: string[] = [];
  const flags: Flags = { json: false, noColor: false };
  let seenFlag = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--json") {
      flags.json = true;
      seenFlag = true;
    } else if (a === "--no-color") {
      flags.noColor = true;
      seenFlag = true;
    } else if (a === "--vendor") {
      flags.vendor = argv[++i];
      seenFlag = true;
    } else if (a === "--category") {
      flags.category = argv[++i];
      seenFlag = true;
    } else if (a.startsWith("--")) {
      // unknown flag — ignore
      seenFlag = true;
    } else if (!seenFlag && command.length < 2 && !positional.length) {
      command.push(a);
    } else {
      positional.push(a);
    }
  }
  return { command, flags, positional };
}

function filterByCategory(tools: Tool[], category: string): Tool[] {
  const cat = category.toLowerCase();
  return tools.filter((t) => {
    const text = `${t.name} ${t.description ?? ""}`.toLowerCase();
    return text.includes(cat);
  });
}

async function cmdLogin() {
  const existing = loadConfig();
  const url = await prompt(
    "Gateway URL",
    existing?.gatewayUrl ?? "https://mcp.wyretechnology.com",
  );
  const jwt = await promptSecret("JWT");
  if (!jwt) throw new Error("JWT is required");
  const cfg = { gatewayUrl: url, jwt };
  process.stdout.write(info("Verifying credentials...\n"));
  await initialize(cfg);
  await listTools(cfg);
  saveConfig(cfg);
  process.stdout.write(success(`Logged in to ${url}\n`));
}

function cmdLogout() {
  clearConfig();
  process.stdout.write(success("Logged out.\n"));
}

async function cmdToolsList(flags: Flags) {
  const cfg = requireConfig();
  let tools = await listTools(cfg);
  if (flags.vendor) {
    const prefix = flags.vendor + "__";
    tools = tools.filter((t) => t.name.startsWith(prefix));
  }
  if (flags.category) tools = filterByCategory(tools, flags.category);
  if (flags.json) {
    process.stdout.write(asJson(tools) + "\n");
    return;
  }
  if (flags.vendor) {
    process.stdout.write(formatToolsFlat(tools) + "\n");
  } else {
    process.stdout.write(formatToolsGrouped(groupByVendor(tools)) + "\n");
  }
}

async function cmdToolsSearch(query: string, flags: Flags) {
  if (!query) throw new Error("Usage: mcpgw tools search <query>");
  const cfg = requireConfig();
  const tools = await searchTools(cfg, query);
  if (flags.json) {
    process.stdout.write(asJson(tools) + "\n");
    return;
  }
  process.stdout.write(formatToolsFlat(tools) + "\n");
}

async function cmdToolsShow(name: string, flags: Flags) {
  if (!name) throw new Error("Usage: mcpgw tools show <tool-name>");
  const cfg = requireConfig();
  const all = await listTools(cfg);
  const tool = all.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  if (flags.json) {
    process.stdout.write(asJson(tool) + "\n");
    return;
  }
  process.stdout.write(formatToolDetail(tool) + "\n");
}

async function cmdVendorsList(flags: Flags) {
  const cfg = requireConfig();
  const tools = await listTools(cfg);
  const groups = groupByVendor(tools);
  if (flags.json) {
    const out = Object.fromEntries(
      Object.entries(groups).map(([k, v]) => [k, v.length]),
    );
    process.stdout.write(asJson(out) + "\n");
    return;
  }
  process.stdout.write(formatVendors(groups) + "\n");
}

async function cmdStatus(flags: Flags) {
  const cfg = loadConfig();
  if (!cfg) {
    if (flags.json) {
      process.stdout.write(asJson({ loggedIn: false }) + "\n");
    } else {
      process.stdout.write(info("Not logged in.\n"));
    }
    return;
  }
  try {
    const tools = await listTools(cfg);
    const groups = groupByVendor(tools);
    if (flags.json) {
      process.stdout.write(
        asJson({
          loggedIn: true,
          gatewayUrl: cfg.gatewayUrl,
          toolCount: tools.length,
          vendors: Object.keys(groups),
        }) + "\n",
      );
      return;
    }
    process.stdout.write(
      [
        `${success("Logged in")} to ${cfg.gatewayUrl}`,
        `${tools.length} tools across ${Object.keys(groups).length} vendors`,
        ...Object.keys(groups).sort().map((v) => `  - ${v} (${groups[v]!.length})`),
      ].join("\n") + "\n",
    );
  } catch (e) {
    if (flags.json) {
      process.stdout.write(
        asJson({ loggedIn: true, gatewayUrl: cfg.gatewayUrl, error: (e as Error).message }) + "\n",
      );
    } else {
      process.stdout.write(error((e as Error).message) + "\n");
    }
    process.exitCode = 1;
  }
}

function printHelp() {
  const help = `mcpgw — CLI for the MCP Gateway

Usage:
  mcpgw login                        Log in to the gateway
  mcpgw logout                       Clear stored credentials
  mcpgw status                       Show login status and vendors
  mcpgw tools list [--vendor V]      List tools (grouped by vendor)
                   [--category C]
  mcpgw tools search <query>         Search tools by keyword
  mcpgw tools show <tool-name>       Show full schema for a tool
  mcpgw vendors list                 List connected vendors

Global flags:
  --json        Output machine-readable JSON
  --no-color    Disable ANSI colors
`;
  process.stdout.write(help);
}

export async function main(argv: string[]): Promise<number> {
  const { command, flags, positional } = parseArgs(argv);
  if (flags.noColor || process.env.NO_COLOR) setColor(false);

  try {
    const [c1, c2] = command;
    if (!c1 || c1 === "help" || c1 === "--help" || c1 === "-h") {
      printHelp();
      return 0;
    }
    if (c1 === "login") {
      await cmdLogin();
      return 0;
    }
    if (c1 === "logout") {
      cmdLogout();
      return 0;
    }
    if (c1 === "status") {
      await cmdStatus(flags);
      return typeof process.exitCode === "number" ? process.exitCode : 0;
    }
    if (c1 === "tools") {
      if (c2 === "list") return (await cmdToolsList(flags), 0);
      if (c2 === "search") return (await cmdToolsSearch(positional[0] ?? "", flags), 0);
      if (c2 === "show") return (await cmdToolsShow(positional[0] ?? "", flags), 0);
      throw new Error(`Unknown tools subcommand: ${c2 ?? ""}`);
    }
    if (c1 === "vendors") {
      if (c2 === "list") return (await cmdVendorsList(flags), 0);
      throw new Error(`Unknown vendors subcommand: ${c2 ?? ""}`);
    }
    throw new Error(`Unknown command: ${c1}`);
  } catch (e) {
    const msg = e instanceof GatewayError ? e.message : (e as Error).message;
    if (flags.json) {
      process.stdout.write(asJson({ error: msg }) + "\n");
    } else {
      process.stderr.write(error(msg) + "\n");
    }
    return 1;
  }
}

// Entry point
const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("cli.js");
if (isMain) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
