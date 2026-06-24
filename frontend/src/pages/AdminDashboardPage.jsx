import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../components/admin/AdminLayout";
import { Card, CardContent } from "../components/ui/card";
import { useAuth } from "../context/AuthContext";
import { getDashboardData } from "../services/dashboardService";

const iconMap = {
  ventas: (
    <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  pendientes: (
    <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  stock: (
    <svg className="h-6 w-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  clientes: (
    <svg className="h-6 w-6 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
};

const colorMap = {
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", sub: "text-emerald-600" },
  amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", sub: "text-amber-600" },
  rose: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", sub: "text-rose-600" },
  sky: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-700", sub: "text-sky-600" },
};

function StatusBadge({ status }) {
  const styles = {
    "Entregado": "bg-emerald-100 text-emerald-700 border-emerald-300",
    "Pagada": "bg-emerald-100 text-emerald-700 border-emerald-300",
    "Pendiente": "bg-amber-100 text-amber-700 border-amber-300",
    "Preparando": "bg-sky-100 text-sky-700 border-sky-300",
    "Cancelada": "bg-rose-100 text-rose-700 border-rose-300",
  };
  const style = styles[status] || "bg-slate-100 text-slate-700 border-slate-300";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold ${style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "Entregado" || status === "Pagada" ? "bg-emerald-500" : status === "Pendiente" ? "bg-amber-500" : status === "Preparando" ? "bg-sky-500" : "bg-rose-500"}`} />
      {status}
    </span>
  );
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [kpis, setKpis] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardData()
      .then(data => {
        setKpis(data.kpis || []);
        setOrders(data.recentOrders || []);
      })
      .catch(err => console.error("Error cargando dashboard:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <AdminLayout activeSection="overview" currentUser={user} onLogout={handleLogout}>
      <section className="space-y-6">
        {/* Encabezado */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Panel de Control</h2>
            <p className="mt-1 text-sm text-slate-500">Resumen general de la farmacia</p>
          </div>
          <div className="text-xs text-slate-400">
            Actualizado: {new Date().toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
                <div className="h-4 w-24 rounded bg-slate-200" />
                <div className="mt-3 h-8 w-32 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-20 rounded bg-slate-100" />
              </div>
            ))
          ) : (
            kpis.map((kpi) => {
              const colors = colorMap[kpi.color] || colorMap.emerald;
              return (
                <article
                  key={kpi.label}
                  className={`rounded-2xl border ${colors.border} ${colors.bg} p-5 transition-shadow hover:shadow-md`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{kpi.label}</p>
                    {iconMap[kpi.icon]}
                  </div>
                  <p className={`mt-3 text-3xl font-black ${colors.text}`}>{kpi.value}</p>
                  <p className={`mt-1 text-xs font-medium ${colors.sub}`}>{kpi.sub}</p>
                </article>
              );
            })
          )}
        </div>

        {/* Pedidos recientes */}
        <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Pedidos recientes</h3>
              <span className="text-xs font-medium text-slate-400">{orders.length} resultados</span>
            </div>
          </div>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center gap-4">
                    <div className="h-4 w-20 rounded bg-slate-200" />
                    <div className="h-4 w-32 rounded bg-slate-200" />
                    <div className="h-4 w-24 rounded bg-slate-200" />
                    <div className="h-6 w-20 rounded-full bg-slate-200" />
                  </div>
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <svg className="mb-3 h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm font-medium">No hay pedidos registrados aún</p>
                <p className="mt-1 text-xs">Ejecuta el seed para generar datos de prueba</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th scope="col" className="py-3.5 pl-6 pr-4">Pedido</th>
                      <th scope="col" className="py-3.5 pr-4">Cliente</th>
                      <th scope="col" className="py-3.5 pr-4">Total</th>
                      <th scope="col" className="py-3.5 pr-4">Fecha</th>
                      <th scope="col" className="py-3.5 pr-4">Origen</th>
                      <th scope="col" className="py-3.5 pr-6">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50/50">
                        <td className="py-3.5 pl-6 pr-4 font-semibold text-slate-800">{order.id}</td>
                        <td className="py-3.5 pr-4 text-slate-700">{order.cliente}</td>
                        <td className="py-3.5 pr-4 font-medium text-slate-800">{order.total}</td>
                        <td className="py-3.5 pr-4 text-xs text-slate-500">{order.fecha}</td>
                        <td className="py-3.5 pr-4">
                          <span className="text-xs font-medium text-slate-600">{order.origen}</span>
                        </td>
                        <td className="py-3.5 pr-6">
                          <StatusBadge status={order.estado} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </AdminLayout>
  );
}