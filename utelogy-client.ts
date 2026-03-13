/**
 * Utelogy REST API Client
 *
 * Wraps the Utelogy portal REST API (https://portal.utelogy.com/swagger/docs/v1).
 * Supports explicit credentials or resolution from environment variables.
 */

export interface UtelogyCredentials {
  baseUrl: string;
  apiKey: string;
  authorization: string; // Base64 auth header value
}

export interface ResolvedCredentials {
  source: "explicit" | "env";
  credentials: UtelogyCredentials;
}

/**
 * Resolve credentials from explicit params or environment.
 * Priority: explicit > env vars.
 */
export function resolveCredentials(params: {
  apiKey?: string;
  authorization?: string;
  baseUrl?: string;
}): ResolvedCredentials {
  // 1. Explicit credentials
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

  // 2. Environment variables
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

export class UtelogyClient {
  private creds: UtelogyCredentials;

  constructor(creds: UtelogyCredentials) {
    this.creds = creds;
  }

  private async request(path: string, params?: Record<string, string>): Promise<unknown> {
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

  // --- Alert endpoints ---

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

  // --- Asset endpoints ---

  async listAssets(): Promise<unknown> {
    return this.request("/api/asset/list");
  }

  async getAsset(id: string): Promise<unknown> {
    return this.request(`/api/asset/${encodeURIComponent(id)}`);
  }

  // --- Room endpoints ---

  async listRooms(): Promise<unknown> {
    return this.request("/api/room/list");
  }

  async getRoom(id: string): Promise<unknown> {
    return this.request(`/api/room/${encodeURIComponent(id)}`);
  }

  async getRoomAlerts(id: string): Promise<unknown> {
    return this.request(`/api/room/${encodeURIComponent(id)}/alerts`);
  }

  // --- GDL endpoints ---

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
