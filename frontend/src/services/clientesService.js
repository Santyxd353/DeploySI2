import { requestJson, requestJsonWithAuthRetry } from "./apiClient";

const buildQuery = (params) => {
  if (!params) return "";
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== "")
  );
  return `?${new URLSearchParams(filtered).toString()}`;
};

export const clientesService = {
  // ── Clientes ────────────────────────────────────────────────────────────
  listar: (params) => requestJson(`/api/clientes/${buildQuery(params)}`),
  obtener: (id) => requestJson(`/api/clientes/${id}/`),
  crear: (data) =>
    requestJsonWithAuthRetry("/api/clientes/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  actualizar: (id, data) =>
    requestJsonWithAuthRetry(`/api/clientes/${id}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  eliminar: (id) =>
    requestJsonWithAuthRetry(`/api/clientes/${id}/`, { method: "DELETE" }),

  segmentacion: (params) => requestJson(`/api/clientes/segmentacion/${buildQuery(params)}`),

  historialCompras: (clienteId, params) =>
    requestJson(`/api/clientes/${clienteId}/historial-compras/${buildQuery(params)}`),

  // ── Recetas ─────────────────────────────────────────────────────────────
  listarRecetas: (clienteId, params = {}) => {
    const query = buildQuery({ cliente: clienteId, ordering: "-created_at", ...params });
    return requestJson(`/api/clientes/recetas/${query}`);
  },

  listarTodasRecetas: (params = {}) => {
    const query = buildQuery({ ordering: "-created_at", ...params });
    return requestJson(`/api/clientes/recetas/${query}`);
  },

  // FormData para multipart/form-data — no pasar Content-Type, el browser lo agrega con boundary
  crearReceta: (formData) =>
    requestJsonWithAuthRetry("/api/clientes/recetas/", {
      method: "POST",
      body: formData,
    }),

  validarReceta: (recetaId, estado, observacion = "") =>
    requestJsonWithAuthRetry(`/api/clientes/recetas/${recetaId}/validar/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado, observacion }),
    }),

  actualizarReceta: (recetaId, formData) =>
    requestJsonWithAuthRetry(`/api/clientes/recetas/${recetaId}/`, {
      method: "PATCH",
      body: formData,
    }),

  eliminarReceta: (recetaId) =>
    requestJsonWithAuthRetry(`/api/clientes/recetas/${recetaId}/`, { method: "DELETE" }),
};
