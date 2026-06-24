import { useEffect, useState } from "react";
import GlobalAdminLayout from "../../components/admin/GlobalAdminLayout";
import { useAuth } from "../../context/AuthContext";
import { requestJsonWithAuthRetry } from "../../services/apiClient";

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
}

const ESTADO_LABELS = { active: "Activa", trialing: "En trial", past_due: "Vencida", canceled: "Cancelada" };
const ESTADO_COLORS = {
  active: "bg-emerald-100 text-emerald-700",
  trialing: "bg-blue-100 text-blue-700",
  past_due: "bg-orange-100 text-orange-700",
  canceled: "bg-slate-100 text-slate-500",
};

export default function GlobalSuscripcionesPage() {
  const { user, logout } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("all");

  useEffect(() => {
    requestJsonWithAuthRetry("/api/tenants/global/tenants/")
      .then((data) => setTenants(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = tenants.filter((t) => {
    const matchQuery = !query || `${t.name} ${t.subdomain} ${t.schema_name}`.toLowerCase().includes(query.toLowerCase());
    const matchEstado = filtroEstado === "all" || (t.suscripcion?.estado === filtroEstado);
    return matchQuery && matchEstado;
  });

  return (
    <GlobalAdminLayout currentUser={user} onLogout={logout}>
      <div className="space-y-5">
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Gestión</p>
          <h1 className="text-2xl font-black text-slate-900">Suscripciones</h1>
          <p className="text-sm text-slate-500">Estado de suscripciones de todas las farmacias</p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Buscar farmacia…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {[["all", "Todas"], ["active", "Activas"], ["trialing", "Trial"], ["past_due", "Vencidas"], ["canceled", "Canceladas"]].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setFiltroEstado(val)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filtroEstado === val ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-white"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">Sin resultados</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3 text-left">Farmacia</th>
                    <th className="px-5 py-3 text-left">Subdominio</th>
                    <th className="px-5 py-3 text-left">Plan</th>
                    <th className="px-5 py-3 text-left">Estado suscripción</th>
                    <th className="px-5 py-3 text-left">Inicio</th>
                    <th className="px-5 py-3 text-left">Vence</th>
                    <th className="px-5 py-3 text-left">Estado farmacia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3 font-semibold text-slate-800">{t.name}</td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">{t.subdomain}</td>
                      <td className="px-5 py-3 text-slate-600">{t.suscripcion?.plan_nombre ?? "—"}</td>
                      <td className="px-5 py-3">
                        {t.suscripcion ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ESTADO_COLORS[t.suscripcion.estado] || "bg-slate-100 text-slate-500"}`}>
                            {ESTADO_LABELS[t.suscripcion.estado] || t.suscripcion.estado}
                          </span>
                        ) : <span className="text-slate-400 text-xs">Sin suscripción</span>}
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs">{fmt(t.suscripcion?.fecha_inicio)}</td>
                      <td className="px-5 py-3 text-slate-400 text-xs">{fmt(t.suscripcion?.fecha_fin)}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.status === "activo" ? "bg-emerald-100 text-emerald-700" : t.status === "suspendido" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </GlobalAdminLayout>
  );
}
