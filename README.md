# mcpgw

A tiny standalone CLI for discovering and exploring tools in the [Wyre MCP Gateway](https://mcp.wyretechnology.com) from your terminal — no MCP client required.

## Install

```bash
npm install -g @wyre-technology/mcpgw
```

Requires Node.js 20+.

## Quick start

```bash
# Log in (stores gateway URL + JWT in ~/.mcpgw/config.json, chmod 600)
mcpgw login

# See what you're connected to
mcpgw status

# List all tools grouped by vendor
mcpgw tools list

# Filter to a single vendor
mcpgw tools list --vendor huntress

# Free-text search across all tool names and descriptions
mcpgw tools search "list incidents"

# Show the full schema for a specific tool
mcpgw tools show huntress__list_incidents

# Just the vendors, please
mcpgw vendors list
```

## Commands

| Command | Description |
| --- | --- |
| `mcpgw login` | Prompt for gateway URL and JWT, verify, and store credentials |
| `mcpgw logout` | Clear stored credentials |
| `mcpgw status` | Show login status, gateway URL, and connected vendors |
| `mcpgw tools list [--vendor V] [--category C]` | List tools (grouped by vendor by default) |
| `mcpgw tools search <query>` | Search tools via `gateway__search_tools`, falling back to local filter |
| `mcpgw tools show <tool-name>` | Show description and full input schema for one tool |
| `mcpgw vendors list` | List connected vendors with tool counts |

## Global flags

- `--json` — machine-readable JSON output, for piping into `jq` and scripts
- `--no-color` — disable ANSI colors (also honors `NO_COLOR`)

## Scripting examples

```bash
# Count tools per vendor
mcpgw vendors list --json | jq 'to_entries | sort_by(-.value)'

# Find every tool whose name contains "ticket"
mcpgw tools search ticket --json | jq -r '.[].name'
```

## How it works

`mcpgw` speaks JSON-RPC 2.0 over HTTP directly to the gateway's `POST /v1/mcp` endpoint with a Bearer JWT. It's deliberately tiny — no `@modelcontextprotocol/sdk`, a single runtime dependency (`picocolors`), and a single-file bundled bin.

Credentials live in `~/.mcpgw/config.json` with `0600` permissions. Override the location with `MCPGW_CONFIG_DIR`.

## License

Apache-2.0
