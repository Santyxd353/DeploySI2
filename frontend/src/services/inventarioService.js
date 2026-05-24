import { requestJson, requestJsonWithAuthRetry } from './apiClient';

const buildQuery = (params) => {
  if (!params) return '';
  return '?' + new URLSearchParams(params).toString();
};

const buildBodyAndHeaders = (data) => {
  if (data instanceof FormData) {
    return { body: data };
  }

  return {
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  };
};

export const categoriasService = {
  listar: (params) => requestJson(`/api/inventarios/categorias/${buildQuery(params)}`),
  crear: (data) => requestJsonWithAuthRetry('/api/inventarios/categorias/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  actualizar: (id, data) => requestJsonWithAuthRetry(`/api/inventarios/categorias/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  eliminar: (id) => requestJsonWithAuthRetry(`/api/inventarios/categorias/${id}/`, {
    method: 'DELETE',
  }),
};

export const subcategoriasService = {
  listar: (params) => requestJson(`/api/inventarios/subcategorias/${buildQuery(params)}`),
  crear: (data) => requestJsonWithAuthRetry('/api/inventarios/subcategorias/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  actualizar: (id, data) => requestJsonWithAuthRetry(`/api/inventarios/subcategorias/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  eliminar: (id) => requestJsonWithAuthRetry(`/api/inventarios/subcategorias/${id}/`, {
    method: 'DELETE',
  }),
};

export const laboratoriosService = {
  listar: (params) => requestJson(`/api/inventarios/laboratorios/${buildQuery(params)}`),
  crear: (data) => requestJsonWithAuthRetry('/api/inventarios/laboratorios/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  actualizar: (id, data) => requestJsonWithAuthRetry(`/api/inventarios/laboratorios/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  eliminar: (id) => requestJsonWithAuthRetry(`/api/inventarios/laboratorios/${id}/`, {
    method: 'DELETE',
  }),
};

export const productosService = {
  listar: (params) => requestJson(`/api/inventarios/productos/${buildQuery(params)}`),
  obtener: (id) => requestJson(`/api/inventarios/productos/${id}/`),
  crear: (data) => requestJsonWithAuthRetry('/api/inventarios/productos/', {
    method: 'POST',
    ...buildBodyAndHeaders(data),
  }),
  actualizar: (id, data) => requestJsonWithAuthRetry(`/api/inventarios/productos/${id}/`, {
    method: 'PUT',
    ...buildBodyAndHeaders(data),
  }),
  eliminar: (id) => requestJsonWithAuthRetry(`/api/inventarios/productos/${id}/`, {
    method: 'DELETE',
  }),
  obtenerInventario: (id) => requestJsonWithAuthRetry(`/api/inventarios/productos/${id}/inventario/`),
  ajustarStock: (id, data) => requestJsonWithAuthRetry(`/api/inventarios/productos/${id}/ajustar_stock/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  stockBajo: () => requestJsonWithAuthRetry('/api/inventarios/productos/stock_bajo/'),
  sinStock: () => requestJsonWithAuthRetry('/api/inventarios/productos/sin_stock/'),
  resumenStock: () => requestJsonWithAuthRetry('/api/inventarios/productos/resumen_stock/'),
};

export const movimientosService = {
  listar: (params) => requestJsonWithAuthRetry(`/api/inventarios/movimientos/${buildQuery(params)}`),
};

export const lotesService = {
  listar: (params) => requestJsonWithAuthRetry(`/api/inventarios/lotes/${buildQuery(params)}`),
  crear: (data) => requestJsonWithAuthRetry('/api/inventarios/lotes/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  bloquear: (id) => requestJsonWithAuthRetry(`/api/inventarios/lotes/${id}/bloquear/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
  }),
  anular: (id, data = {}) => requestJsonWithAuthRetry(`/api/inventarios/lotes/${id}/anular/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
};

export async function obtenerProductos(params) {
  return productosService.listar(params);
}

export async function crearEntradaStock(data) {
  return requestJsonWithAuthRetry('/api/inventarios/entradas-stock/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

export async function obtenerEntradasStock(params) {
  return requestJsonWithAuthRetry(`/api/inventarios/entradas-stock/${buildQuery(params)}`);
}

export async function obtenerUltimasEntradas() {
  return requestJsonWithAuthRetry('/api/inventarios/entradas-stock/ultimas/');
}

export async function obtenerEntradasPorProducto(productoId) {
  return requestJsonWithAuthRetry(`/api/inventarios/entradas-stock/por_producto/?producto_id=${productoId}`);
}

export async function confirmarEntradaStock(entradaId) {
  return requestJsonWithAuthRetry(`/api/inventarios/entradas-stock/${entradaId}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ estado: 'confirmada' }),
  });
}
