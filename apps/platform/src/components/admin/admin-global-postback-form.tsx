"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHero } from "@/components/admin/page-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { readApiErrorMessage } from "@/lib/errors";
import { formatUserDateTime } from "@/lib/user-timezone";

type Settings = {
  useSecurityKey: boolean;
  securityKey: string;
  parallelPostbackUrl: string;
  s2sPostbackUrlExample: string;
  impressionPixelExample: string;
  conversionPixelExample: string;
};

type TestClick = {
  id: string;
  offerId: string;
  offerName: string;
  advertiserId: string;
  createdAt: string;
};

type TestDelivery = {
  target: string;
  status: string;
  url: string;
  httpStatus: number | null;
  error: string | null;
};

type TestFireResult = {
  testUrl: string;
  httpStatus: number;
  response: unknown;
  conversionId: string | null;
  deliveries: TestDelivery[];
};

export function AdminGlobalPostbackForm() {
  const { data: session } = useSession();
  const timezone = session?.user?.timezone;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Settings>({
    useSecurityKey: false,
    securityKey: "",
    parallelPostbackUrl: "",
    s2sPostbackUrlExample: "",
    impressionPixelExample: "",
    conversionPixelExample: "",
  });
  const [testClicks, setTestClicks] = useState<TestClick[]>([]);
  const [testClicksLoading, setTestClicksLoading] = useState(false);
  const [testClickId, setTestClickId] = useState("");
  const [testPayout, setTestPayout] = useState("1");
  const [testFiring, setTestFiring] = useState(false);
  const [testResult, setTestResult] = useState<TestFireResult | null>(null);

  const loadTestClicks = useCallback(async () => {
    setTestClicksLoading(true);
    try {
      const res = await fetch("/api/v1/admin/global-postback/test-clicks?limit=10");
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(readApiErrorMessage(body, "Failed to load test clicks.", res.status));
      }
      const clicks = (body?.data as TestClick[]) ?? [];
      setTestClicks(clicks);
      setTestClickId((prev) => prev || clicks[0]?.id || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load clicks");
    } finally {
      setTestClicksLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/v1/admin/global-postback");
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(readApiErrorMessage(body, "Failed to load settings.", res.status));
        }
        setValues((prev) => ({ ...prev, ...body.data }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
    void loadTestClicks();
  }, [loadTestClicks]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/global-postback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          useSecurityKey: values.useSecurityKey,
          securityKey: values.securityKey,
          parallelPostbackUrl: values.parallelPostbackUrl,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(readApiErrorMessage(body, "Failed to save settings.", res.status));
      }
      setValues((prev) => ({ ...prev, ...body.data }));
      toast.success("Postback settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestFire() {
    const clickId = testClickId.trim();
    if (!clickId) {
      toast.error("Select or enter a click id to test.");
      return;
    }

    setTestFiring(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/v1/admin/global-postback/test-fire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clickId, payout: testPayout.trim() || "1" }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(readApiErrorMessage(body, "Test fire failed.", res.status));
      }
      const data = body?.data as TestFireResult;
      setTestResult(data);
      if (data.httpStatus >= 200 && data.httpStatus < 300) {
        toast.success("Test postback fired");
      } else {
        toast.error(`Tracking returned HTTP ${data.httpStatus}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test fire failed");
    } finally {
      setTestFiring(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading postback settings…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Network"
        title="Global Postback"
        description="Configure postback security and parallel webhook delivery for CPA conversions."
      />

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-base font-semibold text-foreground">Postback URL Info</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These settings apply platform-wide to inbound CPA network postbacks and optional parallel
          delivery. Inbound postbacks hit the <strong>tracking domain</strong> (not leadvix.io).
        </p>

        <div className="mt-6 space-y-5">
          <div className="grid gap-2 sm:grid-cols-[240px_minmax(0,1fr)] sm:items-start sm:gap-6">
            <div>
              <Label className="text-sm font-semibold text-foreground">Use Postback Security Key?</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Require networks to include <code className="font-mono">&amp;secure=&#123;key&#125;</code> on
                inbound postbacks.
              </p>
            </div>
            <Select
              value={values.useSecurityKey ? "yes" : "no"}
              onValueChange={(v) =>
                setValues((prev) => ({ ...prev, useSecurityKey: v === "yes" }))
              }
            >
              <SelectTrigger className="h-11 w-full max-w-md bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 sm:grid-cols-[240px_minmax(0,1fr)] sm:items-start sm:gap-6">
            <div>
              <Label className="text-sm font-semibold text-foreground">Postback Security Key</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Include this parameter on S2S postbacks:{" "}
                <code className="font-mono">&amp;secure=&#123;PostbackSecurityKey&#125;</code>
              </p>
            </div>
            <Input
              value={values.securityKey}
              onChange={(e) => setValues((prev) => ({ ...prev, securityKey: e.target.value }))}
              placeholder="lsdjh3328ds"
              className="max-w-xl font-mono text-sm"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-[240px_minmax(0,1fr)] sm:items-start sm:gap-6">
            <div>
              <Label className="text-sm font-semibold text-foreground">Parallel Postback</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Optional webhook fired on every CPA conversion. Include {"{click_id}"} in the URL to
                receive the platform click id on outbound fires.
              </p>
            </div>
            <Input
              value={values.parallelPostbackUrl}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, parallelPostbackUrl: e.target.value }))
              }
              placeholder="https://example.com/?offer_id={offer_id}&click_id={click_id}&affiliate={aff_id}&payout={payout}"
              className="font-mono text-sm"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-[240px_minmax(0,1fr)] sm:items-start sm:gap-6">
            <div>
              <Label className="text-sm font-semibold text-foreground">S2S Postback Url</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Network-wide inbound URL on the tracking server. Replace {"{click_id}"} with a real
                platform click id from a CPA tracking link — do not fire the macro literally.
              </p>
            </div>
            <Input readOnly value={values.s2sPostbackUrlExample} className="bg-muted font-mono text-xs" />
          </div>

          <div className="grid gap-2 sm:grid-cols-[240px_minmax(0,1fr)] sm:items-start sm:gap-6">
            <div>
              <Label className="text-sm font-semibold text-foreground">Impression pixel</Label>
            </div>
            <Input
              readOnly
              value={values.impressionPixelExample}
              className="bg-muted font-mono text-xs"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-[240px_minmax(0,1fr)] sm:items-start sm:gap-6">
            <div>
              <Label className="text-sm font-semibold text-foreground">Conversion pixel</Label>
            </div>
            <Input
              readOnly
              value={values.conversionPixelExample}
              className="bg-muted font-mono text-xs"
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <Button type="button" disabled={saving} onClick={() => void handleSave()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-base font-semibold text-foreground">Test postback</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fire a real conversion against the tracking server using an existing CPA click. Outbound
          parallel and advertiser postbacks will run as in production.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Recent CPA click</Label>
            {testClicksLoading ? (
              <div className="flex h-10 items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading clicks…
              </div>
            ) : testClicks.length > 0 ? (
              <Select
                value={testClickId || undefined}
                onValueChange={(v) => {
                  if (v) setTestClickId(v);
                }}
              >
                <SelectTrigger className="h-11 bg-white font-mono text-sm">
                  <SelectValue placeholder="Select a click" />
                </SelectTrigger>
                <SelectContent>
                  {testClicks.map((click) => (
                    <SelectItem key={click.id} value={click.id}>
                      {click.offerName} — {click.id.slice(0, 12)}… (
                      {formatUserDateTime(click.createdAt, timezone, "MMM d, yyyy HH:mm")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-amber-700">
                No CPA clicks yet. Visit a CPA offer tracking link first, then refresh this page.
              </p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="test-click-id">Or paste click id</Label>
            <Input
              id="test-click-id"
              value={testClickId}
              onChange={(e) => setTestClickId(e.target.value)}
              placeholder="cuid from cpa_offer_clicks"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-payout">Test payout</Label>
            <Input
              id="test-payout"
              value={testPayout}
              onChange={(e) => setTestPayout(e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={testClicksLoading}
              onClick={() => void loadTestClicks()}
            >
              Refresh clicks
            </Button>
            <Button type="button" disabled={testFiring || !testClickId.trim()} onClick={() => void handleTestFire()}>
              {testFiring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Firing…
                </>
              ) : (
                "Fire test"
              )}
            </Button>
          </div>
        </div>

        {testResult && (
          <div className="mt-6 space-y-4 rounded-xl border border-border bg-muted p-4 text-sm">
            <div>
              <p className="font-medium text-foreground">Inbound URL</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{testResult.testUrl}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">
                Tracking response (HTTP {testResult.httpStatus})
              </p>
              <pre className="mt-1 overflow-x-auto rounded bg-white p-2 font-mono text-xs text-foreground">
                {JSON.stringify(testResult.response, null, 2)}
              </pre>
            </div>
            {testResult.deliveries.length > 0 ? (
              <div>
                <p className="font-medium text-foreground">Outbound deliveries</p>
                <ul className="mt-2 space-y-2">
                  {testResult.deliveries.map((d) => (
                    <li key={`${d.target}-${d.url}`} className="rounded border border-border bg-card p-2">
                      <p className="font-medium text-foreground">
                        {d.target} — {d.status}
                        {d.httpStatus != null ? ` (HTTP ${d.httpStatus})` : ""}
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{d.url}</p>
                      {d.error ? <p className="mt-1 text-xs text-red-600">{d.error}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : testResult.conversionId ? (
              <p className="text-muted-foreground">Conversion recorded; no outbound deliveries logged.</p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
