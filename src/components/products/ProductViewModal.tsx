import type { EnrichedProductRow } from "@/utils/productFields";
import { formatInt, formatRupee, formatWeight } from "@/utils/productFields";
import { X } from "lucide-react";
import { useId } from "react";

function strFrom(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map((x) => strFrom(x)).filter(Boolean).join(", ");
  return "";
}

function pickDescription(raw: Record<string, unknown>): string {
  return strFrom(raw.description ?? raw.desc ?? raw.details ?? raw.body);
}

function pickCategories(raw: Record<string, unknown>): string {
  const c = raw.categories ?? raw.category ?? raw.categoryIds;
  if (Array.isArray(c)) {
    return c
      .map((x) => {
        // If it's a number, it's likely a category ID - we need to handle this differently
        if (typeof x === "number") return String(x);
        if (typeof x === "string") return x;
        if (x && typeof x === "object") {
          const o = x as Record<string, unknown>;
          return strFrom(o.name ?? o.title ?? o.slug ?? o.id);
        }
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }
  // If categories is a single number (category ID), return empty string since we can't get the name
  if (typeof c === "number") return "";
  return strFrom(c);
}

function DetailTile({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2.5 dark:border-white/10 dark:bg-slate-900/40">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-snug text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

export function ProductViewModal({
  open,
  product,
  onClose,
}: {
  open: boolean;
  product: EnrichedProductRow | null;
  onClose: () => void;
}) {
  const titleId = useId();
  if (!open || !product) return null;

  const { raw } = product;
  const desc = pickDescription(raw);
  const cats = pickCategories(raw);
  const shipping = strFrom(raw.shippingCharge ?? raw.shipping_charge ?? raw.shipping);
  const sgst = strFrom(raw.sgst ?? 0);
  const cgst = strFrom(raw.cgst ?? 0);
  const igst = strFrom(raw.igst ?? 0);
  const pack = [strFrom(raw.packAmount ?? raw.pack_amount), strFrom(raw.packUnit ?? raw.pack_unit)]
    .filter(Boolean)
    .join(" ");
  const weightLabel = formatWeight(product.weight, product.weightUnit);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400">Catalog</p>
            <h2 id={titleId} className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              Product details
            </h2>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {product.imageUrl ? (
            <div className="mb-4 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 dark:border-white/10 dark:bg-slate-900">
              <img src={product.imageUrl} alt="" className="mx-auto max-h-48 w-full object-contain" />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3">
            <DetailTile label="Product ID" value={product.id != null ? String(product.id) : ""} />
            <DetailTile label="Title" value={product.title || "—"} />
            <DetailTile label="SKU" value={product.sku || "—"} />
            <DetailTile label="BV" value={formatInt(product.bv)} />
            <DetailTile label="Stock" value={formatInt(product.stock)} />
            <DetailTile label="SGST (%)" value={sgst} />
            <DetailTile label="CGST (%)" value={cgst} />
            <DetailTile label="IGST (%)" value={igst} />
            <DetailTile
              label="Sale price"
              value={formatRupee(Number.isFinite(product.sale) ? product.sale : product.mrp)}
            />
            <DetailTile label="MRP" value={formatRupee(product.mrp)} />
            <DetailTile label="Total price" value={formatRupee(product.total)} />
            <DetailTile label="Status" value={product.active ? "Active" : "Inactive"} />
            {weightLabel ? <DetailTile label="Weight" value={weightLabel} /> : null}
            {cats ? <DetailTile label="Categories" value={cats} /> : null}
            {shipping ? <DetailTile label="Shipping" value={shipping} /> : null}
            {pack ? <DetailTile label="Pack size" value={pack} /> : null}
          </div>

          {desc ? (
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2.5 dark:border-white/10 dark:bg-slate-900/40">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Description
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-800 dark:text-slate-200">{desc}</p>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-5 py-3 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
