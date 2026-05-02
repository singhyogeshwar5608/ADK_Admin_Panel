import { membersApi } from "@/api/members";
import type { MemberAccountStatus } from "@/types/memberList";
import { parseApiError } from "@/utils/parseApiError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

export type Leg = "LEFT" | "RIGHT";

/** Prefill when opening from Binary Tree register slots (sponsor + leg fixed). */
export type BinaryRegisterContext = {
  sponsorLabel: string;
  sponsorMemberCode: string;
  leg: Leg;
};

type FormState = {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  sponsorId: string;
  leg: Leg;
  profileImage: string;
  status: MemberAccountStatus;
};

const initialForm: FormState = {
  fullName: "",
  email: "",
  password: "",
  phone: "+91",
  address: "",
  sponsorId: "",
  leg: "LEFT",
  profileImage: "",
  status: "ACTIVE",
};

type Errors = Partial<Record<keyof FormState | "submit", string>>;

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("91")) digits = digits.slice(2);
  digits = digits.slice(0, 10);
  return "+91" + digits;
}

function validateCreate(f: FormState): Errors {
  const e: Errors = {};
  const phone = normalizePhone(f.phone);

  if (f.fullName.trim().length < 2) e.fullName = "Full name is required";
  if (!f.email.trim()) e.email = "Email is required";
  if (f.password.length < 8) e.password = "Password must be 8+ characters";

  if (!f.phone.trim()) e.phone = "Phone number is required";
  else if (!phone.startsWith("+91")) e.phone = "Phone number must start with +91";
  else {
    const digitsOnly = phone.replace(/^\+91/, "");
    if (digitsOnly.length !== 10) {
      e.phone = `Phone number must be 10 digits after +91 (current: ${digitsOnly.length} digits)`;
    } else if (!/^\d{10}$/.test(digitsOnly)) {
      e.phone = "Phone number must be 10 digits after +91";
    }
  }

  if (!f.address.trim()) e.address = "Address is required";
  if (!f.sponsorId.trim()) e.sponsorId = "Sponsor ID is required";
  if (!f.leg) e.leg = "Leg is required";
  return e;
}

function validateEdit(f: FormState): Errors {
  const e: Errors = {};
  const phone = normalizePhone(f.phone);
  if (f.fullName.trim().length < 2) e.fullName = "Full name is required";
  if (!f.email.trim()) e.email = "Email is required";
  if (!f.phone.trim()) e.phone = "Phone number is required";
  else if (!phone.startsWith("+91")) e.phone = "Phone number must start with +91";
  else {
    const digitsOnly = phone.replace(/^\+91/, "");
    if (digitsOnly.length !== 10) {
      e.phone = `Phone number must be 10 digits after +91 (current: ${digitsOnly.length} digits)`;
    } else if (!/^\d{10}$/.test(digitsOnly)) {
      e.phone = "Phone number must be 10 digits after +91";
    }
  }
  if (!f.leg) e.leg = "Leg is required";
  return e;
}

const looseEmailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/** Binary-tree slot flow: email/phone optional; server assigns a unique placeholder email if omitted. */
function validateTreeRegister(f: FormState): Errors {
  const e: Errors = {};
  if (f.fullName.trim().length < 2) e.fullName = "Full name is required";
  if (f.email.trim() && !looseEmailOk(f.email)) e.email = "Enter a valid email or leave blank";
  if (f.password.length < 8) e.password = "Password must be 8+ characters";

  const phone = normalizePhone(f.phone);
  const digitsOnly = phone.replace(/^\+91/, "");
  if (digitsOnly.length > 0 && digitsOnly.length !== 10) {
    e.phone = `Phone must be 10 digits after +91 (current: ${digitsOnly.length})`;
  } else if (digitsOnly.length > 0 && !/^\d{10}$/.test(digitsOnly)) {
    e.phone = "Phone must be 10 digits after +91";
  }

  if (!f.address.trim()) e.address = "Address is required";
  if (!f.sponsorId.trim()) e.sponsorId = "Sponsor is required";
  if (!f.leg) e.leg = "Leg is required";
  return e;
}

function extractMemberRecord(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const m = o.member;
  if (m && typeof m === "object") return m as Record<string, unknown>;
  return o;
}

function memberRecordToForm(m: Record<string, unknown>): FormState {
  const legRaw = String(m.leg ?? "LEFT").toUpperCase();
  const leg: Leg = legRaw === "RIGHT" ? "RIGHT" : "LEFT";
  const st = String(m.status ?? "ACTIVE").toUpperCase();
  const status: MemberAccountStatus =
    st === "SUSPENDED" || st === "PENDING" ? (st as MemberAccountStatus) : "ACTIVE";
  const phoneRaw = String(m.phone ?? "+91");
  return {
    fullName: String(m.fullName ?? ""),
    email: String(m.email ?? ""),
    password: "",
    phone: phoneRaw.startsWith("+") ? phoneRaw : normalizePhone(phoneRaw),
    address: String(m.address ?? ""),
    sponsorId: String(m.sponsorId ?? ""),
    leg,
    profileImage: String(m.profileImage ?? ""),
    status,
  };
}

export function CreateMemberModal({
  open,
  onClose,
  editMemberId = null,
  binaryRegister = null,
}: {
  open: boolean;
  onClose: () => void;
  editMemberId?: string | number | null;
  binaryRegister?: BinaryRegisterContext | null;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState(false);
  const isEdit = editMemberId != null;
  const isTreeRegister = Boolean(binaryRegister) && !isEdit;

  const detailQ = useQuery({
    queryKey: ["member", editMemberId],
    queryFn: async () => (await membersApi.get(editMemberId as string | number)).data,
    enabled: open && isEdit,
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => membersApi.uploadProfilePhoto(file),
    onSuccess: (url) => {
      if (url) {
        setForm((prev) => ({ ...prev, profileImage: url }));
        toast.success("Profile image uploaded");
      }
    },
    onError: (err: unknown) => toast.error(parseApiError(err)),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: string | number; payload: Record<string, unknown> }) =>
      membersApi.patch(vars.id, vars.payload),
    onSuccess: async () => {
      toast.success("Member updated");
      await qc.invalidateQueries({ queryKey: ["members"] });
      await qc.invalidateQueries({ queryKey: ["member", editMemberId] });
      await qc.invalidateQueries({ queryKey: ["binary-tree"] });
      onClose();
    },
    onError: (e: unknown) => toast.error(parseApiError(e)),
  });

  const createMut = useMutation({
    mutationFn: (payload: {
      fullName: string;
      email?: string;
      password: string;
      phone?: string;
      address: string;
      sponsorId: string;
      leg: Leg;
      profileImage?: string;
    }) => membersApi.create(payload),
    onSuccess: async (_, vars) => {
      toast.success(`${vars.fullName} added successfully`);
      await qc.invalidateQueries({ queryKey: ["members"] });
      await qc.invalidateQueries({ queryKey: ["binary-tree"] });
      onClose();
    },
    onError: (e: unknown) => toast.error(parseApiError(e)),
  });

  useEffect(() => {
    if (!open) {
      setForm(initialForm);
      setErrors({});
      setShowPassword(false);
      createMut.reset();
      updateMut.reset();
      uploadMut.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset mutations when dialog closes only
  }, [open]);

  useEffect(() => {
    if (!open || isEdit || !binaryRegister) return;
    setForm({
      ...initialForm,
      sponsorId: binaryRegister.sponsorMemberCode.trim(),
      leg: binaryRegister.leg,
      phone: "+91",
    });
    setErrors({});
    setShowPassword(false);
  }, [open, isEdit, binaryRegister?.sponsorMemberCode, binaryRegister?.leg]);

  useEffect(() => {
    if (!open || !isEdit) return;
    const rec = extractMemberRecord(detailQ.data);
    if (rec) setForm(memberRecordToForm(rec));
  }, [open, isEdit, detailQ.data]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const detailLoading = isEdit && (detailQ.isLoading || detailQ.isFetching);
  const detailError = isEdit && detailQ.isError;
  const pending = createMut.isPending || updateMut.isPending || uploadMut.isPending;

  const update = (key: keyof FormState, value: string) => {
    setForm((prev) => {
      if (key === "phone") return { ...prev, phone: normalizePhone(value) };
      return { ...prev, [key]: value };
    });
  };

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    const canon = { ...form, phone: normalizePhone(form.phone) };
    setForm(canon);
    const err = isEdit ? validateEdit(canon) : isTreeRegister ? validateTreeRegister(canon) : validateCreate(canon);
    setErrors(err);
    if (Object.keys(err).length > 0) return;

    if (isEdit && editMemberId != null) {
      updateMut.mutate({
        id: editMemberId,
        payload: {
          full_name: canon.fullName.trim(),
          email: canon.email.trim().toLowerCase(),
          phone: canon.phone.trim(),
          status: canon.status,
          leg: canon.leg,
          profile_image: canon.profileImage.trim() || null,
        },
      });
    } else {
      const digits = canon.phone.replace(/^\+91/, "");
      const phonePayload =
        isTreeRegister && (!digits || digits.length !== 10) ? undefined : canon.phone.trim();

      createMut.mutate({
        fullName: canon.fullName.trim(),
        email: isTreeRegister
          ? canon.email.trim()
            ? canon.email.trim().toLowerCase()
            : undefined
          : canon.email.trim().toLowerCase(),
        password: canon.password,
        phone: phonePayload,
        address: canon.address.trim(),
        sponsorId: canon.sponsorId.trim(),
        leg: canon.leg,
        profileImage: canon.profileImage.trim() || undefined,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-member-title"
        className="select-none rounded-3xl border border-slate-100 bg-white shadow-2xl dark:border-white/5 dark:bg-slate-950 w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-white/5">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
              {isTreeRegister && binaryRegister ? "Binary tree" : "Network"}
            </p>
            <h2 id="create-member-title" className="text-xl font-semibold text-slate-900 dark:text-white">
              {isEdit ? "Edit member" : isTreeRegister ? "Register member" : "Create member"}
            </h2>
            {isEdit && extractMemberRecord(detailQ.data)?.memberId ? (
              <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                {String(extractMemberRecord(detailQ.data)!.memberId)}
              </p>
            ) : null}
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

        {isEdit && detailLoading ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-sm text-slate-500">
            <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading member…
          </div>
        ) : isEdit && detailError ? (
          <div className="space-y-3 px-6 py-10 text-center text-sm text-rose-600">
            <p>Could not load this member.</p>
            <button
              type="button"
              className="font-semibold text-primary underline"
              onClick={() => void detailQ.refetch()}
            >
              Retry
            </button>
          </div>
        ) : (
        <form onSubmit={onSubmit} className="space-y-4 px-6 py-6">
          {isTreeRegister && binaryRegister ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Sponsor
                </label>
                <input
                  type="text"
                  readOnly
                  value={binaryRegister.sponsorLabel}
                  className="w-full cursor-default rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Leg
                </label>
                <input
                  type="text"
                  readOnly
                  value={binaryRegister.leg}
                  className="w-full cursor-default rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-slate-800 outline-none dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
                />
              </div>
            </div>
          ) : null}

          {/* Profile image */}
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white/40 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Profile image</p>
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-xs text-slate-400 dark:border-white/10 dark:bg-white/5">
                  {form.profileImage ? (
                    <img src={form.profileImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    "No image"
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-white dark:hover:border-primary dark:hover:text-primary"
                    disabled={uploadMut.isPending}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploadMut.isPending ? "Uploading…" : "Upload image"}
                  </button>
                  {form.profileImage ? (
                    <button
                      type="button"
                      className="text-left text-xs font-semibold text-rose-500 hover:text-rose-600"
                      onClick={() => update("profileImage", "")}
                    >
                      Remove image
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Image URL
                </label>
                <input
                  type="url"
                  value={form.profileImage}
                  onChange={(e) => update("profileImage", e.target.value)}
                  placeholder="https://example.com/profile.jpg"
                  className="w-full rounded-2xl border border-slate-200 bg-transparent px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:text-white"
                />
              </div>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadMut.mutate(f);
              e.target.value = "";
            }}
          />

          {/* Main grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Full name</label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-transparent px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:text-white"
              />
              {errors.fullName ? <p className="mt-1 text-xs text-rose-500">{errors.fullName}</p> : null}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Email{isTreeRegister ? " (optional)" : ""}
              </label>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-transparent px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:text-white"
              />
              {errors.email ? <p className="mt-1 text-xs text-rose-500">{errors.email}</p> : null}
            </div>
            {!isEdit ? (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-transparent py-2.5 pl-4 pr-12 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:text-white"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v: boolean) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password ? <p className="mt-1 text-xs text-rose-500">{errors.password}</p> : null}
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Account status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, status: e.target.value as MemberAccountStatus }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-transparent px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:text-white"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Phone{isTreeRegister ? " (optional)" : ""}
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+91XXXXXXXXXX"
                maxLength={14}
                className="w-full rounded-2xl border border-slate-200 bg-transparent px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:text-white"
              />
              {errors.phone ? <p className="mt-1 text-xs text-rose-500">{errors.phone}</p> : null}
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Address</label>
              <textarea
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                rows={3}
                placeholder={isTreeRegister ? "Enter full address" : "Enter complete address"}
                readOnly={isEdit}
                disabled={isEdit}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-transparent px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:text-white"
              />
              {isEdit ? (
                <p className="mt-1 text-xs text-slate-400">Address is not editable from the admin form.</p>
              ) : errors.address ? (
                <p className="mt-1 text-xs text-rose-500">{errors.address}</p>
              ) : null}
            </div>
          </div>

          {!isTreeRegister ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Sponsor member ID
                </label>
                <input
                  type="text"
                  value={form.sponsorId}
                  onChange={(e) => update("sponsorId", e.target.value)}
                  placeholder="e.g. MBR-AB12"
                  readOnly={isEdit}
                  disabled={isEdit}
                  className="w-full rounded-2xl border border-slate-200 bg-transparent px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:text-white"
                />
                {!isEdit ? (
                  <>
                    <p className="mt-1 text-xs text-slate-400">Use the Member-ID column from the table (exact code).</p>
                    {errors.sponsorId ? <p className="mt-1 text-xs text-rose-500">{errors.sponsorId}</p> : null}
                  </>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">Sponsor cannot be changed here.</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Leg</label>
                <select
                  value={form.leg}
                  onChange={(e) => update("leg", e.target.value as Leg)}
                  className="w-full rounded-2xl border border-slate-200 bg-transparent px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:text-white"
                >
                  <option value="LEFT">Left</option>
                  <option value="RIGHT">Right</option>
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  {isEdit
                    ? "Binary leg stored on the member record."
                    : "Preferred side for placement. If that side (and the other) are already taken on the sponsor, the next free binary slot is used further down the tree—expand nodes on Binary Tree to find them."}
                </p>
                {errors.leg ? <p className="mt-1 text-xs text-rose-500">{errors.leg}</p> : null}
              </div>
            </div>
          ) : null}

          {createMut.isError || updateMut.isError ? (
            <p className="text-sm text-rose-500">
              {createMut.isError && createMut.error instanceof Error
                ? createMut.error.message
                : updateMut.isError && updateMut.error instanceof Error
                  ? updateMut.error.message
                  : isEdit
                    ? "Unable to update member"
                    : "Unable to create member"}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-2xl px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || (isEdit && (detailLoading || detailError))}
              className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-card disabled:opacity-60"
            >
              {createMut.isPending || updateMut.isPending
                ? isEdit
                  ? "Saving…"
                  : isTreeRegister
                    ? "Registering…"
                    : "Creating…"
                : isEdit
                  ? "Save changes"
                  : isTreeRegister
                    ? "Register member"
                    : "Create member"}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
