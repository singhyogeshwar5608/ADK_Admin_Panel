import { dashboardApi } from "@/api/dashboard";
import { fetchSettingsPayload, saveSimulationSettings, simulationDefaultsFromSettings } from "@/api/dashboardSettings";
import { StatCard } from "@/components/dashboard/StatCard";
import { LoadingScreen } from "@/components/LoadingScreen";
import type { DashboardReport } from "@/types/dashboard";
import {
  computeIncomePreview,
  type SimulationFormState,
} from "@/utils/dashboardMath";
import { parseApiError } from "@/utils/parseApiError";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Award,
  Clock,
  Crown,
  DollarSign,
  RefreshCcw,
  ShoppingBag,
  Split,
  TrendingUp,
  Trophy,
  UserCheck,
  UserX,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const SIM_FIELDS: { label: string; field: keyof SimulationFormState; placeholder: string }[] = [
  { label: "Joining Amount (₹)", field: "joiningAmount", placeholder: "10000" },
  { label: "Business Volume (BV)", field: "businessVolume", placeholder: "5000" },
  { label: "Self Purchase Income %", field: "selfIncome", placeholder: "10" },
  { label: "Direct Sponsor Income %", field: "directIncome", placeholder: "20" },
  { label: "Matching Income %", field: "matchingIncome", placeholder: "10" },
  { label: "Self Repurchase Income %", field: "selfRepurchaseIncome", placeholder: "10" },
  { label: "Repurchase Matching Income %", field: "repurchaseMatchingIncome", placeholder: "10" },
  { label: "Repurchase Kit Award Income %", field: "awardIncome", placeholder: "20" },
];

const defaultSim: SimulationFormState = {
  joiningAmount: "10000",
  businessVolume: "5000",
  selfIncome: "10",
  directIncome: "20",
  matchingIncome: "10",
  selfRepurchaseIncome: "10",
  repurchaseMatchingIncome: "10",
  awardIncome: "20",
  repurchaseAmount: "10000",
  repurchaseBv: "2000",
  weeklyCapping: "50000",
};

export function DashboardPage() {
  const qc = useQueryClient();
  const [sim, setSim] = useState<SimulationFormState>(defaultSim);
  const [userId, setUserId] = useState("");
  const [simSettingsLoading, setSimSettingsLoading] = useState(true);
  const [demoJoin, setDemoJoin] = useState("10");
  const [demoRep, setDemoRep] = useState("0");
  const [includeReward, setIncludeReward] = useState(false);
  const [leftCf, setLeftCf] = useState("");
  const [rightCf, setRightCf] = useState("");

  const reportQuery = useQuery({
    queryKey: ["reports", "dashboard"],
    queryFn: async () => (await dashboardApi.reports()).data as DashboardReport,
    staleTime: 0,
  });

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettingsPayload,
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    try {
      setSim(simulationDefaultsFromSettings(settingsQuery.data));
    } catch (e) {
      console.error(e);
      toast.error("Failed to load simulation settings");
    } finally {
      setSimSettingsLoading(false);
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    if (settingsQuery.isError) {
      setSimSettingsLoading(false);
      toast.error("Failed to load simulation settings");
    }
  }, [settingsQuery.isError]);

  const preview = useMemo(
    () =>
      computeIncomePreview({
        sim,
        demoJoinMembers: demoJoin,
        demoRepurchaseCount: demoRep,
        includeRewardOnJoining: includeReward,
        leftCarryBv: leftCf,
        rightCarryBv: rightCf,
      }),
    [sim, demoJoin, demoRep, includeReward, leftCf, rightCf],
  );

  const saveMutation = useMutation({
    mutationFn: saveSimulationSettings,
    onSuccess: async () => {
      toast.success("Simulation settings saved to database");
      await qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err: unknown) => {
      toast.error(parseApiError(err));
    },
  });

  const onSimField = (field: keyof SimulationFormState, raw: string) => {
    const digits = raw.replace(/[^0-9]/g, "");
    setSim((s) => ({ ...s, [field]: digits }));
  };

  const onSaveSimulation = () => {
    saveMutation.mutate({
      joiningAmount: Number(sim.joiningAmount),
      businessVolume: Number(sim.businessVolume),
      selfIncome: Number(sim.selfIncome),
      directIncome: Number(sim.directIncome),
      matchingIncome: Number(sim.matchingIncome),
      selfRepurchaseIncome: Number(sim.selfRepurchaseIncome),
      repurchaseMatchingIncome: Number(sim.repurchaseMatchingIncome),
      awardIncome: Number(sim.awardIncome),
    });
  };

  const opToast = (kind: "repurchase" | "previous" | "next" | "process" | "reset") => {
    const map = {
      repurchase: "Repurchase processed",
      previous: "Moved to previous cycle",
      next: "Moved to next cycle",
      process: "Current cycle processed",
      reset: "Demo data reset",
    } as const;
    toast.info(map[kind]);
  };

  if (reportQuery.isLoading || !reportQuery.data) {
    return <LoadingScreen message="Loading dashboard…" />;
  }

  if (reportQuery.isError) {
    return <p className="text-rose-600">Failed to load dashboard.</p>;
  }

  const { totals: M, topMembers: rawTop } = reportQuery.data;
  const topList = rawTop ?? [];

  const $ = (n: number | undefined | null, d = 0) => Number.isFinite(n) ? n! : d;
  const fmt = (n: number | undefined | null) =>
    `₹${$(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalSales = $(M.totalSales);

  const inactive = M.inactiveMembers ?? Math.max(0, $(M.totalMembers) - $(M.activeMembers));
  const pending = M.pendingMembers ?? 0;
  const selfPurchaseIncome = $(M.selfPurchaseIncome);
  const sponsorIncome = $(M.sponsorIncome);
  const matchingIncome = $(M.matchingIncome);
  const selfRepurchase = $(M.selfRepurchase);
  const repurchaseMatching = $(M.repurchaseMatching);
  const repurchaseAwards = $(M.repurchaseAwards);
  const tourRewards = $(M.tourRewards);
  const royalty = $(M.royalty);
  const totalIncome = $(M.totalIncome);

  const statCards = [
    { title: "Total Members", value: $(M.totalMembers).toLocaleString(), subtitle: `${$(M.activeMembers)} active`, icon: Users },
    { title: "Inactive", value: inactive.toLocaleString(), subtitle: "Non-active members", icon: UserX },
    { title: "Active Users", value: $(M.activeMembers).toLocaleString(), subtitle: "Verified & active", icon: UserCheck },
    { title: "Pending", value: pending.toLocaleString(), subtitle: "Awaiting approval", icon: Clock },
    { title: "Total Sales", value: fmt(totalSales), subtitle: "Revenue last 30 days", icon: TrendingUp },
    { title: "Total BV", value: `${$(M.totalBv).toLocaleString()} BV`, subtitle: "30-day volume", icon: Activity },
    { title: "Orders Today", value: $(M.todaysOrders).toString(), subtitle: `${$(M.totalOrders)} lifetime`, icon: ShoppingBag },
    { title: "Self Purchase Income", value: fmt(selfPurchaseIncome), subtitle: "Self purchase earnings", icon: DollarSign },
    { title: "Sponsor Income", value: fmt(sponsorIncome), subtitle: "Direct sponsor earnings", icon: UserCheck },
    { title: "Matching Income", value: fmt(matchingIncome), subtitle: "Binary matching earnings", icon: Split },
    { title: "Self Re Purchase", value: fmt(selfRepurchase), subtitle: "Repurchase self earnings", icon: RefreshCcw },
    { title: "Repurchase Matching", value: fmt(repurchaseMatching), subtitle: "Repurchase matching earnings", icon: Split },
    { title: "Repurchase Awards", value: fmt(repurchaseAwards), subtitle: "Repurchase award earnings", icon: Award },
    { title: "Tour Rewards", value: fmt(tourRewards), subtitle: "Tour reward earnings", icon: Trophy },
    { title: "Royalty Income", value: fmt(royalty), subtitle: "Royalty earnings", icon: Crown },
    { title: "Total Income", value: fmt(totalIncome), subtitle: "All income combined", icon: Wallet },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h2>
        <button
          type="button"
          onClick={() => qc.invalidateQueries({ queryKey: ["reports", "dashboard"] })}
          disabled={reportQuery.isFetching}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:hover:bg-white/10"
        >
          <RefreshCcw className={`h-4 w-4 ${reportQuery.isFetching ? "animate-spin" : ""}`} />
          {reportQuery.isFetching ? "Refreshing…" : "Refresh Data"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5">
        {statCards.map((c) => (
          <StatCard key={c.title} {...c} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Strategy Lab */}
        <div className="xl:col-span-2 rounded-3xl border border-slate-100 bg-slate-900 text-white shadow-card dark:border-white/10">
          <div className="border-b border-white/10 px-6 py-4">
            <p className="text-xs uppercase tracking-[0.4em] text-primary/80">Strategy Lab</p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xl font-semibold">Simulation Controls</h3>
              <p className="text-sm text-slate-300">Adjust all business plan parameters dynamically.</p>
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SIM_FIELDS.map((row) => (
                <label key={row.field} className="text-sm font-semibold text-slate-200">
                  {row.label}
                  <input
                    type="text"
                    inputMode="numeric"
                    value={sim[row.field]}
                    onChange={(e) => onSimField(row.field, e.target.value)}
                    placeholder={row.placeholder}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-800/70 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={onSaveSimulation}
                disabled={saveMutation.isPending || simSettingsLoading}
                className="rounded-2xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saveMutation.isPending ? "Saving…" : "Update Settings"}
              </button>
            </div>
          </div>
        </div>

        {/* Operations */}
        <div className="rounded-3xl border border-slate-100 bg-white shadow-card dark:border-white/10 dark:bg-slate-950">
          <div className="border-b border-slate-100 px-6 py-4 dark:border-white/5">
            <p className="text-xs uppercase tracking-[0.4em] text-primary">Operations</p>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Cycle &amp; Transaction Controls</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Process repurchases and manage cycle progression.</p>
          </div>
          <div className="space-y-4 px-6 py-6">
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-200">
              User ID
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="MBR-001"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </label>
            <button
              type="button"
              onClick={() => opToast("repurchase")}
              className="w-full rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-card"
            >
              Repurchase
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => opToast("previous")}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
              >
                ← Previous Cycle
              </button>
              <button
                type="button"
                onClick={() => opToast("next")}
                className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-emerald-400"
              >
                Next Cycle →
              </button>
            </div>
            <button
              type="button"
              onClick={() => opToast("process")}
              className="w-full rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-indigo-500"
            >
              Process Current Cycle
            </button>
            <button
              type="button"
              onClick={() => opToast("reset")}
              className="w-full rounded-2xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:border-rose-400/50 dark:text-rose-300 dark:hover:bg-rose-400/10"
            >
              Reset Demo Data
            </button>
          </div>
        </div>
      </div>

      {/* Income preview */}
      <div className="rounded-3xl border border-slate-100 bg-slate-900 text-white shadow-card dark:border-white/10">
        <div className="border-b border-white/10 px-6 py-4">
          <p className="text-xs uppercase tracking-[0.4em] text-primary/80">Income preview</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xl font-semibold">Dummy income calculator</h3>
            <p className="max-w-xl text-sm text-slate-300">
              Same percentage rules as Simulation Controls and the live MLM engine (self, direct, matching 1:1
              ratio, repurchase self and sponsor award, optional reward). Totals ignore weekly capping ( ₹
              {preview.weeklyCap.toLocaleString()} cap per member per week in production). Matching at one node is
              illustrative — real matching depends on your binary tree.
            </p>
          </div>
        </div>
        <div className="space-y-6 px-6 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-semibold text-slate-200">
              Demo new members (joining)
              <input
                type="text"
                inputMode="numeric"
                value={demoJoin}
                onChange={(e) => setDemoJoin(e.target.value.replace(/[^0-9]/g, ""))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-800/70 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <span className="mt-1 block text-xs font-normal text-slate-400">
                Each active join uses BV from &quot;Business Volume (BV)&quot; above ({Number(sim.businessVolume).toLocaleString()}{" "}
                BV).
              </span>
            </label>
            <label className="text-sm font-semibold text-slate-200">
              Demo repurchase count
              <input
                type="text"
                inputMode="numeric"
                value={demoRep}
                onChange={(e) => setDemoRep(e.target.value.replace(/[^0-9]/g, ""))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-800/70 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <span className="mt-1 block text-xs font-normal text-slate-400">
                BV per repurchase from settings: {Number(sim.repurchaseBv).toLocaleString()} BV.
              </span>
            </label>
            <label className="flex cursor-pointer items-end gap-3 pb-2 text-sm font-semibold text-slate-200 sm:col-span-2">
              <input
                type="checkbox"
                checked={includeReward}
                onChange={(e) => setIncludeReward(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-slate-800 accent-primary"
              />
              <span>
                Include reward / kit award % on joining (assumes member is reward-eligible, e.g. 25+ direct referrals in
                production)
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-800/40 p-4">
              <h4 className="text-sm font-semibold text-white">Joining purchases (aggregate)</h4>
              <dl className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between gap-4 text-slate-300">
                  <dt>Total BV from joins</dt>
                  <dd className="font-mono text-white">{preview.totalJoinBv.toLocaleString()} BV</dd>
                </div>
                <div className="flex justify-between gap-4 text-slate-300">
                  <dt>Self purchase income ({sim.selfIncome}%)</dt>
                  <dd className="font-mono text-white">₹{Math.round(preview.totalSelfJoin).toLocaleString()}</dd>
                </div>
                <div className="flex justify-between gap-4 text-slate-300">
                  <dt>Direct sponsor income ({sim.directIncome}%)</dt>
                  <dd className="font-mono text-white">
                    ₹{Math.round(preview.totalDirectJoin).toLocaleString()}
                    <span className="mt-0.5 block font-sans text-xs text-slate-500">
                      ({preview.joinN} members → {Math.max(0, preview.joinN - 1)} sponsored joins)
                    </span>
                  </dd>
                </div>
                {includeReward ? (
                  <div className="flex justify-between gap-4 text-slate-300">
                    <dt>Reward income ({sim.awardIncome}%)</dt>
                    <dd className="font-mono text-white">₹{Math.round(preview.totalRewardJoin).toLocaleString()}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-800/40 p-4">
              <h4 className="text-sm font-semibold text-white">Repurchase (aggregate)</h4>
              <dl className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between gap-4 text-slate-300">
                  <dt>Total repurchase BV</dt>
                  <dd className="font-mono text-white">{preview.totalRepBv.toLocaleString()} BV</dd>
                </div>
                <div className="flex justify-between gap-4 text-slate-300">
                  <dt>Repurchase self ({sim.selfRepurchaseIncome}%)</dt>
                  <dd className="font-mono text-white">₹{Math.round(preview.totalSelfRepurchase).toLocaleString()}</dd>
                </div>
                <div className="flex justify-between gap-4 text-slate-300">
                  <dt>Sponsor award from repurchase ({sim.awardIncome}%)</dt>
                  <dd className="font-mono text-white">
                    ₹{Math.round(preview.totalSponsorAwardRepurchase).toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-800/40 p-4">
            <h4 className="text-sm font-semibold text-white">Binary matching at one node (1:1 ratio)</h4>
            <p className="text-xs text-slate-400">
              Leave fields empty to assume all joining BV is balanced under one parent (left = right = half of total
              join BV). Real trees split volume across many legs.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-200">
                Left carry-forward BV (optional)
                <input
                  type="text"
                  inputMode="decimal"
                  value={leftCf}
                  onChange={(e) => setLeftCf(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder={preview.autoLeft ? String(Math.round(preview.autoLeft)) : "0"}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-800/70 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
              <label className="text-sm font-semibold text-slate-200">
                Right carry-forward BV (optional)
                <input
                  type="text"
                  inputMode="decimal"
                  value={rightCf}
                  onChange={(e) => setRightCf(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder={preview.autoRight ? String(Math.round(preview.autoRight)) : "0"}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-800/70 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
            </div>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-4 rounded-xl bg-slate-900/50 px-3 py-2 text-slate-300">
                <dt>Matched BV (1:1 match)</dt>
                <dd className="font-mono text-white">
                  {preview.firstMatchBv > 0
                    ? `${preview.firstMatchBv.toLocaleString(undefined, { maximumFractionDigits: 2 })} BV`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 rounded-xl bg-slate-900/50 px-3 py-2 text-slate-300">
                <dt>Matching income if joining BV ({(preview.matchingPct * 100).toFixed(0)}%)</dt>
                <dd className="font-mono text-white">
                  {preview.firstMatchBv > 0 ? `₹${Math.round(preview.firstMatchIncomeJoin).toLocaleString()}` : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 rounded-xl bg-slate-900/50 px-3 py-2 text-slate-300 sm:col-span-2">
                <dt>Matching income if repurchase BV ({(preview.repMatchingPct * 100).toFixed(0)}%)</dt>
                <dd className="font-mono text-white">
                  {preview.firstMatchBv > 0 ? `₹${Math.round(preview.firstMatchIncomeRep).toLocaleString()}` : "—"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-semibold text-white">
                Estimated payout (join + repurchase rows, excluding binary matching)
              </span>
              <span className="text-lg font-bold text-primary">
                ₹{Math.round(preview.grandTotalIncome).toLocaleString()}
              </span>
            </div>
            {preview.firstMatchBv > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-2 text-slate-300">
                <span>Plus one illustrative 1:1 match at the demo node (join matching %)</span>
                <span className="font-mono text-white">
                  ₹{Math.round(preview.grandWithIllustrativeMatch).toLocaleString()} combined
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-3xl border border-slate-100 bg-white p-6 shadow-card dark:border-white/5 dark:bg-slate-950">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Revenue Analytics</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">30-day sales vs BV trend</p>
            </div>
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline"
              onClick={() => toast.info("CSV export will be available when the chart API is connected.")}
            >
              Download CSV
            </button>
          </div>
          <div className="flex h-72 items-center justify-center text-slate-400">Chart coming soon</div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-card dark:border-white/5 dark:bg-slate-950">
          <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Top Performers</h3>
          <div className="space-y-4">
            {topList.map((m) => (
              <div
                key={m.memberId}
                className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3 dark:border-white/5"
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{m.fullName}</p>
                  <p className="text-xs text-slate-400">{m.memberId}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-primary">BV {m.bv?.total?.toLocaleString() ?? 0}</p>
                  <p className="text-xs text-slate-400">Team: {m.stats?.teamSize ?? 0}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
