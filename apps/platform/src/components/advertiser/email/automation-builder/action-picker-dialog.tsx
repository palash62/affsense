"use client";

import { useMemo, useState } from "react";
import { Clock, Mail, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectEmail: () => void;
  onSelectWait: () => void;
  atCapacity: boolean;
  /** False only when at capacity and Wait would need to create a new email. */
  canAddWait: boolean;
};

export function ActionPickerDialog({
  open,
  onOpenChange,
  onSelectEmail,
  onSelectWait,
  atCapacity,
  canAddWait,
}: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const showEmail = useMemo(() => {
    if (!q) return true;
    return "send email".includes(q) || "email".includes(q) || "template".includes(q);
  }, [q]);

  const showWait = useMemo(() => {
    if (!q) return true;
    return "wait".includes(q) || "delay".includes(q) || "hold".includes(q) || "days".includes(q);
  }, [q]);

  const noMatch = !showEmail && !showWait;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Add action</DialogTitle>
          <DialogDescription>
            Choose what happens next in this automation.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actions"
            className="h-9 pl-8"
            autoFocus
          />
        </div>
        {atCapacity ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Maximum number of email steps reached.
          </p>
        ) : null}
        <div className="space-y-2">
          {showEmail ? (
            <button
              type="button"
              disabled={atCapacity}
              onClick={() => {
                onSelectEmail();
                setQuery("");
              }}
              className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Mail className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">Send Email</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Send a template to the contact
                </span>
              </span>
            </button>
          ) : null}
          {showWait ? (
            <button
              type="button"
              disabled={!canAddWait}
              onClick={() => {
                onSelectWait();
                setQuery("");
              }}
              className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-violet-300 hover:bg-violet-50/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                <Clock className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">Wait</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Hold for a set number of days before the next email.
                </span>
              </span>
            </button>
          ) : null}
          {noMatch ? (
            <p className="py-6 text-center text-sm text-slate-400">No matching actions</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
