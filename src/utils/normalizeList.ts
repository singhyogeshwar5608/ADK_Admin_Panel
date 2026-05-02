/** Best-effort list extraction for varied API envelope shapes. */
export function normalizeList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    for (const k of [
      "data",
      "items",
      "members",
      "products",
      "orders",
      "categories",
      "delivery_centers",
      "rows",
    ]) {
      const v = o[k];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
  }
  return [];
}
