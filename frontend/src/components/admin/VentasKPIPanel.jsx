import { useState } from "react";
import { Button } from "../ui/button";
import {
  CalendarIcon,
  ChartBarIcon,
  DollarIcon,
  RefreshIcon,
  StoreIcon,
} from "../ui/Icons";

const ORIGIN_ICONS = {
  online: ChartBarIcon,
  fisica: StoreIcon,
};

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
      icon: ChartBarIcon,
      tone: "border-blue-200 bg-blue-50 text-blue-700",
      badge: "Hoy",
    },
    {
      id: "semana",
      label: "Ventas Semana",
      value: data.semana?.ventas || 0,
      detail: `Bs ${(data.semana?.total || 0).toFixed(2)}`,
      icon: CalendarIcon,
      tone: "border-teal-200 bg-teal-50 text-teal-700",
      badge: "7 días",
    },
    {
      id: "mes",
      label: "Ventas Mes",
      value: data.mes?.ventas || 0,
      detail: `Bs ${(data.mes?.total || 0).toFixed(2)}`,
      icon: ChartBarIcon,
      tone: "border-purple-200 bg-purple-50 text-purple-700",
      badge: "30 días",
    },
    {
      id: "ticket_promedio",
      label: "Ticket Promedio",
      value: `Bs ${(data.ticket_promedio || 0).toFixed(2)}`,
      detail: "por transacción",
      icon: DollarIcon,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      badge: "General",
    },
  ];

  return (
    <div>
      {/* KPI Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <article key={kpi.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${kpi.tone}`}>
                <kpi.icon className="h-5 w-5" />
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                {kpi.badge}
              </span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{kpi.label}</p>
            <p className="mt-1 text-3xl font-black text-slate-900">{kpi.value}</p>
            <p className="mt-1 text-xs text-slate-500">{kpi.detail}</p>
          </article>
        ))}
      </div>

      {/* Secciones de datos */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Ventas por Estado */}
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-black text-slate-900">Ventas por Estado</h2>
          <div className="space-y-3">
            {[
              { estado: "Pagada", count: data.ventas_por_estado?.pagada || 0, color: "bg-emerald-100 text-emerald-700" },
              { estado: "Preparando", count: data.ventas_por_estado?.preparando || 0, color: "bg-sky-100 text-sky-700" },
              { estado: "Entregada", count: data.ventas_por_estado?.entregada || 0, color: "bg-blue-100 text-blue-700" },
              { estado: "Pendiente", count: data.ventas_por_estado?.pendiente || 0, color: "bg-amber-100 text-amber-700" },
              { estado: "Cancelada", count: data.ventas_por_estado?.cancelada || 0, color: "bg-rose-100 text-rose-700" },
            ].map((item) => (
              <div key={item.estado} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{item.estado}</span>
                <span className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${item.color}`}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </article>

        {/* Ventas por Origen */}
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-black text-slate-900">Ventas por Origen</h2>
          <div className="space-y-3">
            {[
              { origen: "Online", count: data.ventas_por_origen?.online || 0, key: "online" },
              { origen: "Física (incluye POS)", count: data.ventas_por_origen?.fisica || 0, key: "fisica" },
            ].map((item) => {
              const Icon = ORIGIN_ICONS[item.key];
              return (
                <div key={item.origen} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-slate-500" />
                    <span className="text-sm text-slate-600">{item.origen}</span>
                  </div>
                  <span className="text-sm font-black text-slate-900">{item.count}</span>
                </div>
              );
            })}
          </div>
        </article>

        {/* Top Vendedores */}
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-black text-slate-900">Top Vendedores</h2>
          <div className="space-y-3">
            {(data.top_vendedores || []).slice(0, 5).map((vendedor, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-sm font-black text-teal-700">
                    {idx + 1}
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{vendedor.nombre}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">{vendedor.ventas}</p>
                  <p className="text-xs text-slate-500">Bs {vendedor.total.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        {/* Top Productos */}
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-black text-slate-900">Top Productos</h2>
          <div className="space-y-3">
            {(data.top_productos || []).slice(0, 5).map((producto, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-sm font-black text-purple-700">
                    {idx + 1}
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{producto.nombre}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">x{producto.cantidad}</p>
                  <p className="text-xs text-slate-500">Bs {producto.total.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      {/* Botón de actualización */}
      <div className="mt-6 flex justify-center">
        <Button onClick={handleRefresh} disabled={refreshing} className="gap-2">
          <RefreshIcon className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Actualizando..." : "Actualizar Dashboard"}
        </Button>
      </div>
    </div>
  );
}
