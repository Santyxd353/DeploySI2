import { useEffect, useState } from "react";
import { ventasAdminService } from "../../services/ventasService";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon, StoreIcon, ChartBarIcon } from "../ui/Icons";

const ORIGIN_ICONS = {
  online: ChartBarIcon,
  fisica: StoreIcon,
};

const ORIGIN_LABELS = {
  online: "Online",
  fisica: "Física",
};

export default function VentasDetallePanel() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("");
  const [origen, setOrigen] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [transacciones, setTransacciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadTransacciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, estado, origen, fechaDesde, fechaHasta]);

  const loadTransacciones = async () => {
    setLoading(true);
    try {
      const data = await ventasAdminService.lista({
        page,
        page_size: pageSize,
        search,
        estado,
        origen,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
      });
      setTransacciones(data.results || []);
      setTotalPages(Math.ceil((data.count || 0) / pageSize));
    } catch (error) {
      console.error("Error cargando transacciones:", error);
      loadMockData();
    } finally {
      setLoading(false);
    }
  };

  const loadMockData = () => {
    const mockData = [
      { id: 1001, cliente_nombre: "Juan Pérez García", vendedor_nombre: "María López", origen: "online", estado: "pagada", estado_label: "Pagada", total: 245.5, created_at: "2026-06-21T10:30:00Z" },
      { id: 1002, cliente_nombre: "Rosa Martínez", vendedor_nombre: "Carlos Ruiz", origen: "fisica", estado: "entregada", estado_label: "Entregada", total: 125.0, created_at: "2026-06-21T11:15:00Z" },
      { id: 1003, cliente_nombre: "Pedro Soliz", vendedor_nombre: "Juan García", origen: "fisica", estado: "pagada", estado_label: "Pagada", total: 89.75, created_at: "2026-06-21T12:45:00Z" },
      { id: 1004, cliente_nombre: "Ana Torres", vendedor_nombre: "María López", origen: "online", estado: "pendiente", estado_label: "Pendiente", total: 320.0, created_at: "2026-06-21T14:20:00Z" },
      { id: 1005, cliente_nombre: "Miguel Rivera", vendedor_nombre: "Carlos Ruiz", origen: "fisica", estado: "cancelada", estado_label: "Cancelada", total: 210.5, created_at: "2026-06-21T15:00:00Z" },
    ];
    setTransacciones(mockData);
    setTotalPages(1);
  };

  const getEstadoBadgeClass = (estado) => {
    const badgeClasses = {
      pagada: "bg-emerald-100 text-emerald-700",
      preparando: "bg-sky-100 text-sky-700",
      entregada: "bg-blue-100 text-blue-700",
      pendiente: "bg-amber-100 text-amber-700",
      cancelada: "bg-rose-100 text-rose-700",
    };
    return badgeClasses[estado] || "bg-slate-100 text-slate-700";
  };

  const getOrigenBadgeClass = (origen) => {
    const badgeClasses = {
      online: "bg-purple-100 text-purple-700",
      fisica: "bg-teal-100 text-teal-700",
    };
    return badgeClasses[origen] || "bg-slate-100 text-slate-700";
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header con filtros */}
      <div className="border-b border-slate-200 p-5">
        <h2 className="mb-4 text-lg font-black text-slate-900">Transacciones Recientes</h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar cliente o ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

          <select
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          >
            <option value="">Todos los estados</option>
            <option value="pagada">Pagada</option>
            <option value="pendiente">Pendiente</option>
            <option value="preparando">Preparando</option>
            <option value="entregada">Entregada</option>
            <option value="cancelada">Cancelada</option>
          </select>

          <select
            value={origen}
            onChange={(e) => {
              setOrigen(e.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          >
            <option value="">Todos los orígenes</option>
            <option value="online">Online</option>
            <option value="fisica">Física</option>
          </select>

          <Button
            variant="secondary"
            onClick={() => {
              setSearch("");
              setEstado("");
              setOrigen("");
              setFechaDesde("");
              setFechaHasta("");
              setPage(1);
            }}
          >
            Limpiar filtros
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm sm:max-w-md">
          <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => {
              setFechaDesde(e.target.value);
              setPage(1);
            }}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none"
            aria-label="Fecha desde"
            title="Fecha desde"
          />
          <span className="text-slate-400">a</span>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => {
              setFechaHasta(e.target.value);
              setPage(1);
            }}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none"
            aria-label="Fecha hasta"
            title="Fecha hasta"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-600"></div>
              <p className="mt-2 text-sm text-slate-500">Cargando transacciones...</p>
            </div>
          </div>
        ) : transacciones.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <p>No hay transacciones que coincidan con los filtros</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                <th className="px-6 py-3">ID</th>
                <th className="px-6 py-3">Cliente</th>
                <th className="px-6 py-3">Vendedor</th>
                <th className="px-6 py-3">Origen</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3 text-right">Total</th>
                <th className="px-6 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {transacciones.map((tx) => {
                const OriginIcon = ORIGIN_ICONS[tx.origen];
                return (
                  <tr key={tx.id} className="border-b border-slate-100 transition hover:bg-slate-50/80">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-bold text-teal-700">#{tx.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-900">{tx.cliente_nombre}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600">{tx.vendedor_nombre}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${getOrigenBadgeClass(
                          tx.origen
                        )}`}
                      >
                        {OriginIcon ? <OriginIcon className="h-3.5 w-3.5" /> : null}
                        {ORIGIN_LABELS[tx.origen] || tx.origen}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${getEstadoBadgeClass(tx.estado)}`}>
                        {tx.estado_label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-black text-slate-900">Bs {tx.total.toFixed(2)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600">{new Date(tx.created_at).toLocaleDateString()}</p>
                    </td>
                  </tr>
                );
              })}
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
            <Button variant="secondary" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="gap-1">
              <ChevronLeftIcon className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="gap-1"
            >
              Siguiente
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
