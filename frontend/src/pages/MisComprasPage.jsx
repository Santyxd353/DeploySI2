import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import EstadisticasClientePanel from "../components/cliente/EstadisticasClientePanel";
import DetalleVentaModal from "../components/cliente/DetalleVentaModal";

function BackIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ShoppingBagIcon({ className = "h-6 w-6" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  );
}

function SearchIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function ChevronRightIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function MisComprasPage() {
  const { user, logout } = useAuth();

  // Estado de compras
  const [compras, setCompras] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [estadisticasLoading, setEstadisticasLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Filtros
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [montoMin, setMontoMin] = useState("");
  const [montoMax, setMontoMax] = useState("");

  // Modal
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  // Cargar datos al montar
  useEffect(() => {
    fetchCompras();
    fetchEstadisticas();
  }, [page, search, estado, fechaDesde, fechaHasta, montoMin, montoMax, pageSize]);

  const fetchCompras = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("page", page);
      params.append("page_size", pageSize);
      if (search) params.append("search", search);
      if (estado) params.append("estado", estado);
      if (fechaDesde) params.append("fecha_desde", fechaDesde);
      if (fechaHasta) params.append("fecha_hasta", fechaHasta);
      if (montoMin) params.append("monto_min", montoMin);
      if (montoMax) params.append("monto_max", montoMax);

      const response = await fetch(
        `/api/ventas/historial/?${params}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      if (!response.ok) throw new Error("Error cargando compras");

      const data = await response.json();
      setCompras(data.results || []);
      setTotalPages(Math.ceil((data.count || 0) / pageSize));
    } catch (error) {
      console.error("Error:", error);
      setCompras([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchEstadisticas = async () => {
    try {
      setEstadisticasLoading(true);
      const response = await fetch(
        `/api/ventas/historial/estadisticas/`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEstadisticas(data);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setEstadisticasLoading(false);
    }
  };

  const limpiarFiltros = () => {
    setSearch("");
    setEstado("");
    setFechaDesde("");
    setFechaHasta("");
    setMontoMin("");
    setMontoMax("");
    setPage(1);
  };

  const abrirDetalles = (venta) => {
    setVentaSeleccionada(venta);
    setModalAbierto(true);
  };

  const cerrarDetalles = () => {
    setModalAbierto(false);
    setTimeout(() => setVentaSeleccionada(null), 300);
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  const getEstadoBadgeClass = (estado) => {
    const classes = {
      pagada: "bg-green-100 text-green-700",
      entregada: "bg-blue-100 text-blue-700",
      cancelada: "bg-red-100 text-red-700",
      pendiente: "bg-yellow-100 text-yellow-700",
    };
    return classes[estado] || "bg-slate-100 text-slate-700";
  };

  return (
    <main className="farm-bg min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            to="/perfil"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <BackIcon className="h-4 w-4" />
            Mi perfil
          </Link>
          <button
            onClick={handleLogout}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Título */}
        <div className="mb-8 flex items-start gap-4">
          <div className="rounded-2xl bg-teal-100 p-3">
            <ShoppingBagIcon className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mis compras</h1>
            <p className="text-sm text-slate-600">
              Historial completo de tus transacciones
            </p>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="mb-8">
          <EstadisticasClientePanel
            estadisticas={estadisticas}
            loading={estadisticasLoading}
          />
        </div>

        {/* Filtros avanzados */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Filtros avanzados</h2>
            {(search || estado || fechaDesde || fechaHasta || montoMin || montoMax) && (
              <button
                onClick={limpiarFiltros}
                className="text-xs text-teal-600 font-medium hover:text-teal-700 transition"
              >
                ✕ Limpiar todos
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Búsqueda */}
            <div className="relative">
              <SearchIcon className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2 text-sm placeholder-slate-400 focus:border-teal-500 focus:outline-none"
              />
            </div>

            {/* Estado */}
            <select
              value={estado}
              onChange={(e) => {
                setEstado(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            >
              <option value="">Todos los estados</option>
              <option value="pagada">✓ Pagada</option>
              <option value="entregada">📦 Entregada</option>
              <option value="pendiente">⏳ Pendiente</option>
              <option value="cancelada">✕ Cancelada</option>
            </select>

            {/* Fecha desde */}
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => {
                setFechaDesde(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />

            {/* Fecha hasta */}
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => {
                setFechaHasta(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />

            {/* Monto mínimo */}
            <input
              type="number"
              placeholder="Monto mín"
              value={montoMin}
              onChange={(e) => {
                setMontoMin(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-teal-500 focus:outline-none"
            />

            {/* Monto máximo */}
            <input
              type="number"
              placeholder="Monto máx"
              value={montoMax}
              onChange={(e) => {
                setMontoMax(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Compras */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-teal-600"></div>
                <p className="mt-2 text-slate-600">Cargando compras...</p>
              </div>
            </div>
          ) : compras.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <p className="text-lg text-slate-600">📭 No hay compras</p>
              <p className="mt-1 text-sm text-slate-500">
                No encontramos compras que coincidan con los filtros
              </p>
            </div>
          ) : (
            compras.map((compra) => (
              <button
                key={compra.id}
                onClick={() => abrirDetalles(compra)}
                className="w-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md text-left"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">
                      Compra #{compra.id}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(compra.created_at).toLocaleDateString()} a las{" "}
                      {new Date(compra.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">
                      Bs {compra.total.toFixed(2)}
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold ${getEstadoBadgeClass(
                        compra.estado
                      )}`}
                    >
                      {compra.estado_label}
                    </span>
                  </div>
                </div>

                {/* Detalles de items */}
                <div className="mb-3 space-y-1">
                  {(compra.detalles || []).slice(0, 2).map((detalle, idx) => (
                    <p key={idx} className="text-sm text-slate-600">
                      • {detalle.producto_nombre} (x{detalle.cantidad})
                    </p>
                  ))}
                  {(compra.detalles || []).length > 2 && (
                    <p className="text-xs text-slate-500">
                      +{(compra.detalles || []).length - 2} productos más
                    </p>
                  )}
                </div>

                {/* Observación */}
                {compra.observacion && (
                  <div className="mb-3 rounded-lg bg-blue-50 p-2">
                    <p className="text-xs text-blue-700">💬 {compra.observacion}</p>
                  </div>
                )}

                {/* Click para ver detalles */}
                <div className="flex items-center justify-end text-teal-600">
                  <span className="text-xs font-semibold">Ver detalles</span>
                  <ChevronRightIcon className="h-4 w-4" />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Paginación */}
        {!loading && compras.length > 0 && totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              ← Anterior
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setPage(i + 1)}
                  className={`h-8 w-8 rounded-lg text-sm font-semibold transition ${
                    page === i + 1
                      ? "bg-teal-600 text-white"
                      : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* Modal de detalles */}
      <DetalleVentaModal
        venta={ventaSeleccionada}
        isOpen={modalAbierto}
        onClose={cerrarDetalles}
      />
    </main>
  );
}
