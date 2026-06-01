import { requestJson, requestJsonWithAuthRetry } from "./apiClient";

const buildQuery = (params) => {
  if (!params) return "";
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== "")
  );
  const qs = new URLSearchParams(filtered).toString();
  return qs ? `?${qs}` : "";
};

export const publicidadService = {
  // ── Segmentos RFM ────────────────────────────────────────────────────────
  listarSegmentos: () => requestJson("/api/publicidad/segmentos/"),

  // ── Campañas (admin) ─────────────────────────────────────────────────────
  listar: (params) => requestJson(`/api/publicidad/campanas/${buildQuery(params)}`),
  obtener: (id) => requestJson(`/api/publicidad/campanas/${id}/`),

  crear: (formData) =>
    requestJsonWithAuthRetry("/api/publicidad/campanas/", {
      method: "POST",
      body: formData,
    }),

  actualizar: (id, formData) =>
    requestJsonWithAuthRetry(`/api/publicidad/campanas/${id}/`, {
      method: "PATCH",
      body: formData,
    }),

  eliminar: (id) =>
    requestJsonWithAuthRetry(`/api/publicidad/campanas/${id}/`, {
      method: "DELETE",
    }),

  // ── Campañas activas (cliente / público) ─────────────────────────────────
  activas: () => requestJsonWithAuthRetry("/api/publicidad/campanas/activas/"),
};
