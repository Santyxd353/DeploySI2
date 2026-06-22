import { requestJson, requestJsonWithAuthRetry } from './apiClient';

export const predecirDemanda = async (productoId, dias = 7) => {
  return requestJsonWithAuthRetry('/api/predicciones/demanda/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ producto_id: productoId, dias }),
  });
};

export const getRecomendacionesCompra = async () => {
  return requestJsonWithAuthRetry('/api/predicciones/recomendaciones-compra/');
};

export const getTendencias = async () => {
  return requestJsonWithAuthRetry('/api/predicciones/tendencias/');
};

export const getPatronesEstacionales = async () => {
  return requestJsonWithAuthRetry('/api/predicciones/patrones-estacionales/');
};