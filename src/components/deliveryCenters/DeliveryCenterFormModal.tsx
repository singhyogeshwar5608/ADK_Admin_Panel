import { deliveryCentersApi } from "@/api/deliveryCenters";
import { parseApiError } from "@/utils/parseApiError";
import type { DeliveryCenterRow } from "@/utils/deliveryCenterFields";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { type FormEvent, useEffect, useId, useState } from "react";
import { toast } from "sonner";

type FormState = {
  name: string;
  owner_name: string;
  location: string;
  mobile_number: string;
  is_active: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  owner_name: "",
  location: "",
  mobile_number: "",
  is_active: true,
});

type Props = {
  open: boolean;
  onClose: () => void;
  center: DeliveryCenterRow | null;
};

export function DeliveryCenterFormModal({ open, onClose, center }: Props) {
  const qc = useQueryClient();
  const formId = useId();
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const isEdit = center != null;

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      return;
    }
    if (center) {
      setForm({
        name: center.name,
        owner_name: center.owner_name,
        location: center.location,
        mobile_number: center.mobile_number,
        is_active: center.is_active,
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, center]);

  const createMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => deliveryCentersApi.create(payload),
    onSuccess: async () => {
      toast.success("Delivery center created");
      await qc.invalidateQueries({ queryKey: ["delivery-centers"] });
      onClose();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const patchMut = useMutation({
    mutationFn: (vars: { id: string | number; payload: Record<string, unknown> }) =>
      deliveryCentersApi.patch(vars.id, vars.payload),
    onSuccess: async () => {
      toast.success("Delivery center updated");
      await qc.invalidateQueries({ queryKey: ["delivery-centers"] });
      onClose();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  if (!open) return null;

  const pending = createMut.isPending || patchMut.isPending;

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      owner_name: form.owner_name.trim(),
      location: form.location.trim(),
      mobile_number: form.mobile_number.trim(),
      is_active: form.is_active,
    };

    if (isEdit && center?.id != null) {
      patchMut.mutate({ id: center.id, payload });
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
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-6 py-5 dark:border-white/10">
          <h2 id={`${formId}-title`} className="text-xl font-bold text-slate-900 dark:text-white">
            {isEdit ? "Edit delivery center" : "Add New Delivery Center"}
          </h2>
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
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Center Name <span className="text-rose-500">*</span>
              </span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Owner Name <span className="text-rose-500">*</span>
              </span>
              <input
                required
                value={form.owner_name}
                onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Location <span className="text-rose-500">*</span>
              </span>
              <input
                required
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Mobile Number <span className="text-rose-500">*</span>
              </span>
              <input
                required
                inputMode="numeric"
                placeholder="9876543210"
                value={form.mobile_number}
                onChange={(e) => setForm((f) => ({ ...f, mobile_number: e.target.value }))}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
              />
              Active
            </label>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-white/10 dark:bg-slate-900/80">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              {pending ? "Saving…" : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
