# Utelogy MCP Server

An MCP server that gives AI coding assistants direct access to the Utelogy U-Manage portal REST API, covering rooms, assets, alerts, and the Global Device Library. It runs entirely on your local machine using Deno, communicates over stdio, and connects to your own Utelogy portal account using credentials you provide. Nothing is hosted, proxied, or routed through American Sound or any third party.

This server is open source and available to anyone with a Utelogy portal account and API credentials. You do not need to be an American Sound client to use it. This project is not affiliated with, endorsed by, or supported by Utelogy. It is an independent integration built and maintained by American Sound.

## Supported AI Platforms

American Sound tests and provides support for this server on paid plans of the following AI coding assistants:

- **Claude Code** and **Claude Desktop** (Anthropic) on Max, Team, and Enterprise plans
- **OpenAI Codex CLI** on paid OpenAI plans

Free-tier plans on these platforms may work with MCP servers, but American Sound does not test against free-tier configurations and will not provide integration support for them. If your preferred AI assistant adds MCP support in the future, this server should work with it without modification, though we will only add it to our supported platforms list once we have validated it internally.

## What It Does

The server exposes 13 tools that map to the Utelogy REST API's core endpoints. The API is read-only with one exception: alert acknowledgment is the only write operation Utelogy exposes through their REST interface.

The tools cover four domains:

- **Alerts** list active and historical alerts with optional date filtering, and acknowledge alerts by ID
- **Assets** list all monitored devices and retrieve detail for a specific asset
- **Rooms** list configured rooms, get room detail, and pull per-room alert state
- **Global Device Library** query manufacturers, device kinds, feature kinds, drivers, and search drivers by keyword

All API calls are rate-limited to one request per 10 seconds. The limiter enforces this at the module level so back-to-back tool invocations queue and execute in order rather than flooding the portal API.

## Local Installation

This server runs locally on your machine. It is not a cloud service, there is no hosted version, and American Sound does not operate or have access to any instance of this server beyond our own internal use. Your Utelogy credentials stay on your machine and are passed directly to the Utelogy portal API over HTTPS.

### Prerequisites

- [Deno](https://deno.land) runtime (v1.40+)
- A Utelogy portal account with API access
- Your Utelogy API key and Base64-encoded authorization header (available from your Utelogy portal account settings)

### Setup

Clone this repository to your local machine:

```bash
git clone https://github.com/American-Sound/utelogy-mcp-server.git
```

Add the server to your MCP client's configuration. Most clients accept a JSON format similar to:

```json
{
  "mcpServers": {
    "utelogy": {
      "command": "deno",
      "args": [
        "run",
        "--allow-net=portal.utelogy.com",
        "--allow-env",
        "server.ts"
      ],
      "cwd": "/path/to/utelogy-mcp-server",
      "env": {
        "UTELOGY_API_KEY": "your-api-key",
        "UTELOGY_AUTHORIZATION": "your-base64-auth"
      }
    }
  }
}
```

The `--allow-net=portal.utelogy.com` flag restricts the server's network access to the Utelogy portal only. You can use the broader `--allow-net` if your portal runs on a custom domain, but scoping the permission to the specific host is the more secure default.

You can also run the server directly to verify it starts:

```bash
deno run --allow-net --allow-env server.ts
```

The server will wait for MCP tool calls on stdin. In normal use, your AI assistant launches it automatically through the MCP configuration.

## Credential Resolution

Every tool accepts optional credential parameters, but you do not need to provide them on every call. The server resolves credentials through a two-tier fallback:

1. **Explicit parameters** (`apiKey`, `authorization`, `baseUrl`) passed directly in a tool call override everything. Use this when you need to target a specific account or test with different credentials.
2. **Environment variables** (`UTELOGY_API_KEY`, `UTELOGY_AUTHORIZATION`, `UTELOGY_BASE_URL`) serve as the default when no explicit credentials are provided. This is the standard configuration path.

The base URL defaults to `https://portal.utelogy.com` if not provided through either tier.

**Credential security:** MCP client configurations are stored as plaintext JSON on disk (e.g., `~/.claude.json` for Claude Code). Ensure your configuration file has appropriate file permissions (`chmod 600` on Linux/macOS) and never commit it to source control. If your organization uses a secrets manager, consider injecting credentials as environment variables at runtime rather than storing them in the config file directly.

## Tools Reference

### Alerts

| Tool | Description |
|------|-------------|
| `list-active-alerts` | List all currently active (unacknowledged) alerts across all monitored devices |
| `list-alerts` | List alerts with optional date range filter (ISO 8601 datetime) |
| `acknowledge-alert` | Acknowledge an active alert by its ID (**write operation**) |

### Assets

| Tool | Description |
|------|-------------|
| `list-assets` | List all monitored assets (devices) across all rooms |
| `get-asset` | Get detailed information about a specific asset by ID |

### Rooms

| Tool | Description |
|------|-------------|
| `list-rooms` | List all rooms configured in the Utelogy portal |
| `get-room` | Get detailed room information including CLM status and metrics |
| `get-room-alerts` | List active alerts for a specific room |

### Global Device Library

| Tool | Description |
|------|-------------|
| `list-manufacturers` | List all manufacturers in the GDL |
| `list-device-kinds` | List all device categories |
| `list-feature-kinds` | List device capabilities (power, volume, input, etc.) |
| `list-drivers` | List all available device drivers |
| `search-drivers` | Search drivers by keyword (manufacturer name, model, etc.) |

## Dependencies

The server uses two npm packages imported through Deno's npm specifier syntax:

- `@modelcontextprotocol/sdk@1.12.1` for the MCP server framework and stdio transport
- `zod@3.25.1` for tool parameter validation

No `package.json` or `node_modules` directory is needed. Deno fetches and caches these on first run.

## Rate Limiting

The rate limiter enforces a minimum 10-second interval between API calls at the module level. Because each MCP tool invocation creates a fresh client instance, the limiter lives outside the client class so it applies globally across all tool calls within a server session. Calls that arrive within the window are delayed rather than rejected, so you do not need to handle retry logic in your workflow.

The interval is configured as `minIntervalMs: 10_000` in the `rateLimiter` object in `utelogy-client.ts`.

## Permissions and AI Safety

The `acknowledge-alert` tool is the only write operation in this server. When you connect this server to an AI assistant, the assistant can acknowledge alerts on your behalf without additional confirmation unless your MCP client is configured to require approval for tool calls.

Utelogy's API does not support scoped permissions. An API key that can read rooms and assets can also acknowledge alerts. There is no way to issue a read-only key through the U-Manage portal. If your workflow is monitoring-only, configure your MCP client to require explicit approval before executing tool calls, or remove the `acknowledge-alert` tool registration from `server.ts` before deploying.

## Limitations

The Utelogy REST API does not expose U-Automate script triggering, so this server cannot initiate device control actions. Alert webhooks (HMAC SHA-256 signed, configured per account in the U-Manage portal) are a separate inbound integration path that this server does not handle.

## API Reference

This server wraps the [Utelogy REST API](https://portal.utelogy.com/swagger/docs/v1). All endpoints require a valid API key and authorization header, which you can obtain from your Utelogy portal account settings.

## Quality and Testing

All software published to the American Sound GitHub organization has been tested in either a production client environment or the American Sound integration lab prior to publication.

## Contact

Doug Schaefer, CTO, American Sound & Electronics, Inc.

- GitHub: [@dougschaefer6](https://github.com/dougschaefer6)
- LinkedIn: [linkedin.com/in/dougschaefer](https://linkedin.com/in/dougschaefer)
- Email: dougschaefer@asei.com

## License

MIT. See [LICENSE](LICENSE) for details.
