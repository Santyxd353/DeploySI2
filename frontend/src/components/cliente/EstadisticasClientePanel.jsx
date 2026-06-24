export default function EstadisticasClientePanel({ estadisticas, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-xl bg-slate-200"
          ></div>
        ))}
      </div>
    );
  }

  if (!estadisticas) {
    return null;
  }

  const stats = [
    {
      label: "Total gastado",
      value: `Bs ${estadisticas.total_gastado?.toFixed(2) || "0.00"}`,
      icon: "💰",
      color: "bg-green-50 border-green-200",
    },
    {
      label: "Total compras",
      value: estadisticas.total_compras || 0,
      icon: "🛍️",
      color: "bg-blue-50 border-blue-200",
    },
    {
      label: "Ticket promedio",
      value: `Bs ${estadisticas.ticket_promedio?.toFixed(2) || "0.00"}`,
      icon: "📊",
      color: "bg-purple-50 border-purple-200",
    },
    {
      label: "Compras este mes",
      value: estadisticas.compras_este_mes || 0,
      icon: "📅",
      color: "bg-teal-50 border-teal-200",
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPIs principales */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className={`rounded-xl border shadow-sm p-4 ${stat.color}`}
          >
            <p className="text-2xl">{stat.icon}</p>
            <p className="mt-2 text-xs font-semibold text-slate-600 uppercase">
              {stat.label}
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Estado de compras */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase">
            Pagadas
          </p>
          <p className="mt-1 text-lg font-bold text-green-600">
            {estadisticas.estado_pagada_count || 0}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase">
            Entregadas
          </p>
          <p className="mt-1 text-lg font-bold text-blue-600">
            {estadisticas.estado_entregada_count || 0}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase">
            Pendientes
          </p>
          <p className="mt-1 text-lg font-bold text-yellow-600">
            {estadisticas.estado_pendiente_count || 0}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase">
            Canceladas
          </p>
          <p className="mt-1 text-lg font-bold text-red-600">
            {estadisticas.estado_cancelada_count || 0}
          </p>
        </div>
      </div>

      {/* Última compra */}
      {estadisticas.ultima_compra && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-900">
            ✨ Última compra
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">
                Compra #{estadisticas.ultima_compra.id}
              </p>
              <p className="text-xs text-slate-500">
                {new Date(
                  estadisticas.ultima_compra.created_at
                ).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-slate-900">
                Bs {estadisticas.ultima_compra.total.toFixed(2)}
              </p>
              <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                estadisticas.ultima_compra.estado === "pagada"
                  ? "bg-green-100 text-green-700"
                  : estadisticas.ultima_compra.estado === "entregada"
                  ? "bg-blue-100 text-blue-700"
                  : estadisticas.ultima_compra.estado === "cancelada"
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}>
                {estadisticas.ultima_compra.estado_label}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
