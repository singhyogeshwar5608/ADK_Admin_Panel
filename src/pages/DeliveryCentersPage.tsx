import { deliveryCentersApi } from "@/api/deliveryCenters";
import { DeliveryCenterFormModal } from "@/components/deliveryCenters/DeliveryCenterFormModal";
import { LoadingScreen } from "@/components/LoadingScreen";
import { parseDeliveryCenterPayload, type DeliveryCenterRow } from "@/utils/deliveryCenterFields";
import { parseApiError } from "@/utils/parseApiError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const TH =
  "px-4 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500 sm:px-5 dark:text-slate-400";

export function DeliveryCentersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryCenterRow | null>(null);

  const q = useQuery({
    queryKey: ["delivery-centers"],
    queryFn: async () => (await deliveryCentersApi.list()).data,
  });

  const del = useMutation({
    mutationFn: (id: string | number) => deliveryCentersApi.delete(id),
    onSuccess: () => {
      toast.success("Delivery center deleted");
      void qc.invalidateQueries({ queryKey: ["delivery-centers"] });
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const rows = useMemo(() => parseDeliveryCenterPayload(q.data ?? null), [q.data]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const qv = search.toLowerCase().trim();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(qv) ||
        r.owner_name.toLowerCase().includes(qv) ||
        r.location.toLowerCase().includes(qv) ||
        r.mobile_number.replace(/\s/g, "").includes(qv.replace(/\s/g, "")) ||
        String(r.id).includes(qv),
    );
  }, [rows, search]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (row: DeliveryCenterRow) => {
    setEditing(row);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const onDelete = async (row: DeliveryCenterRow) => {
    const label = row.name || String(row.id);
    if (!window.confirm(`Delete “${label}”? This cannot be undone.`)) return;
    try {
      await del.mutateAsync(row.id);
    } catch {
      /* toast in mutation */
    }
  };

  if (q.isLoading && !q.data) return <LoadingScreen message="Loading delivery centers…" />;

  if (q.isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-6 dark:border-rose-400/30 dark:bg-slate-950">
        <p className="mb-4 font-semibold text-rose-600">Unable to load delivery centers.</p>
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Delivery Centers</h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Manage your company&apos;s delivery centers.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 active:bg-blue-800 sm:self-start"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Add Center
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Search delivery centers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-white"
        />
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {filtered.map((r) => (
          <div
            key={String(r.id)}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-slate-950"
          >
            <div className="flex gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-blue-600 dark:border-white/10 dark:bg-slate-900 dark:text-blue-400">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 dark:text-white">{r.name || "—"}</p>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{r.owner_name || "—"}</p>
                <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{r.location || "—"}</span>
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {r.mobile_number || "—"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                      r.is_active
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {r.is_active ? "Active" : "Inactive"}
                  </span>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 p-2 text-blue-600 hover:bg-blue-50 dark:border-white/10 dark:text-blue-400 dark:hover:bg-blue-500/10"
                    aria-label="Edit center"
                    onClick={() => openEdit(r)}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 p-2 text-rose-600 hover:bg-rose-50 dark:border-white/10 dark:hover:bg-rose-500/10"
                    aria-label="Delete center"
                    onClick={() => void onDelete(r)}
                    disabled={del.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-slate-500 dark:border-white/5 dark:bg-slate-950">
            No delivery centers match your search.
          </div>
        ) : null}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:border-white/5 dark:bg-slate-950 dark:shadow-none">
          <div className="overflow-x-auto">
            <table className="min-w-[800px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 dark:border-white/5 dark:bg-white/[0.03]">
                  <th className={TH}>Center Name</th>
                  <th className={TH}>Owner</th>
                  <th className={TH}>Location</th>
                  <th className={TH}>Mobile</th>
                  <th className={TH}>Status</th>
                  <th className={`${TH} w-36 text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={String(r.id)}
                    className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50/50 dark:border-white/5 dark:hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-4 sm:px-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-blue-600 dark:border-white/10 dark:bg-slate-900 dark:text-blue-400">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <span className="max-w-[220px] font-semibold text-slate-900 dark:text-white">
                          {r.name || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-800 dark:text-slate-200 sm:px-5">
                      {r.owner_name || "—"}
                    </td>
                    <td className="px-4 py-4 text-slate-800 dark:text-slate-200 sm:px-5">
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <span className="max-w-[280px] leading-snug">{r.location || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-800 dark:text-slate-200 sm:px-5">
                      <div className="flex items-center gap-2 tabular-nums">
                        <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                        {r.mobile_number || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-4 sm:px-5">
                      <span
                        className={`inline-flex rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                          r.is_active
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {r.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-4 sm:px-5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          aria-label="Edit delivery center"
                          className="rounded-lg border border-slate-200 p-2 text-blue-600 transition hover:bg-blue-50 dark:border-white/10 dark:text-blue-400 dark:hover:bg-blue-500/10"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete delivery center"
                          className="rounded-lg border border-slate-200 p-2 text-rose-600 transition hover:bg-rose-50 dark:border-white/10 dark:hover:bg-rose-500/10"
                          onClick={() => void onDelete(r)}
                          disabled={del.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                      No delivery centers match your search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3.5 text-sm text-slate-500 dark:border-white/5 dark:text-slate-400">
            <span>
              Showing {showing} of {total} center{total === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>

      <DeliveryCenterFormModal open={modalOpen} onClose={closeModal} center={editing} />
    </div>
  );
}
