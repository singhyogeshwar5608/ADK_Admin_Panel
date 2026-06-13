import type { LucideIcon } from "lucide-react";

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm dark:border-white/5 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{title}</p>
          <p className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/20">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}
