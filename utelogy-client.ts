/**
 * Utelogy REST API Client
 *
 * Provides typed access to the Utelogy U-Manage portal REST API
 * (https://portal.utelogy.com/swagger/docs/v1), covering rooms, assets, alerts,
 * and the Global Device Library. The API itself is read-only with the exception
 * of alert acknowledgment, which is the only write operation Utelogy exposes.
 *
 * Credentials resolve through a two-tier fallback: explicit parameters take
 * priority, and environment variables serve as the default. This keeps
 * configuration simple while still allowing per-call overrides when needed.
 *
 * All API calls are rate-limited to one request per 10 seconds at the module
 * level. The limiter queues rather than rejects, so back-to-back tool
 * invocations will space themselves out automatically.
 */

export interface UtelogyCredentials {
  baseUrl: string;
  apiKey: string;
  authorization: string; // Base64-encoded Basic auth value (with or without "Basic " prefix)
}

export interface ResolvedCredentials {
  source: "explicit" | "env";
  credentials: UtelogyCredentials;
}

/**
 * Resolves credentials through the two-tier fallback chain. Explicit
 * credentials take priority because they represent an intentional override,
 * and environment variables serve as the default when no explicit
 * credentials are provided.
 */
export async function resolveCredentials(params: {
  apiKey?: string;
  authorization?: string;
  baseUrl?: string;
}): Promise<ResolvedCredentials> {
  // Explicit credentials override everything
  if (params.apiKey && params.authorization) {
    return {
      source: "explicit",
      credentials: {
        baseUrl: params.baseUrl ?? "https://portal.utelogy.com",
        apiKey: params.apiKey,
        authorization: params.authorization,
      },
    };
  }

  // Default: environment variables
  const envApiKey = Deno.env.get("UTELOGY_API_KEY");
  const envAuth = Deno.env.get("UTELOGY_AUTHORIZATION");
  const envBaseUrl = Deno.env.get("UTELOGY_BASE_URL");

  if (envApiKey && envAuth) {
    return {
      source: "env",
      credentials: {
        baseUrl: envBaseUrl ?? "https://portal.utelogy.com",
        apiKey: envApiKey,
        authorization: envAuth,
      },
    };
  }

  throw new Error(
    "No Utelogy credentials available. Provide apiKey + authorization explicitly, " +
    "or set UTELOGY_API_KEY and UTELOGY_AUTHORIZATION environment variables."
  );
}

/**
 * Module-level rate limiter shared across all UtelogyClient instances.
 * API calls are limited to one request per 10 seconds, and since
 * each MCP tool invocation creates a fresh client instance
 * through getClient(), the limiter must live outside the class to
 * enforce the interval globally. Calls that arrive inside the window
 * are delayed rather than rejected, so rapid tool invocations queue
 * up and execute in order without the caller needing to handle retries.
 */
const rateLimiter = {
  minIntervalMs: 10_000,
  lastCallTime: 0,

  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise((r) => setTimeout(r, this.minIntervalMs - elapsed));
    }
    this.lastCallTime = Date.now();
  },
};

export class UtelogyClient {
  private creds: UtelogyCredentials;

  constructor(creds: UtelogyCredentials) {
    this.creds = creds;
  }

  private async request(path: string, params?: Record<string, string>): Promise<unknown> {
    await rateLimiter.wait();
    const url = new URL(path, this.creds.baseUrl);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== "") url.searchParams.set(k, v);
      }
    }

    const resp = await fetch(url.toString(), {
      headers: {
        "Authorization": this.creds.authorization.startsWith("Basic ") ? this.creds.authorization : `Basic ${this.creds.authorization}`,
        "api_key": this.creds.apiKey,
        "Accept": "application/json",
      },
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Utelogy API ${resp.status} ${resp.statusText}: ${body}`);
    }

    return resp.json();
  }

  // Alerts: the only domain where Utelogy exposes a write operation (acknowledge)

  async listActiveAlerts(): Promise<unknown> {
    return this.request("/api/alert/list/active");
  }

  async listAlerts(occurredFrom?: string, occurredTo?: string): Promise<unknown> {
    const params: Record<string, string> = {};
    if (occurredFrom) params.occurredFrom = occurredFrom;
    if (occurredTo) params.occurredTo = occurredTo;
    return this.request("/api/alert/list", params);
  }

  async acknowledgeAlert(id: string): Promise<unknown> {
    return this.request(`/api/alert/${encodeURIComponent(id)}/acknowledge`);
  }

  // Assets: monitored devices across all rooms in the account

  async listAssets(): Promise<unknown> {
    return this.request("/api/asset/list");
  }

  async getAsset(id: string): Promise<unknown> {
    return this.request(`/api/asset/${encodeURIComponent(id)}`);
  }

  // Rooms: physical spaces with assigned assets and alert state

  async listRooms(): Promise<unknown> {
    return this.request("/api/room/list");
  }

  async getRoom(id: string): Promise<unknown> {
    return this.request(`/api/room/${encodeURIComponent(id)}`);
  }

  async getRoomAlerts(id: string): Promise<unknown> {
    return this.request(`/api/room/${encodeURIComponent(id)}/alerts`);
  }

  // Global Device Library: manufacturers, device kinds, feature kinds, and drivers

  async listManufacturers(): Promise<unknown> {
    return this.request("/api/gdl/manufacturer/list");
  }

  async listDeviceKinds(): Promise<unknown> {
    return this.request("/api/gdl/devicekind/list");
  }

  async listFeatureKinds(): Promise<unknown> {
    return this.request("/api/gdl/featurekind/list");
  }

  async listDrivers(): Promise<unknown> {
    return this.request("/api/gdl/driver/list");
  }

  async searchDrivers(keywords: string): Promise<unknown> {
    return this.request(`/api/gdl/driver/search/${encodeURIComponent(keywords)}`);
  }
}
