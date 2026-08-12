export function normalizeLeadSourceFilter(value: string | null): string {
  return value?.trim() ?? "";
}
