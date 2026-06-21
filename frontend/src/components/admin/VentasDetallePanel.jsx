import { useState, useEffect } from "react";

function SearchIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function ChevronLeftIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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

export default function VentasDetallePanel({ data }) {
  // Estado para filtros y paginación
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("");
  const [origen, setOrigen] = useState("");
  const [transacciones, setTransacciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);

  // Simular datos de transacciones
  useEffect(() => {
    loadTransacciones();
  }, [page, search, estado, origen]);

  const loadTransacciones = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", page);
      params.append("page_size", pageSize);
      if (search) params.append("search", search);
      if (estado) params.append("estado", estado);
      if (origen) params.append("origen", origen);

      // Intentar cargar datos del API real
      const response = await fetch(
        `/api/admin/ventas/lista/?${params}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTransacciones(data.results || []);
        setTotalPages(Math.ceil((data.count || 0) / pageSize));
      } else {
        // Usar datos mock si falla
        loadMockData();
      }
    } catch (error) {
      console.error("Error:", error);
      loadMockData();
    } finally {
      setLoading(false);
    }
  };

  const loadMockData = () => {
    // Datos mock para desarrollo
    const mockData = [
      {
        id: 1001,
        cliente_nombre: "Juan Pérez García",
        vendedor_nombre: "María López",
        origen: "online",
        estado: "pagada",
        estado_label: "Pagada",
        total: 245.50,
        created_at: "2026-06-21T10:30:00Z",
      },
      {
        id: 1002,
        cliente_nombre: "Rosa Martínez",
        vendedor_nombre: "Carlos Ruiz",
        origen: "fisica",
        estado: "entregada",
        estado_label: "Entregada",
        total: 125.00,
        created_at: "2026-06-21T11:15:00Z",
      },
      {
        id: 1003,
        cliente_nombre: "Pedro Soliz",
        vendedor_nombre: "Juan García",
        origen: "pos",
        estado: "pagada",
        estado_label: "Pagada",
        total: 89.75,
        created_at: "2026-06-21T12:45:00Z",
      },
      {
        id: 1004,
        cliente_nombre: "Ana Torres",
        vendedor_nombre: "María López",
        origen: "online",
        estado: "pendiente",
        estado_label: "Pendiente",
        total: 320.00,
        created_at: "2026-06-21T14:20:00Z",
      },
      {
        id: 1005,
        cliente_nombre: "Miguel Rivera",
        vendedor_nombre: "Carlos Ruiz",
        origen: "fisica",
        estado: "cancelada",
        estado_label: "Cancelada",
        total: 210.50,
        created_at: "2026-06-21T15:00:00Z",
      },
    ];

    setTransacciones(mockData);
    setTotalPages(Math.ceil(mockData.length / pageSize));
  };

  const getEstadoBadgeClass = (estado) => {
    const badgeClasses = {
      pagada: "bg-green-100 text-green-700",
      entregada: "bg-blue-100 text-blue-700",
      pendiente: "bg-yellow-100 text-yellow-700",
      cancelada: "bg-red-100 text-red-700",
    };
    return badgeClasses[estado] || "bg-slate-100 text-slate-700";
  };

  const getOrigenBadgeClass = (origen) => {
    const badgeClasses = {
      online: "bg-purple-100 text-purple-700",
      fisica: "bg-teal-100 text-teal-700",
      pos: "bg-indigo-100 text-indigo-700",
    };
    return badgeClasses[origen] || "bg-slate-100 text-slate-700";
  };

  const getOrigenLabel = (origen) => {
    const labels = {
      online: "🌐 Online",
      fisica: "🏪 Física",
      pos: "🛒 POS",
    };
    return labels[origen] || origen;
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header con filtros */}
      <div className="border-b border-slate-200 p-6">
        <h2 className="mb-4 text-lg font-bold text-slate-900">
          Transacciones Recientes
        </h2>

        {/* Filtros */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Búsqueda */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar cliente o ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2 text-sm placeholder-slate-400 focus:border-teal-500 focus:outline-none"
            />
          </div>

          {/* Estado */}
          <select
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="pagada">Pagada</option>
            <option value="pendiente">Pendiente</option>
            <option value="entregada">Entregada</option>
            <option value="cancelada">Cancelada</option>
          </select>

          {/* Origen */}
          <select
            value={origen}
            onChange={(e) => {
              setOrigen(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
          >
            <option value="">Todos los orígenes</option>
            <option value="online">Online</option>
            <option value="fisica">Física</option>
            <option value="pos">POS</option>
          </select>

          {/* Botón limpiar */}
          <button
            onClick={() => {
              setSearch("");
              setEstado("");
              setOrigen("");
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-teal-600"></div>
              <p className="mt-2 text-slate-600">Cargando transacciones...</p>
            </div>
          </div>
        ) : transacciones.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <p>No hay transacciones que coincidan con los filtros</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">
                  Vendedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">
                  Origen
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody>
              {transacciones.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-slate-200 transition hover:bg-slate-50"
                >
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm font-semibold text-teal-600">
                      #{tx.id}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-900">
                      {tx.cliente_nombre}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-600">{tx.vendedor_nombre}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getOrigenBadgeClass(
                        tx.origen
                      )}`}
                    >
                      {getOrigenLabel(tx.origen)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getEstadoBadgeClass(
                        tx.estado
                      )}`}
                    >
                      {tx.estado_label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-sm font-bold text-slate-900">
                      Bs {tx.total.toFixed(2)}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-600">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {transacciones.length > 0 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <p className="text-sm text-slate-600">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              Anterior
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Siguiente
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
