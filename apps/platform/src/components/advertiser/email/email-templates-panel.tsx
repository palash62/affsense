"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";

type Template = {
  id: string;
  name: string;
  subject: string;
  updatedAt: string;
};

export function EmailTemplatesPanel() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/advertiser/email/templates");
    const json = await res.json();
    setTemplates(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/v1/advertiser/email/templates/${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">No templates yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Starter templates are created on first visit.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="font-semibold text-foreground">{t.name}</h3>
              <p className="mt-1 truncate text-sm text-muted-foreground">{t.subject}</p>
              <div className="mt-4 flex gap-2">
                <ButtonLink href={`/advertiser/email/templates/${t.id}`} size="sm" variant="outline">
                  Edit
                </ButtonLink>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
