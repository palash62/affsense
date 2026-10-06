"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  PUBLISHER_CPA_POSTBACK_MACROS,
  PUBLISHER_DIGITAL_PRODUCT_POSTBACK_MACROS,
} from "@cpl/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PostbackListEditor,
  type EditablePostback,
  type PostbackDeliveryRow,
} from "@/components/postbacks/postback-list-editor";
import { readApiErrorMessage } from "@/lib/errors";

type Channel = "DIGITAL_PRODUCT" | "CPA";

type ChannelData = { postbacks: EditablePostback[]; deliveries: PostbackDeliveryRow[] };

type MacroItem = { macro: string; description: string };

const CHANNELS: {
  channel: Channel;
  key: "digitalProduct" | "cpa";
  label: string;
  refLabel: string;
  macros: readonly MacroItem[];
}[] = [
  {
    channel: "DIGITAL_PRODUCT",
    key: "digitalProduct",
    label: "Digital Product",
    refLabel: "Event",
    macros: PUBLISHER_DIGITAL_PRODUCT_POSTBACK_MACROS,
  },
  {
    channel: "CPA",
    key: "cpa",
    label: "CPA",
    refLabel: "Conversion",
    macros: PUBLISHER_CPA_POSTBACK_MACROS,
  },
];

function pick(row: Partial<ChannelData> | undefined): ChannelData {
  return { postbacks: row?.postbacks ?? [], deliveries: row?.deliveries ?? [] };
}

export function AdminPublisherPostbackDialog({
  publisherId,
  publisherName,
  open,
  onOpenChange,
}: {
  publisherId: string;
  publisherName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const apiBase = `/api/v1/admin/publishers/${publisherId}/postbacks`;
  const [data, setData] = useState<Record<Channel, ChannelData> | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setData(null);
    void (async () => {
      try {
        const res = await fetch(apiBase);
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(readApiErrorMessage(body, "Failed to load postbacks.", res.status));
        }
        if (cancelled) return;
        setData({
          DIGITAL_PRODUCT: pick(body.data.digitalProduct),
          CPA: pick(body.data.cpa),
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load postbacks");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Postbacks — {publisherName}</DialogTitle>
        </DialogHeader>

        {!data ? (
          <p className="text-sm text-muted-foreground">Loading postbacks…</p>
        ) : (
          <Tabs defaultValue="DIGITAL_PRODUCT">
            <TabsList>
              {CHANNELS.map((c) => (
                <TabsTrigger key={c.channel} value={c.channel}>
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {CHANNELS.map((c) => (
              <TabsContent key={c.channel} value={c.channel} className="pt-4">
                <PostbackListEditor
                  compact
                  channelLabel={c.label}
                  collectionUrl={apiBase}
                  itemUrl={(id) => `${apiBase}/${encodeURIComponent(id)}`}
                  testFireUrl={`${apiBase}/test-fire`}
                  extraBody={{ channel: c.channel }}
                  initialPostbacks={data[c.channel].postbacks}
                  deliveries={data[c.channel].deliveries}
                  macros={c.macros}
                  refLabel={c.refLabel}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
