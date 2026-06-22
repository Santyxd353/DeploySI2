import { requestJsonWithAuthRetry } from "./apiClient";

export const reportesService = {
  catalogo: () => requestJsonWithAuthRetry("/api/reportes/catalogo/"),
  generar: ({ tipo_reporte, filtros }) =>
    requestJsonWithAuthRetry("/api/reportes/generar/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo_reporte, filtros }),
    }),
  interpretarTexto: (texto) =>
    requestJsonWithAuthRetry("/api/reportes/ia/interpretar/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto }),
    }),
  interpretarAudio: (audioBlob) => {
    const data = new FormData();
    data.append("audio", audioBlob, "reporte-audio.webm");
    return requestJsonWithAuthRetry("/api/reportes/ia/audio/", {
      method: "POST",
      body: data,
    });
  },
};
