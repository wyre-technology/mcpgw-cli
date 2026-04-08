# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2026-04-07

### Added
- Initial release of `mcpgw` CLI
- `login`, `logout`, `status` commands
- `tools list` with `--vendor` and `--category` filters
- `tools search` using `gateway__search_tools` meta-tool with local fallback
- `tools show` for full schema inspection
- `vendors list` with tool counts
- `--json` and `--no-color` global flags
- Config stored at `~/.mcpgw/config.json` with `0600` permissions
- Unit tests covering client, config, and command routing
