import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CRMLayout from "../../components/crm/CRMLayout";
import { clientesService } from "../../services/clientesService";

const PAGE_SIZE = 10;

const PRESETS = [
  { label: "Todos", frecuencia_min: "", inactivo_dias: "" },
  { label: "Frecuentes (10+)", frecuencia_min: "10", inactivo_dias: "" },
  { label: "Inactivos (30 d.)", frecuencia_min: "", inactivo_dias: "30" },
];

function formatFecha(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMonto(monto) {
  return new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" }).format(monto);
}

function presetIndexOf(frecuencia_min, inactivo_dias) {
  return PRESETS.findIndex(
    (p) => p.frecuencia_min === frecuencia_min && p.inactivo_dias === inactivo_dias
  );
}

export default function SegmentacionClientesPage() {
  const navigate = useNavigate();

  // Filter state (draft = what's in the inputs, applied = what was last fetched)
  const [frecuenciaMin, setFrecuenciaMin] = useState("");
  const [inactivoDias, setInactivoDias] = useState("");
  const [appliedParams, setAppliedParams] = useState({});

  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  // Fetch whenever appliedParams changes
  useEffect(() => {
    setLoading(true);
    setError("");
    setPage(1);
    clientesService
      .segmentacion(appliedParams)
      .then((data) => setClientes(Array.isArray(data) ? data : []))
      .catch(() => setError("No se pudo cargar la segmentación de clientes."))
      .finally(() => setLoading(false));
  }, [appliedParams]);

  function applyFilters() {
    const params = {};
    const fm = parseInt(frecuenciaMin, 10);
    const id = parseInt(inactivoDias, 10);
    if (!Number.isNaN(fm) && fm > 0) params.frecuencia_min = fm;
    if (!Number.isNaN(id) && id > 0) params.inactivo_dias = id;
    setAppliedParams(params);
  }

  function applyPreset(preset) {
    setFrecuenciaMin(preset.frecuencia_min);
    setInactivoDias(preset.inactivo_dias);
    const params = {};
    if (preset.frecuencia_min) params.frecuencia_min = parseInt(preset.frecuencia_min, 10);
    if (preset.inactivo_dias) params.inactivo_dias = parseInt(preset.inactivo_dias, 10);
    setAppliedParams(params);
  }

  function clearFilters() {
    setFrecuenciaMin("");
    setInactivoDias("");
    setAppliedParams({});
  }

  // Pagination
  const totalPages = Math.max(1, Math.ceil(clientes.length / PAGE_SIZE));
  const pageClientes = useMemo(
    () => clientes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [clientes, page]
  );
  const paginationText = useMemo(() => {
    if (!clientes.length) return "0 resultados";
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, clientes.length);
    return `Mostrando ${start}–${end} de ${clientes.length}`;
  }, [page, clientes.length]);

  const activePreset = presetIndexOf(frecuenciaMin, inactivoDias);
  const hasCustomFilters = frecuenciaMin !== "" || inactivoDias !== "";

  function exportarCSV() {
    if (!clientes.length) return;
    const headers = ["Nombres", "Apellidos", "Email", "Teléfono", "# Compras", "Última compra", "Monto total"];
    const rows = clientes.map((c) => [
      c.nombres,
      c.apellidos,
      c.email,
      c.telefono,
      c.num_compras,
      c.ultima_compra ? new Date(c.ultima_compra).toISOString().slice(0, 10) : "",
      c.monto_total,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `segmentacion_clientes_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <CRMLayout activeSection="segmentos">
      <section className="rounded-[28px] border border-slate-200 bg-white/97 p-4 shadow-md sm:p-5">

        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Segmentación de Clientes</h1>
            <p className="text-sm text-slate-500">Agrupa clientes según su frecuencia de compra</p>
          </div>
          <button
            onClick={exportarCSV}
            disabled={!clientes.length}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Exportar CSV
          </button>
        </div>

        {/* Presets rápidos */}
        <div className="mb-3 flex flex-wrap gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className={`rounded-xl border px-4 py-1.5 text-sm font-semibold transition-colors ${
                activePreset === i
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Filtros ajustables */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Filtros personalizados
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-500">Min. compras</span>
              <input
                type="number"
                min="0"
                placeholder="ej. 5"
                value={frecuenciaMin}
                onChange={(e) => setFrecuenciaMin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-500">Inactivo (días)</span>
              <input
                type="number"
                min="1"
                placeholder="ej. 60"
                value={inactivoDias}
                onChange={(e) => setInactivoDias(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                onClick={applyFilters}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 transition-colors"
              >
                Aplicar
              </button>
              {hasCustomFilters && (
                <button
                  onClick={clearFilters}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Estado */}
        {loading && <p className="py-12 text-center text-slate-500">Cargando...</p>}
        {!loading && error && (
          <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}
        {!loading && !error && clientes.length === 0 && (
          <p className="py-12 text-center text-slate-400">
            No hay clientes que coincidan con este filtro.
          </p>
        )}

        {/* Tabla */}
        {!loading && !error && clientes.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2 text-center">Compras</th>
                    <th className="px-3 py-2">Última compra</th>
                    <th className="px-3 py-2 text-right">Monto total</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pageClientes.map((c, idx) => (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 text-slate-400 text-xs">
                        {(page - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-800">
                        {c.nombres} {c.apellidos}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{c.email || "—"}</td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            c.num_compras >= 10
                              ? "bg-emerald-100 text-emerald-700"
                              : c.num_compras >= 3
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {c.num_compras}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{formatFecha(c.ultima_compra)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-700">
                        {formatMonto(c.monto_total)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => navigate("/admin/clientes")}
                          className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                        >
                          Ver perfil
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">{paginationText}</p>
              <div className="inline-flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                >
                  «
                </button>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                >
                  Anterior
                </button>

                {/* Páginas numeradas */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                  .reduce((acc, n, idx, arr) => {
                    if (idx > 0 && n - arr[idx - 1] > 1) acc.push("...");
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-xs text-slate-400">…</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(item)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                          page === item
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}

                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                >
                  Siguiente
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                >
                  »
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </CRMLayout>
  );
}
