"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pause, Play, Trash2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";

type Automation = {
  id: string;
  name: string;
  trigger: string;
  status: string;
  campaignId: string | null;
  steps: { id: string; order: number; delayMinutes: number; template: { name: string } }[];
  _count: { sends: number };
};

const TRIGGER_LABELS: Record<string, string> = {
  LEAD_CAPTURED: "On lead submit",
  LEAD_APPROVED: "On lead approval",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  DRAFT: "secondary",
  PAUSED: "outline",
};

export function EmailAutomationsPanel() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/advertiser/email/automations");
    const json = await res.json();
    setAutomations(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleStatus(a: Automation) {
    if (a.status === "ACTIVE") {
      await fetch(`/api/v1/advertiser/email/automations/${a.id}/pause`, { method: "POST" });
    } else {
      await fetch(`/api/v1/advertiser/email/automations/${a.id}/activate`, { method: "POST" });
    }
    void load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this automation?")) return;
    await fetch(`/api/v1/advertiser/email/automations/${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : automations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Zap className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">No automations yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a list first, then bind an automation to it. Subscribers come from campaign leads.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <ButtonLink href="/advertiser/email/lists" variant="outline">
              Create a list
            </ButtonLink>
            <ButtonLink href="/advertiser/email/automations/new">Create automation</ButtonLink>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{a.name}</h3>
                    <Badge variant={STATUS_VARIANT[a.status] ?? "secondary"}>{a.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {TRIGGER_LABELS[a.trigger] ?? a.trigger} · {a.steps.length} step{a.steps.length !== 1 ? "s" : ""} · {a._count.sends} sends
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {a.steps.map((s) => (
                      <span key={s.id} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {s.delayMinutes === 0 ? "Immediate" : `+${s.delayMinutes}m`}: {s.template.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <ButtonLink href={`/advertiser/email/automations/${a.id}`} size="sm" variant="outline">
                    Edit
                  </ButtonLink>
                  {a.status !== "DRAFT" && (
                    <Button size="sm" variant="outline" onClick={() => toggleStatus(a)}>
                      {a.status === "ACTIVE" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                  )}
                  {a.status === "DRAFT" && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        await fetch(`/api/v1/advertiser/email/automations/${a.id}/activate`, { method: "POST" });
                        void load();
                      }}
                    >
                      Activate
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(a.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
