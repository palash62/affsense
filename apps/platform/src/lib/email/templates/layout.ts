export function emailLayout(content: string, appUrl: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:20px 24px;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:600;">Affsense</p>
        </td></tr>
        <tr><td style="padding:24px;color:#334155;font-size:15px;line-height:1.6;">${content}</td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #f1f5f9;background:#f8fafc;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">
            <a href="${appUrl}" style="color:#6366f1;text-decoration:none;">${appUrl}</a>
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
    <a href="${href}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;">${label}</a>
  </p>`;
}
