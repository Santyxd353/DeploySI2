import { useCallback, useEffect, useMemo, useState } from "react";
import { clientesService } from "../../services/clientesService";
import ValidarRecetaModal from "./ValidarRecetaModal";
import RecetaMedicaFormModal from "./RecetaMedicaFormModal";
import { useAuth } from "../../context/AuthContext";

const PAGE_SIZE = 10;

const BADGE = {
  aprobada: "bg-emerald-100 text-emerald-700",
  pendiente: "bg-amber-100 text-amber-700",
  rechazada: "bg-rose-100 text-rose-700",
  vencida: "bg-rose-100 text-rose-700",
};

const BADGE_LABEL = {
  aprobada: "Aprobada",
  pendiente: "Pendiente",
  rechazada: "Rechazada",
  vencida: "Vencida",
};

function EstadoBadge({ estado, diasParaVencer }) {
  const isExpiringSoon =
    typeof diasParaVencer === "number" && diasParaVencer >= 0 && diasParaVencer <= 7 && estado !== "vencida";

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${BADGE[estado] ?? "bg-slate-100 text-slate-500"}`}>
        {estado === "vencida" ? (
          <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        ) : null}
        {BADGE_LABEL[estado] ?? estado}
      </span>
      {isExpiringSoon ? (
        <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
          Por vencer · {diasParaVencer}d
        </span>
      ) : null}
    </div>
  );
}

function formatDate(str) {
  if (!str) return "—";
  return new Date(str + "T00:00:00").toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
}

function normalizeList(res) {
  if (Array.isArray(res)) return { results: res, count: res.length };
  return {
    results: Array.isArray(res?.results) ? res.results : [],
    count: typeof res?.count === "number" ? res.count : 0,
  };
}

// ── MedicoCard ────────────────────────────────────────────────────────────────
function MedicoCard({ medico }) {
  if (!medico) {
    return (
      <p className="text-xs text-slate-400 italic">Sin datos del médico registrados.</p>
    );
  }
  return (
    <div className="flex flex-wrap items-start gap-4">
      {medico.firma_imagen_url ? (
        <a href={medico.firma_imagen_url} target="_blank" rel="noopener noreferrer">
          <img
            src={medico.firma_imagen_url}
            alt="Firma médico"
            className="h-16 w-auto rounded-xl border border-slate-200 object-contain shadow-sm hover:opacity-80 transition"
            title="Ver firma completa"
          />
        </a>
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-xs">
          Sin firma
        </div>
      )}
      <div className="space-y-0.5">
        <p className="text-sm font-bold text-slate-800">{medico.nombre}</p>
        {medico.licencia ? (
          <p className="text-xs text-slate-500">Licencia: <span className="font-semibold text-slate-700">{medico.licencia}</span></p>
        ) : null}
        {medico.especialidad ? (
          <p className="text-xs text-slate-500">Especialidad: <span className="font-semibold text-slate-700">{medico.especialidad}</span></p>
        ) : null}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RecetasListPanel({ clienteId = null, clienteNombre, onNuevaReceta }) {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "farmaceutico";

  const [recetas, setRecetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [validando, setValidando] = useState(null);
  const [editando, setEditando] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (estadoFilter) params.estado = estadoFilter;
      const res = clienteId
        ? await clientesService.listarRecetas(clienteId, params)
        : await clientesService.listarTodasRecetas(params);
      const { results, count } = normalizeList(res);
      setRecetas(results);
      setTotalCount(count);
    } catch {
      setError("No se pudieron cargar las recetas.");
    } finally {
      setLoading(false);
    }
  }, [clienteId, page, estadoFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (receta) => {
    if (!window.confirm(`¿Eliminar la receta ${receta.codigo}? Esta acción no se puede deshacer.`)) return;
    setDeletingId(receta.id);
    try {
      await clientesService.eliminarReceta(receta.id);
      load();
    } catch {
      alert("No se pudo eliminar la receta.");
    } finally {
      setDeletingId(null);
    }
  };

  const paginationText = useMemo(() => {
    if (!totalCount) return "0 recetas";
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, totalCount);
    return `${start}–${end} de ${totalCount}`;
  }, [page, totalCount]);

  const toggleExpand = (id) => setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div className="space-y-3">
      {/* Filters + action */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={estadoFilter}
          onChange={(e) => { setEstadoFilter(e.target.value); setPage(1); }}
          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="aprobada">Aprobada</option>
          <option value="rechazada">Rechazada</option>
          <option value="vencida">Vencida</option>
        </select>
        <div className="flex-1" />
        {canManage && onNuevaReceta ? (
          <button
            type="button"
            onClick={onNuevaReceta}
            className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
          >
            + Nueva receta
          </button>
        ) : null}
      </div>

      {error ? <p className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-8 px-2 py-2.5" />
              <th className="px-4 py-2.5">Código</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5">Médico</th>
              <th className="px-4 py-2.5">Emisión</th>
              <th className="px-4 py-2.5">Vencimiento</th>
              <th className="px-4 py-2.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">Cargando recetas...</td>
              </tr>
            ) : recetas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                  No hay recetas{estadoFilter ? ` con estado "${estadoFilter}"` : ""}.
                </td>
              </tr>
            ) : (
              recetas.map((r) => (
                <>
                  {/* Main row */}
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    {/* Expand toggle */}
                    <td className="px-2 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggleExpand(r.id)}
                        title={expandedId === r.id ? "Colapsar" : "Ver detalle médico"}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-indigo-300 hover:text-indigo-600"
                      >
                        <svg
                          className={`h-3.5 w-3.5 transition-transform ${expandedId === r.id ? "rotate-180" : ""}`}
                          viewBox="0 0 20 20" fill="currentColor"
                        >
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-700">{r.codigo}</td>
                    <td className="px-4 py-2.5">
                      <EstadoBadge estado={r.estado} diasParaVencer={r.dias_para_vencer} />
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {r.medico ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {r.medico.nombre}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{formatDate(r.fecha_emision)}</td>
                    <td className="px-4 py-2.5">
                      {r.fecha_vencimiento ? (
                        <span className={
                          r.estado === "vencida" ? "font-semibold text-rose-600"
                          : typeof r.dias_para_vencer === "number" && r.dias_para_vencer <= 7 ? "font-semibold text-orange-600"
                          : "text-slate-600"
                        }>
                          {formatDate(r.fecha_vencimiento)}
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {r.archivo_url ? (
                          <a href={r.archivo_url} target="_blank" rel="noopener noreferrer"
                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                            Ver archivo
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">Sin archivo</span>
                        )}
                        {canManage ? (
                          <button type="button" onClick={() => setEditando(r)}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                            Editar
                          </button>
                        ) : null}
                        {canManage && r.estado === "pendiente" ? (
                          <button type="button" onClick={() => setValidando(r)}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100">
                            Validar
                          </button>
                        ) : null}
                        {canManage && r.estado === "pendiente" ? (
                          <button type="button" disabled={deletingId === r.id} onClick={() => handleDelete(r)}
                            className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                            {deletingId === r.id ? "..." : "Eliminar"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded doctor detail row */}
                  {expandedId === r.id ? (
                    <tr key={`${r.id}-detail`} className="bg-indigo-50/40 border-t border-indigo-100">
                      <td colSpan={7} className="px-6 py-4">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-indigo-400">Datos del médico</p>
                        <MedicoCard medico={r.medico} />
                        {r.observacion ? (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Observaciones</p>
                            <p className="mt-0.5 text-xs text-slate-600">{r.observacion}</p>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{paginationText}</p>
        <div className="inline-flex items-center gap-2">
          <button type="button" disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40">
            Anterior
          </button>
          <span className="text-xs font-semibold text-slate-500">{page} / {totalPages}</span>
          <button type="button" disabled={loading || page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40">
            Siguiente
          </button>
        </div>
      </div>

      {/* Modals */}
      {validando ? (
        <ValidarRecetaModal
          receta={validando}
          onClose={() => setValidando(null)}
          onValidada={() => { setValidando(null); load(); }}
        />
      ) : null}

      {editando ? (
        <RecetaMedicaFormModal
          receta={editando}
          clienteNombre={clienteNombre}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); load(); }}
        />
      ) : null}
    </div>
  );
}
