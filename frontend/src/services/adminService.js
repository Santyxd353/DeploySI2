import { getApiBaseUrl, requestJsonWithAuthRetry } from "./apiClient";

function authHeaders(accessToken) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

export async function listAdminUsers(accessToken, params = {}) {
  const query = new URLSearchParams();

  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("page_size", String(params.pageSize));

  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }

  if (params.role && params.role !== "all") {
    query.set("role", params.role);
  }

  if (params.status && params.status !== "all") {
    query.set("status", params.status);
  }

  const queryString = query.toString();
  const endpoint = queryString
    ? `${getApiBaseUrl()}/api/admin/users/?${queryString}`
    : `${getApiBaseUrl()}/api/admin/users/`;

  return requestJsonWithAuthRetry(endpoint, {
    method: "GET",
    headers: authHeaders(accessToken),
  });
}

export async function updateAdminUser(accessToken, userId, payload) {
  return requestJsonWithAuthRetry(`${getApiBaseUrl()}/api/admin/users/${userId}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export async function createAdminUser(accessToken, payload) {
  return requestJsonWithAuthRetry(`${getApiBaseUrl()}/api/admin/users/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminUser(accessToken, userId) {
  return requestJsonWithAuthRetry(`${getApiBaseUrl()}/api/admin/users/${userId}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

export async function listRoles(accessToken) {
  return requestJsonWithAuthRetry(`${getApiBaseUrl()}/api/admin/roles/`, {
    method: "GET",
    headers: authHeaders(accessToken),
  });
}

export async function listPermissionsCatalog(accessToken) {
  return requestJsonWithAuthRetry(`${getApiBaseUrl()}/api/admin/permisos/`, {
    method: "GET",
    headers: authHeaders(accessToken),
  });
}

export async function getBitacora(params = {}, accessToken) {
  const query = new URLSearchParams();

  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("page_size", String(params.pageSize));

  if (params.accion && params.accion !== "all") {
    query.set("accion", params.accion);
  }

  if (params.modulo && params.modulo !== "all") {
    query.set("modulo", params.modulo);
  }

  if (params.resultado && params.resultado !== "all") {
    query.set("resultado", params.resultado);
  }

  if (params.usuario_id && params.usuario_id !== "all") {
    query.set("usuario_id", String(params.usuario_id));
  }

  if (params.fecha_desde) {
    query.set("fecha_desde", params.fecha_desde);
  }

  if (params.fecha_hasta) {
    query.set("fecha_hasta", params.fecha_hasta);
  }

  const queryString = query.toString();
  const endpoint = queryString
    ? `${getApiBaseUrl()}/api/admin/bitacora/?${queryString}`
    : `${getApiBaseUrl()}/api/admin/bitacora/`;

  return requestJsonWithAuthRetry(endpoint, {
    method: "GET",
    headers: authHeaders(accessToken),
  });
}

export async function createRole(accessToken, payload) {
  return requestJsonWithAuthRetry(`${getApiBaseUrl()}/api/admin/roles/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export async function updateRolePermissions(accessToken, roleName, payload) {
  return requestJsonWithAuthRetry(`${getApiBaseUrl()}/api/admin/roles/${roleName}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export async function deleteRole(accessToken, roleName) {
  return requestJsonWithAuthRetry(`${getApiBaseUrl()}/api/admin/roles/${roleName}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

// add funciones para laboratorios...
export async function listLaboratorios(accessToken, params = {}) {
  const query = new URLSearchParams();

  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("page_size", String(params.pageSize));

  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }

  if (params.status && params.status !== "all") {
    query.set("status", params.status);
  }

  const queryString = query.toString();

  const endpoint = queryString
    ? `${getApiBaseUrl()}/api/inventarios/laboratorios/?${queryString}`
    : `${getApiBaseUrl()}/api/inventarios/laboratorios/`;

  return requestJsonWithAuthRetry(endpoint, {
    method: "GET",
    headers: authHeaders(accessToken),
  });
}

export async function createLaboratorio(accessToken, payload) {
  return requestJsonWithAuthRetry(`${getApiBaseUrl()}/api/inventarios/laboratorios/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export async function updateLaboratorio(accessToken, id, payload) {
  return requestJsonWithAuthRetry(`${getApiBaseUrl()}/api/inventarios/laboratorios/${id}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export async function deleteLaboratorio(accessToken, id) {
  return requestJsonWithAuthRetry(`${getApiBaseUrl()}/api/inventarios/laboratorios/${id}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

export async function activarLaboratorio(accessToken, id) {
  return requestJsonWithAuthRetry(`${getApiBaseUrl()}/api/inventarios/laboratorios/${id}/activar/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ estado: true }),
  });
}

// add funciones para categorías...

export async function listCategorias(accessToken, params = {}) {
  const query = new URLSearchParams();

  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("page_size", String(params.pageSize));

  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }

  if (params.status && params.status !== "all") {
    query.set("status", params.status);
  }

  const queryString = query.toString();

  const endpoint = queryString
    ? `${getApiBaseUrl()}/api/inventarios/categorias/?${queryString}`
    : `${getApiBaseUrl()}/api/inventarios/categorias/`;

  return requestJsonWithAuthRetry(endpoint, {
    method: "GET",
    headers: authHeaders(accessToken),
  });
}

export async function createCategoria(accessToken, payload) {
  return requestJsonWithAuthRetry(`${getApiBaseUrl()}/api/inventarios/categorias/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export async function updateCategoria(accessToken, id, payload) {
  return requestJsonWithAuthRetry(`${getApiBaseUrl()}/api/inventarios/categorias/${id}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export async function deleteCategoria(accessToken, id) {
  return requestJsonWithAuthRetry(`${getApiBaseUrl()}/api/inventarios/categorias/${id}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

//add funciones para subcategorías...
/*
export async function listSubcategorias(accessToken, categoriaId) {
  const url = categoriaId
    ? `${getApiBaseUrl()}/api/inventarios/subcategorias/?categoria=${categoriaId}`
    : `${getApiBaseUrl()}/api/inventarios/subcategorias/`;

  return requestJsonWithAuthRetry(url, {
    method: "GET",
    headers: authHeaders(accessToken),
  });
}
*/
export async function listSubcategorias(accessToken, params = {}) {
  const query = new URLSearchParams();

  if (params.categoria) query.set("categoria", params.categoria);
  if (params.status && params.status !== "all") {
    query.set("status", params.status);
  }

  const endpoint = `${getApiBaseUrl()}/api/inventarios/subcategorias/?${query.toString()}`;

  return requestJsonWithAuthRetry(endpoint, {
    method: "GET",
    headers: authHeaders(accessToken),
  });
}

export async function createSubcategoria(accessToken, payload) {
  return requestJsonWithAuthRetry(`${getApiBaseUrl()}/api/inventarios/subcategorias/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export async function updateSubcategoria(accessToken, id, payload) {
  return requestJsonWithAuthRetry(`${getApiBaseUrl()}/api/inventarios/subcategorias/${id}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export async function deleteSubcategoria(accessToken, id) {
  return requestJsonWithAuthRetry(`${getApiBaseUrl()}/api/inventarios/subcategorias/${id}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}