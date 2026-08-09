"use client";

export function MailgunMarketingInfo() {
  const appUrl =
    typeof window !== "undefined" ? window.location.origin : "https://leadvix.io";
  const webhookUrl = `${appUrl}/api/v1/webhooks/mailgun`;

  return (
    <div className="max-w-2xl space-y-4 text-sm text-slate-700">
      <p>
        Advertiser broadcasts and automations send through <strong>Mailgun</strong> only.
        Configure keys in the platform <code className="rounded bg-slate-100 px-1">.env</code>:
      </p>
      <ul className="list-disc space-y-1 pl-5 font-mono text-xs text-slate-800">
        <li>MAILGUN_API_KEY</li>
        <li>MAILGUN_DOMAIN</li>
        <li>MAILGUN_FROM</li>
        <li>MAILGUN_WEBHOOK_SIGNING_KEY</li>
        <li>APP_URL</li>
      </ul>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="font-medium text-slate-900">Delivery webhooks</p>
        <p className="mt-1 text-slate-600">
          In Mailgun → Sending → Webhooks, for each sending domain point{" "}
          <strong>delivered</strong>, <strong>permanent failure</strong>, and{" "}
          <strong>complained</strong> to:
        </p>
        <code className="mt-2 block break-all rounded bg-white px-2 py-1.5 text-xs text-slate-900">
          {webhookUrl}
        </code>
      </div>
    </div>
  );
}
