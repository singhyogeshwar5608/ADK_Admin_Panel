export function JsonPanel({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-800 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
