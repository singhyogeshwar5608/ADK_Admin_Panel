export function LoadingScreen({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-slate-900 dark:border-white" />
      <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
    </div>
  );
}
