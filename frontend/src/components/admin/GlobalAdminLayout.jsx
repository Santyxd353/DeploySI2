import { useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  ChartBarIcon,
  ChevronDownIcon,
  LogOutIcon,
  ShieldIcon,
  UserIcon,
} from "../ui/Icons";
import { useOutsideClick } from "../../hooks/useOutsideClick";

// ── Iconos extra inline (no dependen de Icons.jsx) ───────────────────────────
function BuildingIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11m16-11v11M8 10v4m4-4v4m4-4v4" />
    </svg>
  );
}
function CreditCardIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}
function LayersIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

// ── Navegación del sidebar global ────────────────────────────────────────────
const NAV_ITEMS = [
  { to: "/admin/global/overview", label: "Overview", Icon: ChartBarIcon },
  { to: "/admin/global/tenants",  label: "Farmacias", Icon: BuildingIcon },
  { to: "/admin/global/suscripciones", label: "Suscripciones", Icon: CreditCardIcon },
  { to: "/admin/global/planes",   label: "Planes", Icon: LayersIcon },
];

// ── Layout ────────────────────────────────────────────────────────────────────
export default function GlobalAdminLayout({ currentUser, onLogout, children }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const userMenuRef = useRef(null);
  const navigate = useNavigate();

  useOutsideClick(userMenuRef, () => setShowUserMenu(false));

  const fullName = useMemo(
    () => [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(" ").trim(),
    [currentUser]
  );
  const displayName = useMemo(
    () => fullName || currentUser?.username || "Superadmin",
    [fullName, currentUser]
  );
  const initials = useMemo(() => {
    if (fullName) {
      const parts = fullName.split(" ").filter(Boolean);
      return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase() || "SA";
    }
    return (currentUser?.username || "SA").slice(0, 2).toUpperCase();
  }, [currentUser, fullName]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <div
        className={`mx-auto grid min-h-screen w-full max-w-[1400px] gap-4 px-4 py-4 transition-[grid-template-columns] duration-300 lg:gap-5 lg:px-6 ${
          collapsed
            ? "lg:grid-cols-[0_minmax(0,1fr)]"
            : "lg:grid-cols-[240px_minmax(0,1fr)]"
        }`}
      >
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside
          className={`rounded-[28px] border border-slate-200 bg-white shadow-md transition-all duration-300 lg:w-[240px] ${
            collapsed
              ? "lg:pointer-events-none lg:-translate-x-[calc(100%+1.25rem)] lg:opacity-0"
              : "lg:translate-x-0 lg:opacity-100"
          }`}
        >
          {/* Header del sidebar */}
          <div className="m-4 rounded-2xl bg-gradient-to-br from-emerald-700 to-cyan-700 p-4 text-white">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100">
                  Backoffice SaaS
                </p>
                <h2 className="mt-0.5 text-base font-black leading-tight">Panel Global</h2>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20 lg:inline-flex"
              >
                <ChevronDownIcon className="h-4 w-4 rotate-90" />
              </button>
            </div>
          </div>

          {/* Nav items */}
          <nav className="px-3 pb-4 space-y-1">
            {NAV_ITEMS.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? "text-emerald-600" : "text-slate-400"
                      }`}
                    />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Footer del sidebar */}
          <div className="border-t border-slate-100 px-3 py-3">
            <div className="flex items-center gap-3 rounded-xl px-2 py-2">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-cyan-600 text-xs font-black text-white">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-800">{displayName}</p>
                <p className="text-[11px] text-slate-500">Superadmin</p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                title="Cerrar sesión"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
              >
                <LogOutIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-4">
          {/* Top bar */}
          <div className="flex items-center justify-between rounded-[28px] border border-slate-200 bg-white px-5 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              {collapsed && (
                <button
                  type="button"
                  onClick={() => setCollapsed(false)}
                  className="hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 lg:inline-flex"
                >
                  <ChevronDownIcon className="h-4 w-4 -rotate-90" />
                </button>
              )}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                  Backoffice global SaaS
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/saas/login")}
                className="hidden rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:inline-flex"
              >
                Cambiar cuenta
              </button>

              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowUserMenu((p) => !p)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm hover:border-slate-300 transition"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-cyan-600 text-xs font-black text-white">
                    {initials}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-xs font-bold text-slate-800">{displayName}</span>
                    <span className="block text-[10px] text-slate-500">Superadmin</span>
                  </span>
                  <ChevronDownIcon
                    className={`h-4 w-4 text-slate-400 transition ${showUserMenu ? "rotate-180" : ""}`}
                  />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-bold text-slate-800">{displayName}</p>
                      <p className="text-[11px] text-slate-500">{currentUser?.email || ""}</p>
                    </div>
                    <div className="p-1.5 space-y-0.5">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                      >
                        <UserIcon className="h-4 w-4" /> Perfil global
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                      >
                        <ShieldIcon className="h-4 w-4" /> Rol: Superadmin
                      </button>
                      <button
                        type="button"
                        onClick={onLogout}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                      >
                        <LogOutIcon className="h-4 w-4" /> Cerrar sesión
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Page content */}
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}
