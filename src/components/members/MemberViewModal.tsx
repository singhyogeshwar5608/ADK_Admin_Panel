import { mlmApi } from "@/api/mlm";
import type { MemberListRow } from "@/types/memberList";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useId, type ReactNode } from "react";

function formatNum(n: unknown): string {
  const num = typeof n === "string" ? parseFloat(n) : (n as number);
  if (typeof num !== "number" || !Number.isFinite(num)) return "—";
  return num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

interface IncomeStats {
  self: number;
  sponsor: number;
  matching: number;
  reward: number;
}

interface StatisticsResponse {
  total_income?: IncomeStats;
  [key: string]: unknown;
}

const INCOME_LABELS: { key: keyof IncomeStats; label: string }[] = [
  { key: "self", label: "Self Income" },
  { key: "sponsor", label: "Sponsor Income" },
  { key: "matching", label: "Matching Income" },
  { key: "reward", label: "Reward Income" },
];

function formatDate(iso?: string): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DetailTile({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/90 px-2 py-1.5 sm:rounded-xl sm:px-3 sm:py-2.5 dark:border-white/10 dark:bg-slate-900/40">
      <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-500 sm:text-[10px] dark:text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 break-words text-[11px] font-semibold leading-tight text-slate-900 sm:mt-1 sm:text-sm sm:leading-snug dark:text-white">
        {value}
      </p>
    </div>
  );
}

const COLORS: [string, string][] = [
  ["border-blue-500", "bg-blue-50/40"],
  ["border-purple-500", "bg-purple-50/40"],
  ["border-emerald-500", "bg-emerald-50/40"],
  ["border-orange-500", "bg-orange-50/40"],
  ["border-pink-500", "bg-pink-50/40"],
  ["border-cyan-500", "bg-cyan-50/40"],
  ["border-indigo-500", "bg-indigo-50/40"],
  ["border-amber-500", "bg-amber-50/40"],
  ["border-teal-500", "bg-teal-50/40"],
  ["border-rose-500", "bg-rose-50/40"],
  ["border-violet-500", "bg-violet-50/40"],
  ["border-lime-500", "bg-lime-50/40"],
  ["border-sky-500", "bg-sky-50/40"],
];

/** `cols=3`: two columns on phone, three from `sm`. `cols=2`: two columns everywhere (shorter scroll on mobile). */
function DetailGrid({ cols, children, colorIdx = 0 }: { cols: 2 | 3; children: ReactNode; colorIdx?: number }) {
  const [border, bg] = COLORS[colorIdx % COLORS.length];
  const grid =
    cols === 3
      ? "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3"
      : "grid grid-cols-2 gap-2 sm:gap-3 sm:gap-x-4";
  return (
    <div className={`rounded-lg border-l-4 p-2 sm:rounded-xl sm:p-3 ${border} ${bg} dark:bg-opacity-10`}>
      <div className={grid}>{children}</div>
    </div>
  );
}

export function MemberViewModal({
  open,
  member,
  onClose,
  isLoading = false,
}: {
  open: boolean;
  member: MemberListRow | null;
  onClose: () => void;
  isLoading?: boolean;
}) {
  const titleId = useId();

  const incomeStatsQuery = useQuery({
    queryKey: ["member-income-stats", member?.memberId],
    queryFn: async () => {
      if (!member?.memberId) throw new Error("No memberId");
      const res = await mlmApi.statistics(member.memberId);
      return res.data as StatisticsResponse;
    },
    enabled: open && !!member?.memberId,
    staleTime: 30_000,
  });

  if (!open) return null;

  const leftTeam = member?.stats?.leftTeam ?? 0;
  const rightTeam = member?.stats?.rightTeam ?? 0;

  const incomeTotal = incomeStatsQuery.data?.total_income;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(88dvh,92svh)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl dark:border-white/10 dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-3 py-2.5 sm:px-5 sm:py-4 dark:border-white/10">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-slate-400 sm:text-[11px] sm:tracking-[0.35em]">
              Network
            </p>
            <h2 id={titleId} className="mt-0.5 text-base font-bold text-slate-900 sm:mt-1 sm:text-lg dark:text-white">
              {isLoading ? "Loading details..." : "Member details"}
            </h2>
          </div>
          <button
            type="button"
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 sm:p-2 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 sm:px-5 sm:py-4">
          {isLoading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm font-medium">Fetching complete member profile...</p>
            </div>
          ) : !member ? (
            <div className="flex h-40 items-center justify-center text-slate-500">
              <p>No member data found.</p>
            </div>
          ) : (
            <>
              {member.profileImage ? (
                <div className="mb-2 flex justify-center sm:mb-4">
                  <div className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50 dark:border-white/10 dark:bg-slate-900 sm:rounded-2xl">
                    <img src={member.profileImage} alt="" className="h-16 w-16 object-cover sm:h-32 sm:w-32" />
                  </div>
                </div>
              ) : null}

              {/* Type badge */}
              {member.type ? (
                <div
                  className={`mb-3 flex items-center gap-3 rounded-xl border-l-4 px-4 py-3 sm:mb-4 sm:px-5 sm:py-4 ${
                    member.type === "LEADER"
                      ? "border-amber-500 bg-gradient-to-r from-amber-50 to-amber-100/60 dark:from-amber-950/30 dark:to-amber-900/20"
                      : "border-slate-400 bg-gradient-to-r from-slate-50 to-slate-100/60 dark:from-slate-900/30 dark:to-slate-800/20"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold sm:h-10 sm:w-10 sm:text-sm ${
                      member.type === "LEADER"
                        ? "bg-amber-500 text-white"
                        : "bg-slate-400 text-white"
                    }`}
                  >
                    {member.type === "LEADER" ? "L" : "U"}
                  </span>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-bold tracking-wide sm:text-base ${
                        member.type === "LEADER" ? "text-amber-700 dark:text-amber-400" : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {member.type === "LEADER" ? "LEADER" : "USER"}
                    </p>
                    <p className="text-[10px] text-slate-500 sm:text-xs dark:text-slate-400">
                      {member.type === "LEADER"
                        ? "This person is a leader in the organization"
                        : "This person is a regular user"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider sm:px-4 sm:text-xs ${
                      member.type === "LEADER"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-slate-300/50 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                    }`}
                  >
                    {member.type === "LEADER" ? "Leader" : "User"}
                  </span>
                </div>
              ) : null}

              {/* Status badge */}
              {member.status ? (
                <div
                  className={`mb-3 flex items-center gap-3 rounded-xl border-l-4 px-4 py-3 sm:mb-4 sm:px-5 sm:py-4 ${
                    member.status === "ACTIVE"
                      ? "border-emerald-500 bg-gradient-to-r from-emerald-50 to-emerald-100/60 dark:from-emerald-950/30 dark:to-emerald-900/20"
                      : member.status === "PENDING"
                        ? "border-amber-500 bg-gradient-to-r from-amber-50 to-amber-100/60 dark:from-amber-950/30 dark:to-amber-900/20"
                        : "border-rose-500 bg-gradient-to-r from-rose-50 to-rose-100/60 dark:from-rose-950/30 dark:to-rose-900/20"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold sm:h-10 sm:w-10 sm:text-sm ${
                      member.status === "ACTIVE"
                        ? "bg-emerald-500 text-white"
                        : member.status === "PENDING"
                          ? "bg-amber-500 text-white"
                          : "bg-rose-500 text-white"
                    }`}
                  >
                    {member.status === "ACTIVE" ? "A" : member.status === "PENDING" ? "P" : "S"}
                  </span>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-bold tracking-wide sm:text-base ${
                        member.status === "ACTIVE"
                          ? "text-emerald-700 dark:text-emerald-400"
                          : member.status === "PENDING"
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-rose-700 dark:text-rose-400"
                      }`}
                    >
                      {member.status === "ACTIVE" ? "APPROVED" : member.status}
                    </p>
                    <p className="text-[10px] text-slate-500 sm:text-xs dark:text-slate-400">
                      {member.status === "ACTIVE"
                        ? "This member is approved and active"
                        : member.status === "PENDING"
                          ? "This member is pending approval"
                          : "This member is suspended"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider sm:px-4 sm:text-xs ${
                      member.status === "ACTIVE"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : member.status === "PENDING"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {member.status === "ACTIVE" ? "Active" : member.status === "PENDING" ? "Pending" : "Suspended"}
                  </span>
                </div>
              ) : null}

              <div className="space-y-2 sm:space-y-4">
                <DetailGrid cols={3} colorIdx={0}>
                  <DetailTile label="Serial No." value={member.serialNo != null ? String(member.serialNo) : "—"} />
                  <DetailTile label="Member ID" value={member.memberId || "—"} />
                </DetailGrid>

                <DetailGrid cols={2} colorIdx={1}>
                  <DetailTile label="Full name" value={member.fullName || "—"} />
                  <DetailTile label="Email" value={member.email || "—"} />
                  <DetailTile label="Phone" value={member.phone || "—"} />
                  <DetailTile label="Aadhar" value={member.kyc?.aadharCard?.number || "—"} />
                  <DetailTile label="PAN" value={member.kyc?.panCard?.number || "—"} />
                  <DetailTile label="Bank Account" value={member.kyc?.bankAccount?.number || "—"} />
                  <DetailTile label="Address" value={member.address || "—"} />
                  <DetailTile label="Sponsor member ID" value={member.sponsorId || "—"} />
                </DetailGrid>

                <DetailGrid cols={3} colorIdx={2}>
                  <DetailTile label="Role" value={member.role || "—"} />
                  <DetailTile label="Leg" value={member.leg || "—"} />
                </DetailGrid>

                <DetailGrid cols={2} colorIdx={3}>
                  <DetailTile label="Joined" value={formatDate(member.createdAt)} />
                  <DetailTile label="Last login" value={member.stats?.lastLoginAt || "—"} />
                </DetailGrid>

                <div className="rounded-lg border-l-4 border-pink-500 bg-pink-50/40 p-2 sm:rounded-xl sm:p-3 dark:bg-opacity-10">
                  <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.28em] text-pink-600 sm:mb-2 sm:text-[11px] sm:tracking-[0.35em] dark:text-pink-400">
                    Income Breakdown
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                    {incomeStatsQuery.isLoading
                      ? Array.from({ length: 8 }).map((_, i) => (
                          <div
                            key={i}
                            className="animate-pulse rounded-lg border border-slate-100 bg-slate-50/90 px-2 py-1.5 sm:rounded-xl sm:px-3 sm:py-2.5 dark:border-white/10 dark:bg-slate-900/40"
                          >
                            <div className="mb-1 h-2 w-3/4 rounded bg-slate-200 dark:bg-white/10" />
                            <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-white/10" />
                          </div>
                        ))
                      : INCOME_LABELS.map(({ key, label }) => (
                          <DetailTile
                            key={key}
                            label={label}
                            value={formatNum(incomeTotal?.[key])}
                          />
                        ))}
                  </div>
                </div>

                <DetailGrid cols={2} colorIdx={5}>
                  <DetailTile label="Carry FWD L" value={formatNum(member.bv?.carryForwardLeft)} />
                  <DetailTile label="Carry FWD R" value={formatNum(member.bv?.carryForwardRight)} />
                </DetailGrid>

                <DetailGrid cols={3} colorIdx={6}>
              <DetailTile label="Left team" value={String(leftTeam)} />
              <DetailTile label="Right team" value={String(rightTeam)} />
              <DetailTile label="Team size" value={String(member.stats?.teamSize ?? "—")} />
            </DetailGrid>
            <DetailGrid cols={2} colorIdx={6}>
              <DetailTile label="Active" value={String(member.stats?.activeTeam ?? "—")} />
              <DetailTile label="Inactive" value={String(member.stats?.inactiveTeam ?? "—")} />
            </DetailGrid>

                <DetailGrid cols={2} colorIdx={7}>
                  <DetailTile label="Sponsor" value={String(member.stats?.directRefs ?? "—")} />
                  <DetailTile label="Last updated" value={formatDate(member.updatedAt)} />
                </DetailGrid>

                <DetailGrid cols={3} colorIdx={8}>
                  <DetailTile label="Wallet balance" value={formatNum(member.wallet?.balance)} />
                  <DetailTile label="Wallet total earned" value={formatNum(member.wallet?.totalEarned)} />
                  <DetailTile label="Weekly Income" value={formatNum(member.wallet?.weeklyIncome)} />
                </DetailGrid>

                <DetailGrid cols={2} colorIdx={9}>
              <DetailTile label="Total Matched BV" value={formatNum(member.wallet?.totalMatchedBv)} />
              <DetailTile label="KYC status" value={member.kyc?.status || "—"} />
            </DetailGrid>

          </div>
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-3 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white sm:rounded-xl sm:py-2.5 sm:text-sm dark:bg-white dark:text-slate-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
