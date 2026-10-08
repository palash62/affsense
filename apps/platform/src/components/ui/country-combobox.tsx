"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getCountryName } from "@/lib/campaign-form";
import { COUNTRY_SEARCH_OPTIONS, findCountryByName, searchCountries } from "@/lib/country-search";
import { cn } from "@/lib/utils";

export function CountryCombobox({
  value,
  onChange,
  id,
  placeholder = "Select country",
  required,
  inputClassName,
  uiInput = false,
}: {
  value: string;
  onChange: (code: string) => void;
  id?: string;
  placeholder?: string;
  required?: boolean;
  inputClassName?: string;
  /** Render with the shared `Input` styles instead of a bare `<input>` styled by the page. */
  uiInput?: boolean;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-listbox`;
  const selectedName = value ? getCountryName(value) : "";

  const [query, setQuery] = useState(selectedName);
  const [typed, setTyped] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) setQuery(selectedName);
  }, [selectedName, open]);

  const results = useMemo(
    () => (open ? searchCountries(COUNTRY_SEARCH_OPTIONS, typed ? query : "") : []),
    [open, typed, query],
  );

  useEffect(() => {
    if (!open) return;
    const item = listRef.current?.children[active] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function openList() {
    setOpen(true);
    setTyped(false);
    const index = COUNTRY_SEARCH_OPTIONS.findIndex((option) => option.code === value);
    setActive(Math.max(0, index));
  }

  function commit(code: string) {
    onChange(code);
    setQuery(getCountryName(code));
    setTyped(false);
    setOpen(false);
  }

  function closeList() {
    setOpen(false);
    if (typed) {
      const match = findCountryByName(COUNTRY_SEARCH_OPTIONS, query);
      if (match) {
        commit(match.code);
        return;
      }
      if (!query.trim()) onChange("");
    }
    setTyped(false);
    setQuery(query.trim() ? selectedName : "");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => Math.min(Math.max(index + step, 0), Math.max(results.length - 1, 0)));
    } else if (event.key === "Enter" && open) {
      const option = results[active];
      if (option) {
        event.preventDefault();
        commit(option.code);
      }
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setTyped(false);
      setQuery(selectedName);
    }
  }

  const activeOption = open ? results[active] : undefined;
  const inputProps = {
    id: inputId,
    type: "text",
    role: "combobox",
    "aria-expanded": open,
    "aria-controls": listId,
    "aria-autocomplete": "list" as const,
    "aria-activedescendant": activeOption ? `${listId}-${activeOption.code}` : undefined,
    autoComplete: "off",
    required,
    placeholder,
    value: query,
    onFocus: openList,
    onClick: () => {
      if (!open) openList();
    },
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value);
      setTyped(true);
      setOpen(true);
      setActive(0);
    },
    onKeyDown,
    onBlur: closeList,
    className: cn("pr-8", inputClassName),
  };

  return (
    <div className="relative">
      {uiInput ? <Input {...inputProps} /> : <input {...inputProps} />}
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[260px] overflow-y-auto rounded-lg border border-border bg-white py-1 text-sm text-foreground shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">No country found</li>
          ) : (
            results.map((option, index) => (
              <li
                key={option.code}
                id={`${listId}-${option.code}`}
                role="option"
                aria-selected={option.code === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(option.code)}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "cursor-pointer px-3 py-2",
                  index === active && "bg-muted",
                  option.code === value && "font-semibold text-[var(--theme-primary)]",
                )}
              >
                {option.name}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
