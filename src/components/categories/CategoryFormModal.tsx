import { categoriesApi } from "@/api/categories";
import type { CategoryRow } from "@/types/category";
import { parseApiError } from "@/utils/parseApiError";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const emptyForm: CategoryFormState = {
  name: "",
  slug: "",
  description: "",
  logo_url: "",
  is_active: true,
};

type CategoryFormState = {
  name: string;
  slug: string;
  description: string;
  logo_url: string;
  is_active: boolean;
};

function extractUploadUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const direct = o.url ?? o.secure_url ?? o.secureUrl;
  if (typeof direct === "string" && direct) return direct;
  const file = o.file;
  if (file && typeof file === "object") {
    const f = file as Record<string, unknown>;
    const u = f.url ?? f.secure_url ?? f.secureUrl;
    if (typeof u === "string" && u) return u;
  }
  const nested = o.data;
  if (nested && typeof nested === "object") {
    const d = nested as Record<string, unknown>;
    const u = d.url ?? d.secure_url ?? d.secureUrl;
    if (typeof u === "string" && u) return u;
  }
  return null;
}

function slugFromName(name: string, id: string | number | null): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/_+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = id != null ? String(id) : Date.now().toString().slice(-6);
  return `${base}-${suffix}`;
}

type Props = {
  open: boolean;
  onClose: () => void;
  category: CategoryRow | null;
};

export function CategoryFormModal({ open, onClose, category }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CategoryFormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof CategoryFormState, string>>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(category?.id);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setErrors({});
      return;
    }
    if (category) {
      setForm({
        name: category.name,
        slug: category.slug ?? "",
        description: category.description ?? "",
        logo_url: category.logo_url ?? "",
        is_active: category.is_active,
      });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [open, category]);

  const createMut = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await categoriesApi.create(payload);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const patchMut = useMutation({
    mutationFn: async (vars: { id: string; payload: Record<string, unknown> }) => {
      const { data } = await categoriesApi.patch(vars.id, vars.payload);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await categoriesApi.uploadLogo(fd);
      return data;
    },
  });

  if (!open) return null;

  const setField = (key: keyof CategoryFormState, value: string | boolean) => {
    setForm((prev) => {
      let next = { ...prev, [key]: value };
      if (key === "name" && typeof value === "string") {
        const generated = slugFromName(value, isEdit && category != null ? category.id : null);
        next = { ...next, name: value, slug: prev.slug || generated };
      }
      return next;
    });
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof CategoryFormState, string>> = {};
    if (!form.name.trim()) e.name = "Name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description.trim() || undefined,
      logo_url: form.logo_url || undefined,
      is_active: form.is_active,
    };
    try {
      if (isEdit && category) {
        await patchMut.mutateAsync({ id: String(category.id), payload });
        toast.success("Category updated");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Category created");
      }
      onClose();
    } catch (err) {
      toast.error(parseApiError(err));
    }
  };

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
      setForm((prev) => ({ ...prev, logo_url: url }));
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error(parseApiError(err));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeLogo = () => setForm((prev) => ({ ...prev, logo_url: "" }));

  const pending = createMut.isPending || patchMut.isPending || uploadMut.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Catalog</p>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {isEdit ? "Edit category" : "Add category"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3 px-4 py-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-200">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className="mt-0.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary/20 dark:border-white/10 dark:text-white"
              placeholder="e.g. Wellness"
            />
            {errors.name && <p className="mt-0.5 text-xs text-rose-500">{errors.name}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-200">Slug</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setField("slug", e.target.value)}
              readOnly={!isEdit}
              className="mt-0.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs text-slate-900 read-only:bg-slate-50 focus:border-primary focus:ring-1 focus:ring-primary/20 dark:read-only:bg-white/5 dark:border-white/10 dark:text-white"
              placeholder={isEdit ? "edit slug manually" : "auto-generated from name"}
            />
            <p className="mt-0.5 text-xs text-slate-400">
              {isEdit ? "Slug can be edited manually" : "Auto-generated with unique ID"}
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-200">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              className="mt-0.5 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary/20 dark:border-white/10 dark:text-white"
              rows={2}
              placeholder="Optional short summary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-200">Logo</label>
            <div className="mt-1 flex flex-col gap-2 rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500 dark:border-white/10">
              {form.logo_url ? (
                <div className="flex items-center gap-2">
                  <img
                    src={form.logo_url}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="text-xs font-semibold text-rose-500"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <p>No logo uploaded yet.</p>
              )}
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white dark:hover:bg-white/10">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void onFile(e.target.files)}
                />
                {uploadMut.isPending ? "Uploading…" : "Upload"}
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-200">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setField("is_active", e.target.checked)}
              className="h-3 w-3 rounded border-slate-300 text-primary focus:ring-primary"
            />
            Active category
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200"
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-card disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
