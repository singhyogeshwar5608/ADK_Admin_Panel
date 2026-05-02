import { settingsApi } from "@/api/settings";
import { LoadingScreen } from "@/components/LoadingScreen";
import { parseApiError } from "@/utils/parseApiError";
import { formatPrimitiveForDraft, unwrapSettingValue } from "@/utils/settingsValue";
import {
  AlertCircle,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  Save,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type RawSettings = Record<string, { value?: unknown; updated_at?: string; updatedAt?: string }>;

export function SettingsPage() {
  const [settings, setSettings] = useState<RawSettings>({});
  const [draftStrings, setDraftStrings] = useState<Record<string, string>>({});
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await settingsApi.get();
      const map = (data as { settings?: RawSettings }).settings ?? {};
      setSettings(map);

      const nextDraft: Record<string, string> = {};
      if (map.razorpay_key_id) {
        nextDraft.razorpay_key_id = formatPrimitiveForDraft(unwrapSettingValue(map.razorpay_key_id));
      }
      if (map.razorpay_key_secret) {
        const rawSec = unwrapSettingValue(map.razorpay_key_secret);
        nextDraft.razorpay_key_secret =
          typeof rawSec === "string"
            ? /^\*{3,}$/.test(rawSec)
              ? ""
              : rawSec
            : formatPrimitiveForDraft(rawSec);
      }
      setDraftStrings(nextDraft);
      setShowSecret(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const lastUpdatedDisplay = useMemo(() => {
    let bestTs = 0;
    let bestStr = "";
    for (const entry of Object.values(settings)) {
      const raw =
        typeof entry.updated_at === "string"
          ? entry.updated_at
          : typeof entry.updatedAt === "string"
            ? entry.updatedAt
            : undefined;
      if (!raw) continue;
      const ms = Date.parse(raw);
      if (Number.isFinite(ms) && ms >= bestTs) {
        bestTs = ms;
        bestStr = raw;
      }
    }
    if (!bestStr) return "Never";
    try {
      return new Date(bestStr).toLocaleString();
    } catch {
      return bestStr;
    }
  }, [settings]);

  const unwrappedSecret = unwrapSettingValue(settings.razorpay_key_secret);
  const hasStoredRazorpaySecret =
    unwrappedSecret !== null &&
    unwrappedSecret !== undefined &&
    (typeof unwrappedSecret !== "string" || unwrappedSecret.trim().length > 0);

  const razorpaySecretPlaceholder =
    !showSecret && hasStoredRazorpaySecret && !(draftStrings.razorpay_key_secret ?? "").trim()
      ? "••••••••••••"
      : "Enter your Razorpay Key Secret";

  const onSave = async () => {
    const entries: { key: string; value: unknown }[] = [];

    try {
      if (draftStrings.razorpay_key_id !== undefined || settings.razorpay_key_id) {
        const v = (draftStrings.razorpay_key_id ?? "").trim();
        if (v) entries.push({ key: "razorpay_key_id", value: v });
      }
      const secTrim = (draftStrings.razorpay_key_secret ?? "").trim();
      if (secTrim) entries.push({ key: "razorpay_key_secret", value: secTrim });

      if (entries.length === 0) {
        toast.warning("Please enter at least one setting value");
        return;
      }

      setSaving(true);
      await settingsApi.put({ settings: entries });
      toast.success("Settings updated successfully!");
      await load();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = (key: string, value: string) => {
    setDraftStrings((d) => ({ ...d, [key]: value }));
  };

  if (loading) return <LoadingScreen message="Loading settings…" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Settings
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Manage your application settings and configurations
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving}
          className="flex shrink-0 items-center gap-2 self-start rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {saving ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" aria-hidden />
              Save Changes
            </>
          )}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <CreditCard className="h-5 w-5 text-slate-700 dark:text-slate-200" aria-hidden />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Payment Gateway Settings
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-white/10 dark:text-slate-300">
              Razorpay
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Configure Razorpay payment gateway credentials for processing payments
          </p>
        </div>
        <div className="space-y-6 px-6 py-6">
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-400/35 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p>
              These credentials are sensitive and will be encrypted. Never share them publicly.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="razorpay_key_id"
                className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
                Razorpay Key ID
              </label>
              <input
                id="razorpay_key_id"
                type="text"
                placeholder="rzp_live_XXXXXXXXXXXXXXXX"
                value={draftStrings.razorpay_key_id ?? ""}
                onChange={(e) => updateDraft("razorpay_key_id", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your Razorpay Key ID (starts with rzp_)
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="razorpay_key_secret"
                className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
                Razorpay Key Secret
              </label>
              <div className="relative">
                <input
                  id="razorpay_key_secret"
                  type={showSecret ? "text" : "password"}
                  placeholder={razorpaySecretPlaceholder}
                  autoComplete="off"
                  value={draftStrings.razorpay_key_secret ?? ""}
                  onChange={(e) => updateDraft("razorpay_key_secret", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-3 pr-11 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  aria-label={showSecret ? "Hide secret" : "Show secret"}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                  onClick={() => {
                    setShowSecret((v) => {
                      const next = !v;
                      if (next) {
                        const raw = unwrapSettingValue(settings.razorpay_key_secret);
                        if (
                          typeof raw === "string" &&
                          raw.trim().length > 0 &&
                          !/^\*{6,}$/.test(raw) &&
                          !(draftStrings.razorpay_key_secret ?? "").trim()
                        ) {
                          setDraftStrings((d) => ({ ...d, razorpay_key_secret: raw }));
                        }
                      }
                      return next;
                    });
                  }}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your Razorpay Key Secret (keep this secure)
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-white/10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            System Information
          </h2>
        </div>
        <div className="space-y-3 px-6 py-5 text-sm">
          <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-3 dark:border-white/10">
            <span className="font-medium text-slate-600 dark:text-slate-400">Last Updated:</span>
            <span className="text-slate-900 dark:text-white">{lastUpdatedDisplay}</span>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <span className="font-medium text-slate-600 dark:text-slate-400">
              Configured Settings:
            </span>
            <span className="text-slate-900 dark:text-white">
              {Object.keys(settings).length} settings
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
