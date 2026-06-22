import { useState, useEffect } from "react";
import { confirmarEntradaStock, obtenerEntradasStock } from "../../services/inventarioService";

export default function HistorialEntradasStock({ refresh = 0 }) {
  const PAGE_SIZE = 6;
  const [entradas, setEntradas] = useState([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [confirmingId, setConfirmingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPage(1);
  }, [refresh]);

  useEffect(() => {
    cargarEntradas();
  }, [refresh, page]);

  const cargarEntradas = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await obtenerEntradasStock({ page, page_size: PAGE_SIZE, ordering: "-created_at" });
      const rows = Array.isArray(data) ? data : data.results || [];
      const ordered = [...rows].sort((a, b) => {
        const aPending = a?.estado === "pendiente" ? 0 : 1;
        const bPending = b?.estado === "pendiente" ? 0 : 1;
        if (aPending !== bPending) return aPending - bPending;
        return new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime();
      });
      setEntradas(ordered);
      setTotalCount(Array.isArray(data) ? ordered.length : data.count || ordered.length);
    } catch (error) {
      console.error("Error cargando entradas:", error);
      setError("Error al cargar el historial.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarEntrada = async (entradaId) => {
    try {
      setConfirmingId(entradaId);
      setError("");
      await confirmarEntradaStock(entradaId);
      await cargarEntradas();
    } catch (confirmError) {
      console.error("Error confirmando entrada:", confirmError);
      setError(confirmError?.message || "No se pudo confirmar la entrada.");
    } finally {
      setConfirmingId(null);
    }
  };

  const formatearFecha = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getMotivoLabel = (motivo) => {
    const motivos = {
      reposicion: "Reposición Proveedor",
      devolucion: "Devolución de Cliente",
      ajuste: "Ajuste de Inventario",
      correccion: "Corrección de Conteo",
      otro: "Otro",
    };
    return motivos[motivo] || motivo;
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-md mt-8">
      <h2 className="text-2xl font-black text-slate-900">Historial de entradas</h2>
      <p className="mt-2 text-sm text-slate-600">
        Visualiza el registro de todas las entradas de stock realizadas.
      </p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 text-center text-slate-500">
          <p>Cargando historial...</p>
        </div>
      ) : entradas.length === 0 ? (
        <div className="mt-6 text-center text-slate-500">
          <p>Aun no se registraron entradas de stock.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold text-slate-700">FECHA</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">SKU</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">PRODUCTO</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-700">CANTIDAD</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">MOTIVO</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">ESTADO</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">USUARIO</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">ACCION</th>
              </tr>
            </thead>
            <tbody>
              {entradas.map((entrada) => (
                <tr key={entrada.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700 text-xs">
                    {formatearFecha(entrada.created_at)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                    {entrada.producto_sku || entrada.producto}
                  </td>
                  <td className="px-4 py-3 text-slate-900 font-medium">
                    {entrada.producto_nombre}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-900 font-semibold">
                    {entrada.cantidad}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <span className="inline-block px-2 py-1 bg-teal-100 text-teal-800 rounded text-xs font-medium">
                      {getMotivoLabel(entrada.motivo)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 text-xs">
                    <span
                      className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                        entrada.estado === "pendiente"
                          ? "bg-amber-100 text-amber-800"
                          : entrada.estado === "confirmada"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {entrada.estado_display || entrada.estado || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 text-xs">
                    {entrada.usuario_nombre || "Sistema"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {entrada.estado === "pendiente" ? (
                      <button
                        type="button"
                        onClick={() => handleConfirmarEntrada(entrada.id)}
                        disabled={confirmingId === entrada.id}
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                      >
                        {confirmingId === entrada.id ? "Confirmando..." : "Confirmar entrada"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-slate-600">
            Mostrando pagina {page} de {totalPages} · {totalCount} registros
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || loading}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || loading}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
