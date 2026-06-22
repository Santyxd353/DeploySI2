import { requestJsonWithAuthRetry } from './apiClient';

const buildQuery = (params) => {
  if (!params) return '';
  return '?' + new URLSearchParams(params).toString();
};

export async function buscarProductos(params) {
  return requestJsonWithAuthRetry(`/api/inventarios/productos/${buildQuery(params)}`);
}

export async function crearVentaPOS(data) {
  return requestJsonWithAuthRetry('/api/ventas/pos/crear/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function listarClientes(params) {
  return requestJsonWithAuthRetry(`/api/admin/users/${buildQuery(params)}`);
}

export async function listarCategorias(params) {
  return requestJsonWithAuthRetry(`/api/inventarios/categorias/${buildQuery(params)}`);
}
