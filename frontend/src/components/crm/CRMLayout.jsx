import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BackIcon,
  ChartBarIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  HistoryIcon,
  LogOutIcon,
  MegaphoneIcon,
  ShieldIcon,
  SparkIcon,
  UserIcon,
  UsersGroupIcon,
} from "../ui/Icons";

import { useOutsideClick } from "../../hooks/useOutsideClick";
import { useAuth } from "../../context/AuthContext";

const CRM_SECTIONS = [
  {
    id: "clientes",
    label: "Directorio",
    description: "Lista y gestión de clientes",
    icon: UserIcon,
    path: "/admin/clientes",
    available: true,
  },
  {
    id: "recetas",
    label: "Recetas",
    description: "Recetas médicas",
    icon: ClipboardListIcon,
    path: "/admin/recetas",
    available: true,
  },
  {
    id: "segmentos",
    label: "Segmentos",
    description: "Segmentación de clientes",
    icon: UsersGroupIcon,
    path: "/admin/segmentacion-clientes",
    available: true,
  },
  {
    id: "opiniones",
    label: "Opiniones",
    description: "Puntuaciones y reseñas",
    icon: SparkIcon,
    path: "/admin/opiniones",
    available: true,
  },
  {
    id: "publicidad",
    label: "Publicidad",
    description: "Campañas y promociones",
    icon: MegaphoneIcon,
    path: "/admin/publicidad",
    available: true,
  },
  {
    id: "limites",
    label: "Límites",
    description: "Límites de dispensación",
    icon: ShieldIcon,
    path: "/admin/limites-dispensacion",
    available: true,
  },
  {
    id: "puntos",
    label: "Puntos",
    description: "Fidelidad y canjes",
    icon: SparkIcon,
    path: "/admin/puntos",
    available: true,
  },
];

export default function CRMLayout({ activeSection = "clientes", children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const userMenuRef = useRef(null);

  useOutsideClick(userMenuRef, () => setShowUserMenu(false));

  const fullName = useMemo(() => {
    return [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  }, [user]);

  const displayName = useMemo(() => fullName || user?.username || "Usuario", [fullName, user]);

  const roleLabel = useMemo(() => {
    if (user?.role === "admin") return "Administrador";
    if (user?.role === "farmaceutico") return "Farmacéutico";
    if (user?.role === "cajero") return "Cajero";
    return "Usuario";
  }, [user]);

  const initials = useMemo(() => {
    if (fullName) {
      const parts = fullName.split(" ").filter(Boolean);
      return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase() || "CR";
    }
    return (user?.username || "CR").slice(0, 2).toUpperCase();
  }, [fullName, user]);

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-800">
      <div
        className={`mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-4 px-4 py-4 transition-[grid-template-columns] duration-300 lg:gap-5 lg:px-6 ${
          isSidebarCollapsed
            ? "lg:grid-cols-[0_minmax(0,1fr)]"
            : "lg:grid-cols-[250px_minmax(0,1fr)]"
        }`}
      >
        {/* CRM Sidebar */}
        <aside
          className={`rounded-[28px] border border-indigo-100 bg-white/97 p-4 shadow-md transition-all duration-300 lg:w-[250px] lg:p-5 ${
            isSidebarCollapsed
              ? "lg:pointer-events-none lg:-translate-x-[calc(100%+1.25rem)] lg:opacity-0"
              : "lg:translate-x-0 lg:opacity-100"
          }`}
        >
          {/* CRM Header */}
          <div className="mb-5 rounded-2xl bg-gradient-to-r from-indigo-700 to-violet-700 p-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-200">
                  Módulo CRM
                </p>
                <h1 className="mt-1 text-lg font-black">Clientes</h1>
              </div>
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(true)}
                className="hidden h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20 lg:inline-flex"
                aria-label="Ocultar menú CRM"
                title="Ocultar menú"
              >
                <ChevronDownIcon className="h-4 w-4 rotate-90" />
              </button>
            </div>
          </div>

          {/* Back to admin */}
          <button
            type="button"
            onClick={() => navigate("/admin/resumen")}
            className="mb-3 flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <BackIcon className="h-4 w-4 text-slate-400" />
            <span>Volver al panel</span>
          </button>

          <div className="mb-3 h-px bg-slate-100" />

          {/* CRM Navigation */}
          <nav className="space-y-1">
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              CRM
            </p>
            {CRM_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;

              if (!section.available) {
                return (
                  <div
                    key={section.id}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-slate-200 px-3 py-2.5 opacity-50"
                    title="Próximamente"
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 truncate text-sm font-semibold text-slate-400">
                      {section.label}
                    </span>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-400">
                      pronto
                    </span>
                  </div>
                );
              }

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => navigate(section.path)}
                  className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
                    isActive
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${
                      isActive ? "bg-white/20" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 truncate">{section.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <section className="min-w-0 space-y-4">
          {/* CRM Header bar */}
          <header className="rounded-[28px] border border-slate-200 bg-white/97 p-4 shadow-md sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                  className="hidden h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 lg:inline-flex"
                  aria-label={isSidebarCollapsed ? "Mostrar menú CRM" : "Ocultar menú CRM"}
                  title={isSidebarCollapsed ? "Mostrar menú" : "Ocultar menú"}
                >
                  <ChevronDownIcon
                    className={`h-5 w-5 transition-transform ${
                      isSidebarCollapsed ? "-rotate-90" : "rotate-90"
                    }`}
                  />
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-lg bg-indigo-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-indigo-700">
                      CRM
                    </span>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Gestión de clientes
                    </p>
                  </div>
                  <h2 className="text-xl font-black text-slate-900">
                    {CRM_SECTIONS.find((s) => s.id === activeSection)?.label ?? "CRM"}
                  </h2>
                </div>
              </div>

              {/* User menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowUserMenu((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm transition hover:border-slate-300"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-xs font-black text-white">
                    {initials}
                  </span>
                  <span className="text-left">
                    <span className="block text-xs font-bold text-slate-800">{displayName}</span>
                    <span className="block text-[11px] text-slate-500">{roleLabel}</span>
                  </span>
                  <ChevronDownIcon
                    className={`h-4 w-4 text-slate-500 transition ${showUserMenu ? "rotate-180" : ""}`}
                  />
                </button>

                {showUserMenu ? (
                  <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-bold text-slate-800">{displayName}</p>
                      <p className="text-[11px] text-slate-500">{user?.email || "Sin correo"}</p>
                    </div>
                    <div className="p-1.5">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        <UserIcon className="h-4 w-4" />
                        Mi perfil
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        <ShieldIcon className="h-4 w-4" />
                        Permisos: {roleLabel}
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                      >
                        <LogOutIcon className="h-4 w-4" />
                        Cerrar sesión
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          {children}
        </section>
      </div>
    </main>
  );
}
