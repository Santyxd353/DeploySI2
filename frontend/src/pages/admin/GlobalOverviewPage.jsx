import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import GlobalAdminLayout from "../../components/admin/GlobalAdminLayout";
import { useAuth } from "../../context/AuthContext";
import { requestJsonWithAuthRetry } from "../../services/apiClient";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n, decimals = 0) {
  if (n == null) return "—";
  return Number(n).toLocaleString("es-BO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
}

const COLORES_PLAN = ["#059669", "#0891b2", "#7c3aed", "#ea580c", "#db2777"];

const ESTADO_LABELS = {
  activo: "Activo", suspendido: "Suspendido", cancelado: "Cancelado",
  active: "Activa", trialing: "En trial", past_due: "Vencida", canceled: "Cancelada",
};
const ESTADO_COLORS = {
  activo: "bg-emerald-100 text-emerald-700",
  suspendido: "bg-amber-100 text-amber-700",
  cancelado: "bg-red-100 text-red-700",
  active: "bg-emerald-100 text-emerald-700",
  trialing: "bg-blue-100 text-blue-700",
  past_due: "bg-orange-100 text-orange-700",
  canceled: "bg-slate-100 text-slate-600",
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = "emerald", icon: Icon }) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    cyan:    "bg-cyan-50 text-cyan-600 border-cyan-100",
    violet:  "bg-violet-50 text-violet-600 border-violet-100",
    amber:   "bg-amber-50 text-amber-600 border-amber-100",
    rose:    "bg-rose-50 text-rose-600 border-rose-100",
  };
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1 text-3xl font-black text-slate-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        {Icon && (
          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${colors[color] || colors.emerald}`}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

// ── Tooltip personalizado ─────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs">
      <p className="mb-1 font-bold text-slate-700">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{fmt(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function GlobalOverviewPage() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    requestJsonWithAuthRetry("/api/tenants/global/kpis/")
      .then(setData)
      .catch(() => setError("No se pudieron cargar los KPIs globales."))
      .finally(() => setLoading(false));
  }, []);

  // Datos para gráfico de distribución de tenants
  const donutTenants = data
    ? [
        { name: "Activos", value: data.tenants.activos },
        { name: "Suspendidos", value: data.tenants.suspendidos },
        { name: "Cancelados", value: data.tenants.cancelados },
      ].filter((d) => d.value > 0)
    : [];

  const donutColors = ["#059669", "#d97706", "#e11d48"];

  return (
    <GlobalAdminLayout currentUser={user} onLogout={logout}>
      <div className="space-y-5">
        {/* Header */}
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Dashboard</p>
          <h1 className="text-2xl font-black text-slate-900">Overview Global</h1>
          <p className="text-sm text-slate-500">Métricas de toda la plataforma SaaS</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
            Cargando KPIs…
          </div>
        )}

        {error && (
          <div className="rounded-[22px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* ── Cards ── */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiCard
                label="Farmacias activas"
                value={fmt(data.tenants.activos)}
                sub={`de ${fmt(data.tenants.total)} registradas`}
                color="emerald"
              />
              <KpiCard
                label="MRR estimado"
                value={`Bs. ${fmt(data.suscripciones.mrr, 0)}`}
                sub="Suscripciones activas + trial"
                color="cyan"
              />
              <KpiCard
                label="Nuevas este mes"
                value={fmt(data.tenants.nuevos_mes)}
                sub="Farmacias registradas"
                color="violet"
              />
              <KpiCard
                label="En trial"
                value={fmt(data.suscripciones.en_trial)}
                sub={`${fmt(data.suscripciones.past_due)} con pago vencido`}
                color="amber"
              />
            </div>

            {/* ── Gráficos fila 1 ── */}
            <div className="grid gap-5 lg:grid-cols-3">
              {/* Línea: farmacias nuevas por mes */}
              <div className="lg:col-span-2">
                <Section title="Farmacias nuevas — últimos 6 meses">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.tendencia_meses} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="nuevas" name="Nuevas" fill="#059669" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Section>
              </div>

              {/* Dona: estado de farmacias */}
              <Section title="Estado de farmacias">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={donutTenants}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {donutTenants.map((_, i) => (
                        <Cell key={i} fill={donutColors[i % donutColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </Section>
            </div>

            {/* ── Gráficos fila 2 ── */}
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Barras: suscripciones por plan */}
              <Section title="Suscripciones activas por plan">
                {data.suscripciones.por_plan.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">Sin datos</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={data.suscripciones.por_plan}
                      layout="vertical"
                      margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis dataKey="plan" type="category" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="cantidad" name="Farmacias" radius={[0, 6, 6, 0]}>
                        {data.suscripciones.por_plan.map((_, i) => (
                          <Cell key={i} fill={COLORES_PLAN[i % COLORES_PLAN.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Section>

              {/* Stats rápidos */}
              <Section title="Resumen de suscripciones">
                <div className="space-y-3">
                  {[
                    { label: "Activas", val: data.suscripciones.activas, color: "text-emerald-600" },
                    { label: "En trial", val: data.suscripciones.en_trial, color: "text-blue-600" },
                    { label: "Pago vencido", val: data.suscripciones.past_due, color: "text-orange-600" },
                    { label: "Farmacias suspendidas", val: data.tenants.suspendidos, color: "text-amber-600" },
                    { label: "Farmacias canceladas", val: data.tenants.cancelados, color: "text-red-600" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5">
                      <span className="text-sm text-slate-600">{label}</span>
                      <span className={`text-lg font-black ${color}`}>{fmt(val)}</span>
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            {/* ── Tabla: próximas a vencer ── */}
            {data.proximas_vencer?.length > 0 && (
              <Section title="Suscripciones próximas a vencer (≤ 30 días)">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <th className="pb-2 text-left">Farmacia</th>
                        <th className="pb-2 text-left">Subdominio</th>
                        <th className="pb-2 text-left">Plan</th>
                        <th className="pb-2 text-left">Vence</th>
                        <th className="pb-2 text-left">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.proximas_vencer.map((s, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 font-semibold text-slate-800">{s.tenant}</td>
                          <td className="py-2.5 text-slate-500 font-mono text-xs">{s.subdomain}</td>
                          <td className="py-2.5 text-slate-600">{s.plan}</td>
                          <td className="py-2.5 text-slate-600">{fmtDate(s.fecha_fin)}</td>
                          <td className="py-2.5">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ESTADO_COLORS[s.estado] || "bg-slate-100 text-slate-600"}`}>
                              {ESTADO_LABELS[s.estado] || s.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </GlobalAdminLayout>
  );
}
