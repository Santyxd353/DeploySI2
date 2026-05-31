import { useCallback, useEffect, useState } from "react";
import CRMLayout from "../../components/crm/CRMLayout";
import { ShieldIcon, CloseIcon, PencilIcon } from "../../components/ui/Icons";
import {
  limitesDispensacionService,
  productosService,
} from "../../services/inventarioService";

// ── Modal ─────────────────────────────────────────────────────────────────────

function LimiteModal({ producto, limiteExistente, onClose, onSaved }) {
  const [form, setForm] = useState({
    cantidad_maxima: limiteExistente ? String(limiteExistente.cantidad_maxima) : "",
    periodo_dias: limiteExistente ? String(limiteExistente.periodo_dias) : "30",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const cantidad = parseInt(form.cantidad_maxima, 10);
    const periodo = parseInt(form.periodo_dias, 10);
    if (!cantidad || cantidad < 1) return setError("La cantidad máxima debe ser mayor a 0.");
    if (!periodo || periodo < 1) return setError("El periodo debe ser mayor a 0 días.");

    setSaving(true);
    try {
      if (limiteExistente) {
        await limitesDispensacionService.actualizar(limiteExistente.id, {
          cantidad_maxima: cantidad,
          periodo_dias: periodo,
        });
      } else {
        await limitesDispensacionService.crear({
          producto: producto.id,
          cantidad_maxima: cantidad,
          periodo_dias: periodo,
        });
      }
      onSaved();
    } catch (err) {
      const msg =
        err?.cantidad_maxima?.[0] ||
        err?.periodo_dias?.[0] ||
        err?.producto?.[0] ||
        err?.detail ||
        "Error al guardar el límite.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!limiteExistente) return;
    if (!window.confirm("¿Eliminar el límite de dispensación de este producto?")) return;
    setSaving(true);
    try {
      await limitesDispensacionService.eliminar(limiteExistente.id);
      onSaved();
    } catch {
      setError("No se pudo eliminar el límite.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div>
            <h2 className="text-sm font-black text-slate-900">
              {limiteExistente ? "Editar límite" : "Nuevo límite"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {producto.nombre_comercial}{" "}
              <span className="font-mono text-slate-400">({producto.sku})</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-200"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">
              Cantidad máxima por cliente
            </label>
            <input
              type="number"
              min="1"
              value={form.cantidad_maxima}
              onChange={(e) => setForm((p) => ({ ...p, cantidad_maxima: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="Ej: 2"
              autoFocus
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Unidades totales permitidas por cliente en el periodo.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Periodo (días)</label>
            <input
              type="number"
              min="1"
              value={form.periodo_dias}
              onChange={(e) => setForm((p) => ({ ...p, periodo_dias: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="Ej: 30"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Ventana de tiempo en días para contabilizar dispensaciones previas.
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
            {limiteExistente ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
              >
                Eliminar límite
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Guardando…" : limiteExistente ? "Guardar cambios" : "Crear límite"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AdminLimitesDispensacionPage() {
  const [productos, setProductos] = useState([]);
  const [limites, setLimites] = useState({}); // { producto_id: limite_obj }
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState("todos"); // "todos" | "con_limite" | "sin_limite"
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [modal, setModal] = useState(null); // { producto, limite | null }

  const PAGE_SIZE = 15;

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (search) params.search = search;

      const [productosRes, limitesRes] = await Promise.all([
        productosService.listar(params),
        limitesDispensacionService.listar(),
      ]);

      const lista = Array.isArray(productosRes)
        ? productosRes
        : (productosRes.results ?? []);
      const count = productosRes.count ?? lista.length;

      const limitesMap = {};
      const limitesArr = Array.isArray(limitesRes)
        ? limitesRes
        : (limitesRes.results ?? []);
      limitesArr.forEach((l) => { limitesMap[l.producto] = l; });

      setProductos(lista);
      setTotalCount(count);
      setLimites(limitesMap);
    } catch {
      setProductos([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const productosFiltrados = productos.filter((p) => {
    if (filtro === "con_limite") return !!limites[p.id];
    if (filtro === "sin_limite") return !limites[p.id];
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleSaved = () => {
    setModal(null);
    cargar();
  };

  return (
    <CRMLayout activeSection="limites">
      <div className="space-y-4">
        {/* Header */}
        <div className="rounded-[28px] border border-slate-200 bg-white/97 p-5 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">Límites de Dispensación</h2>
              <p className="text-xs text-slate-500">
                Controla la cantidad máxima que un cliente puede dispensar de un producto en un periodo.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
              <ShieldIcon className="h-3.5 w-3.5" />
              {Object.keys(limites).length} producto(s) con límite
            </span>
          </div>

          {/* Filtros */}
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar producto…"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <div className="flex overflow-hidden rounded-xl border border-slate-200">
              {[
                { key: "todos", label: "Todos" },
                { key: "con_limite", label: "Con límite" },
                { key: "sin_limite", label: "Sin límite" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFiltro(key)}
                  className={`px-3 py-2 text-xs font-bold transition ${
                    filtro === key
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="rounded-[28px] border border-slate-200 bg-white/97 shadow-md">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-xs text-slate-400">
              Cargando productos…
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
              <ShieldIcon className="h-10 w-10 opacity-30" />
              <p className="text-xs font-semibold">No hay productos para los filtros aplicados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3">Producto</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3 text-center">Controlado</th>
                    <th className="px-4 py-3 text-center">Límite configurado</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productosFiltrados.map((p) => {
                    const limite = limites[p.id] ?? null;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-3">
                          <p className="font-bold text-slate-900">{p.nombre_comercial}</p>
                          {p.nombre_generico && (
                            <p className="mt-0.5 text-slate-400">{p.nombre_generico}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700">{p.sku}</td>
                        <td className="px-4 py-3 text-slate-600">{p.categoria_nombre}</td>
                        <td className="px-4 py-3 text-center">
                          {p.es_controlado ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                              Sí
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {limite ? (
                            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                              máx {limite.cantidad_maxima} u. / {limite.periodo_dias} días
                            </span>
                          ) : (
                            <span className="text-slate-400">Sin límite</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setModal({ producto: p, limite })}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
                          >
                            <PencilIcon className="h-3 w-3" />
                            {limite ? "Editar" : "Configurar"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-xs text-slate-500">
                Página {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <LimiteModal
          producto={modal.producto}
          limiteExistente={modal.limite}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </CRMLayout>
  );
}
