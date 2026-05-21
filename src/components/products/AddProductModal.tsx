import { categoriesApi } from "@/api/categories";
import { productsApi } from "@/api/products";
import { normalizeList } from "@/utils/normalizeList";
import { parseApiError } from "@/utils/parseApiError";
import { resolveMediaUrl } from "@/utils/resolveMediaUrl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, X } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";

const PACK_UNITS = [
  "Grams (g)",
  "Kilograms (kg)",
  "Milliliters (ml)",
  "Litres (L)",
  "Pieces",
  "Pack",
  "Box",
  "Tablets",
  "Capsules",
] as const;

/** Maps UI pack label → Laravel `Product::weight_unit` string stored on product. */
function packLabelToWeightUnit(label: string): string {
  const map: Record<string, string> = {
    "Grams (g)": "g",
    "Kilograms (kg)": "kg",
    "Milliliters (ml)": "ml",
    "Litres (L)": "l",
    Pieces: "pcs",
    Pack: "pack",
    Box: "box",
    Tablets: "pcs",
    Capsules: "pcs",
  };
  return map[label] ?? "g";
}

/** Reverse map for `ProductResource` `weightUnit` → form select label. */
function weightUnitCodeToPackLabel(code: string): string {
  const c = (code || "g").toLowerCase();
  if (c === "kg") return "Kilograms (kg)";
  if (c === "g") return "Grams (g)";
  if (c === "l") return "Litres (L)";
  if (c === "ml") return "Milliliters (ml)";
  if (c === "pack") return "Pack";
  if (c === "box") return "Box";
  if (c === "pcs" || c === "unit") return "Pieces";
  return "Grams (g)";
}

function numToInputStr(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  return "";
}

function imagesFromApiToUrls(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  const out: string[] = [];
  for (const item of images) {
    if (typeof item === "string" && item.trim()) {
      const r = resolveMediaUrl(item.trim());
      if (r) out.push(r);
    } else if (item && typeof item === "object") {
      const u = (item as Record<string, unknown>).url;
      if (typeof u === "string" && u.trim()) {
        const r = resolveMediaUrl(u.trim());
        if (r) out.push(r);
      }
    }
  }
  return out;
}

function extractProductRecord(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const p = o.product;
  if (p && typeof p === "object") return p as Record<string, unknown>;
  return o;
}

function apiProductToFormState(p: Record<string, unknown>): ProductFormState {
  const actual = p.actualPrice ?? p.actual_price;
  const total = p.totalPrice ?? p.total_price;
  const cats = p.categories;
  let categoryId = "";
  if (Array.isArray(cats) && cats.length > 0) {
    const first = cats[0];
    if (first != null) categoryId = String(first);
  }
  return {
    title: String(p.name ?? p.title ?? "").trim(),
    sku: String(p.sku ?? "").trim(),
    brand: String(p.brand ?? "Independent").trim() || "Independent",
    salePrice: numToInputStr(actual),
    mrp: numToInputStr(total),
    bv: numToInputStr(p.bv),
    stock: numToInputStr(p.stock ?? p.stockQuantity),
    packAmount: numToInputStr(p.weight ?? p.productWeight ?? p.product_weight ?? 0),
    packUnit: weightUnitCodeToPackLabel(String(p.weightUnit ?? p.weight_unit ?? "g")),
    shippingCharge: numToInputStr(p.shippingCharge ?? p.shipping_charge ?? 0),
    sgst: numToInputStr(p.sgst ?? p.SGST ?? p.sgst_rate ?? 0),
    cgst: numToInputStr(p.cgst ?? p.CGST ?? p.cgst_rate ?? 0),
    igst: numToInputStr(p.igst ?? p.IGST ?? p.igst_rate ?? 0),
    categoryId,
    description: String(p.description ?? ""),
    imageUrls: (() => {
      const urls = imagesFromApiToUrls(p.images);
      if (urls.length > 0) return urls;
      const primary = p.primaryImage ?? p.primary_image;
      if (typeof primary === "string" && primary.trim()) {
        const r = resolveMediaUrl(primary.trim());
        return r ? [r] : [];
      }
      return [];
    })(),
    manualImageUrl: "",
    isActive: Boolean(p.isActive ?? p.is_active ?? true),
  };
}

function isHttpsOrHttpUrl(s: string): boolean {
  const t = s.trim();
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function randomSku() {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SKU-${part()}-${part()}`;
}

/** Laravel `POST /media/products` returns `{ files: [{ url, secureUrl, ... }] }`. */
function extractProductMediaUrls(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  const fromFile = (item: unknown): string | null => {
    if (!item || typeof item !== "object") return null;
    const r = item as Record<string, unknown>;
    const u = r.url ?? r.secureUrl ?? r.secure_url;
    return typeof u === "string" && u ? u : null;
  };
  const list = o.files;
  if (Array.isArray(list)) {
    return list.map(fromFile).filter((u): u is string => Boolean(u));
  }
  const single = fromFile(o);
  if (single) return [single];
  const nested = o.data;
  if (nested && typeof nested === "object") {
    const d = nested as Record<string, unknown>;
    const u = d.url ?? d.secure_url ?? d.secureUrl;
    if (typeof u === "string" && u) return [u];
  }
  const direct = o.url ?? o.secure_url ?? o.secureUrl;
  if (typeof direct === "string" && direct) return [direct];
  return [];
}

type CategoryOption = { id: string; label: string };

function parseCategories(payload: unknown): CategoryOption[] {
  const rows = normalizeList(payload);
  const seen = new Set<string>();
  return rows
    .map((r) => {
      const label = String(r.name ?? r.title ?? r.slug ?? r.id ?? r._id ?? "");
      if (!label || seen.has(label)) return null;
      seen.add(label);
      // We use the label (name) as the ID because the user wants to save category names 
      // in the database instead of numeric IDs.
      return { id: label, label };
    })
    .filter(Boolean) as CategoryOption[];
}

type ProductFormState = {
  title: string;
  sku: string;
  brand: string;
  salePrice: string;
  mrp: string;
  bv: string;
  stock: string;
  packAmount: string;
  packUnit: string;
  shippingCharge: string;
  sgst: string;
  cgst: string;
  igst: string;
  categoryId: string;
  description: string;
  imageUrls: string[];
  manualImageUrl: string;
  isActive: boolean;
};

const emptyForm = (): ProductFormState => ({
  title: "",
  sku: randomSku(),
  brand: "Independent",
  salePrice: "",
  mrp: "",
  bv: "",
  stock: "",
  packAmount: "",
  packUnit: PACK_UNITS[0],
  shippingCharge: "",
  sgst: "",
  cgst: "",
  igst: "",
  categoryId: "",
  description: "",
  imageUrls: [],
  manualImageUrl: "",
  isActive: true,
});

export function AddProductModal({
  open,
  onClose,
  editProductId = null,
}: {
  open: boolean;
  onClose: () => void;
  /** When set, modal loads this product and PATCHes on save. */
  editProductId?: string | number | null;
}) {
  const qc = useQueryClient();
  const formId = useId();
  const [form, setForm] = useState<ProductFormState>(() => emptyForm());
  const [uploading, setUploading] = useState(false);
  const isEdit = editProductId != null;

  const catQ = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await categoriesApi.list()).data,
    enabled: open,
  });
  const categories = parseCategories(catQ.data);

  const detailQ = useQuery({
    queryKey: ["product", editProductId],
    queryFn: async () => (await productsApi.get(editProductId as string | number)).data,
    enabled: open && isEdit,
  });

  useEffect(() => {
    if (!open) return;
    if (!isEdit) setForm(emptyForm());
  }, [open, isEdit]);

  useEffect(() => {
    if (!open || !isEdit) return;
    const rec = extractProductRecord(detailQ.data);
    if (rec) setForm(apiProductToFormState(rec));
  }, [open, isEdit, detailQ.data]);


  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) => productsApi.create(payload),
    onSuccess: async () => {
      toast.success("Product saved");
      await qc.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const update = useMutation({
    mutationFn: (vars: { id: string | number; payload: Record<string, unknown> }) =>
      productsApi.patch(vars.id, vars.payload),
    onSuccess: async () => {
      toast.success("Product updated");
      await qc.invalidateQueries({ queryKey: ["products"] });
      await qc.invalidateQueries({ queryKey: ["product", editProductId] });
      onClose();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const onUpload = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || (Array.isArray(files) ? files.length === 0 : files.length === 0)) return;
      const list = Array.isArray(files) ? files : Array.from(files);
      setUploading(true);
      try {
        const imageFiles = list.filter((file) => file.type.startsWith("image/"));
        if (!imageFiles.length) {
          toast.error("Only image files are accepted");
          return;
        }
        /** Backend: `files` array, max 6 per request (`ProductMediaUploadRequest`). */
        const chunkSize = 6;
        const nextUrls: string[] = [];
        for (let i = 0; i < imageFiles.length; i += chunkSize) {
          const chunk = imageFiles.slice(i, i + chunkSize);
          const fd = new FormData();
          for (const file of chunk) {
            fd.append("files[]", file);
          }
          const { data } = await productsApi.uploadMedia(fd);
          nextUrls.push(...extractProductMediaUrls(data));
        }
        if (nextUrls.length) {
          setForm((f) => ({ ...f, imageUrls: [...f.imageUrls, ...nextUrls] }));
          toast.success(nextUrls.length === 1 ? "Image uploaded" : `${nextUrls.length} images uploaded`);
        } else toast.error("Upload succeeded but no image URL was returned");
      } catch (e) {
        toast.error(parseApiError(e));
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  const addManualImage = () => {
    const u = form.manualImageUrl.trim();
    if (!u) return;
    setForm((f) => ({ ...f, imageUrls: [...f.imageUrls, u], manualImageUrl: "" }));
  };

  const detailLoading = isEdit && (detailQ.isLoading || detailQ.isFetching);
  const detailError = isEdit && detailQ.isError;
  const pending = create.isPending || update.isPending || uploading;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.title.trim();
    const sku = form.sku.trim();
    if (name.length < 2) {
      toast.error("Product title must be at least 2 characters.");
      return;
    }
    if (sku.length < 2) {
      toast.error("SKU must be at least 2 characters.");
      return;
    }

    if (!form.salePrice.trim()) {
      toast.error("Sale price is required.");
      return;
    }
    const saleN = Number(form.salePrice);
    const mrpN = form.mrp.trim() === "" ? NaN : Number(form.mrp);
    if (!Number.isFinite(saleN) || saleN < 0) {
      toast.error("Sale price must be a valid amount.");
      return;
    }
    const actual_price = saleN;
    const total_price = Number.isFinite(mrpN) && mrpN >= 0 ? mrpN : saleN;

    if (!form.packAmount.trim()) {
      toast.error('Pack quantity / weight is required (fill "Amount" next to pack unit).');
      return;
    }
    const weightN = Number(form.packAmount);
    if (!Number.isFinite(weightN) || weightN < 0) {
      toast.error("Pack amount must be a valid number.");
      return;
    }

    if (!form.stock.trim()) {
      toast.error("Stock quantity is required.");
      return;
    }
    const stockN = Number(form.stock);
    if (!Number.isFinite(stockN) || stockN < 0 || !Number.isInteger(stockN)) {
      toast.error("Stock must be a whole number zero or greater.");
      return;
    }

    let bvN = Number(form.bv);
    if (form.bv.trim() === "") bvN = 0;
    if (!Number.isFinite(bvN) || bvN < 0) {
      toast.error("BV must be zero or greater.");
      return;
    }

    let shipN = Number(form.shippingCharge);
    if (form.shippingCharge.trim() === "") shipN = 0;
    if (!Number.isFinite(shipN) || shipN < 0) {
      toast.error("Shipping charge must be zero or greater.");
      return;
    }

    let sgstN = Number(form.sgst);
    if (form.sgst.trim() === "") sgstN = 0;
    if (!Number.isFinite(sgstN) || sgstN < 0) {
      toast.error("SGST must be zero or greater.");
      return;
    }

    let cgstN = Number(form.cgst);
    if (form.cgst.trim() === "") cgstN = 0;
    if (!Number.isFinite(cgstN) || cgstN < 0) {
      toast.error("CGST must be zero or greater.");
      return;
    }

    let igstN = Number(form.igst);
    if (form.igst.trim() === "") igstN = 0;
    if (!Number.isFinite(igstN) || igstN < 0) {
      toast.error("IGST must be zero or greater.");
      return;
    }

    /** Laravel validates `images.*.url` — must be objects with absolute URLs. */
    const images = form.imageUrls.map((u) => u.trim()).filter(isHttpsOrHttpUrl).map((url) => ({ url }));

    if (images.length === 0) {
      toast.error("Add at least one image (upload files or paste a full https:// image URL).");
      return;
    }

    const brand = form.brand.trim() || "Independent";

    /** Matches `StoreProductRequest` / `UpdateProductRequest` (`_backend_extract`). */
    const payload = {
      sku,
      name,
      brand,
      description: form.description.trim() || null,
      actual_price,
      total_price,
      bv: bvN,
      stock: stockN,
      weight: weightN,
      weight_unit: packLabelToWeightUnit(form.packUnit),
      shipping_charge: shipN,
      sgst: sgstN,
      cgst: cgstN,
      igst: igstN,
      categories: form.categoryId.trim() ? [form.categoryId.trim()] : [],
      images,
      is_active: form.isActive,
    };

    if (isEdit && editProductId != null) {
      update.mutate({ id: editProductId, payload });
    } else {
      create.mutate(payload);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        className="flex max-h-[min(92dvh,100svh)] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-slate-200/80 bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-2xl dark:border-white/10 dark:bg-slate-950"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-4 py-4 dark:border-white/10 sm:px-6 sm:py-5">
          <div>
            <h2 id={`${formId}-title`} className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
              {isEdit ? "Edit product" : "Add product"}
            </h2>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <form id={`${formId}-form`} onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          {detailError ? (
            <div className="px-4 py-8 text-center sm:px-6">
              <p className="text-sm font-semibold text-rose-600">Could not load this product.</p>
              <button
                type="button"
                className="mt-3 text-sm font-semibold text-primary underline"
                onClick={() => void detailQ.refetch()}
              >
                Retry
              </button>
            </div>
          ) : detailLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-20 text-sm text-slate-500">
              <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading product…
            </div>
          ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-5">
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Product title</span>
                <input
                  required
                  placeholder="Title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none ring-primary/0 transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">SKU</span>
                  <input
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Sale price / actual price (₹)
                  </span>
                  <input
                    inputMode="decimal"
                    placeholder="Sale price"
                    value={form.salePrice}
                    onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    MRP / total list price (₹)
                  </span>
                  <input
                    inputMode="decimal"
                    placeholder="MRP"
                    value={form.mrp}
                    onChange={(e) => setForm((f) => ({ ...f, mrp: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    BV <span className="font-normal text-slate-500">(optional, defaults to 0)</span>
                  </span>
                  <input
                    inputMode="decimal"
                    placeholder="0"
                    value={form.bv}
                    onChange={(e) => setForm((f) => ({ ...f, bv: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Stock quantity</span>
                  <input
                    inputMode="numeric"
                    placeholder="Stock"
                    value={form.stock}
                    onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  />
                </label>
                <div className="grid grid-cols-3 gap-4">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      SGST (%)
                    </span>
                    <input
                      inputMode="decimal"
                      placeholder="0"
                      value={form.sgst}
                      onChange={(e) => setForm((f) => ({ ...f, sgst: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      CGST (%)
                    </span>
                    <input
                      inputMode="decimal"
                      placeholder="0"
                      value={form.cgst}
                      onChange={(e) => setForm((f) => ({ ...f, cgst: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      IGST (%)
                    </span>
                    <input
                      inputMode="decimal"
                      placeholder="0"
                      value={form.igst}
                      onChange={(e) => setForm((f) => ({ ...f, igst: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                    />
                  </label>
                </div>
                <div className="block sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Pack quantity / weight
                    <span className="font-normal text-slate-500"> (stored as product weight)</span>
                  </span>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      inputMode="decimal"
                      placeholder="Amount"
                      value={form.packAmount}
                      onChange={(e) => setForm((f) => ({ ...f, packAmount: e.target.value }))}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                    />
                    <select
                      value={form.packUnit}
                      onChange={(e) => setForm((f) => ({ ...f, packUnit: e.target.value }))}
                      className="w-40 shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900 dark:text-white sm:w-48"
                    >
                      {PACK_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    Describes one sellable unit (e.g. 500 g jar, 1 L bottle, 2 tablets). The amount and unit are saved as{" "}
                    <span className="font-medium text-slate-600 dark:text-slate-300">weight</span> and{" "}
                    <span className="font-medium text-slate-600 dark:text-slate-300">weight_unit</span> for catalog detail and
                    logistics.
                  </p>
                </div>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Shipping charge (₹) <span className="font-normal text-slate-500">(defaults to 0)</span>
                  </span>
                  <input
                    inputMode="decimal"
                    placeholder="0"
                    value={form.shippingCharge}
                    onChange={(e) => setForm((f) => ({ ...f, shippingCharge: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  />
                </label>
                              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Categories</span>
                <select
                  value={form.categoryId}
                  disabled={catQ.isLoading || (!catQ.isLoading && categories.length === 0)}
                  onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-900/50 dark:disabled:text-slate-500"
                >
                  <option value="">
                    {catQ.isLoading
                      ? "Loading categories…"
                      : categories.length === 0
                        ? "No categories available"
                        : "Select categories"}
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</span>
                <textarea
                  rows={4}
                  placeholder="Describe the product"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Product images</span>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                    <Upload className="h-3.5 w-3.5" />
                    Upload files
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      disabled={uploading}
                      onChange={(e) => void onUpload(e.target.files)}
                    />
                  </label>
                </div>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    void onUpload(e.dataTransfer.files);
                  }}
                  className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-slate-900/30 dark:text-slate-400"
                >
                  Drag &amp; drop images here or use the button above. Images appear after the server accepts the
                  upload.
                </div>
                {form.imageUrls.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {form.imageUrls.map((url, idx) => (
                      <li
                        key={`${idx}-${url.slice(0, 48)}`}
                        className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10"
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          className="absolute inset-0 flex items-center justify-center bg-slate-900/60 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100"
                          onClick={() => setForm((f) => ({ ...f, imageUrls: f.imageUrls.filter((u) => u !== url) }))}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    No images yet. Upload files or add manually.
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="url"
                    placeholder="https://… (full URL required)"
                    value={form.manualImageUrl}
                    onChange={(e) => setForm((f) => ({ ...f, manualImageUrl: e.target.value }))}
                    className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={addManualImage}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    + Add image manually
                  </button>
                </div>
              </div>
            </div>
          </div>
          )}

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-slate-900/80 sm:gap-4 sm:px-6 sm:py-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="rounded border-slate-300 text-primary focus:ring-primary/30"
              />
              Active product
            </label>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="shrink-0 text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || detailLoading || detailError}
                className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-50 sm:px-5"
              >
                {create.isPending || update.isPending ? "Saving…" : isEdit ? "Update product" : "Save product"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
