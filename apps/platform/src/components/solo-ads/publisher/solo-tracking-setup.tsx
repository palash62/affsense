"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { soloRequest } from "@/components/solo-ads/solo-ui";

type Host = { host: string; lastSeenAt: string };
type ExternalCampaign = { id: string; name: string; host: string | null; verified: boolean };

function copy(text: string) {
  void navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 pr-16 text-xs leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
      <Button size="sm" variant="secondary" className="absolute right-2 top-2 h-7 gap-1 px-2 text-xs" onClick={() => copy(code)}>
        <Copy className="h-3 w-3" /> Copy
      </Button>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="premium-card space-y-3 p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--theme-primary)] text-sm font-semibold text-white">{n}</span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function SoloTrackingSetup({
  snippet,
  hosts,
  campaigns,
  leadApiUrl,
  apiKeyPrefix,
  sampleOfferLink,
}: {
  snippet: string;
  hosts: Host[];
  campaigns: ExternalCampaign[];
  leadApiUrl: string;
  apiKeyPrefix: string | null;
  sampleOfferLink: string;
}) {
  const router = useRouter();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function rotate() {
    if (apiKeyPrefix && !window.confirm("Create a new API key? The current key will stop working immediately.")) return;
    setBusy(true);
    try {
      const data = await soloRequest<{ apiKey: string }>("/api/v1/publisher/solo-ads/tracking/api-key", { method: "POST" });
      setNewKey(data.apiKey);
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const curl = `curl -X POST ${leadApiUrl} \\
  -H "Authorization: Bearer ${newKey ?? "YOUR_API_KEY"}" \\
  -H "Content-Type: application/json" \\
  -d '{"click_id":"sc_xxxxxxxxxxxxxxxxxxxxxxxx","email":"subscriber@example.com","event_id":"optional-unique-id"}'`;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        You only need this if a campaign sends visitors to <strong>your own opt-in page</strong>. Campaigns that go straight to the
        offer are tracked automatically.
      </p>

      <Step n={1} title="Add the tracking script to your pages">
        <p className="text-sm text-muted-foreground">
          Paste this into the <code>&lt;head&gt;</code> of your opt-in page, your thank-you page, and any page that links to the
          offer. It is the same script for all your sites and campaigns.
        </p>
        <CodeBlock code={snippet} />
      </Step>

      <Step n={2} title="Link to the offer with your Affsense affiliate link">
        <p className="text-sm text-muted-foreground">
          Use your normal Affsense link for the offer on your page (for example the button on your thank-you page). The script adds
          the visitor&apos;s click id to it automatically, so the sale is credited to the right campaign.
        </p>
        <CodeBlock code={sampleOfferLink} />
      </Step>

      <Step n={3} title="Check that we can see the script">
        {hosts.length === 0 ? (
          <p className="text-sm text-amber-700">
            We have not detected the script on any site yet. Open your opt-in page in a browser after installing it, then refresh
            this page.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {hosts.map((h) => (
              <li key={h.host} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="font-medium">{h.host}</span>
                <span className="text-xs text-muted-foreground">last seen {new Date(h.lastSeenAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
        {campaigns.length > 0 ? (
          <div className="space-y-1 border-t border-border pt-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Campaigns using your own page</div>
            {campaigns.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-sm">
                {c.verified ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-amber-500" />}
                <span>{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.host}</span>
                {!c.verified ? <span className="text-xs text-amber-700">waiting for script — no traffic yet</span> : null}
              </div>
            ))}
          </div>
        ) : null}
      </Step>

      <section className="premium-card space-y-3 p-6">
        <h2 className="text-base font-semibold">Reporting opt-ins (optional)</h2>
        <p className="text-sm text-muted-foreground">
          The script records an opt-in automatically when a form with an email field is submitted. If your form is custom, call
          this after a successful sign-up:
        </p>
        <CodeBlock code={`window.affsense && window.affsense.lead("subscriber@example.com");`} />
        <p className="text-sm text-muted-foreground">
          If your sign-up is processed on your server or by your autoresponder, send the opt-in from there instead. The click id is
          in the <code>affs_click_id</code> URL parameter and is added as a hidden field to your forms.
        </p>
        <CodeBlock code={curl} />
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="outline" className="gap-1" disabled={busy} onClick={rotate}>
            <KeyRound className="h-4 w-4" /> {apiKeyPrefix ? "Create new API key" : "Create API key"}
          </Button>
          {apiKeyPrefix && !newKey ? <span className="text-xs text-muted-foreground">Current key starts with {apiKeyPrefix}…</span> : null}
        </div>
        {newKey ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
            <div className="mb-1 font-medium text-emerald-800">Your new API key — copy it now, it will not be shown again.</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all text-xs">{newKey}</code>
              <Button size="sm" variant="outline" onClick={() => copy(newKey)}>
                Copy
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="premium-card space-y-2 p-6">
        <h2 className="text-base font-semibold">Can&apos;t add scripts to your page?</h2>
        <p className="text-sm text-muted-foreground">
          Use manual mode: read the <code>affs_click_id</code> value from your landing page URL and add it to your offer link
          yourself, for example <code>…&amp;affs_click_id=sc_…</code>. Then report opt-ins with the server API above. Note that we
          need to detect the script once on your landing page domain before the campaign can receive traffic; contact support if
          that is not possible for your setup.
        </p>
      </section>
    </div>
  );
}
