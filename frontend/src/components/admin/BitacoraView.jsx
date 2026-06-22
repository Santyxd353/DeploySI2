import { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import { getBitacora } from "../../services/adminService";
import { useAuth } from "../../context/AuthContext";
import { CalendarIcon, FilterIcon } from "../ui/Icons";

function AccionBadge({ accion }) {
  const estilos = {
    LOGIN: "bg-blue-100 text-blue-700",
    LOGOUT: "bg-slate-100 text-slate-700",
    REGISTER: "bg-green-100 text-green-700",
    CREATE: "bg-emerald-100 text-emerald-700",
    UPDATE: "bg-amber-100 text-amber-700",
    DELETE: "bg-rose-100 text-rose-700",
    AJUSTE_STOCK: "bg-purple-100 text-purple-700",
    ENTRADA_STOCK: "bg-indigo-100 text-indigo-700",
  };

  const style = estilos[accion] || "bg-slate-100 text-slate-700";

  return <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${style}`}>{accion}</span>;
}

export default function BitacoraView() {
  useAuth();
  const [bitacora, setBitacora] = useState({
    results: [],
    count: 0,
    next: null,
    previous: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // Filtros
  const [filters, setFilters] = useState({
    accion: "all",
    usuario_id: "all",
    fecha_desde: "",
    fecha_hasta: "",
  });

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const loadBitacora = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getBitacora({
          page,
          pageSize,
          ...filters,
        });

        setBitacora(response);
      } catch (err) {
        console.error("Error loading bitácora:", err);
        setError("No se pudo cargar la bitácora del sistema");
      } finally {
        setLoading(false);
      }
    };

    loadBitacora();
  }, [page, pageSize, filters]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
    setPage(1); // Reset to first page when filtering
  };

  const handleResetFilters = () => {
    setFilters({
      accion: "all",
      usuario_id: "all",
      fecha_desde: "",
      fecha_hasta: "",
    });
    setPage(1);
  };

  const accionesUnicas = [
    "LOGIN",
    "LOGOUT",
    "REGISTER",
    "CREATE",
    "UPDATE",
    "DELETE",
    "AJUSTE_STOCK",
    "ENTRADA_STOCK",
  ];

  const formatearFecha = (fecha) => {
    if (!fecha) return "";
    return new Date(fecha).toLocaleString("es-BO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const totalPages = Math.ceil(bitacora.count / pageSize);

  return (
    <div className="space-y-4">
      {/* Encabezado con botón de filtros */}
      <Card className="rounded-[28px] border border-slate-200 bg-white/97 shadow-md">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900">Bitácora del Sistema</h3>
              <p className="mt-1 text-xs text-slate-500">
                Total de eventos: {bitacora.count}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <FilterIcon className="h-4 w-4" />
              Filtros
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Panel de filtros */}
      {showFilters && (
        <Card className="rounded-[28px] border border-slate-200 bg-white/97 shadow-md">
          <CardContent className="p-4 sm:p-5">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {/* Acción */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Acción</label>
                  <select
                    value={filters.accion}
                    onChange={(e) => handleFilterChange("accion", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-300"
                  >
                    <option value="all">Todas las acciones</option>
                    {accionesUnicas.map((accion) => (
                      <option key={accion} value={accion}>
                        {accion}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fecha desde */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Desde</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={filters.fecha_desde}
                      onChange={(e) => handleFilterChange("fecha_desde", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-300"
                    />
                    <CalendarIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Fecha hasta */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Hasta</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={filters.fecha_hasta}
                      onChange={(e) => handleFilterChange("fecha_hasta", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-300"
                    />
                    <CalendarIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla de bitácora */}
      <Card className="rounded-[28px] border border-slate-200 bg-white/97 shadow-md">
        <CardContent className="p-4 sm:p-5">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="text-sm text-slate-600">Cargando bitácora...</div>
            </div>
          ) : error ? (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-4">
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          ) : bitacora.results.length === 0 ? (
            <div className="flex justify-center py-8">
              <div className="text-sm text-slate-600">No hay eventos registrados</div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                      <th scope="col" className="py-2 pr-4">Fecha y hora</th>
                      <th scope="col" className="py-2 pr-4">Acción</th>
                      <th scope="col" className="py-2 pr-4">Usuario</th>
                      <th scope="col" className="py-2 pr-4">Rol</th>
                      <th scope="col" className="py-2 pr-4">Mensaje</th>
                      <th scope="col" className="py-2 pr-4">IP / Navegador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bitacora.results.map((evento) => (
                      <tr key={evento.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                        <td className="py-3 pr-4 text-xs text-slate-600 whitespace-nowrap">
                          {formatearFecha(evento.fecha_hora)}
                        </td>
                        <td className="py-3 pr-4">
                          <AccionBadge accion={evento.accion} />
                        </td>
                        <td className="py-3 pr-4 text-xs text-slate-700 font-semibold">
                          {evento.usuario_nombre && evento.usuario_apellido ? (
                            <span>{evento.usuario_nombre} {evento.usuario_apellido}</span>
                          ) : evento.usuario_email ? (
                            <span>{evento.usuario_email}</span>
                          ) : (
                            <span className="text-slate-400">Sistema</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-xs">
                          {evento.usuario_rol ? (
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700 capitalize">
                              {evento.usuario_rol}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-xs text-slate-600 max-w-xl truncate" title={evento.mensaje}>
                          {evento.mensaje}
                        </td>
                        <td className="py-3 text-xs text-slate-600 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            {evento.ip_origen && (
                              <span title={evento.ip_origen} className="text-slate-500 font-mono text-[10px]">
                                {evento.ip_origen}
                              </span>
                            )}
                            {evento.navegador && (
                              <span title={evento.navegador} className="text-slate-400 text-[10px] truncate max-w-xs">
                                {evento.navegador}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <div className="text-xs text-slate-600">
                    Página {page} de {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={!bitacora.previous}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        !bitacora.previous
                          ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={!bitacora.next}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        !bitacora.next
                          ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
