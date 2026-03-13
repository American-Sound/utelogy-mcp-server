#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Utelogy MCP Server
 *
 * Exposes the Utelogy U-Manage portal REST API as MCP tools, providing
 * AI coding assistants with direct access to room inventory, asset
 * status, active alerts, and the Global Device Library for any Utelogy
 * portal account.
 *
 * All API calls are rate-limited to one request per 10 seconds.
 * The limiter queues rather than rejects, so consecutive tool calls
 * will execute in order without the caller needing to handle timing.
 *
 * Usage:
 *   deno run --allow-net --allow-env server.ts
 */

import { McpServer } from "npm:@modelcontextprotocol/sdk@1.12.1/server/mcp.js";
import { StdioServerTransport } from "npm:@modelcontextprotocol/sdk@1.12.1/server/stdio.js";
import { z } from "npm:zod@3.25.1";
import { UtelogyClient, resolveCredentials } from "./utelogy-client.ts";

const server = new McpServer({
  name: "utelogy",
  version: "1.0.0",
});

// Every tool accepts optional credential overrides so callers can
// pass credentials directly instead of relying on environment variables
const CredentialArgs = {
  apiKey: z.string().optional().describe(
    "Utelogy API key. Overrides env credentials."
  ),
  authorization: z.string().optional().describe(
    "Base64 authorization header value. Overrides env credentials."
  ),
  baseUrl: z.string().optional().describe(
    "Utelogy portal base URL. Defaults to https://portal.utelogy.com"
  ),
};

async function getClient(args: {
  apiKey?: string;
  authorization?: string;
  baseUrl?: string;
}): Promise<{ client: UtelogyClient; source: string }> {
  const resolved = await resolveCredentials(args);
  return {
    client: new UtelogyClient(resolved.credentials),
    source: resolved.source,
  };
}

function jsonResult(data: unknown, meta?: string) {
  const text = JSON.stringify(data, null, 2);
  const prefix = meta ? `[credentials: ${meta}]\n\n` : "";
  return { content: [{ type: "text" as const, text: prefix + text }] };
}

function errorResult(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
}

// Alert tools: list, filter, and acknowledge alerts from U-Manage

server.tool(
  "list-active-alerts",
  "List all currently active (unacknowledged) alerts across all monitored devices",
  { ...CredentialArgs },
  async (args) => {
    try {
      const { client, source } = await getClient(args);
      const data = await client.listActiveAlerts();
      return jsonResult(data, source);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  "list-alerts",
  "List alerts with optional date range filter",
  {
    ...CredentialArgs,
    occurredFrom: z.string().optional().describe("Start date filter (ISO 8601 datetime)"),
    occurredTo: z.string().optional().describe("End date filter (ISO 8601 datetime)"),
  },
  async (args) => {
    try {
      const { client, source } = await getClient(args);
      const data = await client.listAlerts(args.occurredFrom, args.occurredTo);
      return jsonResult(data, source);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  "acknowledge-alert",
  "Acknowledge an active alert by its ID",
  {
    ...CredentialArgs,
    id: z.string().describe("The alert ID to acknowledge"),
  },
  async (args) => {
    try {
      const { client, source } = await getClient(args);
      const data = await client.acknowledgeAlert(args.id);
      return jsonResult(data, source);
    } catch (err) {
      return errorResult(err);
    }
  }
);

// Asset tools: inventory and detail for monitored devices

server.tool(
  "list-assets",
  "List all monitored assets (devices) across all rooms",
  { ...CredentialArgs },
  async (args) => {
    try {
      const { client, source } = await getClient(args);
      const data = await client.listAssets();
      return jsonResult(data, source);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  "get-asset",
  "Get detailed information about a specific asset by ID",
  {
    ...CredentialArgs,
    id: z.string().describe("The asset ID"),
  },
  async (args) => {
    try {
      const { client, source } = await getClient(args);
      const data = await client.getAsset(args.id);
      return jsonResult(data, source);
    } catch (err) {
      return errorResult(err);
    }
  }
);

// Room tools: spaces, their assets, and per-room alert state

server.tool(
  "list-rooms",
  "List all rooms configured in the Utelogy portal",
  { ...CredentialArgs },
  async (args) => {
    try {
      const { client, source } = await getClient(args);
      const data = await client.listRooms();
      return jsonResult(data, source);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  "get-room",
  "Get detailed information about a specific room by ID",
  {
    ...CredentialArgs,
    id: z.string().describe("The room ID"),
  },
  async (args) => {
    try {
      const { client, source } = await getClient(args);
      const data = await client.getRoom(args.id);
      return jsonResult(data, source);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  "get-room-alerts",
  "List active alerts for a specific room",
  {
    ...CredentialArgs,
    id: z.string().describe("The room ID"),
  },
  async (args) => {
    try {
      const { client, source } = await getClient(args);
      const data = await client.getRoomAlerts(args.id);
      return jsonResult(data, source);
    } catch (err) {
      return errorResult(err);
    }
  }
);

// Global Device Library tools: manufacturers, device kinds, drivers, and capabilities

server.tool(
  "list-manufacturers",
  "List all manufacturers in the Utelogy Global Device Library",
  { ...CredentialArgs },
  async (args) => {
    try {
      const { client, source } = await getClient(args);
      const data = await client.listManufacturers();
      return jsonResult(data, source);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  "list-device-kinds",
  "List all device kinds (categories) in the Global Device Library",
  { ...CredentialArgs },
  async (args) => {
    try {
      const { client, source } = await getClient(args);
      const data = await client.listDeviceKinds();
      return jsonResult(data, source);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  "list-feature-kinds",
  "List all feature kinds (capabilities like power, volume, input) in the GDL",
  { ...CredentialArgs },
  async (args) => {
    try {
      const { client, source } = await getClient(args);
      const data = await client.listFeatureKinds();
      return jsonResult(data, source);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  "list-drivers",
  "List all device drivers available in the Global Device Library",
  { ...CredentialArgs },
  async (args) => {
    try {
      const { client, source } = await getClient(args);
      const data = await client.listDrivers();
      return jsonResult(data, source);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  "search-drivers",
  "Search for device drivers by keyword (manufacturer name, model, etc.)",
  {
    ...CredentialArgs,
    keywords: z.string().describe("Search keywords for driver lookup"),
  },
  async (args) => {
    try {
      const { client, source } = await getClient(args);
      const data = await client.searchDrivers(args.keywords);
      return jsonResult(data, source);
    } catch (err) {
      return errorResult(err);
    }
  }
);

// Connect over stdio and begin accepting tool calls

const transport = new StdioServerTransport();
await server.connect(transport);
