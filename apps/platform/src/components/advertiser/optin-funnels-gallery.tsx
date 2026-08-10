"use client";



import { useState } from "react";

import { useRouter } from "next/navigation";

import { Plus } from "lucide-react";

import { listOptinTemplates } from "@/lib/optin-templates";

import type { SerializedOptinFunnel } from "@/lib/optin-funnel";

import { Button } from "@/components/ui/button";

import { toast } from "sonner";

import { OptinFunnelCard } from "@/components/advertiser/optin-funnel-card";

import { OptinFunnelTemplateCard } from "@/components/advertiser/optin-funnel-template-card";



export function OptinFunnelsGallery({

  initialFunnels,

}: {

  initialFunnels: SerializedOptinFunnel[];

}) {

  const router = useRouter();

  const [funnels, setFunnels] = useState(initialFunnels);

  const [loading, setLoading] = useState(false);

  const optinTemplates = listOptinTemplates();



  async function createFunnel(input: {

    name: string;

    editorType: "BUILDER";

    templateId?: string;

  }) {

    setLoading(true);

    const res = await fetch("/api/v1/advertiser/optin-funnels", {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(input),

    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error?.message ?? "Failed to create funnel");
      return;
    }

    const { data } = await res.json();

    router.push(`/advertiser/optin-funnels/${data.id}`);

  }
  async function archiveFunnel(id: string) {

    if (!confirm("Archive this optin funnel?")) return;

    const res = await fetch(`/api/v1/advertiser/optin-funnels/${id}`, { method: "DELETE" });

    if (!res.ok) {

      toast.error("Archive failed");

      return;

    }

    setFunnels((prev) => prev.filter((f) => f.id !== id));

    toast.success("Funnel archived");

  }



  return (

    <div className="space-y-10" id="create">

      <section>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

          <div>

            <h2 className="text-lg font-semibold text-foreground">Your Optin Funnels</h2>

            <p className="mt-1 text-sm text-muted-foreground">

              Edit optin and thank-you pages in the drag-and-drop builder.

            </p>

          </div>

          <Button disabled={loading} onClick={() => createFunnel({ name: "Blank Funnel", editorType: "BUILDER" })}>

            <Plus className="mr-2 h-4 w-4" />

            Blank funnel

          </Button>

        </div>



        {funnels.length === 0 ? (

          <div className="rounded-2xl border border-dashed border-border bg-muted/50 py-14 text-center">

            <p className="text-sm text-muted-foreground">No funnels yet.</p>

            <p className="mt-1 text-sm text-muted-foreground">Start from a template below or create a blank funnel.</p>

          </div>

        ) : (

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">

            {funnels.map((funnel) => (

              <OptinFunnelCard

                key={funnel.id}

                funnel={funnel}

                onArchive={archiveFunnel}

              />

            ))}

          </div>

        )}

      </section>



      <section>

        <div className="mb-5">

          <h2 className="text-lg font-semibold text-foreground">Template Funnels</h2>

          <p className="mt-1 text-sm text-muted-foreground">

            Pick a high-converting layout, then customize it in the page builder. Add an optional thank-you page

            after submit.

          </p>

        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">

          {optinTemplates.map((template) => (

            <OptinFunnelTemplateCard

              key={template.id}

              template={template}

              loading={loading}

              onUse={() =>

                createFunnel({

                  name: template.name,

                  editorType: "BUILDER",

                  templateId: template.id,

                })

              }

            />

          ))}

        </div>

      </section>

    </div>

  );

}

