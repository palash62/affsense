"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RoleHero } from "@/components/layout/role-hero";
import { PublisherInfoBanner } from "@/components/publisher/publisher-info-banner";
import {
  PostbackListEditor,
  type EditablePostback,
  type PostbackDeliveryRow,
} from "@/components/postbacks/postback-list-editor";
import { readApiErrorMessage } from "@/lib/errors";

type MacroItem = { macro: string; description: string };

type ChannelPostbacks = { postbacks: EditablePostback[]; deliveries: PostbackDeliveryRow[] };

export function PublisherChannelPostbackForm({
  channelLabel,
  eyebrow,
  title,
  description,
  banner,
  tip,
  apiBase,
  macros,
  refLabel,
}: {
  channelLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  banner?: string;
  tip: string;
  apiBase: string;
  macros: readonly MacroItem[];
  refLabel: string;
}) {
  const [data, setData] = useState<ChannelPostbacks | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(apiBase);
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(readApiErrorMessage(body, "Failed to load postbacks.", res.status));
        }
        setData({
          postbacks: (body.data.postbacks as EditablePostback[] | undefined) ?? [],
          deliveries: (body.data.deliveries as PostbackDeliveryRow[] | undefined) ?? [],
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load");
        setData({ postbacks: [], deliveries: [] });
      }
    })();
  }, [apiBase]);

  return (
    <div className="space-y-6">
      <RoleHero eyebrow={eyebrow} title={title} description={description} />

      {banner ? <PublisherInfoBanner>{banner}</PublisherInfoBanner> : null}

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        {tip}
        <div className="mt-2 font-mono text-xs text-sky-800">
          Example: https://your-tracker.com/pb?click_id=&#123;click_id&#125;&amp;payout=&#123;payout&#125;&amp;sub_id=&#123;sub_id&#125;
        </div>
      </div>

      {!data ? (
        <p className="text-sm text-slate-500">Loading postbacks…</p>
      ) : (
        <PostbackListEditor
          channelLabel={channelLabel}
          collectionUrl={apiBase}
          itemUrl={(id) => `${apiBase}/${encodeURIComponent(id)}`}
          testFireUrl={`${apiBase}/test-fire`}
          initialPostbacks={data.postbacks}
          deliveries={data.deliveries}
          macros={macros}
          refLabel={refLabel}
        />
      )}
    </div>
  );
}
