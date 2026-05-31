import { requestJsonWithAuthRetry } from "./apiClient";

const buildQuery = (params) => {
  if (!params) return "";
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== "")
  );
  if (Object.keys(filtered).length === 0) return "";
  return `?${new URLSearchParams(filtered).toString()}`;
};

export const ventasService = {
  /**
   * GET /api/ventas/historial/
   * params: { cliente_id?, page?, page_size?, estado?, fecha_desde?, fecha_hasta? }
   *
   * RBAC:
   *  - admin/farmacéutico/cajero: pueden pasar cliente_id para ver historial ajeno
   *  - ROLE_CLIENTE: siempre ve solo sus propias ventas (backend ignora cliente_id)
   *
   * Devuelve: { count, page, page_size, next, previous, results[], resumen, productos_frecuentes[] }
   */
  historialVentas: (params) =>
    requestJsonWithAuthRetry(`/api/ventas/historial/${buildQuery(params)}`),
};
