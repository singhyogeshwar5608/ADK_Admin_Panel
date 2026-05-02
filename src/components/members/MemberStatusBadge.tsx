import type { MemberAccountStatus } from "@/types/memberList";

const styles: Record<MemberAccountStatus, string> = {
  ACTIVE:
    "bg-emerald-100/70 text-emerald-600 dark:bg-emerald-300/10 dark:text-emerald-300",
  SUSPENDED: "bg-rose-100/70 text-rose-600 dark:bg-rose-300/10 dark:text-rose-300",
  PENDING: "bg-amber-100/70 text-amber-600 dark:bg-amber-300/10 dark:text-amber-300",
};

export function MemberStatusBadge({ status }: { status?: MemberAccountStatus }) {
  const s = status ?? "PENDING";
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[s]}`}>
      {s}
    </span>
  );
}
