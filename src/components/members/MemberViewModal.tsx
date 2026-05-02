import type { MemberListRow } from "@/types/memberList";
import { X } from "lucide-react";
import { useId, type ReactNode } from "react";

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v);
}

function formatNum(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

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

/** `cols=3`: two columns on phone, three from `sm`. `cols=2`: two columns everywhere (shorter scroll on mobile). */
function DetailGrid({ cols, children }: { cols: 2 | 3; children: ReactNode }) {
  const grid =
    cols === 3
      ? "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3"
      : "grid grid-cols-2 gap-2 sm:gap-3 sm:gap-x-4";
  return <div className={grid}>{children}</div>;
}

export function MemberViewModal({
  open,
  member,
  onClose,
}: {
  open: boolean;
  member: MemberListRow | null;
  onClose: () => void;
}) {
  const titleId = useId();
  if (!open || !member) return null;

  const leftTeam = member.stats?.leftTeam ?? 0;
  const rightTeam = member.stats?.rightTeam ?? 0;
  const leftBv = member.stats?.leftBv ?? member.bv?.leftLeg ?? 0;
  const rightBv = member.stats?.rightBv ?? member.bv?.rightLeg ?? 0;
  const leftChild = str(member.stats?.leftChild);
  const rightChild = str(member.stats?.rightChild);

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
              Member details
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
          {member.profileImage ? (
            <div className="mb-2 flex justify-center sm:mb-4">
              <div className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50 dark:border-white/10 dark:bg-slate-900 sm:rounded-2xl">
                <img src={member.profileImage} alt="" className="h-16 w-16 object-cover sm:h-32 sm:w-32" />
              </div>
            </div>
          ) : null}

          <div className="space-y-2 sm:space-y-4">
            <DetailGrid cols={3}>
              <DetailTile label="Database ID" value={member.id != null ? String(member.id) : ""} />
              <DetailTile label="Member ID" value={member.memberId || "—"} />
              <DetailTile label="Depth" value={member.depth != null ? String(member.depth) : "—"} />
            </DetailGrid>

            <DetailGrid cols={2}>
              <DetailTile label="Full name" value={member.fullName || "—"} />
              <DetailTile label="Email" value={member.email || "—"} />
              <DetailTile label="Phone" value={member.phone || "—"} />
              <DetailTile label="Sponsor member ID" value={member.sponsorId || "—"} />
            </DetailGrid>

            <DetailGrid cols={3}>
              <DetailTile label="Status" value={member.status || "—"} />
              <DetailTile label="Role" value={member.role || "—"} />
              <DetailTile label="Leg" value={member.leg || "—"} />
            </DetailGrid>

            <DetailGrid cols={2}>
              <DetailTile label="Joined" value={formatDate(member.createdAt)} />
              <DetailTile label="Last login" value={formatDate(member.stats?.lastLoginAt)} />
            </DetailGrid>

            <DetailGrid cols={3}>
              <DetailTile label="Total BV" value={formatNum(member.bv?.total)} />
              <DetailTile label="Left leg BV" value={formatNum(leftBv)} />
              <DetailTile label="Right leg BV" value={formatNum(rightBv)} />
            </DetailGrid>

            <DetailGrid cols={3}>
              <DetailTile label="Carry FWD L" value={formatNum(member.bv?.carryForwardLeft)} />
              <DetailTile label="Carry FWD R" value={formatNum(member.bv?.carryForwardRight)} />
              <DetailTile label="Total team BV" value={formatNum(member.stats?.totalTeamBV)} />
            </DetailGrid>

            <DetailGrid cols={3}>
              <DetailTile label="Left team" value={String(leftTeam)} />
              <DetailTile label="Right team" value={String(rightTeam)} />
              <DetailTile label="Team size" value={String(member.stats?.teamSize ?? "—")} />
            </DetailGrid>

            <DetailGrid cols={2}>
              <DetailTile label="Direct refs" value={String(member.stats?.directRefs ?? "—")} />
              <DetailTile label="Last updated" value={formatDate(member.updatedAt)} />
            </DetailGrid>

            <DetailGrid cols={2}>
              <DetailTile label="Left child ID" value={leftChild || "—"} />
              <DetailTile label="Right child ID" value={rightChild || "—"} />
            </DetailGrid>

            <DetailGrid cols={3}>
              <DetailTile label="Wallet balance" value={formatNum(member.wallet?.balance)} />
              <DetailTile label="Wallet total earned" value={formatNum(member.wallet?.totalEarned)} />
              <DetailTile label="KYC status" value={member.kyc?.status || "—"} />
            </DetailGrid>
          </div>

          {member.placementPath ? (
            <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/90 px-2 py-1.5 sm:mt-4 sm:rounded-xl sm:px-3 sm:py-2.5 dark:border-white/10 dark:bg-slate-900/40">
              <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-500 sm:text-[10px] dark:text-slate-400">
                Placement path
              </p>
              <p className="mt-0.5 break-all font-mono text-[10px] font-medium leading-snug text-slate-800 sm:mt-1 sm:text-xs dark:text-slate-200">
                {member.placementPath}
              </p>
            </div>
          ) : null}

          {member.address ? (
            <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/90 px-2 py-1.5 sm:mt-4 sm:rounded-xl sm:px-3 sm:py-2.5 dark:border-white/10 dark:bg-slate-900/40">
              <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-500 sm:text-[10px] dark:text-slate-400">
                Address
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-[11px] font-medium leading-snug text-slate-800 sm:mt-1 sm:text-sm dark:text-slate-200">
                {member.address}
              </p>
            </div>
          ) : null}
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
