import { categoriesApi } from "@/api/categories";
import { CategoryFormModal } from "@/components/categories/CategoryFormModal";
import type { CategoriesListMeta, CategoryRow } from "@/types/category";
import { parseApiError } from "@/utils/parseApiError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

const ROW_LIMITS = [10, 20, 50];

const DATE_IN = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

function formatCreated(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return DATE_IN.format(new Date(value));
  } catch {
    return "—";
  }
}

function categorySubtitleSlug(slug: string): string {
  if (!slug) return "—";
  return slug.slice(0, 1).toUpperCase() + slug.slice(1);
}

function categoryAvatarLabel(name: string): string {
  const letters = [...name.trim()].filter((c) => /[A-Za-z0-9]/.test(c));
  const s = letters.slice(0, 2).join("");
  return s ? s.toUpperCase() : name.slice(0, 2).toUpperCase();
}

function normalizeMeta(
  raw: Partial<CategoriesListMeta> | null | undefined,
  rowsLen: number,
  pageState: number,
  limitState: number,
): CategoriesListMeta {
  const total =
    typeof raw?.total === "number" ? raw.total : typeof raw?.total === "string"
      ? Number(raw.total)
      : rowsLen;
  const limit =
    typeof raw?.limit === "number" ? raw.limit : typeof raw?.limit === "string"
      ? Number(raw.limit)
      : limitState;
  const page =
    typeof raw?.page === "number" ? raw.page : typeof raw?.page === "string"
      ? Number(raw.page)
      : pageState;
  let pages =
    typeof raw?.pages === "number" ? raw.pages : typeof raw?.pages === "string"
      ? Number(raw.pages)
      : NaN;
  if (!Number.isFinite(pages) || pages < 1) {
    pages = Math.max(1, Math.ceil((Number.isFinite(total) ? total : rowsLen) / (limit || 1)));
  }
  return {
    total: Number.isFinite(total) ? total : rowsLen,
    limit: Number.isFinite(limit) ? limit : limitState,
    page: Number.isFinite(page) ? page : pageState,
    pages,
  };
}

type Filters = { search: string; status: string; page: number; limit: number };

export function CategoriesPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>({
    search: "",
    status: "ALL",
    page: 1,
    limit: 20,
  });
  const deferredSearch = useDeferredValue(filters.search.trim());
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuForId, setMenuForId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);

  /** Laravel `CategoryController` only accepts booleans for `status`; "ALL" breaks as `WHERE is_active IS NULL`. */
  const params = useMemo(() => {
    const base: Parameters<typeof categoriesApi.list>[0] = {
      search: deferredSearch || undefined,
      page: filters.page,
      limit: filters.limit,
    };
    if (filters.status === "active") base.status = "1";
    else if (filters.status === "inactive") base.status = "0";
    return base;
  }, [deferredSearch, filters.limit, filters.page, filters.status]);

  const q = useQuery({
    queryKey: ["categories", params],
    queryFn: async () => (await categoriesApi.list(params)).data,
  });

  const delMut = useMutation({
    mutationFn: (id: string | number) => categoriesApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const patchMut = useMutation({
    mutationFn: (vars: { id: string | number; payload: Record<string, unknown> }) =>
      categoriesApi.patch(vars.id, vars.payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const rows = q.data?.data ?? [];
  const meta = normalizeMeta(q.data?.meta ?? null, rows.length, filters.page, filters.limit);

  useEffect(() => {
    if (!menuForId) return;
    const onDoc = (ev: MouseEvent) => {
      const el = menuRef.current;
      if (el && !el.contains(ev.target as Node)) setMenuForId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuForId]);

  const openCreate = () => {
    setEditingCategory(null);
    setModalOpen(true);
  };

  const openEdit = (c: CategoryRow) => {
    setEditingCategory(c);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCategory(null);
  };

  const onDelete = async (row: CategoryRow) => {
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    try {
      await delMut.mutateAsync(row.id);
      toast.success(`${row.name} removed`);
      setMenuForId(null);
    } catch (e) {
      toast.error(parseApiError(e));
    }
  };

  const toggleActive = async (row: CategoryRow) => {
    try {
      await patchMut.mutateAsync({
        id: row.id,
        payload: { is_active: !row.is_active, slug: row.slug },
      });
      toast.success(`${row.name} ${row.is_active ? "deactivated" : "activated"}`);
      setMenuForId(null);
    } catch (e) {
      toast.error(parseApiError(e));
    }
  };

  const rowKey = (id: CategoryRow["id"]) => String(id);

  const toggleMenu = (id: CategoryRow["id"]) => {
    const key = rowKey(id);
    setMenuForId((prev) => (prev === key ? null : key));
  };

  const refreshCategories = () => {
    void qc.refetchQueries({ queryKey: ["categories"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Categories</h1>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-500 dark:border-white/10 dark:text-slate-300">
            <Search className="h-4 w-4 shrink-0" aria-hidden />
            <input
              value={filters.search}
              onChange={(e) =>
                setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))
              }
              placeholder="Search by name or slug"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
            />
          </label>
          <div className="relative inline-flex shrink-0">
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))
              }
              aria-label="Filter by status"
              className="min-w-[6.5rem] cursor-pointer appearance-none rounded-2xl border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-950 dark:text-white"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="text-black dark:text-white">
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400"
              aria-hidden
            />
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-card"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            New category
          </button>
        </div>
      </div>

      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        {q.isError && (
          <div className="rounded-3xl border border-rose-200 bg-white p-4 text-center dark:border-rose-400/30 dark:bg-slate-950">
            <p className="text-sm font-semibold text-rose-500">Unable to load categories.</p>
            <button
              type="button"
              onClick={refreshCategories}
              className="mt-3 inline-flex rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        )}
        {!q.isError &&
          q.isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="space-y-3 rounded-3xl border border-slate-100 bg-white p-4 animate-pulse dark:border-white/5 dark:bg-slate-950"
            >
              <div className="h-4 w-1/2 rounded bg-slate-100 dark:bg-white/10" />
              <div className="h-3 w-1/3 rounded bg-slate-100 dark:bg-white/10" />
            </div>
          ))}
        {!q.isError &&
          !q.isLoading &&
          rows.map((L) => (
            <div
              key={rowKey(L.id)}
              className="space-y-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-card dark:border-white/5 dark:bg-slate-950"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {L.logo_url ? (
                    <img src={L.logo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold uppercase text-slate-500 dark:bg-white/10 dark:text-white">
                      {categoryAvatarLabel(L.name)}
                    </div>
                  )}
                  <div>
                    <p className="text-base font-semibold text-slate-900 dark:text-white">{L.name}</p>
                    <p className="text-xs text-slate-400">{categorySubtitleSlug(L.slug)}</p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    L.is_active
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-300/10 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-300"
                  }`}
                >
                  {L.is_active ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-300">
                <span>Created</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {formatCreated(L.created_at)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  className="flex-1 rounded-full border border-slate-200 px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                  onClick={() => openEdit(L)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-full border border-slate-200 px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                  onClick={() => void toggleActive(L)}
                >
                  {L.is_active ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-full border border-rose-200 px-3 py-2 font-semibold text-rose-500 hover:bg-rose-50 dark:border-rose-400/40"
                  onClick={() => void onDelete(L)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        {!q.isError && !q.isLoading && rows.length === 0 && (
          <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center text-slate-400 dark:border-white/5 dark:bg-slate-950">
            No categories match your filters.
          </div>
        )}
        <button
          type="button"
          onClick={refreshCategories}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
        >
          Refresh list
        </button>
      </div>

      {/* Desktop */}
      <div className="hidden md:block rounded-3xl border border-slate-100 bg-white shadow-card dark:border-white/5 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/5">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Overview</p>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              {rows.length} visible • {meta.total} total entries
            </p>
          </div>
          <button
            type="button"
            onClick={refreshCategories}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {q.isError ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-semibold text-rose-500">Unable to load categories.</p>
            <button
              type="button"
              onClick={refreshCategories}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : (
          <div ref={menuRef} className="relative">
            <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-white/5">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:bg-white/5">
                <tr>
                  {["Category", "Slug", "Created", "Status", "Actions"].map((cell) => (
                    <th key={cell} className="px-6 py-3">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {q.isLoading &&
                  Array.from({ length: 5 }).map((_, F) => (
                    <tr key={F}>
                      <td colSpan={5} className="px-6 py-5">
                        <div className="h-4 w-full animate-pulse rounded bg-slate-100 dark:bg-white/5" />
                      </td>
                    </tr>
                  ))}
                {!q.isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">
                      No categories match your filters.
                    </td>
                  </tr>
                )}
                {!q.isLoading &&
                  rows.map((L) => (
                    <tr
                      key={rowKey(L.id)}
                      className="hover:bg-slate-50/60 dark:hover:bg-white/5"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {L.logo_url ? (
                            <img
                              src={L.logo_url}
                              alt=""
                              className="h-11 w-11 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold uppercase text-slate-500 dark:bg-white/10 dark:text-white">
                              {categoryAvatarLabel(L.name)}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {L.name}
                            </div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">
                              {categorySubtitleSlug(L.slug)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-300">{L.slug}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-300">
                        {formatCreated(L.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            L.is_active
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-300/10 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-300"
                          }`}
                        >
                          {L.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void onDelete(L)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-rose-200 text-rose-500 hover:bg-rose-50 dark:border-rose-400/40 dark:text-rose-300"
                            aria-label={`Delete ${L.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => toggleMenu(L.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200"
                              aria-haspopup="menu"
                              aria-expanded={menuForId === rowKey(L.id)}
                              aria-label={`More actions for ${L.name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {menuForId === rowKey(L.id) && (
                              <div className="absolute right-0 z-50 mt-2 w-44 rounded-2xl border border-slate-100 bg-white p-1 text-sm shadow-2xl dark:border-white/10 dark:bg-slate-900">
                                <button
                                  type="button"
                                  className="w-full rounded-2xl px-4 py-2 text-left text-slate-600 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/10"
                                  onClick={() => {
                                    openEdit(L);
                                    setMenuForId(null);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="w-full rounded-2xl px-4 py-2 text-left text-slate-600 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/10"
                                  onClick={() => void toggleActive(L)}
                                >
                                  {L.is_active ? "Deactivate" : "Activate"}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!q.isLoading && meta.pages > 1 && (
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-card dark:border-white/5 dark:bg-slate-950 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-500 dark:text-slate-300">
            Showing {(meta.page - 1) * meta.limit + 1}-
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
              <span>Rows:</span>
              <select
                value={filters.limit}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    limit: Number(e.target.value),
                    page: 1,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-white/10 dark:bg-slate-950 dark:text-white"
              >
                {ROW_LIMITS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 p-1 text-slate-600 dark:border-white/10 dark:text-slate-200">
              <button
                type="button"
                onClick={() =>
                  setFilters((L) => ({ ...L, page: Math.max(1, L.page - 1) }))
                }
                disabled={meta.page <= 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-2xl disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold">
                {meta.page} / {meta.pages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setFilters((L) => ({
                    ...L,
                    page: Math.min(meta.pages, L.page + 1),
                  }))
                }
                disabled={meta.page >= meta.pages}
                className="inline-flex h-8 w-8 items-center justify-center rounded-2xl disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <CategoryFormModal open={modalOpen} onClose={closeModal} category={editingCategory} />
    </div>
  );
}
