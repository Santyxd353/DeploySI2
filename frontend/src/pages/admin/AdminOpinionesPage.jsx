import { useCallback, useEffect, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import CRMLayout from "../../components/crm/CRMLayout";
import { useAuth } from "../../context/AuthContext";
import { opinionesService } from "../../services/opinionesService";

// ── Constantes ────────────────────────────────────────────────────────────────

const TIPOS = [
  { value: "", label: "Todos los tipos" },
  { value: "general", label: "General" },
  { value: "venta", label: "Venta" },
  { value: "producto", label: "Producto" },
  { value: "servicio", label: "Servicio" },
];
const ESTADOS = [
  { value: "", label: "Todos los estados" },
  { value: "pendiente", label: "Pendiente" },
  { value: "respondida", label: "Respondida" },
  { value: "escalada", label: "Escalada" },
  { value: "archivada", label: "Archivada" },
];
const ESTRELLAS_OPT = [
  { value: "", label: "Todas" },
  { value: "1", label: "1 ★" },
  { value: "2", label: "2 ★★" },
  { value: "3", label: "3 ★★★" },
  { value: "4", label: "4 ★★★★" },
  { value: "5", label: "5 ★★★★★" },
];
const DIST_COLORS = {
  "1": "#ef4444",
  "2": "#f97316",
  "3": "#eab308",
  "4": "#84cc16",
  "5": "#22c55e",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function Stars({ n }) {
  return (
    <span>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          style={{ color: i < n ? "#f59e0b" : "#d1d5db", fontSize: 16 }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function EstadoBadge({ estado }) {
  const map = {
    pendiente: "bg-yellow-100 text-yellow-800",
    respondida: "bg-green-100 text-green-800",
    escalada: "bg-red-100 text-red-800",
    archivada: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[estado] ?? "bg-gray-100 text-gray-600"}`}
    >
      {estado}
    </span>
  );
}

function normalizeList(response) {
  if (Array.isArray(response)) return { results: response, count: response.length };
  return {
    results: Array.isArray(response?.results) ? response.results : [],
    count: Number.isInteger(response?.count) ? response.count : 0,
  };
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AdminOpinionesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("opiniones.gestionar");
  const canView = hasPermission("opiniones.ver") || canManage;

  // ── Estado ────────────────────────────────────────────────────────────────
  const [opiniones, setOpiniones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState({
    tipo: "",
    estado: "",
    puntuacion: "",
    fecha_desde: "",
    fecha_hasta: "",
    sin_respuesta: "",
  });

  const [metricas, setMetricas] = useState(null);
  const [metricasLoading, setMetricasLoading] = useState(true);

  // Modal respuesta
  const [modal, setModal] = useState(null); // { opinion, respuesta, estado, saving, error }

  // ── Carga de datos ────────────────────────────────────────────────────────

  const cargarOpiniones = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: 20, ...filters };
      const res = await opinionesService.listar(params);
      const { results, count } = normalizeList(res);
      setOpiniones(results);
      setTotalCount(count);
    } catch {
      setError("Error al cargar las opiniones.");
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  const cargarMetricas = useCallback(async () => {
    setMetricasLoading(true);
    try {
      const res = await opinionesService.metricas({ dias: 30 });
      setMetricas(res);
    } catch {
      // métricas no críticas
    } finally {
      setMetricasLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) cargarOpiniones();
  }, [cargarOpiniones, canView]);

  useEffect(() => {
    if (canView) cargarMetricas();
  }, [cargarMetricas, canView]);

  // ── Acciones ──────────────────────────────────────────────────────────────

  const handleFilterChange = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const abrirModal = (opinion) =>
    setModal({
      opinion,
      respuesta: opinion.respuesta_staff || "",
      estado: opinion.estado,
      saving: false,
      error: "",
    });

  const cerrarModal = () => setModal(null);

  const guardarRespuesta = async () => {
    if (!modal) return;
    setModal((m) => ({ ...m, saving: true, error: "" }));
    try {
      await opinionesService.responder(modal.opinion.id, {
        respuesta_staff: modal.respuesta,
        estado: modal.estado,
      });
      cerrarModal();
      cargarOpiniones();
      cargarMetricas();
    } catch {
      setModal((m) => ({ ...m, saving: false, error: "Error al guardar la respuesta." }));
    }
  };

  const archivar = async (id) => {
    if (!window.confirm("¿Archivar esta opinión?")) return;
    try {
      await opinionesService.responder(id, { estado: "archivada" });
      cargarOpiniones();
      cargarMetricas();
    } catch {
      alert("Error al archivar la opinión.");
    }
  };

  const escalar = async (id) => {
    try {
      await opinionesService.responder(id, { estado: "escalada" });
      cargarOpiniones();
    } catch {
      alert("Error al escalar la opinión.");
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm("¿Eliminar permanentemente esta opinión? Esta acción no se puede deshacer.")) return;
    try {
      await opinionesService.eliminar(id);
      cargarOpiniones();
      cargarMetricas();
    } catch {
      alert("Error al eliminar la opinión.");
    }
  };

  const isUrgente = (op) =>
    op.puntuacion <= 2 &&
    !op.respuesta_staff &&
    op.estado === "pendiente" &&
    new Date() - new Date(op.created_at) > 24 * 60 * 60 * 1000;

  const totalPages = Math.ceil(totalCount / 20);

  // ── Gráfico distribución ──────────────────────────────────────────────────

  const donutData = metricas
    ? Object.entries(metricas.distribucion).map(([k, v]) => ({
        name: `${k} ★`,
        value: v,
        fill: DIST_COLORS[k],
      }))
    : [];

  // ── Render ────────────────────────────────────────────────────────────────

  if (!canView) {
    return (
      <CRMLayout activeSection="opiniones">
        <div className="p-8 text-center text-gray-500">
          No tienes permisos para ver las opiniones.
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout activeSection="opiniones">
      <div className="p-6 space-y-6">
        {/* Encabezado */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Opiniones</h1>
            <p className="text-sm text-gray-500 mt-1">
              Gestiona y responde las opiniones de tus clientes
            </p>
          </div>
        </div>

        {/* KPIs */}
        {!metricasLoading && metricas && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Promedio general"
              value={metricas.promedio ? `${metricas.promedio} ★` : "—"}
              color="yellow"
            />
            <KpiCard
              label="Total opiniones"
              value={metricas.total}
              color="blue"
            />
            <KpiCard
              label="% Respondidas"
              value={`${metricas.porcentaje_respondidas}%`}
              color="green"
            />
            <KpiCard
              label="Alertas urgentes"
              value={metricas.urgentes}
              color={metricas.urgentes > 0 ? "red" : "gray"}
            />
          </div>
        )}

        {/* Métricas: gráfico + evolución */}
        {!metricasLoading && metricas && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Donut distribución */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Distribución de estrellas
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {donutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Distribución tabla */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Conteo por puntuación
              </h2>
              <div className="space-y-2">
                {Object.entries(metricas.distribucion)
                  .sort((a, b) => Number(b[0]) - Number(a[0]))
                  .map(([stars, count]) => {
                    const pct = metricas.total ? Math.round((count / metricas.total) * 100) : 0;
                    return (
                      <div key={stars} className="flex items-center gap-2 text-sm">
                        <span className="w-12 text-gray-600">{stars} ★</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: DIST_COLORS[stars],
                            }}
                          />
                        </div>
                        <span className="w-8 text-right text-gray-700 font-medium">{count}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <select
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={filters.tipo}
              onChange={(e) => handleFilterChange("tipo", e.target.value)}
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={filters.estado}
              onChange={(e) => handleFilterChange("estado", e.target.value)}
            >
              {ESTADOS.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
            <select
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={filters.puntuacion}
              onChange={(e) => handleFilterChange("puntuacion", e.target.value)}
            >
              {ESTRELLAS_OPT.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <input
              type="date"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={filters.fecha_desde}
              onChange={(e) => handleFilterChange("fecha_desde", e.target.value)}
              placeholder="Desde"
            />
            <input
              type="date"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={filters.fecha_hasta}
              onChange={(e) => handleFilterChange("fecha_hasta", e.target.value)}
              placeholder="Hasta"
            />
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.sin_respuesta === "true"}
                onChange={(e) =>
                  handleFilterChange("sin_respuesta", e.target.checked ? "true" : "")
                }
              />
              Sin respuesta
            </label>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Cargando opiniones...</div>
          ) : opiniones.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              No hay opiniones que coincidan con los filtros.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Puntuación
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Comentario
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Fecha
                    </th>
                    {canManage && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {opiniones.map((op) => {
                    const urgente = isUrgente(op);
                    return (
                      <tr
                        key={op.id}
                        className={urgente ? "bg-red-50" : "hover:bg-gray-50"}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {urgente && (
                              <span
                                className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"
                                title="Urgente: baja puntuación sin respuesta > 24h"
                              />
                            )}
                            <span className="font-medium text-gray-900 truncate max-w-[120px]">
                              {op.cliente_nombre}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 capitalize">{op.tipo}</td>
                        <td className="px-4 py-3">
                          <Stars n={op.puntuacion} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-700 truncate max-w-[220px]">
                            {op.comentario || (
                              <span className="text-gray-400 italic">Sin comentario</span>
                            )}
                          </p>
                          {op.respuesta_staff && (
                            <p className="text-xs text-green-600 mt-0.5 truncate max-w-[220px]">
                              ↪ {op.respuesta_staff}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <EstadoBadge estado={op.estado} />
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(op.created_at).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => abrirModal(op)}
                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                Responder
                              </button>
                              {op.estado !== "escalada" && (
                                <button
                                  onClick={() => escalar(op.id)}
                                  className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                                >
                                  Escalar
                                </button>
                              )}
                              {op.estado !== "archivada" && (
                                <button
                                  onClick={() => archivar(op.id)}
                                  className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
                                >
                                  Archivar
                                </button>
                              )}
                              <button
                                onClick={() => eliminar(op.id)}
                                className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <span className="text-sm text-gray-500">
                {totalCount} opiniones — Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de respuesta */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Responder opinión
                </h2>
                <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600 text-xl">
                  ✕
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Info opinión */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800">{modal.opinion.cliente_nombre}</span>
                  <Stars n={modal.opinion.puntuacion} />
                  <span className="text-xs text-gray-400 capitalize">{modal.opinion.tipo}</span>
                </div>
                {modal.opinion.comentario && (
                  <p className="text-sm text-gray-600">{modal.opinion.comentario}</p>
                )}
              </div>

              {/* Cambiar estado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={modal.estado}
                  onChange={(e) => setModal((m) => ({ ...m, estado: e.target.value }))}
                >
                  {ESTADOS.filter((e) => e.value).map((e) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </div>

              {/* Respuesta */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Respuesta pública
                </label>
                <textarea
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                  placeholder="Escribe una respuesta visible para el cliente..."
                  value={modal.respuesta}
                  onChange={(e) => setModal((m) => ({ ...m, respuesta: e.target.value }))}
                  maxLength={1000}
                />
                <p className="text-xs text-gray-400 text-right mt-0.5">
                  {modal.respuesta.length}/1000
                </p>
              </div>

              {modal.error && (
                <p className="text-sm text-red-600">{modal.error}</p>
              )}
            </div>

            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={cerrarModal}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={guardarRespuesta}
                disabled={modal.saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {modal.saving ? "Guardando..." : "Guardar respuesta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </CRMLayout>
  );
}

// ── Sub-componente KPI ────────────────────────────────────────────────────────

function KpiCard({ label, value, color }) {
  const colorMap = {
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    red: "bg-red-50 border-red-200 text-red-700",
    gray: "bg-gray-50 border-gray-200 text-gray-700",
  };
  return (
    <div className={`border rounded-xl p-4 ${colorMap[color] ?? colorMap.gray}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
