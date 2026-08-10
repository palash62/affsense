"use client";

import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CpaOfferSelect } from "@/components/cpa/cpa-offer-select";

type FunnelSettingsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName?: string;
  name?: string;
  onNameChange?: (value: string) => void;
  urlHint: string;
  description?: string;
  thankYouEnabled: boolean;
  destinationUrl: string;
  cpaOfferId?: string | null;
  showOfferSelect?: boolean;
  thankYouPixelHtml: string;
  saving: boolean;
  message: string | null;
  thankYouRedirectHint?: string;
  onThankYouEnabledChange: (enabled: boolean) => void;
  onDestinationUrlChange: (url: string) => void;
  onCpaOfferIdChange?: (offerId: string | null) => void;
  onThankYouPixelHtmlChange: (html: string) => void;
  onSave: () => void;
};

export function FunnelSettingsSheet({
  open,
  onOpenChange,
  entityName,
  name,
  onNameChange,
  urlHint,
  description = "Configure submit behavior and tracking for this funnel.",
  thankYouEnabled,
  destinationUrl,
  cpaOfferId = null,
  showOfferSelect = false,
  thankYouPixelHtml,
  saving,
  message,
  thankYouRedirectHint,
  onThankYouEnabledChange,
  onDestinationUrlChange,
  onCpaOfferIdChange,
  onThankYouPixelHtmlChange,
  onSave,
}: FunnelSettingsSheetProps) {
  const hasOfferSelected = Boolean(cpaOfferId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-l border-border bg-white sm:max-w-md">
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-blue-600" />
            Funnel settings
          </SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-border bg-muted p-3">
            {onNameChange ? (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Funnel name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={name ?? ""}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="e.g. Sales funnel"
                  className="h-9 border-border bg-card text-sm"
                  disabled={saving}
                />
              </div>
            ) : (
              <p className="text-sm font-semibold text-foreground">{entityName}</p>
            )}
            <p className="mt-2 font-mono text-xs text-muted-foreground">{urlHint}</p>
          </div>

          <div className="space-y-3 rounded-xl border border-border p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">After submit</p>
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={thankYouEnabled}
                disabled={saving}
                onChange={(e) => onThankYouEnabledChange(e.target.checked)}
                className="mt-0.5 accent-blue-600"
              />
              <span>
                Redirect to thank-you page
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Enable this if you want users to land on your thank-you step after form submit.
                </span>
              </span>
            </label>

            {!thankYouEnabled && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Destination URL {!hasOfferSelected && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    type="url"
                    value={destinationUrl}
                    onChange={(e) => onDestinationUrlChange(e.target.value)}
                    placeholder="https://example.com/thank-you"
                    className="h-9 border-border text-sm"
                    disabled={saving || hasOfferSelected}
                  />
                  <p className="text-xs text-muted-foreground">
                    Users go here after form submit when thank-you redirect is off.
                  </p>
                </div>

                {showOfferSelect && onCpaOfferIdChange && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">or</span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>
                    <CpaOfferSelect
                      value={cpaOfferId}
                      onChange={onCpaOfferIdChange}
                      disabled={saving}
                      label="Connect high converting CPA offer"
                      placeholder="Choose a CPA offer"
                    />
                    <p className="text-xs text-muted-foreground">
                      Selecting an offer redirects visitors through your CPA tracking link after submit.
                    </p>
                  </>
                )}
              </div>
            )}

            {thankYouEnabled && thankYouRedirectHint && (
              <p className="text-xs text-muted-foreground">{thankYouRedirectHint}</p>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-border p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tracking code</p>
            <Label className="text-xs font-medium text-muted-foreground">Custom pixel / HTML</Label>
            <textarea
              value={thankYouPixelHtml}
              onChange={(e) => onThankYouPixelHtmlChange(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-border px-3 py-2 font-mono text-xs"
              placeholder="<script>...</script>"
            />
          </div>

          <div className="flex items-center gap-3 border-t border-border pt-3">
            <Button className="h-9" disabled={saving} onClick={onSave}>
              {saving ? "Saving..." : "Save settings"}
            </Button>
            {message && (
              <p className={`text-sm ${message.includes("Unable") || message.includes("required") || message.includes("valid") || message.includes("characters") || message.includes("offer") ? "text-red-600" : "text-emerald-600"}`}>
                {message}
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
