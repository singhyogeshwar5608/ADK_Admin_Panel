import { heroSlidersApi } from "@/api/heroSliders";
import { parseApiError } from "@/utils/parseApiError";
import type { HeroSlideRow } from "@/utils/heroSliderFields";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

function extractUploadUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const direct = o.url ?? o.secure_url ?? o.secureUrl;
  if (typeof direct === "string" && direct) return direct;
  const nested = o.data;
  if (nested && typeof nested === "object") {
    const d = nested as Record<string, unknown>;
    const u = d.url ?? d.secure_url ?? d.secureUrl;
    if (typeof u === "string" && u) return u;
  }
  const file = o.file;
  if (file && typeof file === "object") {
    const f = file as Record<string, unknown>;
    const u = f.url ?? f.secure_url ?? f.secureUrl;
    if (typeof u === "string" && u) return u;
  }
  return null;
}

type FormState = {
  badge: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  is_active: boolean;
};

const emptyForm = (): FormState => ({
  badge: "",
  title: "",
  subtitle: "",
  imageUrl: "",
  is_active: true,
});

type Props = {
  open: boolean;
  onClose: () => void;
  slide: HeroSlideRow | null;
};

export function HeroSlideFormModal({ open, onClose, slide }: Props) {
  const qc = useQueryClient();
  const formId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const isEdit = slide != null;

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      return;
    }
    if (slide) {
      setForm({
        badge: slide.badge ?? "",
        title: slide.title ?? "",
        subtitle: slide.subtitle ?? "",
        imageUrl: slide.imageUrl ?? "",
        is_active: slide.is_active,
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, slide]);

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await heroSlidersApi.upload(fd);
      return data;
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const createMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => heroSlidersApi.create(payload),
    onSuccess: async () => {
      toast.success("Slide created");
      await qc.invalidateQueries({ queryKey: ["hero-sliders"] });
      onClose();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: string | number; payload: Record<string, unknown> }) =>
      heroSlidersApi.update(vars.id, vars.payload),
    onSuccess: async () => {
      toast.success("Slide updated");
      await qc.invalidateQueries({ queryKey: ["hero-sliders"] });
      onClose();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  if (!open) return null;

  const pending = createMut.isPending || updateMut.isPending || uploadMut.isPending;

  const onFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const data = await uploadMut.mutateAsync(file);
      const url = extractUploadUrl(data);
      if (!url) {
        toast.error("Upload succeeded but no image URL was returned");
        return;
      }
      setForm((prev) => ({ ...prev, imageUrl: url }));
      toast.success("Image uploaded");
    } catch {
      /* toast in mutation */
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    const payload: Record<string, unknown> = {
      badge: form.badge.trim() || undefined,
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || undefined,
      image: form.imageUrl || undefined,
      image_url: form.imageUrl || undefined,
      imageUrl: form.imageUrl || undefined,
      is_active: form.is_active,
      isActive: form.is_active,
    };

    if (isEdit && slide?.id != null) {
      updateMut.mutate({ id: slide.id, payload });
    } else {
      createMut.mutate(payload);
    }
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
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-6 py-5 dark:border-white/10">
          <div>
            <h2 id={`${formId}-title`} className="text-xl font-bold text-slate-900 dark:text-white">
              {isEdit ? "Edit Slide" : "Add New Slide"}
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

        <form id={`${formId}-form`} onSubmit={(e) => void onSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Badge Text</span>
                <input
                  value={form.badge}
                  onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))}
                  placeholder="e.g., New / Launch / Sale"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Title</span>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Slide Title"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Subtitle</span>
              <input
                value={form.subtitle}
                onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                placeholder="Slide subtitle"
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </label>

            <div className="mt-4">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Hero Image</span>
              <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  disabled={pending}
                  onChange={(e) => void onFile(e.target.files)}
                  className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200 dark:text-slate-200 dark:file:bg-white/10 dark:file:text-slate-200 dark:hover:file:bg-white/15"
                />
                {form.imageUrl ? (
                  <div className="mt-3 flex items-center gap-3">
                    <img
                      src={form.imageUrl}
                      alt=""
                      className="h-12 w-20 rounded-md border border-slate-200 object-cover dark:border-white/10"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                      className="text-sm font-semibold text-rose-600 hover:underline"
                      disabled={pending}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
              />
              Active (show in slider)
            </label>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-white/10 dark:bg-slate-900/80">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {pending ? "Saving…" : isEdit ? "Update Slide" : "Create Slide"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

