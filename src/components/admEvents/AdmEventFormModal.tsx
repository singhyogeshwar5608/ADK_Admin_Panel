import { adminEventsApi } from "@/api/adminEvents";
import type { AdmEventRow } from "@/utils/admEventFields";
import { parseApiError } from "@/utils/parseApiError";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, X } from "lucide-react";
import { type FormEvent, useEffect, useId, useState } from "react";
import { toast } from "sonner";

type FormState = {
  leaderName: string;
  storeName: string;
  meetingDate: string;
  meetingHour12: string;
  meetingMinute: string;
  meetingMeridiem: "AM" | "PM";
  city: string;
  state: string;
  leaderMobile: string;
  storeMobile: string;
  address: string;
  notes: string;
};

const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const MINUTES_00_59 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function emptyForm(): FormState {
  return {
    leaderName: "",
    storeName: "",
    meetingDate: "",
    meetingHour12: "12",
    meetingMinute: "00",
    meetingMeridiem: "PM",
    city: "",
    state: "",
    leaderMobile: "",
    storeMobile: "",
    address: "",
    notes: "",
  };
}

/** Parse `HH:mm` or `HH:mm:ss` from API into 12-hour parts. */
function parse24hTo12h(time24: string): { h12: number; minute: number; meridiem: "AM" | "PM" } {
  const parts = time24.trim().split(":");
  const H = Math.min(23, Math.max(0, Number(parts[0]) || 0));
  const minute = Math.min(59, Math.max(0, Number(parts[1]) || 0));
  const meridiem: "AM" | "PM" = H < 12 ? "AM" : "PM";
  let h12 = H % 12;
  if (h12 === 0) h12 = 12;
  return { h12, minute, meridiem };
}

function to24hFrom12h(h12: number, minute: number, meridiem: "AM" | "PM"): string {
  let h = h12 % 12;
  if (meridiem === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeTimeForApi(t: string): string | undefined {
  const s = t.trim();
  if (!s) return undefined;
  return /^\d{2}:\d{2}$/.test(s) ? `${s}:00` : s;
}

/** Backend `StoreAdkEventRequest` expects 10-digit strings (no spaces / +91). */
function normalizeTenDigitMobile(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

type Props = {
  open: boolean;
  onClose: () => void;
  eventRow: AdmEventRow | null;
};

const labelCls =
  "text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400";
const inputCls =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white";

export function AdmEventFormModal({ open, onClose, eventRow }: Props) {
  const qc = useQueryClient();
  const formId = useId();
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const isEdit = eventRow != null;

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      return;
    }
    if (eventRow) {
      const time = eventRow.meetingTime?.trim() || "";
      const timeShort = time.length >= 5 ? time.slice(0, 5) : time || "12:00";
      const { h12, minute, meridiem } = parse24hTo12h(timeShort);
      setForm({
        leaderName: eventRow.leaderName,
        storeName: eventRow.storeName,
        meetingDate: eventRow.meetingDate,
        meetingHour12: String(h12),
        meetingMinute: String(minute).padStart(2, "0"),
        meetingMeridiem: meridiem,
        city: eventRow.city,
        state: eventRow.state,
        leaderMobile: eventRow.leaderMobile,
        storeMobile: eventRow.storeMobile,
        address: eventRow.address,
        notes: eventRow.notes,
      });
    } else setForm(emptyForm());
  }, [open, eventRow]);

  const createMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => adminEventsApi.create(payload),
    onSuccess: async () => {
      toast.success("Event created");
      await qc.invalidateQueries({ queryKey: ["admin-events"] });
      onClose();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: string | number; payload: Record<string, unknown> }) =>
      adminEventsApi.update(vars.id, vars.payload),
    onSuccess: async () => {
      toast.success("Event updated");
      await qc.invalidateQueries({ queryKey: ["admin-events"] });
      onClose();
    },
    onError: (e) => toast.error(parseApiError(e)),
  });

  if (!open) return null;

  const pending = createMut.isPending || updateMut.isPending;

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();

    const address = form.address.trim();
    if (!address) {
      toast.error("Address is required.");
      return;
    }

    const h12 = Number(form.meetingHour12);
    const min = Number(form.meetingMinute);
    if (!Number.isFinite(h12) || h12 < 1 || h12 > 12 || !Number.isFinite(min) || min < 0 || min > 59) {
      toast.error("Choose a valid meeting time.");
      return;
    }
    const time24 = to24hFrom12h(h12, min, form.meetingMeridiem);
    const mt = normalizeTimeForApi(time24);
    if (!mt) {
      toast.error("Meeting time is required.");
      return;
    }

    const leader_mobile = normalizeTenDigitMobile(form.leaderMobile);
    const store_mobile = normalizeTenDigitMobile(form.storeMobile);
    if (leader_mobile.length !== 10 || store_mobile.length !== 10) {
      toast.error("Leader mobile and store mobile must each be 10 digits.");
      return;
    }

    /** Laravel validates snake_case (`StoreAdkEventRequest`). */
    const payload: Record<string, unknown> = {
      leader_name: form.leaderName.trim(),
      store_name: form.storeName.trim(),
      meeting_date: form.meetingDate.trim(),
      meeting_time: mt,
      city: form.city.trim(),
      state: form.state.trim(),
      leader_mobile,
      store_mobile,
      address,
      notes: form.notes.trim() ? form.notes.trim() : null,
    };

    if (isEdit && eventRow?.id != null) {
      updateMut.mutate({ id: eventRow.id, payload });
    } else createMut.mutate(payload);
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
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-6 py-4 dark:border-white/10">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-400">Modal</p>
            <h2 id={`${formId}-title`} className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {isEdit ? "Edit event" : "Add Event"}
            </h2>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelCls}>Leader name</span>
                <input
                  required
                  value={form.leaderName}
                  onChange={(e) => setForm((f) => ({ ...f, leaderName: e.target.value }))}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Store name</span>
                <input
                  required
                  value={form.storeName}
                  onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))}
                  className={inputCls}
                />
              </label>

              <label className="block">
                <span className={labelCls}>Meeting date</span>
                <div className="relative mt-1.5">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={form.meetingDate}
                    onChange={(e) => setForm((f) => ({ ...f, meetingDate: e.target.value }))}
                    className={`${inputCls} pl-10`}
                  />
                </div>
              </label>
              <label className="block">
                <span className={labelCls}>Meeting time</span>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  <select
                    required
                    aria-label="Hour"
                    value={form.meetingHour12}
                    onChange={(e) => setForm((f) => ({ ...f, meetingHour12: e.target.value }))}
                    className="w-[4.5rem] shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  >
                    {HOURS_12.map((h) => (
                      <option key={h} value={String(h)}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">:</span>
                  <select
                    required
                    aria-label="Minute"
                    value={form.meetingMinute}
                    onChange={(e) => setForm((f) => ({ ...f, meetingMinute: e.target.value }))}
                    className="w-[4.5rem] shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  >
                    {MINUTES_00_59.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    required
                    aria-label="AM or PM"
                    value={form.meetingMeridiem}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, meetingMeridiem: e.target.value as "AM" | "PM" }))
                    }
                    className="min-w-[5.5rem] shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </label>

              <label className="block">
                <span className={labelCls}>City</span>
                <input
                  required
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className={labelCls}>State</span>
                <input
                  required
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  className={inputCls}
                />
              </label>

              <label className="block">
                <span className={labelCls}>Leader mobile</span>
                <input
                  required
                  inputMode="tel"
                  value={form.leaderMobile}
                  onChange={(e) => setForm((f) => ({ ...f, leaderMobile: e.target.value }))}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Store mobile</span>
                <input
                  required
                  inputMode="tel"
                  value={form.storeMobile}
                  onChange={(e) => setForm((f) => ({ ...f, storeMobile: e.target.value }))}
                  className={inputCls}
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className={labelCls}>Address</span>
              <textarea
                required
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                rows={3}
                className={inputCls}
              />
            </label>

            <label className="mt-4 block">
              <span className={labelCls}>Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                className={inputCls}
              />
            </label>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-white/10 dark:bg-slate-900/80">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {pending ? "Saving…" : isEdit ? "Update event" : "Create event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
