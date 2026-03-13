# Utelogy MCP Server

MCP server for the [Utelogy](https://www.utelogy.com) AV monitoring platform. Exposes Utelogy's REST API as tools for [Claude Code](https://claude.com/claude-code) and other MCP-compatible clients.

## What It Does

Gives your AI assistant direct access to your Utelogy-monitored AV environment — query rooms, devices, alerts, and the Global Device Library without leaving your terminal.

## Tools

### Alerts (3 tools)

- **`list-active-alerts`** — List all currently active (unacknowledged) alerts across all monitored devices
- **`list-alerts`** — List alerts with optional date range filter (ISO 8601 datetime)
- **`acknowledge-alert`** — Acknowledge an active alert by its ID

### Assets (2 tools)

- **`list-assets`** — List all monitored assets (devices) across all rooms
- **`get-asset`** — Get detailed information about a specific asset by ID

### Rooms (3 tools)

- **`list-rooms`** — List all rooms configured in the Utelogy portal
- **`get-room`** — Get detailed room information including CLM status and metrics
- **`get-room-alerts`** — List active alerts for a specific room

### Global Device Library (5 tools)

- **`list-manufacturers`** — List all manufacturers in the GDL
- **`list-device-kinds`** — List all device categories
- **`list-feature-kinds`** — List device capabilities (power, volume, input, etc.)
- **`list-drivers`** — List all device drivers
- **`search-drivers`** — Search drivers by keyword (manufacturer name, model, etc.)

## Prerequisites

- [Deno](https://deno.land) runtime (v1.40+)
- A Utelogy portal account with API access
- Your Utelogy API key and Base64 authorization header

## Installation

### Claude Code

Add to your `~/.claude.json` (user-level, recommended) or project `.mcp.json`:

```json
{
  "mcpServers": {
    "utelogy": {
      "command": "deno",
      "args": ["run", "--allow-net", "--allow-env", "server.ts"],
      "cwd": "/path/to/utelogy-mcp-server",
      "env": {
        "UTELOGY_API_KEY": "your-api-key",
        "UTELOGY_AUTHORIZATION": "your-base64-auth"
      }
    }
  }
}
```

### Other MCP Clients

Any MCP-compatible client can connect via stdio transport:

```bash
deno run --allow-net --allow-env server.ts
```

## Credential Resolution

The server supports two credential sources, checked in priority order:

1. **Explicit** — Pass `apiKey` and `authorization` directly in tool arguments
2. **Environment** — Set `UTELOGY_API_KEY` and `UTELOGY_AUTHORIZATION` environment variables

For multi-tenant setups (e.g., managing multiple Utelogy customer accounts as an MSP), run separate MCP server instances with different environment variables per client, or pass credentials explicitly per tool call.

## API Reference

This server wraps the [Utelogy REST API](https://portal.utelogy.com/swagger/docs/v1). All endpoints require a valid API key and authorization header, which you can obtain from your Utelogy portal account settings.

## License

MIT — see [LICENSE](LICENSE)
