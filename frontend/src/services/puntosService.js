import { requestJson, requestJsonWithAuthRetry } from "./apiClient";

const buildQuery = (params) => {
  if (!params) return "";
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== null && value !== undefined && value !== "")
  );
  const query = new URLSearchParams(filtered).toString();
  return query ? `?${query}` : "";
};

const normalizeList = (response) => {
  if (Array.isArray(response)) {
    return { results: response, count: response.length };
  }

  return {
    results: Array.isArray(response?.results) ? response.results : [],
    count: Number.isInteger(response?.count) ? response.count : 0,
  };
};

export const puntosService = {
  miCuenta: () => requestJson("/api/puntos/mi-cuenta/"),
  historialMiCuenta: () => requestJson("/api/puntos/mi-cuenta/historial/"),
  catalogoPublico: () => requestJson("/api/puntos/catalogo-publico/"),
  canjear: (catalogoId) =>
    requestJsonWithAuthRetry("/api/puntos/canjear/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogo_id: catalogoId }),
    }),

  configuracionListar: () => requestJsonWithAuthRetry("/api/puntos/configuracion/"),
  configuracionCrear: (data) =>
    requestJsonWithAuthRetry("/api/puntos/configuracion/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  configuracionActualizar: (id, data) =>
    requestJsonWithAuthRetry(`/api/puntos/configuracion/${id}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  cuentasListar: (params = {}) => requestJsonWithAuthRetry(`/api/puntos/cuentas/${buildQuery(params)}`),
  transaccionesListar: (params = {}) => requestJsonWithAuthRetry(`/api/puntos/transacciones/${buildQuery(params)}`),
  canjesListar: (params = {}) => requestJsonWithAuthRetry(`/api/puntos/canjes/${buildQuery(params)}`),
  catalogoListar: (params = {}) => requestJsonWithAuthRetry(`/api/puntos/catalogo/${buildQuery(params)}`),
  productosFarmaciaListar: (params = {}) => requestJsonWithAuthRetry(`/api/inventarios/productos/${buildQuery(params)}`),
  categoriasInventarioListar: (params = {}) => requestJsonWithAuthRetry(`/api/inventarios/categorias/${buildQuery(params)}`),
  catalogoCrear: (data) =>
    requestJsonWithAuthRetry("/api/puntos/catalogo/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  catalogoActualizar: (id, data) =>
    requestJsonWithAuthRetry(`/api/puntos/catalogo/${id}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  catalogoEliminar: (id) => requestJsonWithAuthRetry(`/api/puntos/catalogo/${id}/`, { method: "DELETE" }),

  ajusteManual: (data) =>
    requestJsonWithAuthRetry("/api/puntos/transacciones/ajuste_manual/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  normalizeList,
};