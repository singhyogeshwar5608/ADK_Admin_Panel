/**
 * API settings rows often nest values as `{ value: { value: 0.1 } }` or `{ value: { left, right } }`.
 * Peel `value` chains until we reach a primitive, null, pairing object, etc.
 */

export function unwrapSettingValue(entry: { value?: unknown } | undefined): unknown {
  if (!entry || !Object.prototype.hasOwnProperty.call(entry, "value")) {
    return undefined;
  }
  let current: unknown = entry.value;
  while (
    current &&
    typeof current === "object" &&
    !Array.isArray(current)
  ) {
    const o = current as Record<string, unknown>;
    if ("left" in o || "right" in o) break;
    if (!("value" in o)) break;
    current = o.value;
  }
  return current;
}

/** Human-readable string for a single-valued setting (numbers, booleans); pairing handled elsewhere. */
export function formatPrimitiveForDraft(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "string") return v;
  return "";
}

export function parseNumericDraft(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) throw new Error("Invalid number");
  return n;
}
