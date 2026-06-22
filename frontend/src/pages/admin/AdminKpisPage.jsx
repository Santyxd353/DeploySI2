import { useCallback, useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import AdminLayout from "../../components/admin/AdminLayout";
import { requestJsonWithAuthRetry } from "../../services/apiClient";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n, dec = 0) {
  if (n == null) return "—";
  return Number(n).toLocaleString("es-BO", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-BO", { day: "2-digit", month: "short" }) +
    " " + d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
}
function Delta({ val }) {
  if (val == null) return null;
  const pos = val >= 0;
  return <span className={`ml-1.5 text-xs font-bold ${pos ? "text-emerald-600" : "text-red-500"}`}>{pos ? "▲" : "▼"} {Math.abs(val)}%</span>;
}

// ── Colores ───────────────────────────────────────────────────────────────────
const PEDIDO_COLORS = {
  pagado: "#3b82f6", aceptado: "#06b6d4", preparando: "#f59e0b", listo: "#8b5cf6",
  en_camino: "#f97316", cerca: "#ef4444", entregado: "#10b981", no_entregado: "#ef4444", cancelado: "#94a3b8",
};
const PEDIDO_LABELS = {
  pagado: "Pagado", aceptado: "Aceptado", preparando: "Preparando", listo: "Listo",
  en_camino: "En camino", cerca: "Cerca", entregado: "Entregado", no_entregado: "No entregado", cancelado: "Cancelado",
};
const NIVEL_COLORS = { bronce: "#cd7f32", plata: "#9ca3af", oro: "#eab308", diamante: "#38bdf8" };
const NIVEL_LABELS = { bronce: "Bronce", plata: "Plata", oro: "Oro", diamante: "Diamante" };

const PERIODOS = [{ id: "hoy", label: "Hoy" }, { id: "semana", label: "Esta semana" }, { id: "mes", label: "Este mes" }];

// ── KPI Card clickable ────────────────────────────────────────────────────────
function KpiCard({ label, value, delta, sub, accent = "teal", tipo, onDetalle, disabled }) {
  const accents = {
    teal:   "from-teal-600 to-cyan-600",
    violet: "from-violet-600 to-purple-600",
    amber:  "from-amber-500 to-orange-500",
    rose:   "from-rose-500 to-pink-600",
    blue:   "from-blue-600 to-indigo-600",
    green:  "from-emerald-600 to-green-600",
    gold:   "from-yellow-500 to-amber-600",
    indigo: "from-indigo-600 to-blue-700",
  };
  const isClickable = !!tipo && !disabled;
  return (
    <div
      onClick={isClickable ? () => onDetalle(tipo, label) : undefined}
      className={`rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm transition-all ${
        isClickable ? "cursor-pointer hover:border-teal-300 hover:shadow-md hover:-translate-y-0.5" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <div className="mt-1 flex items-baseline gap-1 flex-wrap">
            <span className="text-2xl font-black text-slate-900">{value}</span>
            {delta != null && <Delta val={delta} />}
          </div>
          {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </div>
        {isClickable && (
          <span className="ml-2 mt-0.5 text-[10px] font-semibold text-teal-500 opacity-0 group-hover:opacity-100 transition">Ver →</span>
        )}
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className={`h-1 w-10 rounded-full bg-gradient-to-r ${accents[accent] || accents.teal}`} />
        {isClickable && <span className="text-[10px] text-slate-300 font-medium">Ver detalle →</span>}
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs">
      <p className="mb-1 font-bold text-slate-700">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{fmt(p.value, p.name.includes("Bs") || p.name === "Total (Bs.)" ? 2 : 0)}</strong>
        </p>
      ))}
    </div>
  );
}

// ── Drawer de detalle ─────────────────────────────────────────────────────────
function DetalleDrawer({ visible, titulo, data, loading, onClose }) {
  if (!visible) return null;

  const esNumero = (v) => typeof v === "number";
  const fmtCelda = (v) => {
    if (v == null) return "—";
    if (esNumero(v)) return v % 1 !== 0 ? fmt(v, 2) : fmt(v);
    return String(v);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay oscuro */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-2xl overflow-hidden bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-teal-600">Detalle KPI</p>
            <h2 className="text-base font-black text-slate-900">{titulo}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 transition"
          >
            ✕
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
            </div>
          ) : !data ? (
            <p className="text-sm text-slate-400 text-center py-10">Sin datos disponibles</p>
          ) : data.filas?.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">No hay registros para mostrar</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {data.columnas?.map((col, i) => (
                      <th key={i} className="pb-3 pr-4 text-left whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.filas?.map((fila, ri) => (
                    <tr key={ri} className="hover:bg-slate-50 transition">
                      {fila.map((celda, ci) => (
                        <td
                          key={ci}
                          className={`py-2.5 pr-4 text-sm ${
                            esNumero(celda) && celda < 0
                              ? "font-semibold text-red-600"
                              : esNumero(celda)
                              ? "font-semibold text-slate-800"
                              : "text-slate-600"
                          }`}
                        >
                          {fmtCelda(celda)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 px-6 py-3 text-xs text-slate-400">
          {data?.filas?.length ? `${data.filas.length} registros` : ""}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function AdminKpisPage() {
  const [periodo, setPeriodo] = useState("mes");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Drawer state
  const [drawer, setDrawer] = useState({ visible: false, tipo: "", titulo: "", data: null, loading: false });

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await requestJsonWithAuthRetry(`/api/admin/kpis/?periodo=${periodo}`);
      setData(result);
    } catch {
      setError("No se pudieron cargar los KPIs.");
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => { cargar(); }, [cargar]);

  // Abrir drawer y cargar detalle
  async function abrirDetalle(tipo, titulo) {
    setDrawer({ visible: true, tipo, titulo, data: null, loading: true });
    try {
      const result = await requestJsonWithAuthRetry(
        `/api/admin/kpis/detalle/?tipo=${tipo}&periodo=${periodo}`
      );
      setDrawer((d) => ({ ...d, data: result, loading: false }));
    } catch {
      setDrawer((d) => ({ ...d, data: null, loading: false }));
    }
  }

  function cerrarDrawer() {
    setDrawer({ visible: false, tipo: "", titulo: "", data: null, loading: false });
  }

  // Datos para gráficos
  const donutPedidos = data?.pedidos?.por_estado?.map((p) => ({
    name: PEDIDO_LABELS[p.estado] || p.estado,
    value: p.cantidad,
    color: PEDIDO_COLORS[p.estado] || "#94a3b8",
  })) || [];

  const donutNiveles = (data?.fidelizacion?.niveles || []).map((n) => ({
    name: NIVEL_LABELS[n.nivel] || n.nivel,
    value: n.cantidad,
    color: NIVEL_COLORS[n.nivel] || "#94a3b8",
  }));

  const distOpiniones = [1, 2, 3, 4, 5].map((p) => {
    const found = data?.opiniones?.distribucion?.find((d) => d.puntuacion === p);
    return { label: `${p}★`, cantidad: found?.cantidad || 0 };
  });

  return (
    <AdminLayout>
      <DetalleDrawer
        visible={drawer.visible}
        titulo={drawer.titulo}
        data={drawer.data}
        loading={drawer.loading}
        onClose={cerrarDrawer}
      />

      <div className="space-y-5">
        {/* Header + selector período */}
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Analytics</p>
              <h1 className="text-2xl font-black text-slate-900">KPIs de la farmacia</h1>
              <p className="text-sm text-slate-500">Haz clic en cualquier card para ver el detalle</p>
            </div>
            <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
              {PERIODOS.map(({ id, label }) => (
                <button key={id} type="button" onClick={() => setPeriodo(id)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                    periodo === id ? "bg-teal-600 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="rounded-[22px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error} — <button onClick={cargar} className="font-semibold underline">Reintentar</button>
          </div>
        )}

        {!loading && data && (
          <>
            {/* ── Fila 1: Ventas ── */}
            <div>
              <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-400">Ventas</p>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard label="Total ventas" value={`Bs. ${fmt(data.ventas.total_bs, 2)}`}
                  delta={data.ventas.delta_pct} sub="vs período anterior"
                  accent="teal" tipo="clientes_top" onDetalle={abrirDetalle} />
                <KpiCard label="Transacciones" value={fmt(data.ventas.num_transacciones)}
                  delta={data.ventas.delta_transacciones_pct}
                  sub={`Física: ${data.ventas.fisica} · Online: ${data.ventas.online}`}
                  accent="blue" />
                <KpiCard label="Ticket promedio" value={`Bs. ${fmt(data.ventas.ticket_promedio, 2)}`}
                  sub="Por venta completada" accent="violet" />
                <KpiCard label="Margen bruto"
                  value={`Bs. ${fmt(data.ventas.margen_bs, 2)}`}
                  sub={data.ventas.margen_pct != null ? `${data.ventas.margen_pct}% del total` : ""}
                  accent="green" tipo="margen_productos" onDetalle={abrirDetalle} />
              </div>
            </div>

            {/* ── Fila 2: Operaciones ── */}
            <div>
              <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-400">Operaciones</p>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard label="Pedidos activos" value={fmt(data.pedidos.activos)}
                  sub="En proceso ahora" accent="amber"
                  tipo="pedidos_activos" onDetalle={abrirDetalle} />
                <KpiCard label="Entregados en período" value={fmt(data.pedidos.entregados_periodo)}
                  sub={data.pedidos.tasa_entrega_pct != null ? `Tasa de éxito: ${data.pedidos.tasa_entrega_pct}%` : ""}
                  accent="green" />
                <KpiCard label="Stock bajo" value={fmt(data.inventario.stock_bajo)}
                  sub="Productos bajo mínimo" accent="rose"
                  tipo="stock_bajo" onDetalle={abrirDetalle} />
                <KpiCard label="Vencen en 30 días" value={fmt(data.inventario.por_vencer_30d)}
                  sub="Lotes próximos a vencer" accent="amber"
                  tipo="vencimientos" onDetalle={abrirDetalle} />
              </div>
            </div>

            {/* ── Fila 3: Clientes y salud ── */}
            <div>
              <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-400">Clientes y atención</p>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard label="Clientes activos" value={fmt(data.clientes.activos_periodo)}
                  sub="Con compras en el período" accent="teal"
                  tipo="clientes_top" onDetalle={abrirDetalle} />
                <KpiCard label="NPS promedio"
                  value={data.opiniones.nps_promedio != null ? `${data.opiniones.nps_promedio}★` : "—"}
                  sub="Promedio de opiniones" accent="gold" />
                <KpiCard label="Opiniones urgentes" value={fmt(data.opiniones.urgentes)}
                  sub="≤ 2★ sin respuesta" accent="rose"
                  tipo="opiniones_urgentes" onDetalle={abrirDetalle} />
                <KpiCard label="Recetas pendientes" value={fmt(data.recetas_pendientes)}
                  sub="Esperando validación" accent="violet"
                  tipo="recetas_pendientes" onDetalle={abrirDetalle} />
              </div>
            </div>

            {/* ── Fila 4: Fidelización y tratamientos ── */}
            <div>
              <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-400">Fidelización y adherencia</p>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard label="Puntos entregados" value={fmt(data.fidelizacion.puntos_entregados)}
                  sub="Ganados en el período" accent="gold"
                  tipo="puntos_top" onDetalle={abrirDetalle} />
                <KpiCard label="Puntos canjeados" value={fmt(data.fidelizacion.puntos_canjeados)}
                  sub="Usados en el período" accent="indigo" />
                <KpiCard label="Tratamientos activos" value={fmt(data.tratamientos.activos)}
                  sub={data.tratamientos.adherencia_pct != null ? `Adherencia: ${data.tratamientos.adherencia_pct}%` : ""}
                  accent="teal" tipo="tratamientos" onDetalle={abrirDetalle} />
                <KpiCard label="Canjes pendientes" value={fmt(data.fidelizacion.canjes_pendientes)}
                  sub="Sin aplicar" accent="amber"
                  tipo="canjes_pendientes" onDetalle={abrirDetalle} />
              </div>
            </div>

            {/* ── Gráfico tendencia ── */}
            <Section title={`Tendencia de ventas — ${PERIODOS.find((p) => p.id === periodo)?.label}`}>
              {data.tendencia.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Sin ventas en este período</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.tendencia} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                    <Line yAxisId="left" type="monotone" dataKey="total" name="Total (Bs.)" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Bar yAxisId="right" dataKey="cantidad" name="Transacciones" fill="#e2f8f5" stroke="#0d9488" radius={[4, 4, 0, 0]} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Section>

            {/* ── Fila gráficos: Top productos + Pedidos + Niveles ── */}
            <div className="grid gap-5 lg:grid-cols-5">
              {/* Barras top productos */}
              <div className="lg:col-span-3">
                <Section title="Top productos vendidos">
                  {data.top_productos.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-400">Sin datos</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={data.top_productos} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                        <YAxis dataKey="nombre" type="category" tick={{ fontSize: 10 }} width={110}
                          tickFormatter={(v) => v.length > 18 ? v.slice(0, 17) + "…" : v} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="cantidad" name="Unidades" radius={[0, 6, 6, 0]}>
                          {data.top_productos.map((_, i) => (
                            <Cell key={i} fill={`hsl(${175 - i * 12}, 70%, ${45 + i * 3}%)`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Section>
              </div>

              {/* Donas: pedidos y niveles */}
              <div className="lg:col-span-2 space-y-5">
                <Section title="Pedidos por estado">
                  {donutPedidos.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">Sin pedidos</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={donutPedidos} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                          {donutPedidos.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip formatter={(v, n) => [fmt(v), n]} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </Section>

                <Section title="Niveles de fidelización">
                  {donutNiveles.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">Sin datos de puntos</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={donutNiveles} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                          {donutNiveles.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip formatter={(v, n) => [fmt(v), n]} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </Section>
              </div>
            </div>

            {/* ── Distribución de opiniones ── */}
            <Section title="Distribución de opiniones (1★ — 5★)">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={distOpiniones} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 13 }} width={30} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="cantidad" name="Opiniones" radius={[0, 6, 6, 0]}>
                    {distOpiniones.map((_, i) => (
                      <Cell key={i} fill={["#ef4444", "#f97316", "#eab308", "#84cc16", "#10b981"][i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>

            {/* ── Tabla últimas ventas ── */}
            <Section title="Últimas ventas del período">
              {data.ultimas_ventas.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Sin ventas en este período</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <th className="pb-3 text-left">#</th>
                        <th className="pb-3 text-left">Cliente</th>
                        <th className="pb-3 text-left">Productos</th>
                        <th className="pb-3 text-right">Total</th>
                        <th className="pb-3 text-left">Canal</th>
                        <th className="pb-3 text-left">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.ultimas_ventas.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 font-mono text-xs text-slate-400">#{v.id}</td>
                          <td className="py-2.5 font-semibold text-slate-800">{v.cliente}</td>
                          <td className="py-2.5 max-w-[180px] truncate text-xs text-slate-500">{v.productos}</td>
                          <td className="py-2.5 text-right font-bold text-teal-700">Bs. {fmt(v.total, 2)}</td>
                          <td className="py-2.5">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${v.origen === "online" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                              {v.origen === "online" ? "Online" : "Física"}
                            </span>
                          </td>
                          <td className="py-2.5 text-xs text-slate-400">{fmtDate(v.fecha)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
