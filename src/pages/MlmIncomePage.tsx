import { mlmApi } from "@/api/mlm";
import { LoadingScreen } from "@/components/LoadingScreen";
import { normalizeList } from "@/utils/normalizeList";
import { parseApiError } from "@/utils/parseApiError";
import {
  formatMlmRupee,
  parseMlmIncomeOverview,
} from "@/utils/mlmIncomeParse";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  TrendingUp,
  FileText,
  Network,
  Scale,
  Trophy,
  UserRound,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";

type Tab = "overview" | "transactions" | "matching" | "bv_tree";

const TABS = [
  { id: "overview" as const, label: "Income Overview", Icon: Trophy },
  { id: "transactions" as const, label: "Transactions", Icon: FileText },
  { id: "matching" as const, label: "Matching History", Icon: Scale },
  { id: "bv_tree" as const, label: "BV Tree", Icon: Network },
];

const TH =
  "px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400";

function formatCell(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "—";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 160);
  return String(v);
}

export function MlmIncomePage() {
  const DEFAULT_MEMBER_ID = "ADMIN001";
  const [draftId, setDraftId] = useState(DEFAULT_MEMBER_ID);
  const [memberId, setMemberId] = useState(DEFAULT_MEMBER_ID);
  const [tab, setTab] = useState<Tab>("overview");

  const income = useQuery({
    queryKey: ["mlm", memberId, "income"],
    enabled: Boolean(memberId) && tab === "overview",
    queryFn: async () => (await mlmApi.income(memberId)).data,
  });

  const matching = useQuery({
    queryKey: ["mlm", memberId, "matching"],
    enabled: Boolean(memberId) && tab === "matching",
    queryFn: async () => (await mlmApi.matching(memberId)).data,
  });

  const statistics = useQuery({
    queryKey: ["mlm", memberId, "statistics"],
    enabled: Boolean(memberId) && (tab === "bv_tree" || tab === "overview"),
    queryFn: async () => (await mlmApi.statistics(memberId)).data,
  });

  const transactions = useQuery({
    queryKey: ["mlm", memberId, "transactions"],
    enabled: Boolean(memberId) && tab === "transactions",
    queryFn: async () => (await mlmApi.transactions(memberId)).data,
  });

  const overviewModel = useMemo(
    () => parseMlmIncomeOverview(income.data, statistics.data ?? null, memberId),
    [income.data, statistics.data, memberId],
  );

  const runSearch = () => setMemberId(draftId.trim());

  const bvBarSum = overviewModel.bvBarLeft + overviewModel.bvBarRight;
  const leftPct = bvBarSum > 0 ? (overviewModel.bvBarLeft / bvBarSum) * 100 : 50;

  const tableRows =
    tab === "transactions"
      ? normalizeList(transactions.data ?? null)
      : tab === "matching"
        ? normalizeList(matching.data ?? null)
        : [];

  const columns = useMemo(() => {
    if (tableRows.length === 0) return [] as string[];
    const keys = new Set<string>();
    tableRows.slice(0, 50).forEach((row) =>
      Object.keys(row).forEach((k) => {
        keys.add(k);
      }),
    );
    return [...keys];
  }, [tableRows]);

  const activeFetch =
    tab === "overview"
      ? income
      : tab === "transactions"
        ? transactions
        : tab === "matching"
          ? matching
          : statistics;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-white/5 dark:bg-slate-950 dark:shadow-none sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              MLM Income Dashboard
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Track income, matching history, and BV performance
            </p>
            {memberId ? (
              <p className="mt-3 inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800 dark:bg-violet-500/20 dark:text-violet-300">
                Viewing:{` `}
                <span className="ml-1 font-bold">{overviewModel.viewingId || memberId}</span>
              </p>
            ) : null}
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:items-center lg:max-w-md">
            <input
              value={draftId}
              onChange={(e) => setDraftId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void runSearch()}
              placeholder="Search Member ID..."
              aria-label="Search Member ID"
              autoComplete="off"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
            <button
              type="button"
              onClick={() => void runSearch()}
              className="shrink-0 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="-mx-1 flex gap-2 overflow-x-auto border-b border-slate-100 pb-0 dark:border-white/10">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-2 rounded-t-xl px-4 py-3 text-sm font-semibold transition ${
                active
                  ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${id === "bv_tree" ? "text-emerald-600 dark:text-emerald-400" : ""}`}
              />
              {label}
            </button>
          );
        })}
      </div>

      {!memberId ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-500 dark:border-white/15 dark:bg-slate-950 dark:text-slate-400">
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">No Member Selected</p>
          <p className="mt-2 text-sm">Enter a Member ID above and tap Search.</p>
        </div>
      ) : tab === "overview" ? (
        income.isLoading || statistics.isLoading ? (
          <LoadingScreen message="Loading income overview…" />
        ) : income.isError ? (
          <div className="rounded-2xl border border-rose-200 bg-white p-6 text-rose-600 dark:border-rose-400/40 dark:bg-slate-950">
            Unable to load income: {parseApiError(income.error)}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<Wallet className="h-5 w-5 text-slate-400" />}
                title="Wallet Balance"
                value={formatMlmRupee(overviewModel.walletBalance)}
                sub={`Total Earned: ${formatMlmRupee(overviewModel.totalEarned)}`}
              />
              <StatCard
                icon={<TrendingUp className="h-5 w-5 text-slate-400" />}
                title="Weekly Income"
                value={formatMlmRupee(overviewModel.weeklyIncome)}
                sub={`Cap Remaining: ${formatMlmRupee(overviewModel.weeklyCapRemaining)}`}
              />
              <StatCard
                icon={<TrendingUp className="h-5 w-5 text-slate-400" />}
                title="This Month"
                value={formatMlmRupee(overviewModel.monthIncome)}
                sub={`${overviewModel.monthTxCount} transaction${overviewModel.monthTxCount === 1 ? "" : "s"}`}
              />
              <StatCard
                icon={<UserRound className="h-5 w-5 text-slate-400" />}
                title="Direct Referrals"
                value={String(overviewModel.directReferrals)}
                sub={
                  overviewModel.referralsNeedMore > 0
                    ? `Need ${overviewModel.referralsNeedMore} more`
                    : "Target reached"
                }
              />
            </div>

            <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-slate-950">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Income Breakdown</h2>
              <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <BreakdownCell label="Self Purchase Income" value={formatMlmRupee(overviewModel.selfPurchase)} />
                <BreakdownCell label="Sponsor Income" value={formatMlmRupee(overviewModel.sponsor)} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Matching Income</p>
                  <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                    {formatMlmRupee(overviewModel.matching)}
                  </p>
                  {overviewModel.matchingCount > 0 ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {overviewModel.matchingCount} matches
                    </p>
                  ) : null}
                </div>
                <BreakdownCell label="Reward Income" value={formatMlmRupee(overviewModel.reward)} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-slate-950">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Business Volume (BV) Summary
              </h2>
              <div className="mt-6 grid gap-8 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Total BV</p>
                  <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                    {overviewModel.bvTotal.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Left Leg BV</p>
                  <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                    {overviewModel.bvLeft.toLocaleString("en-IN")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Carry Forward: {overviewModel.bvLeftCf.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    Right Leg BV
                  </p>
                  <p className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {overviewModel.bvRight.toLocaleString("en-IN")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Carry Forward: {overviewModel.bvRightCf.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
              <div className="mt-8 flex flex-col gap-2 border-t border-slate-100 pt-6 lg:flex-row lg:items-start lg:justify-between dark:border-white/10">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Total Matched BV</p>
                  <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                    {overviewModel.bvMatched.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="text-left lg:text-right">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Next Match Ratio</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{overviewModel.nextRatio}</p>
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  BV Balance Visualization
                </p>
                <div className="flex h-11 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                  <div
                    style={{ width: `${bvBarSum > 0 ? leftPct : 50}%` }}
                    className="flex min-w-0 shrink-0 items-center justify-center bg-sky-200 text-xs font-bold text-sky-950 dark:bg-sky-500/35 dark:text-sky-100"
                  >
                    Left:{` `}
                    {overviewModel.bvBarLeft.toLocaleString("en-IN")}
                  </div>
                  <div
                    style={{ width: `${bvBarSum > 0 ? 100 - leftPct : 50}%` }}
                    className="flex min-w-0 shrink-0 items-center justify-center bg-emerald-400 text-xs font-bold text-emerald-950 dark:bg-emerald-500 dark:text-emerald-950"
                  >
                    Right:{` `}
                    {overviewModel.bvBarRight.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  overviewModel.activeMember
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                    : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {overviewModel.activeMember ? "✓ Active Member" : "Inactive Member"}
              </span>
            </div>
          </div>
        )
      ) : activeFetch.isLoading ? (
        <LoadingScreen message="Loading…" />
      ) : activeFetch.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-rose-600 dark:bg-slate-950">
          {parseApiError(activeFetch.error)}
        </div>
      ) : tab === "bv_tree" ? (
        <BvTreePanel data={statistics.data} />
      ) : (
        <TablePanel rows={tableRows} columns={columns} />
      )}
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  sub,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">{title}</p>
        <div className="shrink-0 rounded-lg bg-slate-50 p-2 dark:bg-slate-900">{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
    </div>
  );
}

function BreakdownCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function TablePanel({
  rows,
  columns,
}: {
  rows: Record<string, unknown>[];
  columns: string[];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-slate-500 dark:border-white/5 dark:bg-slate-950">
        No records for this member.
      </div>
    );
  }
  const showCols = columns.filter((c) => c !== "id" && c !== "_id").slice(0, 10);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/5 dark:bg-slate-950">
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 dark:border-white/5 dark:bg-white/[0.03]">
              {showCols.map((c) => (
                <th key={c} className={TH}>
                  {c.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-slate-100 hover:bg-slate-50/50 dark:border-white/5 dark:hover:bg-white/[0.02]"
              >
                {showCols.map((c) => (
                  <td key={c} className="max-w-[220px] truncate px-4 py-3 text-slate-800 dark:text-slate-200 sm:px-5">
                    {formatCell(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BvTreePanel({ data }: { data: unknown }) {
  const rows = normalizeList(data ?? null);
  if (rows.length > 0) return <TablePanel rows={rows} columns={[...new Set(rows.flatMap((r) => Object.keys(r)))]} />;

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    const kv = Object.entries(o).flatMap(([k, v]): [string, unknown][] =>
      typeof v !== "object" || v === null || Array.isArray(v) ? [[k, v]] : [],
    );
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-6 dark:border-white/5 dark:bg-slate-950">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kv.length ? (
            kv.map(([key, val]) => (
              <div key={key}>
                <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {key.replace(/_/g, " ")}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{formatCell(val)}</dd>
              </div>
            ))
          ) : (
            <div className="col-span-full text-sm text-slate-500">No BV tree data to display.</div>
          )}
        </dl>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-slate-500 dark:border-white/5 dark:bg-slate-950">
      No BV tree data.
    </div>
  );
}
