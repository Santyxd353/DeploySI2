import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import VentasKPIPanel from "../../components/admin/VentasKPIPanel";
import VentasDetallePanel from "../../components/admin/VentasDetallePanel";
import VentasAnalisisPanel from "../../components/admin/VentasAnalisisPanel";

export default function AdminVentasPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      // Endpoint que implementaremos en la siguiente sub-fase
      const response = await fetch("/api/admin/ventas/dashboard/", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Endpoint aún no existe, usar datos mock
          setDashboard(getDataMock());
        } else {
          throw new Error("Error cargando dashboard");
        }
      } else {
        const data = await response.json();
        setDashboard(data);
      }
    } catch (error) {
      console.error("Error:", error);
      setError(error.message);
      // Usar datos mock si hay error
      setDashboard(getDataMock());
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex justify-center py-12">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-teal-600"></div>
              <p className="mt-2 text-slate-600">Cargando dashboard...</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Gestión de Ventas</h1>
          <p className="mt-1 text-sm text-slate-600">
            HU-36: Módulo de gestión, análisis y transacciones
          </p>
        </div>

        {/* Error alert */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">⚠️ {error}</p>
          </div>
        )}

        {/* Tabs de navegación */}
        <div className="mb-6 border-b border-slate-200">
          <div className="flex gap-4">
            {[
              { id: "dashboard", label: "Dashboard", icon: "📊" },
              { id: "transacciones", label: "Transacciones", icon: "💳" },
              { id: "analisis", label: "Análisis", icon: "📈" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition capitalize ${
                  activeTab === tab.id
                    ? "border-b-2 border-teal-600 text-teal-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {dashboard && (
          <div>
            {activeTab === "dashboard" && (
              <VentasKPIPanel data={dashboard} onRefresh={fetchDashboard} />
            )}

            {activeTab === "transacciones" && (
              <VentasDetallePanel data={dashboard} />
            )}

            {activeTab === "analisis" && (
              <VentasAnalisisPanel data={dashboard} />
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// Datos mock para desarrollo
function getDataMock() {
  return {
    hoy: {
      ventas: 12,
      total: 2450.75,
      promedio: 204.23,
    },
    semana: {
      ventas: 85,
      total: 18340.50,
      promedio: 215.77,
    },
    mes: {
      ventas: 342,
      total: 74250.00,
      promedio: 217.01,
    },
    anio: {
      ventas: 1850,
      total: 405600.00,
      promedio: 219.27,
    },
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
    ventas_por_estado: {
      pagada: 280,
      entregada: 320,
      pendiente: 25,
      cancelada: 8,
    },
    ventas_por_origen: {
      online: 150,
      fisica: 170,
      pos: 22,
    },
  };
}
