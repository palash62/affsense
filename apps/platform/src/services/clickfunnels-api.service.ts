import { AppError } from "@/lib/errors";
import { loadClickFunnelsWebhookConfig } from "@/services/clickfunnels-webhook-settings.service";

const ACCOUNTS_BASE = "https://accounts.myclickfunnels.com/api/v2";
const USER_AGENT = "Affsense/1.0 (affsense.com)";
const MAX_PAGES = 20;
const PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000;

export type ClickFunnelsWorkspace = {
  id: string;
  publicId: string | null;
  teamId: string | null;
  teamName: string | null;
  name: string;
  subdomain: string;
};

export type ClickFunnelsProduct = {
  id: string;
  publicId: string | null;
  name: string;
};

let productCache: { key: string; at: number; products: ClickFunnelsProduct[] } | null = null;

function isValidSubdomain(value: string): boolean {
  return /^[a-z0-9-]+$/i.test(value);
}

async function cfGet(url: string, token: string): Promise<{ data: unknown; next: string | null }> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AppError("CLICKFUNNELS_UNREACHABLE", "Could not reach ClickFunnels API", 502);
  }
  if (res.status === 401 || res.status === 403) {
    throw new AppError(
      "CLICKFUNNELS_UNAUTHORIZED",
      "ClickFunnels rejected the API access token",
      400,
    );
  }
  if (!res.ok) {
    throw new AppError(
      "CLICKFUNNELS_API_ERROR",
      `ClickFunnels API returned ${res.status}`,
      502,
    );
  }
  const data = (await res.json().catch(() => null)) as unknown;
  return { data, next: res.headers.get("pagination-next") };
}

async function cfList(baseUrl: string, token: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(baseUrl);
    if (after) url.searchParams.set("after", after);
    const { data, next } = await cfGet(url.toString(), token);
    if (!Array.isArray(data)) break;
    for (const item of data) {
      if (item && typeof item === "object") out.push(item as Record<string, unknown>);
    }
    if (!next || next === after || data.length === 0) break;
    after = next;
  }
  return out;
}

function idOf(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

/** List every workspace the token can reach (teams → workspaces). */
export async function listClickFunnelsWorkspaces(token: string): Promise<ClickFunnelsWorkspace[]> {
  const apiToken = token.trim();
  if (!apiToken) {
    throw new AppError("CLICKFUNNELS_NOT_CONFIGURED", "ClickFunnels API access token is required", 400);
  }
  const teams = await cfList(`${ACCOUNTS_BASE}/teams`, apiToken);
  const workspaces: ClickFunnelsWorkspace[] = [];
  for (const team of teams) {
    const teamId = idOf(team.id);
    if (!teamId) continue;
    const rows = await cfList(`${ACCOUNTS_BASE}/teams/${encodeURIComponent(teamId)}/workspaces`, apiToken);
    for (const row of rows) {
      const id = idOf(row.id);
      const subdomain = typeof row.subdomain === "string" ? row.subdomain.trim() : "";
      if (!id || !subdomain) continue;
      workspaces.push({
        id,
        publicId: idOf(row.public_id),
        teamId,
        teamName: typeof team.name === "string" ? team.name : null,
        name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : subdomain,
        subdomain,
      });
    }
  }
  return workspaces;
}

async function loadApiConfig() {
  const config = await loadClickFunnelsWebhookConfig();
  if (!config.apiToken || !config.apiWorkspaceId || !config.apiWorkspaceSubdomain) {
    throw new AppError(
      "CLICKFUNNELS_NOT_CONFIGURED",
      "Connect the ClickFunnels API in Settings → ClickFunnels first",
      400,
    );
  }
  if (!isValidSubdomain(config.apiWorkspaceSubdomain)) {
    throw new AppError("CLICKFUNNELS_NOT_CONFIGURED", "Invalid ClickFunnels workspace subdomain", 400);
  }
  return config;
}

/** Non-archived products in the connected workspace (cached ~5 min). */
export async function listClickFunnelsProducts(opts: { refresh?: boolean } = {}): Promise<ClickFunnelsProduct[]> {
  const config = await loadApiConfig();
  const cacheKey = `${config.apiWorkspaceSubdomain}:${config.apiWorkspaceId}:${config.apiToken.slice(-6)}`;
  if (
    !opts.refresh &&
    productCache &&
    productCache.key === cacheKey &&
    Date.now() - productCache.at < PRODUCT_CACHE_TTL_MS
  ) {
    return productCache.products;
  }

  const base = `https://${config.apiWorkspaceSubdomain}.myclickfunnels.com/api/v2/workspaces/${encodeURIComponent(
    config.apiWorkspaceId,
  )}/products?filter[archived]=false`;
  const rows = await cfList(base, config.apiToken);
  const products = rows
    .map((row) => {
      const id = idOf(row.id);
      if (!id) return null;
      return {
        id,
        publicId: idOf(row.public_id),
        name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : `Product ${id}`,
      };
    })
    .filter((p): p is ClickFunnelsProduct => p != null)
    .sort((a, b) => a.name.localeCompare(b.name));

  productCache = { key: cacheKey, at: Date.now(), products };
  return products;
}

export function clearClickFunnelsProductCache() {
  productCache = null;
}
