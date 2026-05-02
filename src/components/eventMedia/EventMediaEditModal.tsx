import { eventMediaApi } from "@/api/eventMedia";
import type { EventMediaRow } from "@/utils/eventMediaFields";
import { parseApiError } from "@/utils/parseApiError";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

export function EventMediaEditModal({
  row,
  open,
  onClose,
}: {
  row: EventMediaRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const formId = useId();
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (row && open) {
      setTitle(row.title);
      setCaption(row.caption ?? "");
      setIsActive(row.isActive);
    }
  }, [row, open]);

  const patch = useMutation({
    mutationFn: ({ id, payload }: { id: string | number; payload: Record<string, unknown> }) =>
      eventMediaApi.patch(id, payload),
    onSuccess: async () => {
      toast.success("Media updated");
      await qc.invalidateQueries({ queryKey: ["event-media"] });
      onClose();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  if (!open || !row) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    patch.mutate({
      id: row.id,
      payload: {
        title: title.trim(),
        caption: caption.trim(),
        isActive,
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-950"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={`${formId}-title`} className="text-lg font-bold text-slate-900 dark:text-white">
            Edit media
          </h2>
          <button
            type="button"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Title
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Caption
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300 text-primary focus:ring-primary/30"
            />
            Active
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={patch.isPending}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {patch.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
