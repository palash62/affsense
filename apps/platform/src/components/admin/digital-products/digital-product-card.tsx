"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { DigitalProductListItem } from "./digital-product-types";

function StatusPill({ status }: { status: DigitalProductListItem["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm backdrop-blur-sm",
        status === "Active"
          ? "bg-[color-mix(in_srgb,var(--theme-success)_14%,white)] text-[var(--theme-success)]"
          : "bg-[color-mix(in_srgb,var(--warning)_16%,white)] text-[var(--warning)]",
      )}
    >
      {status}
    </span>
  );
}

export function DigitalProductCard({
  product,
  onDelete,
}: {
  product: DigitalProductListItem;
  onDelete: (id: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const letter = (product.name.trim()[0] || "?").toUpperCase();

  return (
    <>
      <article
        className={cn(
          "group flex h-full flex-col overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card",
          "shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]",
        )}
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div
              className={cn(
                "flex h-full w-full items-center justify-center bg-gradient-to-br text-4xl font-bold text-white",
                product.thumbTone,
              )}
            >
              {letter}
            </div>
          )}

          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
            <div className="flex flex-wrap gap-1.5">
              {product.featured ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                  <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
                  Featured
                </span>
              ) : null}
              {product.isNew ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--theme-accent-purple,#713BFF)_80%,black)]/80 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                  <Sparkles className="h-3 w-3" />
                  New
                </span>
              ) : null}
            </div>
            <StatusPill status={product.status} />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
              {product.name}
            </h3>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {product.category} · {product.niche} · {product.productType}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold tracking-tight text-foreground">
              ${product.price.toFixed(2)}
            </span>
            <span className="inline-flex rounded-md bg-[var(--theme-primary-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--theme-primary)]">
              {product.frontEndCommission}% FE
            </span>
          </div>

          <p className="truncate text-xs text-muted-foreground">{product.vendor}</p>

          <div className="mt-auto flex items-center justify-between">
            <Link
              href="/admin/digital-products/new"
              className="text-sm font-medium text-[var(--theme-primary)] hover:underline"
            >
              Manage offer
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </article>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{product.name}&rdquo; will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(product.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
