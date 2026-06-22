import { getApiBaseUrl, getTenantSubdomain, requestJsonWithAuthRetry } from "./apiClient";

const buildQuery = (params) => {
  if (!params) return "";
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== "")
  );
  if (Object.keys(filtered).length === 0) return "";
  return `?${new URLSearchParams(filtered).toString()}`;
};

export const pedidosService = {
  // ── Admin ──────────────────────────────────────────────────────────────────
  listar: (params) =>
    requestJsonWithAuthRetry(`/api/pedidos/${buildQuery(params)}`),

  detalle: (id) =>
    requestJsonWithAuthRetry(`/api/pedidos/${id}/`),

  cambiarEstado: (id, estado, notas = "") =>
    requestJsonWithAuthRetry(`/api/pedidos/${id}/estado/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado, notas }),
    }),

  asignarRepartidor: (id, repartidorId) =>
    requestJsonWithAuthRetry(`/api/pedidos/${id}/repartidor/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repartidor_id: repartidorId }),
    }),

  listarRepartidores: () =>
    requestJsonWithAuthRetry("/api/pedidos/repartidores/"),

  // ── Notificaciones campana ─────────────────────────────────────────────────
  notificaciones: (params) =>
    requestJsonWithAuthRetry(`/api/pedidos/notificaciones/${buildQuery(params)}`),

  contadorNoLeidas: () =>
    requestJsonWithAuthRetry("/api/pedidos/notificaciones/no-leidas/"),

  marcarLeida: (id) =>
    requestJsonWithAuthRetry(`/api/pedidos/notificaciones/${id}/leida/`, { method: "PATCH" }),

  marcarTodasLeidas: () =>
    requestJsonWithAuthRetry("/api/pedidos/notificaciones/marcar-todas/", { method: "PATCH" }),

  // ── WebSocket URL builder ──────────────────────────────────────────────────
  wsAdminUrl: (token) => {
    const base = getApiBaseUrl().replace(/^http/, "ws");
    const subdomain = getTenantSubdomain();
    return `${base}/ws/pedidos/admin/?token=${token}${subdomain ? `&subdomain=${subdomain}` : ""}`;
  },

  wsTrackingUrl: (pedidoId, token) => {
    const base = getApiBaseUrl().replace(/^http/, "ws");
    return `${base}/ws/pedidos/${pedidoId}/tracking/?token=${token}`;
  },
};
