import { normalizeList } from "@/utils/normalizeList";

export type HeroSlideRow = {
  id: string | number;
  badge: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  buttonText: string;
  buttonLink: string;
  sortOrder: number | null;
  is_active: boolean;
};

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export function parseHeroSlidesPayload(payload: unknown): HeroSlideRow[] {
  const rows = normalizeList(payload);
  const out: HeroSlideRow[] = [];
  for (const r of rows) {
    const rawId = r.id ?? r._id;
    if (rawId == null) continue;
    const id =
      typeof rawId === "string" || typeof rawId === "number" ? rawId : String(rawId);

    out.push({
      id,
      badge: asString(r.badge ?? r.badge_text ?? r.badgeText),
      title: asString(r.title),
      subtitle: asString(r.subtitle),
      imageUrl: asString(r.imageUrl ?? r.image_url ?? r.image),
      buttonText: asString(r.button_text ?? r.buttonText),
      buttonLink: asString(r.button_link ?? r.buttonLink),
      sortOrder: asNumber(r.sort_order ?? r.sortOrder),
      is_active: Boolean(r.is_active ?? r.isActive ?? true),
    });
  }

  // Show higher sortOrder first (matches typical admin ordering).
  return out.sort((a, b) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0));
}

