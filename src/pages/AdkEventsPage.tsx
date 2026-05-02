import { adminEventsApi } from "@/api/adminEvents";
import { AdmEventFormModal } from "@/components/admEvents/AdmEventFormModal";
import { LoadingScreen } from "@/components/LoadingScreen";
import type { AdmEventRow } from "@/utils/admEventFields";
import { formatEventDate, formatEventTime, parseAdminEventsEnvelope } from "@/utils/admEventFields";
import { parseApiError } from "@/utils/parseApiError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const TH =
  "px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 sm:px-5 dark:text-slate-400";

function listParams(applied: { search: string; startDate: string; endDate: string }, page: number) {
  const params: Record<string, string | number> = {
    page,
    /** Laravel `AdkEventController@index` reads `limit`, not `perPage`. */
    limit: 15,
  };
  const q = applied.search.trim();
  if (q) params.search = q;
  if (applied.startDate) params.start_date = applied.startDate;
  if (applied.endDate) params.end_date = applied.endDate;
  return params;
}

export function AdkEventsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState({ search: "", startDate: "", endDate: "" });
  const [applied, setApplied] = useState({ search: "", startDate: "", endDate: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdmEventRow | null>(null);

  /** Keep list query in sync while typing (backend expects `search`). */
  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = draft.search.trim();
      setApplied((prev) => (prev.search === next ? prev : { ...prev, search: next }));
    }, 350);
    return () => window.clearTimeout(id);
  }, [draft.search]);

  useEffect(() => {
    setPage(1);
  }, [applied.search]);

  const q = useQuery({
    queryKey: ["admin-events", page, applied.search, applied.startDate, applied.endDate],
    queryFn: async () => {
      const { data } = await adminEventsApi.list(listParams(applied, page));
      return data;
    },
  });

  const del = useMutation({
    mutationFn: (id: string | number) => adminEventsApi.delete(id),
    onSuccess: () => {
      toast.success("Event deleted");
      void qc.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const { rows, meta } = useMemo(
    () => parseAdminEventsEnvelope(q.data ?? null),
    [q.data],
  );

  const applyFilters = () => {
    setApplied({
      search: draft.search.trim(),
      startDate: draft.startDate,
      endDate: draft.endDate,
    });
    setPage(1);
  };

  const resetFilters = () => {
    setDraft({ search: "", startDate: "", endDate: "" });
    setApplied({ search: "", startDate: "", endDate: "" });
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (row: AdmEventRow) => {
    setEditing(row);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const onDelete = async (row: AdmEventRow) => {
    const label = row.leaderName || String(row.id);
    if (!window.confirm(`Delete event for “${label}”? This cannot be undone.`)) return;
    try {
      await del.mutateAsync(row.id);
    } catch {
      /* toast handled */
    }
  };

  if (q.isLoading && q.data === undefined)
    return <LoadingScreen message="Loading events…" />;

  if (q.isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-6 dark:border-rose-400/30 dark:bg-slate-950">
        <p className="mb-4 font-semibold text-rose-600">Unable to load events.</p>
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

  const total = meta.total;
  const perPage = meta.perPage || 15;
  const lastPage = Math.max(1, meta.lastPage);
  const clampedPage = Math.min(Math.max(1, page), lastPage);
  const from = total === 0 ? 0 : (clampedPage - 1) * perPage + 1;
  const to = total === 0 ? 0 : Math.min(clampedPage * perPage, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">ADK Events</h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Manage leader meetups, venues, and schedules.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void q.refetch()}
            disabled={q.isFetching}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Add Event
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-white/5 dark:bg-slate-950 dark:shadow-none">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search leader, state, city"
            aria-label="Search leader, state, city"
            value={draft.search}
            onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyFilters();
              }
            }}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Start date
            </span>
            <input
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              End date
            </span>
            <input
              type="date"
              value={draft.endDate}
              onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:border-white/5 dark:bg-slate-950 dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="min-w-[800px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 dark:border-white/5 dark:bg-white/[0.03]">
                <th className={TH}>Leader Name</th>
                <th className={TH}>Date</th>
                <th className={TH}>Time</th>
                <th className={TH}>Store Name</th>
                <th className={TH}>City</th>
                <th className={`${TH} w-52 text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={String(row.id)}
                  className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50/50 dark:border-white/5 dark:hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-4 font-medium text-slate-900 dark:text-white sm:px-5">
                    {row.leaderName || "—"}
                  </td>
                  <td className="px-4 py-4 text-slate-800 dark:text-slate-200 sm:px-5">
                    {formatEventDate(row.meetingDate)}
                  </td>
                  <td className="px-4 py-4 tabular-nums text-slate-800 dark:text-slate-200 sm:px-5">
                    {formatEventTime(row.meetingTime)}
                  </td>
                  <td className="max-w-[200px] px-4 py-4 text-slate-800 dark:text-slate-200 sm:px-5">
                    <span className="line-clamp-2">{row.storeName || "—"}</span>
                  </td>
                  <td className="px-4 py-4 text-slate-800 dark:text-slate-200 sm:px-5">
                    {row.city || "—"}
                  </td>
                  <td className="px-4 py-4 sm:px-5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 shadow-sm hover:bg-blue-50 dark:border-white/15 dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-blue-500/10"
                        onClick={() => openEdit(row)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/30 dark:bg-slate-900 dark:hover:bg-rose-500/10"
                        onClick={() => void onDelete(row)}
                        disabled={del.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                    No events found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5 text-sm text-slate-500 dark:border-white/5 dark:text-slate-400">
          <span>
            Showing {from}-{to} of {total}
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              disabled={clampedPage <= 1 || q.isFetching || total === 0}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="font-semibold text-slate-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:text-blue-400"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={clampedPage >= lastPage || q.isFetching || total === 0}
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              className="font-semibold text-slate-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:text-blue-400"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <AdmEventFormModal open={modalOpen} onClose={closeModal} eventRow={editing} />
    </div>
  );
}
