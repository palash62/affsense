"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { FilterX, Mail, X } from "lucide-react";
import { defaultCampaignDateFrom, defaultCampaignDateTo } from "@/lib/advertiser-campaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeadExportButton } from "@/components/leads/lead-export-button";

const SELECT_TRIGGER_CLASS =
  "h-8 !w-full min-w-0 bg-card text-xs *:data-[slot=select-value]:line-clamp-none";

const SELECT_MENU_CLASS = "z-200 !w-[22rem] max-w-[calc(100vw-2rem)]";

type CampaignOption = { id: string; name: string };

const STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "CAPTURED", label: "Captured" },
  { value: "VALIDATING", label: "Validating" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "PAID", label: "Paid" },
] as const;

function normalizeSelectValue(value: string | null, allowed: string[]) {
  if (!value) return "all";
  return allowed.includes(value) ? value : "all";
}

function EmailSearchDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (email: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchEmails = useCallback((search: string) => {
    setLoading(true);
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    fetch(`/api/v1/advertiser/lead-emails${params}`)
      .then((r) => r.json())
      .then((j) => setResults(j.data ?? []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchEmails(query);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleInputChange(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchEmails(val), 300);
  }

  function selectEmail(email: string) {
    onChange(email);
    setQuery("");
    setOpen(false);
  }

  function clearEmail() {
    onChange("");
    setQuery("");
  }

  if (value) {
    return (
      <div className="flex h-8 min-w-[200px] items-center gap-1 rounded-md border border-border bg-card px-2 text-xs">
        <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="truncate text-foreground">{value}</span>
        <button
          type="button"
          onClick={clearEmail}
          className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-muted-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative min-w-[200px]">
      <Input
        type="text"
        placeholder="Filter by email…"
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        className="h-8 rounded-md border-border bg-card text-xs"
      />
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[22rem] max-w-[calc(100vw-2rem)] rounded-md border border-border bg-card shadow-lg">
          <div className="max-h-[240px] overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); setQuery(""); }}
              className="w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
            >
              All emails
            </button>
            {loading ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>
            ) : results.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">No emails found</div>
            ) : (
              results.map((email) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => selectEmail(email)}
                  className="w-full truncate px-3 py-1.5 text-left text-xs text-foreground hover:bg-muted"
                >
                  {email}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdvertiserLeadDetailsFilters({ campaigns }: { campaigns: CampaignOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [campaignId, setCampaignId] = useState(() =>
    normalizeSelectValue(searchParams.get("campaignId"), ["all", ...campaigns.map((c) => c.id)]),
  );
  const [status, setStatus] = useState(() =>
    normalizeSelectValue(searchParams.get("status"), STATUSES.map((s) => s.value)),
  );
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") ?? defaultCampaignDateFrom());
  const [dateTo, setDateTo] = useState(searchParams.get("to") ?? defaultCampaignDateTo());

  const applyFilters = useCallback(
    (
      overrides?: Partial<{
        campaignId: string;
        status: string;
        email: string;
        from: string;
        to: string;
      }>,
    ) => {
      const params = new URLSearchParams(searchParams.toString());

      const values = {
        campaignId: overrides?.campaignId ?? campaignId,
        status: overrides?.status ?? status,
        email: overrides?.email ?? email,
        from: overrides?.from ?? dateFrom,
        to: overrides?.to ?? dateTo,
      };

      if (values.campaignId && values.campaignId !== "all") params.set("campaignId", values.campaignId);
      else params.delete("campaignId");

      if (values.status && values.status !== "all") params.set("status", values.status);
      else params.delete("status");

      if (values.email) params.set("email", values.email);
      else params.delete("email");

      if (values.from) params.set("from", values.from);
      else params.delete("from");

      if (values.to) params.set("to", values.to);
      else params.delete("to");

      params.delete("page");

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [campaignId, status, email, dateFrom, dateTo, pathname, router, searchParams],
  );

  function clearFilters() {
    const from = defaultCampaignDateFrom();
    const to = defaultCampaignDateTo();
    setCampaignId("all");
    setStatus("all");
    setEmail("");
    setDateFrom(from);
    setDateTo(to);
    startTransition(() => {
      router.push(`${pathname}?from=${from}&to=${to}`);
    });
  }

  const hasFilters =
    searchParams.has("campaignId") ||
    searchParams.has("status") ||
    searchParams.has("email") ||
    searchParams.has("sort") ||
    (searchParams.has("page") && searchParams.get("page") !== "1");

  return (
    <div className="border-b border-border bg-muted/80 px-4 py-2.5">
      <div className="flex w-full flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <Select
            value={campaignId}
            onValueChange={(value) => {
              if (!value) return;
              setCampaignId(value);
              applyFilters({ campaignId: value });
            }}
          >
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="All campaigns" />
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false} className={SELECT_MENU_CLASS}>
              <SelectItem value="all">All campaigns</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[160px]">
          <Select
            value={status}
            onValueChange={(value) => {
              if (!value) return;
              setStatus(value);
              applyFilters({ status: value });
            }}
          >
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false} className={SELECT_MENU_CLASS}>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <EmailSearchDropdown
          value={email}
          onChange={(val) => {
            setEmail(val);
            applyFilters({ email: val });
          }}
        />

        <div className="flex shrink-0 items-center gap-1.5">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-[132px] rounded-md border-border bg-card text-xs"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-[132px] rounded-md border-border bg-card text-xs"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => applyFilters()}
            disabled={isPending}
            className="h-8 rounded-md bg-[var(--theme-primary)] px-4 text-xs hover:opacity-90"
          >
            {isPending ? "..." : "Apply"}
          </Button>
          {hasFilters && (
            <Button
              size="sm"
              variant="outline"
              onClick={clearFilters}
              disabled={isPending}
              className="h-8 gap-1 rounded-md border-border bg-card px-2.5 text-xs"
            >
              <FilterX className="h-3 w-3" />
              Clear
            </Button>
          )}
          <LeadExportButton />
        </div>
      </div>
    </div>
  );
}
