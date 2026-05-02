import { useAuth } from "@/context/AuthContext";
import { parseApiError } from "@/utils/parseApiError";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

  const [form, setForm] = useState({ email: "", password: "" });
  const [loginAsAdmin, setLoginAsAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({ ...form, login_as_admin: loginAsAdmin });
      toast.success("Welcome back!");
      navigate(from, { replace: true });
    } catch (err) {
      const msg = parseApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-10 shadow-card dark:border-white/10 dark:bg-slate-900">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Welcome back 👋</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Sign in to manage members, orders, and payouts in a single command center.
          </p>
        </div>
        <form className="space-y-6" onSubmit={onSubmit}>
          <label className="block space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              value={form.email}
              onChange={onChange}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none ring-primary/20 focus:border-primary focus:ring-2 dark:border-white/10 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="block space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={onChange}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none ring-primary/20 focus:border-primary focus:ring-2 dark:border-white/10 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={loginAsAdmin}
              onChange={(e) => setLoginAsAdmin(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Only administrator accounts can sign in when enabled
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
