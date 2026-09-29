/** Escape sequences that would break out of a script tag in srcdoc HTML. */
function escapeScriptContent(source: string): string {
  return source.replace(/<\/script/gi, "<\\/script");
}

export const CUSTOM_CODE_DEFAULT_HTML =
  '<div class="custom-code-block">\n  <p>Custom code</p>\n</div>';

export const CUSTOM_CODE_SANDBOX =
  "allow-scripts allow-forms allow-popups" as const;

/** postMessage type used by the iframe height reporter. */
export const CUSTOM_CODE_RESIZE_MESSAGE = "affsense-custom-code-resize" as const;

const BASE_STYLE = `html, body { margin: 0; }`;

const RESIZE_REPORTER_SCRIPT = escapeScriptContent(`(function () {
  function measure() {
    var doc = document.documentElement;
    var body = document.body;
    return Math.max(
      doc ? doc.scrollHeight : 0,
      doc ? doc.offsetHeight : 0,
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0
    );
  }
  function report() {
    var height = measure();
    if (!height || !isFinite(height)) return;
    try {
      parent.postMessage({ type: "${CUSTOM_CODE_RESIZE_MESSAGE}", height: height }, "*");
    } catch (e) {}
  }
  if (document.readyState === "complete") {
    report();
  } else {
    window.addEventListener("load", report);
  }
  window.addEventListener("resize", report);
  if (typeof ResizeObserver !== "undefined") {
    var ro = new ResizeObserver(report);
    if (document.documentElement) ro.observe(document.documentElement);
    if (document.body) ro.observe(document.body);
  }
})();`);

export function buildCustomCodeSrcdoc(html: string, css: string, js: string): string {
  const safeHtml = html ?? "";
  const safeCss = css ?? "";
  const safeJs = escapeScriptContent(js ?? "");

  const userStyle = safeCss.trim() ? `\n${safeCss}\n` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
${BASE_STYLE}${userStyle}
  </style>
</head>
<body>
${safeHtml}
${safeJs ? `<script>${safeJs}</script>` : ""}
<script>${RESIZE_REPORTER_SCRIPT}</script>
</body>
</html>`;
}

export function hasCustomCodeContent(
  html: string,
  css: string,
  js: string,
): boolean {
  return Boolean(html.trim() || css.trim() || js.trim());
}
