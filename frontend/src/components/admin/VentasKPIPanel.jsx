import { useState } from "react";

function RefreshIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function TrendingUpIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  );
}

export default function VentasKPIPanel({ data, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const kpis = [
    {
      id: "hoy",
      label: "Ventas Hoy",
      value: data.hoy?.ventas || 0,
      detail: `Bs ${(data.hoy?.total || 0).toFixed(2)}`,
      icon: "🔔",
      color: "bg-blue-50 border-blue-200",
      badge: "Hoy",
    },
    {
      id: "semana",
      label: "Ventas Semana",
      value: data.semana?.ventas || 0,
      detail: `Bs ${(data.semana?.total || 0).toFixed(2)}`,
      icon: "📅",
      color: "bg-teal-50 border-teal-200",
      badge: "7 días",
    },
    {
      id: "mes",
      label: "Ventas Mes",
      value: data.mes?.ventas || 0,
      detail: `Bs ${(data.mes?.total || 0).toFixed(2)}`,
      icon: "📊",
      color: "bg-purple-50 border-purple-200",
      badge: "30 días",
    },
    {
      id: "ticket_promedio",
      label: "Ticket Promedio",
      value: `Bs ${(data.ticket_promedio || 0).toFixed(2)}`,
      detail: "por transacción",
      icon: "💰",
      color: "bg-green-50 border-green-200",
      badge: "General",
    },
  ];

  return (
    <div>
      {/* KPI Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.id}
            className={`rounded-xl border shadow-sm transition ${kpi.color}`}
          >
            <div className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-2xl">{kpi.icon}</span>
                <span className="inline-block rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {kpi.badge}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase">
                {kpi.label}
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {typeof kpi.value === "string" ? kpi.value : kpi.value}
              </p>
              <p className="mt-1 text-xs text-slate-600">{kpi.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Secciones de datos */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ventas por Estado */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Ventas por Estado
          </h2>
          <div className="space-y-3">
            {[
              {
                estado: "Pagada",
                count: data.ventas_por_estado?.pagada || 0,
                color: "bg-green-100 text-green-700",
              },
              {
                estado: "Entregada",
                count: data.ventas_por_estado?.entregada || 0,
                color: "bg-blue-100 text-blue-700",
              },
              {
                estado: "Pendiente",
                count: data.ventas_por_estado?.pendiente || 0,
                color: "bg-yellow-100 text-yellow-700",
              },
              {
                estado: "Cancelada",
                count: data.ventas_por_estado?.cancelada || 0,
                color: "bg-red-100 text-red-700",
              },
            ].map((item) => (
              <div key={item.estado} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{item.estado}</span>
                <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${item.color}`}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Ventas por Origen */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Ventas por Origen
          </h2>
          <div className="space-y-3">
            {[
              {
                origen: "Online",
                count: data.ventas_por_origen?.online || 0,
                icon: "🌐",
              },
              {
                origen: "Física",
                count: data.ventas_por_origen?.fisica || 0,
                icon: "🏪",
              },
              {
                origen: "POS",
                count: data.ventas_por_origen?.pos || 0,
                icon: "🛒",
              },
            ].map((item) => (
              <div key={item.origen} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm text-slate-600">{item.origen}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Vendedores */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Top Vendedores
          </h2>
          <div className="space-y-3">
            {(data.top_vendedores || []).slice(0, 5).map((vendedor, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
                    {idx + 1}
                  </div>
                  <span className="text-sm font-medium text-slate-900">
                    {vendedor.nombre}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">
                    {vendedor.ventas}
                  </p>
                  <p className="text-xs text-slate-500">
                    Bs {vendedor.total.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Productos */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Top Productos
          </h2>
          <div className="space-y-3">
            {(data.top_productos || []).slice(0, 5).map((producto, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">
                    {idx + 1}
                  </div>
                  <span className="text-sm font-medium text-slate-900">
                    {producto.nombre}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">
                    x{producto.cantidad}
                  </p>
                  <p className="text-xs text-slate-500">
                    Bs {producto.total.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Botón de actualización */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
        >
          <RefreshIcon className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Actualizando..." : "Actualizar Dashboard"}
        </button>
      </div>
    </div>
  );
}
