import { heroSlidersApi } from "@/api/heroSliders";
import { HeroSlideFormModal } from "@/components/heroSlider/HeroSlideFormModal";
import { LoadingScreen } from "@/components/LoadingScreen";
import { parseApiError } from "@/utils/parseApiError";
import { parseHeroSlidesPayload, type HeroSlideRow } from "@/utils/heroSliderFields";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export function HeroSliderPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<HeroSlideRow | null>(null);

  const q = useQuery({
    queryKey: ["hero-sliders"],
    queryFn: async () => (await heroSlidersApi.list()).data,
  });

  const del = useMutation({
    mutationFn: (id: string | number) => heroSlidersApi.delete(id),
    onSuccess: () => {
      toast.success("Slide deleted");
      void qc.invalidateQueries({ queryKey: ["hero-sliders"] });
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const rows = useMemo(() => parseHeroSlidesPayload(q.data ?? null), [q.data]);

  const openCreate = () => {
    setEditing(null);
    setCreateOpen(true);
  };

  const openEdit = (row: HeroSlideRow) => {
    setEditing(row);
    setCreateOpen(true);
  };

  const closeModal = () => {
    setCreateOpen(false);
    setEditing(null);
  };

  const onDelete = async (row: HeroSlideRow) => {
    const label = row.title || String(row.id);
    if (!window.confirm(`Delete “${label}”? This cannot be undone.`)) return;
    try {
      await del.mutateAsync(row.id);
    } catch {
      /* toast in mutation */
    }
  };

  if (q.isLoading && !q.data) return <LoadingScreen message="Loading hero sliders…" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Hero Slider</h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Manage homepage hero section slides.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 active:bg-indigo-800 sm:self-start"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Add Slide
        </button>
      </div>

      <div className="space-y-4">
        {rows.map((r) => (
          <div
            key={String(r.id)}
            className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/5 dark:bg-slate-950"
          >
            <div className="flex items-center gap-4 p-4 sm:p-5">
              <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50 dark:border-white/10 dark:bg-slate-900">
                {r.imageUrl ? <img src={r.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {r.badge ? (
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{r.badge}</span>
                  ) : null}
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      r.is_active
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {r.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {r.title || "—"}
                </p>
                <p className="mt-0.5 line-clamp-1 text-xs text-slate-600 dark:text-slate-400">
                  {r.subtitle || "—"}
                </p>
              </div>

              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 p-2 transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
                  aria-label="Move up"
                  onClick={() => toast.info("Reorder not wired")}
                >
                  <span className="text-sm font-bold">↑</span>
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 p-2 transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
                  aria-label="Move down"
                  onClick={() => toast.info("Reorder not wired")}
                >
                  <span className="text-sm font-bold">↓</span>
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 p-2 transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
                  aria-label="Edit"
                  onClick={() => openEdit(r)}
                >
                  <span className="text-sm font-bold">✎</span>
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 p-2 text-rose-600 transition hover:bg-rose-50 dark:border-white/10 dark:hover:bg-rose-500/10"
                  aria-label="Delete slide"
                  onClick={() => void onDelete(r)}
                  disabled={del.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-slate-500 dark:border-white/5 dark:bg-slate-950">
            No slides found.
          </div>
        ) : null}
      </div>

      <HeroSlideFormModal open={createOpen} onClose={closeModal} slide={editing} />
    </div>
  );
}
