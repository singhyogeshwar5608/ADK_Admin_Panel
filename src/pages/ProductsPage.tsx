import { productsApi } from "@/api/products";
import { AddProductModal } from "@/components/products/AddProductModal";
import { ProductViewModal } from "@/components/products/ProductViewModal";
import { LoadingScreen } from "@/components/LoadingScreen";
import { normalizeList } from "@/utils/normalizeList";
import {
  formatInt,
  formatRupee,
  parseProductRow,
  type EnrichedProductRow,
  type ProductRow,
} from "@/utils/productFields";
import { parseApiError } from "@/utils/parseApiError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, MoreVertical, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const TH =
  "px-4 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500 sm:px-5 dark:text-slate-400";

export function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editProductId, setEditProductId] = useState<string | number | null>(null);
  const [viewProduct, setViewProduct] = useState<EnrichedProductRow | null>(null);
  const [menuForId, setMenuForId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const q = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await productsApi.list()).data,
  });

  const del = useMutation({
    mutationFn: (id: string | number) => productsApi.delete(id),
    onSuccess: () => {
      toast.success("Product deleted");
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => toast.error(parseApiError(e)),
    onSettled: () => setMenuForId(null),
  });

  const rows = useMemo(() => normalizeList(q.data ?? null) as ProductRow[], [q.data]);

  const parsedRows = useMemo(
    () => rows.map((r) => ({ raw: r, ...parseProductRow(r) }) as EnrichedProductRow),
    [rows],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return parsedRows;
    const qv = search.toLowerCase().trim();
    return parsedRows.filter(
      (p) => p.title.toLowerCase().includes(qv) || p.sku.toLowerCase().includes(qv) || String(p.id ?? "").includes(qv),
    );
  }, [parsedRows, search]);

  useEffect(() => {
    if (!menuForId) return;
    const onDoc = (ev: MouseEvent) => {
      const el = menuRef.current;
      if (el && !el.contains(ev.target as Node)) setMenuForId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuForId]);

  const onDelete = async (id: string | number | undefined, label: string) => {
    if (id == null) {
      toast.error("Product id missing");
      return;
    }
    if (!window.confirm(`Delete “${label}”? This cannot be undone.`)) return;
    try {
      await del.mutateAsync(id);
    } catch {
      /* toast in mutation */
    }
  };

  if (q.isLoading && !q.data) return <LoadingScreen message="Loading products…" />;

  if (q.isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-6 dark:border-rose-400/30 dark:bg-slate-950">
        <p className="mb-4 font-semibold text-rose-600">Unable to load products.</p>
        <button
          type="button"
          onClick={() => void q.refetch()}
          className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const total = rows.length;
  const showing = filtered.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400">Catalog</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Products</h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">Manage stock, BV, and prices for every SKU.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto lg:min-w-[320px]">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search by name or SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none ring-0 transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setEditProductId(null);
              setCreateOpen(true);
            }}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:brightness-105 active:brightness-95"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Add product
          </button>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {filtered.map((p) => {
          const idStr = p.id != null ? String(p.id) : "";
          if (!idStr) return null;
          return (
            <div
              key={idStr}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-slate-950"
            >
              <div className="flex gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50 dark:border-white/10 dark:bg-slate-900">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">No img</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold uppercase leading-snug text-slate-900 dark:text-white">{p.title || "—"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    BV {formatInt(p.bv)} · Stock {formatInt(p.stock)}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {formatRupee(p.sale)} · Total {formatRupee(p.total)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        p.active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {p.active ? "Active" : "Inactive"}
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200"
                      aria-label="View product"
                      onClick={() => setViewProduct(p)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:border-white/10 dark:text-indigo-400"
                      aria-label="Edit product"
                      onClick={() => {
                        setCreateOpen(false);
                        setEditProductId(p.id as string | number);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 p-2 text-rose-600 dark:border-white/10"
                      aria-label="Delete product"
                      onClick={() => void onDelete(p.id, p.title)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-slate-500 dark:border-white/5 dark:bg-slate-950">
            No products match your search.
          </div>
        ) : null}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:border-white/5 dark:bg-slate-950 dark:shadow-none">
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/90 dark:border-white/5 dark:bg-white/[0.03]">
                  <th className={TH}>Product</th>
                  <th className={TH}>BV</th>
                  <th className={TH}>Stock</th>
                  <th className={TH}>Sale price</th>
                  <th className={TH}>Total price</th>
                  <th className={TH}>Status</th>
                  <th className={`${TH} w-28 text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const idStr = p.id != null ? String(p.id) : "";
                  if (!idStr) return null;
                  const menuOpen = menuForId === idStr;
                  return (
                    <tr
                      key={idStr}
                      className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50/50 dark:border-white/5 dark:hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-4 sm:px-5">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50 dark:border-white/10 dark:bg-slate-900">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-400">
                                —
                              </div>
                            )}
                          </div>
                          <span className="max-w-[220px] font-bold uppercase leading-snug text-slate-900 dark:text-white">
                            {p.title || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium tabular-nums text-slate-800 dark:text-slate-200 sm:px-5">
                        {formatInt(p.bv)}
                      </td>
                      <td className="px-4 py-4 font-medium tabular-nums text-slate-800 dark:text-slate-200 sm:px-5">
                        {formatInt(p.stock)}
                      </td>
                      <td className="px-4 py-4 font-medium tabular-nums text-slate-800 dark:text-slate-200 sm:px-5">
                        {formatRupee(Number.isFinite(p.sale) ? p.sale : p.mrp)}
                      </td>
                      <td className="px-4 py-4 font-medium tabular-nums text-slate-800 dark:text-slate-200 sm:px-5">
                        {formatRupee(p.total)}
                      </td>
                      <td className="px-4 py-4 sm:px-5">
                        <span
                          className={`inline-flex rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                            p.active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {p.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-4 sm:px-5">
                        <div
                          ref={menuOpen ? menuRef : undefined}
                          className="flex items-center justify-end gap-1.5 text-slate-500 dark:text-slate-400"
                        >
                          <button
                            type="button"
                            aria-label="Delete product"
                            className="rounded-full border border-slate-200 p-2 text-rose-600 transition hover:bg-rose-50 dark:border-white/10 dark:hover:bg-rose-500/10"
                            onClick={() => void onDelete(p.id, p.title)}
                            disabled={del.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div className="relative">
                            <button
                              type="button"
                              aria-expanded={menuOpen}
                              aria-haspopup="menu"
                              aria-label="More actions"
                              className="rounded-full border border-slate-200 p-2 transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setMenuForId((cur) => (cur === idStr ? null : idStr));
                              }}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {menuOpen ? (
                              <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-slate-100 bg-white py-1.5 shadow-xl dark:border-white/10 dark:bg-slate-900">
                                <button
                                  type="button"
                                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/10"
                                  onClick={() => {
                                    setMenuForId(null);
                                    setViewProduct(p);
                                  }}
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/10"
                                  onClick={() => {
                                    setMenuForId(null);
                                    setCreateOpen(false);
                                    setEditProductId(p.id as string | number);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                                  onClick={() => {
                                    setMenuForId(null);
                                    void onDelete(p.id, p.title);
                                  }}
                                  disabled={del.isPending}
                                >
                                  Delete
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                      No products match your search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3.5 text-sm text-slate-500 dark:border-white/5 dark:text-slate-400">
            <span>
              Showing {showing} of {total} product{total === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className="text-xs font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              onClick={() => {
                setSearch("");
                toast.info("Showing all products in this list.");
              }}
            >
              View all
            </button>
          </div>
        </div>
      </div>

      <AddProductModal
        open={createOpen || editProductId != null}
        editProductId={createOpen ? null : editProductId}
        onClose={() => {
          setCreateOpen(false);
          setEditProductId(null);
        }}
      />
      <ProductViewModal open={!!viewProduct} product={viewProduct} onClose={() => setViewProduct(null)} />
    </div>
  );
}
