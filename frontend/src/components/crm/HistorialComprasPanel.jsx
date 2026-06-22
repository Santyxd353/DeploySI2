import { useCallback, useEffect, useState } from "react";
import { ventasService } from "../../services/ventasService";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(num) {
  if (num === null || num === undefined) return "Bs. 0.00";
  return `Bs. ${Number(num).toFixed(2)}`;
}

const ORIGEN_BADGE = {
  fisica: "bg-blue-100 text-blue-700",
  online: "bg-violet-100 text-violet-700",
};
const ORIGEN_LABEL = { fisica: "Física", online: "Online" };

const ESTADO_BADGE = {
  pendiente: "bg-amber-100 text-amber-700",
  pagada: "bg-emerald-100 text-emerald-700",
  preparando: "bg-blue-100 text-blue-700",
  entregada: "bg-emerald-50 text-emerald-600",
  cancelada: "bg-rose-100 text-rose-700",
};
const ESTADO_LABEL = {
  pendiente: "Pendiente",
  pagada: "Pagada",
  preparando: "Preparando",
  entregada: "Entregada",
  cancelada: "Cancelada",
};

const ESTADOS_OPCIONES = [
  { value: "", label: "Todos los estados" },
  { value: "pagada", label: "Pagada" },
  { value: "entregada", label: "Entregada" },
  { value: "pendiente", label: "Pendiente" },
  { value: "preparando", label: "Preparando" },
  { value: "cancelada", label: "Cancelada" },
];

// ─── Iconos inline ─────────────────────────────────────────────────────────────

function CurrencyIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ShoppingCartIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function ClockIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ChevronIcon({ up = false, className = "h-4 w-4" }) {
  return (
    <svg className={`${className} ${up ? "rotate-180" : ""} transition-transform`} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
          <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
        </div>
        {Icon ? <div className="text-indigo-400/40"><Icon className="h-8 w-8" /></div> : null}
      </div>
    </div>
  );
}

function FiltroBarra({ filtros, onChange }) {
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex-1 min-w-[130px]">
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Estado</label>
        <select
          value={filtros.estado}
          onChange={(e) => onChange("estado", e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {ESTADOS_OPCIONES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-w-[130px]">
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Desde</label>
        <input
          type="date"
          value={filtros.fecha_desde}
          onChange={(e) => onChange("fecha_desde", e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>
      <div className="flex-1 min-w-[130px]">
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Hasta</label>
        <input
          type="date"
          value={filtros.fecha_hasta}
          onChange={(e) => onChange("fecha_hasta", e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>
      <button
        type="button"
        onClick={() => onChange("_reset")}
        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
      >
        Limpiar
      </button>
    </div>
  );
}

function Paginacion({ page, pageSize, total, onPage }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-2 pt-1">
      <p className="text-xs text-slate-500">
        Página <span className="font-bold text-slate-700">{page}</span> de <span className="font-bold text-slate-700">{totalPages}</span>
        <span className="ml-2 text-slate-400">({total} venta{total !== 1 ? "s" : ""})</span>
      </p>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Anterior
        </button>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

const FILTROS_INIT = { estado: "", fecha_desde: "", fecha_hasta: "" };

/**
 * Panel de historial de compras.
 * - clienteId: si se proporciona, el admin/staff puede ver el historial de ese cliente.
 *   Para ROLE_CLIENTE, el backend ignora el clienteId y retorna solo sus propias ventas.
 * - pageSize: filas por página (default 8)
 */
export default function HistorialComprasPanel({ clienteId, pageSize = 8 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [filtros, setFiltros] = useState(FILTROS_INIT);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        page_size: pageSize,
        ...(clienteId ? { cliente_id: clienteId } : {}),
        ...(filtros.estado ? { estado: filtros.estado } : {}),
        ...(filtros.fecha_desde ? { fecha_desde: filtros.fecha_desde } : {}),
        ...(filtros.fecha_hasta ? { fecha_hasta: filtros.fecha_hasta } : {}),
      };
      const res = await ventasService.historialVentas(params);
      setData(res);
    } catch {
      setError("No se pudieron cargar las compras.");
    } finally {
      setLoading(false);
    }
  }, [clienteId, page, pageSize, filtros]);

  useEffect(() => { load(); }, [load]);

  const handleFiltro = (key, value) => {
    if (key === "_reset") {
      setFiltros(FILTROS_INIT);
      setPage(1);
    } else {
      setFiltros((prev) => ({ ...prev, [key]: value }));
      setPage(1);
    }
  };

  // ── Estados de carga / error ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-slate-500">Cargando historial de compras...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
    );
  }

  const { results = [], count = 0, resumen = {}, productos_frecuentes = [] } = data || {};

  // ── Vista vacía ─────────────────────────────────────────────────────────────
  if (count === 0 && !filtros.estado && !filtros.fecha_desde && !filtros.fecha_hasta) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
        <p className="text-sm text-slate-500">No hay compras registradas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Total gastado" value={formatCurrency(resumen.total_gastado)} icon={CurrencyIcon} />
        <KpiCard label="Nº de compras" value={resumen.num_compras ?? 0} icon={ShoppingCartIcon} />
        <KpiCard label="Promedio por compra" value={formatCurrency(resumen.promedio_por_compra)} icon={CurrencyIcon} />
        <KpiCard label="Última compra" value={resumen.ultima_compra ? formatDate(resumen.ultima_compra) : "—"} icon={ClockIcon} />
      </div>

      {/* Productos frecuentes */}
      {productos_frecuentes.length > 0 ? (
        <div>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Productos frecuentes / Medicamentos crónicos
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Producto</th>
                  <th className="px-4 py-2.5 text-center">Veces</th>
                  <th className="px-4 py-2.5 text-center">Cant. total</th>
                </tr>
              </thead>
              <tbody>
                {productos_frecuentes.map((p) => (
                  <tr key={p.nombre} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{p.nombre}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                        {p.veces_comprado}×
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-slate-600">{p.cantidad_total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Filtros */}
      <FiltroBarra filtros={filtros} onChange={handleFiltro} />

      {/* Lista de ventas */}
      <div>
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
          Historial de ventas
        </h3>

        {results.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
            <p className="text-sm text-slate-500">Sin resultados con los filtros aplicados.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {results.map((venta) => (
              <div key={venta.id}>
                {/* Fila expandible */}
                <button
                  type="button"
                  onClick={() => setExpandedId((prev) => (prev === venta.id ? null : venta.id))}
                  className="w-full rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 px-4 py-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/30"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-800">{formatDate(venta.created_at)}</p>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${ORIGEN_BADGE[venta.origen] ?? "bg-slate-100 text-slate-600"}`}>
                          {ORIGEN_LABEL[venta.origen] ?? venta.origen}
                        </span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${ESTADO_BADGE[venta.estado] ?? "bg-slate-100 text-slate-600"}`}>
                          {ESTADO_LABEL[venta.estado] ?? venta.estado}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {venta.detalles.length} producto{venta.detalles.length !== 1 ? "s" : ""}
                        {venta.numero_factura ? ` · Factura: ${venta.numero_factura}` : ""}
                        {venta.cliente ? ` · ${venta.cliente.nombre}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <p className="font-bold text-slate-900">{formatCurrency(venta.total)}</p>
                      <ChevronIcon up={expandedId === venta.id} className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                </button>

                {/* Detalles expandidos */}
                {expandedId === venta.id ? (
                  <div className="mt-1 rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 py-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                      Detalle de items
                    </p>
                    <div className="space-y-2">
                      {venta.detalles.map((d, idx) => (
                        <div key={idx} className="flex items-start justify-between text-xs">
                          <div>
                            <p className="font-semibold text-slate-800">{d.producto_nombre}</p>
                            <p className="text-slate-500">Cantidad: {d.cantidad}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-slate-600">{d.cantidad} × {formatCurrency(d.precio_unitario)}</p>
                            <p className="font-semibold text-slate-800">{formatCurrency(d.subtotal)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 border-t border-indigo-100 pt-2">
                      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <div>
                          <p className="text-slate-500">Subtotal</p>
                          <p className="font-semibold text-slate-800">{formatCurrency(venta.subtotal)}</p>
                        </div>
                        {venta.descuento > 0 ? (
                          <div>
                            <p className="text-slate-500">Descuento</p>
                            <p className="font-semibold text-slate-800">-{formatCurrency(venta.descuento)}</p>
                          </div>
                        ) : null}
                        {venta.impuesto > 0 ? (
                          <div>
                            <p className="text-slate-500">Impuesto</p>
                            <p className="font-semibold text-slate-800">{formatCurrency(venta.impuesto)}</p>
                          </div>
                        ) : null}
                        <div>
                          <p className="text-slate-500">Total</p>
                          <p className="font-bold text-indigo-700">{formatCurrency(venta.total)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {/* Paginación */}
        <div className="mt-3">
          <Paginacion
            page={page}
            pageSize={pageSize}
            total={count}
            onPage={(p) => { setPage(p); setExpandedId(null); }}
          />
        </div>
      </div>
    </div>
  );
}
