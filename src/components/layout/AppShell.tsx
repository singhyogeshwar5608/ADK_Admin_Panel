import { navItemsForRole } from "@/config/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Menu, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

export function AppShell() {
  const { member, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const items = navItemsForRole(member?.role);

  const NavList = (
    <nav className="flex-1 space-y-1 px-4 py-6">
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `block rounded-lg px-4 py-3 text-sm font-semibold transition ${
              isActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
            }`
          }
          onClick={() => setMobileOpen(false)}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-slate-100 dark:bg-slate-900">
      {/* Desktop sidebar — width animates (display:none cannot transition) */}
      <aside
        className={[
          "relative z-30 hidden min-h-0 shrink-0 overflow-hidden border-r border-transparent bg-slate-900 text-white md:flex",
          "transition-[width,opacity,border-color] duration-300 ease-in-out motion-reduce:transition-none",
          sidebarOpen ? "w-64 border-white/10 opacity-100" : "w-0 border-transparent opacity-0 md:pointer-events-none",
        ].join(" ")}
        aria-hidden={!sidebarOpen}
      >
        <div className="flex h-full min-h-screen w-64 flex-col">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Asli Desi Kisan</h1>
              {member?.role === "MEMBER" ? (
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300/90">
                  Staff · limited access
                </p>
              ) : null}
            </div>
          </div>
          {NavList}
          <div className="border-t border-white/10 px-4 py-6">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary/80 py-2 text-sm font-semibold text-white"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              Toggle theme
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer backdrop */}
      <button
        type="button"
        aria-label="Close menu"
        className={[
          "fixed inset-0 z-40 bg-slate-900/60 md:hidden",
          "transition-opacity duration-300 ease-in-out motion-reduce:transition-none",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 text-white shadow-2xl md:hidden",
          "transition-transform duration-300 ease-in-out motion-reduce:transition-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <span className="font-semibold">Menu</span>
          <button type="button" className="text-white/80" onClick={() => setMobileOpen(false)}>
            ✕
          </button>
        </div>
        {NavList}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 dark:border-white/5 dark:bg-slate-950 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label={
                isDesktop ? (sidebarOpen ? "Hide sidebar" : "Show sidebar") : mobileOpen ? "Close menu" : "Open menu"
              }
              aria-expanded={isDesktop ? sidebarOpen : mobileOpen}
              onClick={() => {
                if (isDesktop) setSidebarOpen((v) => !v);
                else setMobileOpen((v) => !v);
              }}
            >
              <Menu size={22} strokeWidth={2} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="hidden rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 active:bg-rose-800 sm:block dark:bg-rose-600 dark:hover:bg-rose-500"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
            >
              Logout
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
