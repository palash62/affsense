import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "s", "mark", "sub", "sup",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "a", "span", "div", "img", "blockquote", "hr",
];

const ALLOWED_ATTR = ["href", "src", "alt", "title", "class", "target", "rel", "style"];

const ALLOWED_STYLE_PROPS = new Set([
  "color",
  "background-color",
  "font-size",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-align",
]);

function sanitizeInlineStyle(style: string): string {
  const safe: string[] = [];
  for (const part of style.split(";")) {
    const [rawKey, rawVal] = part.split(":");
    if (!rawKey || !rawVal) continue;
    const key = rawKey.trim().toLowerCase();
    const val = rawVal.trim();
    if (!ALLOWED_STYLE_PROPS.has(key)) continue;
    if (/javascript:|expression\s*\(/i.test(val)) continue;
    safe.push(`${key}: ${val}`);
  }
  return safe.join("; ");
}

let hooksRegistered = false;

function ensureStyleHook() {
  if (hooksRegistered) return;
  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    if (data.attrName === "style" && data.attrValue) {
      data.attrValue = sanitizeInlineStyle(data.attrValue);
      if (!data.attrValue) {
        data.keepAttr = false;
      }
    }
  });
  hooksRegistered = true;
}

const INLINE_ALLOWED_TAGS = [
  "br", "strong", "em", "u", "s", "mark", "sub", "sup", "a", "span",
];

export function sanitizeInlineHtml(html: string): string {
  ensureStyleHook();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: INLINE_ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

export function sanitizeHtml(html: string): string {
  ensureStyleHook();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

const EMBED_ALLOWLIST = [
  "youtube.com",
  "www.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "vimeo.com",
];

export function sanitizeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase();
    if (!EMBED_ALLOWLIST.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function sanitizeCustomCss(css: string, scopeId: string): string {
  const stripped = css.replace(/@import/gi, "").replace(/javascript:/gi, "").replace(/expression\s*\(/gi, "");
  return `#${scopeId} { ${stripped} }`;
}
