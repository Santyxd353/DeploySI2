import { requestJsonWithAuthRetry } from "./apiClient";

const buildQuery = (params) => {
  if (!params) return "";
  const clean = Object.entries(params).reduce((acc, [key, value]) => {
    if (value === undefined || value === null || value === "") return acc;
    acc[key] = String(value);
    return acc;
  }, {});
  const query = new URLSearchParams(clean).toString();
  return query ? `?${query}` : "";
};

export const tratamientosAdminService = {
  listarBase: (params) =>
    requestJsonWithAuthRetry(`/api/admin/tratamientos/base/${buildQuery(params)}`, {
      method: "GET",
    }),

  crearBase: (payload) =>
    requestJsonWithAuthRetry("/api/admin/tratamientos/base/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  actualizarBase: (id, payload) =>
    requestJsonWithAuthRetry(`/api/admin/tratamientos/base/${id}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  desactivarBase: (id) =>
    requestJsonWithAuthRetry(`/api/admin/tratamientos/base/${id}/`, {
      method: "DELETE",
    }),

  buscarProductos: (q) =>
    requestJsonWithAuthRetry(`/api/admin/productos/buscar/${buildQuery({ q })}`, {
      method: "GET",
    }),
};
