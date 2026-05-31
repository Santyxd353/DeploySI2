import { requestJson, requestJsonWithAuthRetry } from "./apiClient";

const buildQuery = (params) => {
  if (!params) return "";
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== "")
  );
  const qs = new URLSearchParams(filtered).toString();
  return qs ? `?${qs}` : "";
};

export const opinionesService = {
  // ── Admin ────────────────────────────────────────────────────────────────
  listar: (params) => requestJson(`/api/opiniones/${buildQuery(params)}`),
  obtener: (id) => requestJson(`/api/opiniones/${id}/`),
  responder: (id, data) =>
    requestJsonWithAuthRetry(`/api/opiniones/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  eliminar: (id) =>
    requestJsonWithAuthRetry(`/api/opiniones/${id}/`, { method: "DELETE" }),
  metricas: (params) => requestJson(`/api/opiniones/metricas/${buildQuery(params)}`),

  // ── Cliente ──────────────────────────────────────────────────────────────
  mias: (params) => requestJson(`/api/opiniones/mias/${buildQuery(params)}`),
  crear: (data) =>
    requestJsonWithAuthRetry("/api/opiniones/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
};
