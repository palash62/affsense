/** True when the value is HTML from the rich editor rather than legacy plain text. */
export function isRichHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*?>/i.test(value);
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
};

export function richTextToPlain(value: string): string {
  if (!isRichHtml(value)) return value.trim();
  return value
    .replace(/<(br|hr)\s*\/?>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(nbsp|amp|lt|gt|quot|#39|#x27);/gi, (match) => ENTITIES[match.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

/** Styles for rendered rich text; the project has no typography plugin. */
export const RICH_CONTENT_CLASS = [
  "text-sm leading-relaxed break-words",
  "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
  "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold",
  "[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--theme-primary)]/40 [&_blockquote]:pl-3 [&_blockquote]:italic",
  "[&_a]:text-[var(--theme-primary)] [&_a]:underline [&_a]:underline-offset-2",
  "[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg",
  "[&_hr]:my-4 [&_hr]:border-border",
  "[&_mark]:rounded-sm [&_mark]:px-0.5",
].join(" ");
