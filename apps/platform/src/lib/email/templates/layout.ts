import { PLATFORM_EMAILS } from "@/lib/email/addresses";

/** Coral + Navy theme as hex values; email clients do not support CSS variables. */
export const EMAIL_THEME = {
  navy: "#0B1F3A",
  coral: "#FF6B6B",
  coralSoft: "#FFE8E4",
  background: "#FFF5F2",
  border: "#F1D9D5",
  text: "#334155",
  muted: "#64748B",
  success: "#16A34A",
  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
  dangerBorder: "#FECACA",
} as const;

const FONT_STACK = "Inter,'Segoe UI',system-ui,-apple-system,Helvetica,Arial,sans-serif";

export function emailLayout(content: string, appUrl: string) {
  const t = EMAIL_THEME;
  const support = PLATFORM_EMAILS.support;
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${t.background};font-family:${FONT_STACK};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${t.background};padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${t.border};border-radius:12px;overflow:hidden;">
        <tr><td style="height:4px;line-height:4px;font-size:0;background:${t.coral};">&nbsp;</td></tr>
        <tr><td style="background:${t.navy};padding:20px 24px;">
          <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.01em;color:#ffffff;">Aff<span style="color:${t.coral};">sense</span></p>
        </td></tr>
        <tr><td style="padding:28px 24px;color:${t.text};font-size:15px;line-height:1.6;">${content}</td></tr>
        <tr><td style="padding:18px 24px;border-top:1px solid ${t.border};background:${t.background};">
          <p style="margin:0 0 6px;font-size:13px;color:${t.navy};">
            Need help? <a href="mailto:${support}" style="color:${t.coral};text-decoration:none;font-weight:600;">${support}</a>
          </p>
          <p style="margin:0;font-size:12px;color:${t.muted};">
            <a href="${appUrl}" style="color:${t.muted};text-decoration:underline;">${appUrl}</a>
            &nbsp;&middot;&nbsp; &copy; ${year} Affsense Ltd
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buttonHtml(label: string, href: string) {
  return `<p style="margin:24px 0 0;">
    <a href="${href}" style="display:inline-block;background:${EMAIL_THEME.coral};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">${label}</a>
  </p>`;
}

export function calloutHtml(html: string, tone: "info" | "danger" = "info") {
  const t = EMAIL_THEME;
  const style =
    tone === "danger"
      ? `background:${t.dangerSoft};border:1px solid ${t.dangerBorder};border-left:4px solid ${t.danger};color:#991B1B;`
      : `background:${t.coralSoft};border:1px solid ${t.border};border-left:4px solid ${t.coral};color:${t.navy};`;
  return `<div style="margin:16px 0;padding:12px 14px;border-radius:8px;font-size:14px;line-height:1.55;${style}">${html}</div>`;
}
