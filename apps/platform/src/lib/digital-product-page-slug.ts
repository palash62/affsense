/**
 * Derive a ClickFunnels-style page_slug from a full page URL
 * (last non-empty path segment, lowercased, query/hash stripped).
 */
export function derivePageSlugFromUrl(urlLike: string | null | undefined): string | null {
  const raw = urlLike?.trim();
  if (!raw) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last) return null;
    return decodeURIComponent(last).trim().toLowerCase() || null;
  } catch {
    const withoutQuery = raw.split(/[?#]/)[0] ?? raw;
    const segments = withoutQuery.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last) return null;
    try {
      return decodeURIComponent(last).trim().toLowerCase() || null;
    } catch {
      return last.trim().toLowerCase() || null;
    }
  }
}

export function normalizePageSlug(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.replace(/^\/+|\/+$/g, "") || null;
}
