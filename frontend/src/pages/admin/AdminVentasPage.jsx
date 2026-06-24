import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import { useAuth } from "../../context/AuthContext";
import { ventasAdminService } from "../../services/ventasService";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { ChartBarIcon, ClipboardListIcon, TrendingUp } from "../../components/ui/Icons";
import VentasKPIPanel from "../../components/admin/VentasKPIPanel";
import VentasDetallePanel from "../../components/admin/VentasDetallePanel";
import VentasAnalisisPanel from "../../components/admin/VentasAnalisisPanel";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: ChartBarIcon },
  { id: "transacciones", label: "Transacciones", icon: ClipboardListIcon },
  { id: "analisis", label: "Análisis", icon: TrendingUp },
];

function TopNavButton({ active, icon: Icon, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition ${
        active ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-900"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

export default function AdminVentasPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ventasAdminService.dashboard();
      setDashboard(data);
      setUsingMock(false);
    } catch (error) {
      console.error("Error cargando dashboard de ventas:", error);
      setDashboard(getDataMock());
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return (
    <AdminLayout activeSection="sales" currentUser={user} onLogout={handleLogout}>
      <div className="space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-700">Modulo ventas</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Gestión de ventas</h1>
              <p className="mt-1 text-sm text-slate-500">
                Dashboard, transacciones y análisis de ventas en un solo lugar.
              </p>
            </div>
            <div className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
              {TABS.map((tab) => (
                <TopNavButton key={tab.id} icon={tab.icon} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
                  {tab.label}
                </TopNavButton>
              ))}
            </div>
          </div>
        </section>

        {usingMock && (
          <Alert tone="info">
            <AlertDescription>
              Mostrando datos de ejemplo: el backend aún no expone <code>/api/admin/ventas/dashboard/</code>.
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-12 shadow-sm">
            <div className="flex justify-center">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-600"></div>
                <p className="mt-2 text-sm text-slate-500">Cargando dashboard...</p>
              </div>
            </div>
          </section>
        ) : (
          dashboard && (
            <>
              {activeTab === "dashboard" && <VentasKPIPanel data={dashboard} onRefresh={fetchDashboard} />}
              {activeTab === "transacciones" && <VentasDetallePanel data={dashboard} />}
              {activeTab === "analisis" && <VentasAnalisisPanel data={dashboard} />}
            </>
          )
        )}
      </div>
    </AdminLayout>
  );
}

// Datos mock usados mientras el endpoint de backend no esté disponible.
function getDataMock() {
  return {
    hoy: { ventas: 12, total: 2450.75, promedio: 204.23 },
    semana: { ventas: 85, total: 18340.5, promedio: 215.77 },
    mes: { ventas: 342, total: 74250.0, promedio: 217.01 },
    anio: { ventas: 1850, total: 405600.0, promedio: 219.27 },
    ticket_promedio: 217.01,
    top_vendedores: [
      { nombre: "Juan García", ventas: 45, total: 9750 },
      { nombre: "María López", ventas: 38, total: 8240 },
      { nombre: "Carlos Ruiz", ventas: 32, total: 6980 },
    ],
    top_productos: [
      { nombre: "Paracetamol 500mg", cantidad: 150, total: 2325 },
      { nombre: "Ibupirac 400mg", cantidad: 120, total: 1980 },
      { nombre: "Amoxicilina 500mg", cantidad: 95, total: 2375 },
    ],
    ventas_por_estado: { pagada: 280, preparando: 14, entregada: 320, pendiente: 25, cancelada: 8 },
    ventas_por_origen: { online: 150, fisica: 192 },
  };
}
