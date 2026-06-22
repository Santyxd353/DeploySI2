import { useCallback, useEffect, useRef, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import {
  CheckCircleIcon,
  TruckIcon,
  UserIcon,
  XIcon,
} from "../../components/ui/Icons";
import { pedidosService } from "../../services/pedidosService";

// ── Constantes ────────────────────────────────────────────────────────────────

const ESTADOS = [
  { value: "", label: "Todos" },
  { value: "pagado", label: "Pagado" },
  { value: "aceptado", label: "Aceptado" },
  { value: "preparando", label: "Preparando" },
  { value: "listo", label: "Listo" },
  { value: "en_camino", label: "En camino" },
  { value: "cerca", label: "Cerca" },
  { value: "entregado", label: "Entregado" },
  { value: "no_entregado", label: "No entregado" },
  { value: "cancelado", label: "Cancelado" },
];

const TRANSICIONES = {
  pagado: ["aceptado", "cancelado"],
  aceptado: ["preparando", "cancelado"],
  preparando: ["listo", "cancelado"],
  listo: ["en_camino", "cancelado"],
  en_camino: ["cerca", "entregado", "no_entregado"],
  cerca: ["entregado", "no_entregado"],
  no_entregado: ["en_camino", "cancelado"],
  entregado: [],
  cancelado: [],
};

const ESTADO_COLORS = {
  pagado: "bg-blue-100 text-blue-800",
  aceptado: "bg-cyan-100 text-cyan-800",
  preparando: "bg-yellow-100 text-yellow-800",
  listo: "bg-purple-100 text-purple-800",
  en_camino: "bg-orange-100 text-orange-800",
  cerca: "bg-amber-100 text-amber-800",
  entregado: "bg-green-100 text-green-800",
  no_entregado: "bg-red-100 text-red-800",
  cancelado: "bg-gray-100 text-gray-600",
};

const ESTADO_LABELS = {
  pagado: "Pagado",
  aceptado: "Aceptado",
  preparando: "Preparando",
  listo: "Listo",
  en_camino: "En camino",
  cerca: "Cerca",
  entregado: "Entregado",
  no_entregado: "No entregado",
  cancelado: "Cancelado",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function EstadoBadge({ estado }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${ESTADO_COLORS[estado] ?? "bg-gray-100 text-gray-600"}`}>
      {ESTADO_LABELS[estado] ?? estado}
    </span>
  );
}

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("es-BO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtMoney(v) {
  return `${parseFloat(v || 0).toFixed(2)} Bs.`;
}

// ── Mapa Leaflet ──────────────────────────────────────────────────────────────

function MapaEntrega({ lat, lon }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!lat || !lon || !mapRef.current) return;
    if (mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const map = L.map(mapRef.current).setView([parseFloat(lat), parseFloat(lon)], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      const icon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });

      L.marker([parseFloat(lat), parseFloat(lon)], { icon })
        .addTo(map)
        .bindPopup("Punto de entrega")
        .openPopup();

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lon]);

  if (!lat || !lon) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
        Sin coordenadas de entrega
      </div>
    );
  }

  return <div ref={mapRef} className="h-48 w-full rounded-xl" />;
}

// ── Modal detalle ─────────────────────────────────────────────────────────────
// El backend (PedidoDetalleSerializer) devuelve campos planos:
//   cliente_nombre, cliente_email, repartidor_nombre, total, items[], historial[]

function ModalDetalle({ pedido, onClose, onEstadoCambiado }) {
  const [repartidores, setRepartidores] = useState([]);
  const [selectedRepartidor, setSelectedRepartidor] = useState("");
  const [nuevoEstado, setNuevoEstado] = useState("");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    pedidosService.listarRepartidores().then((r) => setRepartidores(r.results ?? []));
  }, []);

  const transicionesDisponibles = TRANSICIONES[pedido.estado] ?? [];

  async function handleCambiarEstado() {
    if (!nuevoEstado) return;
    setLoading(true);
    setError("");
    try {
      const updated = await pedidosService.cambiarEstado(pedido.id, nuevoEstado, notas);
      onEstadoCambiado(updated);
      setNuevoEstado("");
      setNotas("");
    } catch (e) {
      setError(e?.detail || "Error al cambiar estado");
    } finally {
      setLoading(false);
    }
  }

  async function handleAsignarRepartidor() {
    if (!selectedRepartidor) return;
    setLoading(true);
    setError("");
    try {
      const updated = await pedidosService.asignarRepartidor(pedido.id, selectedRepartidor);
      onEstadoCambiado(updated);
    } catch (e) {
      setError(e?.detail || "Error al asignar repartidor");
    } finally {
      setLoading(false);
    }
  }

  const items = pedido.items ?? [];
  const historial = pedido.historial ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50">
              <TruckIcon className="h-5 w-5 text-teal-600" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pedido</p>
              <h2 className="text-lg font-black text-slate-900">#{pedido.id}</h2>
            </div>
            <EstadoBadge estado={pedido.estado} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* Datos cliente */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Cliente</p>
            <p className="text-sm font-semibold text-slate-800">{pedido.cliente_nombre || "—"}</p>
            <p className="text-xs text-slate-500">{pedido.cliente_email || "—"}</p>
            {pedido.direccion_texto && (
              <p className="text-xs text-slate-600 mt-1">📍 {pedido.direccion_texto}</p>
            )}
          </div>

          {/* Mapa */}
          <MapaEntrega lat={pedido.lat_entrega} lon={pedido.lon_entrega} />

          {/* Productos */}
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Productos</p>
            {items.length === 0 ? (
              <p className="text-xs text-slate-400">Sin productos</p>
            ) : (
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{item.producto}</span>
                    <span className="text-slate-500">x{item.cantidad} · {fmtMoney(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 border-t border-slate-100 pt-2 flex justify-between text-sm font-bold">
              <span>Total</span>
              <span>{fmtMoney(pedido.total)}</span>
            </div>
          </div>

          {/* Repartidor */}
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Repartidor</p>
            {pedido.repartidor_nombre ? (
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100">
                  <UserIcon className="h-4 w-4 text-teal-600" />
                </span>
                <p className="text-sm font-semibold text-slate-800">{pedido.repartidor_nombre}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400 mb-3">Sin asignar</p>
            )}

            <div className="flex gap-2">
              <select
                value={selectedRepartidor}
                onChange={(e) => setSelectedRepartidor(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Seleccionar repartidor…</option>
                {repartidores.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedRepartidor || loading}
                onClick={handleAsignarRepartidor}
                className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                Asignar
              </button>
            </div>
          </div>

          {/* Cambiar estado */}
          {transicionesDisponibles.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Cambiar estado</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {transicionesDisponibles.map((est) => (
                  <button
                    key={est}
                    type="button"
                    onClick={() => setNuevoEstado(est)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      nuevoEstado === est
                        ? "bg-teal-600 text-white"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {ESTADO_LABELS[est] ?? est}
                  </button>
                ))}
              </div>
              {nuevoEstado && (
                <>
                  <textarea
                    placeholder="Notas opcionales…"
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleCambiarEstado}
                    className="mt-2 w-full rounded-xl bg-teal-600 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                  >
                    {loading ? "Guardando…" : `Cambiar a "${ESTADO_LABELS[nuevoEstado]}"`}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Historial */}
          {historial.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Historial</p>
              <div className="space-y-2">
                {historial.map((h) => (
                  <div key={h.id} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100">
                      <CheckCircleIcon className="h-3 w-3 text-teal-600" />
                    </span>
                    <div>
                      <span className="font-semibold text-slate-700">
                        {h.estado_anterior ? `${ESTADO_LABELS[h.estado_anterior] ?? h.estado_anterior} → ` : ""}
                        {ESTADO_LABELS[h.estado_nuevo] ?? h.estado_nuevo}
                      </span>
                      {h.cambiado_por_nombre && (
                        <span className="ml-1 text-slate-400">por {h.cambiado_por_nombre}</span>
                      )}
                      <span className="ml-2 text-slate-400">{fmt(h.created_at)}</span>
                      {h.notas && <p className="text-slate-500 mt-0.5">{h.notas}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-3 text-xs text-slate-400">
          Creado: {fmt(pedido.created_at)} · Actualizado: {fmt(pedido.updated_at)}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AdminPedidosPage() {
  const [pedidos, setPedidos] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [loading, setLoading] = useState(false);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const wsRef = useRef(null);
  const pedidoSeleccionadoRef = useRef(null);
  pedidoSeleccionadoRef.current = pedidoSeleccionado;

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await pedidosService.listar({ page, page_size: 15, estado: filtroEstado || undefined });
      setPedidos(data.results ?? []);
      setTotal(data.count ?? 0);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [page, filtroEstado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // WebSocket en tiempo real — con reconexión automática exponencial
  useEffect(() => {
    const token = localStorage.getItem("auth_access_token");
    if (!token) return;

    let ws;
    let intentos = 0;
    let reconnectTimer;
    let destroyed = false;

    function conectar() {
      if (destroyed) return;
      const url = pedidosService.wsAdminUrl(token);
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => { intentos = 0; };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          // Recargar lista en cualquier evento
          cargar();
          // Si el modal está abierto y es el mismo pedido, actualizarlo
          const abierto = pedidoSeleccionadoRef.current;
          if (abierto && msg.pedido_id === abierto.id) {
            try {
              const updated = await pedidosService.detalle(abierto.id);
              setPedidoSeleccionado(updated);
            } catch (_) { /* silencioso */ }
          }
        } catch (_) { /* JSON parse error — ignorar */ }
      };

      ws.onclose = () => {
        if (destroyed) return;
        const delay = Math.min(1000 * 2 ** intentos, 30_000);
        intentos += 1;
        reconnectTimer = setTimeout(conectar, delay);
      };

      ws.onerror = () => ws.close();
    }

    conectar();

    return () => {
      destroyed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [cargar]);

  function handleEstadoCambiado(pedidoActualizado) {
    setPedidos((prev) =>
      prev.map((p) => (p.id === pedidoActualizado.id ? pedidoActualizado : p))
    );
    setPedidoSeleccionado(pedidoActualizado);
  }

  const totalPages = Math.max(1, Math.ceil(total / 15));

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Cabecera */}
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50">
                <TruckIcon className="h-5 w-5 text-teal-600" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Gestión</p>
                <h1 className="text-xl font-black text-slate-900">Pedidos</h1>
              </div>
            </div>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
              {total} pedidos
            </span>
          </div>
        </div>

        {/* Filtros por estado */}
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {ESTADOS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setFiltroEstado(value); setPage(1); }}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  filtroEstado === value
                    ? "bg-teal-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla */}
        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-400">Cargando pedidos…</div>
          ) : pedidos.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">
              No hay pedidos{filtroEstado ? ` con estado "${ESTADO_LABELS[filtroEstado]}"` : ""}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3 text-left">#</th>
                    <th className="px-5 py-3 text-left">Cliente</th>
                    <th className="px-5 py-3 text-left">Estado</th>
                    <th className="px-5 py-3 text-left">Repartidor</th>
                    <th className="px-5 py-3 text-right">Total</th>
                    <th className="px-5 py-3 text-left">Fecha</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pedidos.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3 font-mono font-bold text-slate-700">#{p.id}</td>
                      <td className="px-5 py-3 text-slate-700">{p.cliente_nombre || "—"}</td>
                      <td className="px-5 py-3">
                        <EstadoBadge estado={p.estado} />
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {p.repartidor_nombre ?? <span className="text-slate-300">Sin asignar</span>}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-800">
                        {fmtMoney(p.total)}
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs">{fmt(p.created_at)}</td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={async () => {
                            const detalle = await pedidosService.detalle(p.id);
                            setPedidoSeleccionado(detalle);
                          }}
                          className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
              <span className="text-xs text-slate-400">Página {page} de {totalPages}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal detalle */}
      {pedidoSeleccionado && (
        <ModalDetalle
          pedido={pedidoSeleccionado}
          onClose={() => setPedidoSeleccionado(null)}
          onEstadoCambiado={handleEstadoCambiado}
        />
      )}
    </AdminLayout>
  );
}
