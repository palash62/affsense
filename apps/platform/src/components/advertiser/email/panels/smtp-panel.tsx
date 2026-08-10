"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Loader2, Server, XCircle } from "lucide-react";
import { PageSection } from "@/components/admin/page-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailModuleShell } from "../email-module-shell";

type ProviderInfo = {
  provider: "mailgun" | "smtp" | "none";
  configured: boolean;
  marketingProvider: string;
};

const PROVIDER_LABELS: Record<string, string> = {
  mailgun: "Mailgun",
  smtp: "SMTP",
  ses: "Amazon SES",
  none: "Not Configured",
};

export function SmtpPanel() {
  const [info, setInfo] = useState<ProviderInfo | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/v1/advertiser/email/provider")
      .then((r) => r.json())
      .then((j) => setInfo(j.data))
      .catch(() => {});
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/v1/advertiser/email/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo || undefined }),
      });
      const j = await res.json();
      setTestResult(j.data);
    } catch {
      setTestResult({ ok: false, message: "Request failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <EmailModuleShell
      title="Email Provider"
      description="View your platform email delivery configuration and send a test email."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Email Provider" },
      ]}
      showToolbar={false}
    >
      <PageSection title="Provider Status" icon={Server} gradient="leads">
        <div className="space-y-4 px-6 pb-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">Transactional Provider:</span>
            <Badge variant={info?.configured ? "default" : "destructive"}>
              {info ? PROVIDER_LABELS[info.provider] ?? info.provider : "Loading..."}
            </Badge>
            {info?.configured && <CheckCircle className="h-4 w-4 text-green-500" />}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">Marketing Provider:</span>
            <Badge variant="default">
              {info ? PROVIDER_LABELS[info.marketingProvider] ?? info.marketingProvider : "Loading..."}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {info?.provider === "mailgun"
              ? "Email delivery is handled via Mailgun API with SMTP fallback. Marketing domains can be verified on the Domain tab when using Mailgun."
              : info?.provider === "smtp"
                ? "Email delivery is handled via direct SMTP connection."
                : "No email provider is configured. Set MAILGUN_API_KEY or SMTP_HOST in the platform environment."}
          </p>
        </div>
      </PageSection>

      <PageSection title="Send Test Email" icon={Server} gradient="approved">
        <div className="space-y-4 px-6 pb-6">
          <div className="max-w-md space-y-2">
            <Label htmlFor="test-to">Recipient (leave blank to use your account email)</Label>
            <Input
              id="test-to"
              type="email"
              placeholder="test@example.com"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
          </div>
          <Button type="button" onClick={handleTest} disabled={testing}>
            {testing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            {testing ? "Sending..." : "Send Test Email"}
          </Button>
          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
                testResult.ok
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              {testResult.message}
            </div>
          )}
        </div>
      </PageSection>
    </EmailModuleShell>
  );
}
