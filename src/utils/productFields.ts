import { resolveMediaUrl } from "@/utils/resolveMediaUrl";

/** Map varied product API shapes to table / form-friendly values. */
export type ProductRow = Record<string, unknown>;

function toNum(v: unknown): number {
  if (v == null || v === "") return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function parseImagesField(images: unknown): unknown[] {
  if (Array.isArray(images)) return images;
  if (typeof images === "string" && images.trim()) {
    try {
      const p = JSON.parse(images) as unknown;
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function pickUrlFromImageObject(o: Record<string, unknown>): string | null {
  for (const k of ["url", "secure_url", "src", "href", "link", "secureUrl", "publicUrl", "path"]) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function firstImageUrl(row: ProductRow): string | null {
  const direct =
    row.primaryImage ??
    row.primary_image ??
    row.image ??
    row.thumbnail ??
    row.photo ??
    row.coverImage ??
    row.cover_image;
  if (typeof direct === "string" && direct.trim()) {
    return resolveMediaUrl(direct.trim());
  }
  const images = parseImagesField(row.images);
  for (const item of images) {
    if (typeof item === "string" && item.trim()) {
      const r = resolveMediaUrl(item.trim());
      if (r) return r;
    }
    if (item && typeof item === "object") {
      const u = pickUrlFromImageObject(item as Record<string, unknown>);
      if (u) {
        const r = resolveMediaUrl(u);
        if (r) return r;
      }
    }
  }
  return null;
}

function rowId(row: ProductRow): string | number | undefined {
  const id = row.id;
  if (typeof id === "string" || typeof id === "number") return id;
  return undefined;
}

export type ParsedProduct = ReturnType<typeof parseProductRow>;

/** One list row: parsed fields + original API object for detail views. */
export type EnrichedProductRow = ParsedProduct & { raw: ProductRow };

export function parseProductRow(row: ProductRow) {
  const id = rowId(row);
  const title = String(row.title ?? row.name ?? "").trim();
  const sku = String(row.sku ?? row.SKU ?? "").trim();
  const bv = toNum(row.bv ?? row.BV ?? row.businessVolume);
  const stock = toNum(row.stock ?? row.stockQuantity ?? row.quantity ?? row.stock_quantity ?? row.qty);
  const sale = toNum(
    row.salePrice ?? row.sale_price ?? row.price ?? row.actualPrice ?? row.actual_price ?? row.sellingPrice,
  );
  /** Laravel `ProductResource` uses `totalPrice` for DB `total_price` (form “MRP / list price”), not `mrp`. */
  const totalFromApi = toNum(row.totalPrice ?? row.total_price ?? row.lineTotal ?? row.line_total);
  const mrpExplicit = toNum(row.mrp ?? row.MRP ?? row.maxRetailPrice);
  const mrp = Number.isFinite(mrpExplicit) ? mrpExplicit : totalFromApi;
  let total = totalFromApi;
  if (!Number.isFinite(total) && Number.isFinite(sale) && Number.isFinite(stock)) {
    total = sale * stock;
  }
  const weight = toNum(row.weight ?? row.productWeight ?? row.product_weight);
  const weightUnit = String(row.weightUnit ?? row.weight_unit ?? "").trim();
  const sgst = toNum(row.sgst ?? 0);
  const cgst = toNum(row.cgst ?? 0);
  const igst = toNum(row.igst ?? 0);
  const inactiveExplicit =
    row.status === "INACTIVE" ||
    row.status === "DRAFT" ||
    row.isActive === false ||
    row.active === false ||
    row.is_active === false ||
    row.enabled === false;
  /** Treat missing flags as active so legacy list payloads still show a green badge. */
  const active = !inactiveExplicit;

  return {
    id,
    title,
    sku,
    bv,
    stock,
    sale,
    mrp,
    total,
    active,
    imageUrl: firstImageUrl(row),
    weight,
    weightUnit,
    sgst,
    cgst,
    igst,
  };
}

export function formatRupee(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function formatInt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-IN");
}

/** Pack / product weight from API (`weight` + `weightUnit`, default unit g). */
export function formatWeight(n: number, unit: string | undefined): string {
  if (!Number.isFinite(n)) return "";
  const u = (unit ?? "").trim() || "g";
  return `${n.toLocaleString("en-IN", { maximumFractionDigits: 4 })} ${u}`;
}
