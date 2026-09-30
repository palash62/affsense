"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ClickFunnelsProductOption = { id: string; publicId: string | null; name: string };

export type ClickFunnelsProductsState =
  | { status: "loading" }
  | { status: "ready"; products: ClickFunnelsProductOption[] }
  | { status: "unavailable"; message: string };

const NONE = "__none__";

/** Loads the connected workspace's ClickFunnels products once per form. */
export function useClickFunnelsProducts() {
  const [state, setState] = useState<ClickFunnelsProductsState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    setState({ status: "loading" });
    fetch(`/api/v1/admin/clickfunnels/products${reloadKey > 0 ? "?refresh=1" : ""}`, {
      signal: ac.signal,
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (ac.signal.aborted) return;
        if (!res.ok) {
          setState({
            status: "unavailable",
            message: json.error?.message ?? "ClickFunnels API is not available",
          });
          return;
        }
        setState({ status: "ready", products: Array.isArray(json.data) ? json.data : [] });
      })
      .catch(() => {
        if (!ac.signal.aborted) {
          setState({ status: "unavailable", message: "Could not load ClickFunnels products" });
        }
      });
    return () => ac.abort();
  }, [reloadKey]);

  return { state, reload: () => setReloadKey((k) => k + 1) };
}

export function ClickFunnelsProductPicker({
  state,
  onReload,
  cfProductId,
  cfProductName,
  onChange,
  ariaLabel,
}: {
  state: ClickFunnelsProductsState;
  onReload: () => void;
  cfProductId: string;
  cfProductName: string;
  onChange: (next: { cfProductId: string; cfProductName: string }) => void;
  ariaLabel: string;
}) {
  if (state.status === "unavailable") {
    return (
      <div className="space-y-1.5">
        <Input
          value={cfProductId}
          onChange={(e) => onChange({ cfProductId: e.target.value, cfProductName: "" })}
          placeholder="ClickFunnels product ID"
          aria-label={ariaLabel}
          className="h-10 rounded-md font-mono"
        />
        <p className="text-xs text-muted-foreground">
          {state.message}. Enter the product ID manually, or connect the API in Settings →
          ClickFunnels.
        </p>
      </div>
    );
  }

  const products = state.status === "ready" ? state.products : [];
  const options =
    cfProductId && !products.some((p) => p.id === cfProductId)
      ? [{ id: cfProductId, publicId: null, name: cfProductName || `Product ${cfProductId}` }, ...products]
      : products;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Select
          value={cfProductId || NONE}
          onValueChange={(v) => {
            const id = typeof v === "string" && v !== NONE ? v : "";
            const match = options.find((p) => p.id === id);
            onChange({ cfProductId: id, cfProductName: match?.name ?? "" });
          }}
          disabled={state.status === "loading"}
        >
          <SelectTrigger className="h-10 w-full rounded-md" aria-label={ariaLabel}>
            <SelectValue>
              {(value: string | null) => {
                if (state.status === "loading") return "Loading ClickFunnels products...";
                if (!value || value === NONE) return "Not linked";
                return options.find((p) => p.id === value)?.name ?? `Product ${value}`;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Not linked</SelectItem>
            {options.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={onReload}
          aria-label="Reload ClickFunnels products"
          disabled={state.status === "loading"}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      {cfProductId ? (
        <p className="text-xs text-muted-foreground">
          ClickFunnels product ID: <code className="rounded bg-muted px-1">{cfProductId}</code>
        </p>
      ) : null}
    </div>
  );
}
