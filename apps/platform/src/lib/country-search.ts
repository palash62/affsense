import { COUNTRY_BY_CODE } from "@/lib/campaign-form";

export type CountryOption = { code: string; name: string };

export const COUNTRY_SEARCH_OPTIONS: CountryOption[] = Object.entries(COUNTRY_BY_CODE)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function normalizeCountryText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchScore(option: CountryOption, query: string): number | null {
  const name = normalizeCountryText(option.name);
  if (option.code.toLowerCase() === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.split(/[\s,()'-]+/).some((word) => word.startsWith(query))) return 2;
  if (name.includes(query)) return 3;
  return null;
}

/** Countries matching `query` by name or ISO code; names starting with the query come first. */
export function searchCountries(options: CountryOption[], query: string): CountryOption[] {
  const q = normalizeCountryText(query);
  if (!q) return options;
  return options
    .map((option, index) => ({ option, index, score: matchScore(option, q) }))
    .filter((row): row is { option: CountryOption; index: number; score: number } => row.score !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((row) => row.option);
}

export function findCountryByName(options: CountryOption[], text: string): CountryOption | undefined {
  const q = normalizeCountryText(text);
  if (!q) return undefined;
  return options.find(
    (option) => normalizeCountryText(option.name) === q || option.code.toLowerCase() === q,
  );
}
