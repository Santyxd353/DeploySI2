import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { adminSections } from "../../data/adminData";
import {
  ChartBarIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  CogIcon,
  DollarIcon,
  LogOutIcon,
  MegaphoneIcon,
  PackageIcon,
  ShieldIcon,
  UserIcon,
  UsersGroupIcon,
  SaveIcon,                     // ← Para la sección de backups
  SparkIcon,
} from "../ui/Icons";
import { useOutsideClick } from "../../hooks/useOutsideClick";
import { useAuth } from "../../context/AuthContext";

export default function AdminLayout({ activeSection, setActiveSection, currentUser, onLogout, children }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showUsersSection, setShowUsersSection] = useState(false);
  const [showInventorySection, setShowInventorySection] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("admin-sidebar-collapsed") === "true";
  });
  const userMenuRef = useRef(null);
  const { hasPermission, user: authUser, logout: authLogout } = useAuth();
  const resolvedUser = currentUser ?? authUser;
  const resolvedLogout = onLogout ?? authLogout;
  const location = useLocation();
  const navigate = useNavigate();

  useOutsideClick(userMenuRef, () => setShowUserMenu(false));

  const roleLabel = useMemo(() => {
    if (resolvedUser?.role === "admin") return "Administrador";
    if (resolvedUser?.role === "farmaceutico") return "Farmaceutico";
    if (resolvedUser?.role === "cajero") return "Cajero";
    return "Cliente";
  }, [resolvedUser]);

  const visibleSections = useMemo(
    () => adminSections.filter((section) => hasPermission(section.requiredPermission)),
    [hasPermission]
  );

  const userManagementSectionIds = ["users", "roles-permisos"];
  const inventorySectionId = "inventory";

  const activeSectionByPath = useMemo(() => {
    return adminSections.find((section) => section.path === location.pathname)?.id || null;
  }, [location.pathname]);

  const resolvedActiveSection = activeSection || activeSectionByPath || "overview";

  const handleSectionAction = (section) => {
    if (section.path) {
      navigate(section.path);
      return;
    }

    if (setActiveSection) {
      setActiveSection(section.id);
    }
  };

  const userManagementSections = useMemo(
    () => visibleSections.filter((section) => userManagementSectionIds.includes(section.id)),
    [visibleSections]
  );

  const inventorySection = useMemo(
    () => visibleSections.find((section) => section.id === inventorySectionId) || null,
    [visibleSections]
  );

  const regularSections = useMemo(
    () => visibleSections.filter((section) => !userManagementSectionIds.includes(section.id) && section.id !== inventorySectionId),
    [visibleSections]
  );

  const overviewSection = useMemo(
    () => regularSections.find((section) => section.id === "overview") || null,
    [regularSections]
  );

  const otherRegularSections = useMemo(
    () => regularSections.filter((section) => section.id !== "overview"),
    [regularSections]
  );

  const isUsersSectionActive = userManagementSections.some((section) => section.id === resolvedActiveSection);
  const inventoryView = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("view") || "dashboard";
  }, [location.search]);
  const isInventorySectionActive = resolvedActiveSection === inventorySectionId;

  useEffect(() => {
    if (isUsersSectionActive) {
      setShowUsersSection(true);
    }
  }, [isUsersSectionActive]);

  useEffect(() => {
    if (isInventorySectionActive) {
      setShowInventorySection(true);
    }
  }, [isInventorySectionActive]);

  useEffect(() => {
    if (location.pathname === "/admin/reportes") {
      setIsSidebarCollapsed(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("admin-sidebar-collapsed", String(isSidebarCollapsed));
    }
  }, [isSidebarCollapsed]);

  const fullName = useMemo(() => {
    return [resolvedUser?.first_name, resolvedUser?.last_name].filter(Boolean).join(" ").trim();
  }, [resolvedUser]);

  const displayName = useMemo(() => {
    return fullName || resolvedUser?.username || "Admin";
  }, [fullName, resolvedUser]);

  const initials = useMemo(() => {
    if (fullName) {
      const parts = fullName.split(" ").filter(Boolean);
      const first = parts[0]?.[0] || "";
      const second = parts[1]?.[0] || "";
      return `${first}${second}`.toUpperCase() || "AD";
    }

    const value = resolvedUser?.username || "Admin";
    return value.slice(0, 2).toUpperCase();
  }, [resolvedUser, fullName]);

  // Mapa de iconos: incluye POS y backups
  const iconMap = {
    dashboard: ChartBarIcon,
    orders: ClipboardListIcon,
    inventory: PackageIcon,
    products: PackageIcon,
    users: UsersGroupIcon,
    customers: UserIcon,
    sales: DollarIcon,
    promotions: MegaphoneIcon,
    reports: ChartBarIcon,
    finance: DollarIcon,
    settings: CogIcon,
    spark: SparkIcon,
    pos: DollarIcon,            // ← Sección de punto de venta
    backup: SaveIcon,           // ← Sección de backups
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-800">
      <div
        className={`mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-4 px-4 py-4 transition-[grid-template-columns] duration-300 lg:gap-5 lg:px-6 ${
          isSidebarCollapsed ? "lg:grid-cols-[0_minmax(0,1fr)]" : "lg:grid-cols-[250px_minmax(0,1fr)]"
        }`}
      >
        <aside
          className={`rounded-[28px] border border-slate-200 bg-white/97 p-4 shadow-md transition-all duration-300 lg:w-[250px] lg:p-5 ${
            isSidebarCollapsed
              ? "lg:pointer-events-none lg:-translate-x-[calc(100%+1.25rem)] lg:opacity-0"
              : "lg:translate-x-0 lg:opacity-100"
          }`}
        >
          <div className="mb-5 rounded-2xl bg-gradient-to-r from-teal-700 to-cyan-700 p-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-100">Panel administrativo</p>
                <h1 className="mt-1 text-lg font-black">Farmacia SaludPlus</h1>
              </div>
              <button
                type="button"
                onClick={toggleSidebar}
                className="hidden h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20 lg:inline-flex"
                aria-label="Ocultar panel administrativo"
                title="Ocultar panel"
              >
                <ChevronDownIcon className="h-4 w-4 rotate-90" />
              </button>
            </div>
          </div>

          <nav className="space-y-1.5">
            {overviewSection ? (() => {
              const Icon = iconMap[overviewSection.icon] || ShieldIcon;
              const isActive = resolvedActiveSection === overviewSection.id;

              return (
                <button
                  key={overviewSection.id}
                  type="button"
                  onClick={() => handleSectionAction(overviewSection)}
                  className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
                    isActive
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${isActive ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="truncate">{overviewSection.label}</span>
                </button>
              );
            })() : null}

            {userManagementSections.length ? (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setShowUsersSection((prev) => !prev)}
                  className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
                    isUsersSectionActive
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${isUsersSectionActive ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>
                    <UsersGroupIcon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 truncate">Usuarios</span>
                  <ChevronDownIcon className={`h-4 w-4 transition ${showUsersSection ? "rotate-180" : ""}`} />
                </button>

                {showUsersSection ? (
                  <div className="space-y-1 pl-3">
                    {userManagementSections.map((section) => {
                      const isActive = resolvedActiveSection === section.id;
                      return (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => handleSectionAction(section)}
                          className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                            isActive
                              ? "border-teal-600 bg-teal-50 text-teal-700"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <span className="truncate">{section.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

            {inventorySection ? (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setShowInventorySection((prev) => !prev)}
                  className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
                    isInventorySectionActive
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${isInventorySectionActive ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>
                    <PackageIcon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 truncate">Inventario</span>
                  <ChevronDownIcon className={`h-4 w-4 transition ${showInventorySection ? "rotate-180" : ""}`} />
                </button>

                {showInventorySection ? (
                  <div className="space-y-1 pl-3">
                    <button
                      type="button"
                      onClick={() => navigate("/admin/inventarios?view=dashboard")}
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                        isInventorySectionActive && inventoryView === "dashboard"
                          ? "border-teal-600 bg-teal-50 text-teal-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="truncate">Dashboard</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/admin/inventarios?view=entradas")}
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                        isInventorySectionActive && inventoryView === "entradas"
                          ? "border-teal-600 bg-teal-50 text-teal-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="truncate">Entrada de inventario</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/admin/inventarios?view=stock")}
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                        isInventorySectionActive && inventoryView === "stock"
                          ? "border-teal-600 bg-teal-50 text-teal-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="truncate">Inventario (stock)</span>
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {otherRegularSections.map((section) => {
              const Icon = iconMap[section.icon] || ShieldIcon;
              const isActive = resolvedActiveSection === section.id;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => handleSectionAction(section)}
                  className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
                    isActive
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${isActive ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="truncate">{section.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 space-y-4">
          <header className="rounded-[28px] border border-slate-200 bg-white/97 p-4 shadow-md sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="hidden h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 lg:inline-flex"
                  aria-label={isSidebarCollapsed ? "Mostrar panel administrativo" : "Ocultar panel administrativo"}
                  title={isSidebarCollapsed ? "Mostrar panel" : "Ocultar panel"}
                >
                  <ChevronDownIcon className={`h-5 w-5 transition-transform ${isSidebarCollapsed ? "-rotate-90" : "rotate-90"}`} />
                </button>

                <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Backoffice</p>
                <h2 className="text-xl font-black text-slate-900">Gestion operativa</h2>
                </div>
              </div>
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowUserMenu((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm transition hover:border-slate-300"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-cyan-600 text-xs font-black text-white">
                    {initials}
                  </span>
                  <span className="text-left">
                    <span className="block text-xs font-bold text-slate-800">{displayName}</span>
                    <span className="block text-[11px] text-slate-500">{roleLabel}</span>
                  </span>
                  <ChevronDownIcon className={`h-4 w-4 text-slate-500 transition ${showUserMenu ? "rotate-180" : ""}`} />
                </button>

                {showUserMenu ? (
                  <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-bold text-slate-800">{displayName}</p>
                      <p className="text-[11px] text-slate-500">{resolvedUser?.email || "Sin correo"}</p>
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
                        onClick={resolvedLogout}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                      >
                        <LogOutIcon className="h-4 w-4" />
                        Cerrar sesion
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
