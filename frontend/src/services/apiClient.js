function normalizeApiBaseUrl(rawValue) {
  const base = (rawValue || "http://localhost:8000").trim().replace(/\/+$/, "");
  // If env already includes /api, avoid generating /api/api/... when endpoints also start with /api.
  return base.replace(/\/api$/i, "");
}

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || "localhost";
const ACCESS_TOKEN_KEY = "auth_access_token";
const REFRESH_TOKEN_KEY = "auth_refresh_token";

function detectTenantSubdomain(hostname = window.location.hostname) {
  const host = (hostname || "").toLowerCase();
  if (!host) return "";

  if (host.endsWith(".localhost")) {
    const parts = host.split(".");
    return parts.length > 1 ? parts[0] : "";
  }

  if (ROOT_DOMAIN && host.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = host.slice(0, host.length - (`.${ROOT_DOMAIN}`).length);
    return sub && sub !== "www" ? sub : "";
  }

  return "";
}

function buildUrl(endpoint) {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  return `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

function getStoredAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || "";
}

function setStoredAccessToken(token) {
  if (!token) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    return;
  }
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function setAuthTokens({ access, refresh } = {}) {
  setStoredAccessToken(access || "");
  if (refresh) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function request(endpoint, init = {}) {
  const tenantSubdomain = detectTenantSubdomain();
  const headers = new Headers(init.headers || {});
  const token = getStoredAccessToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (tenantSubdomain) {
    headers.set("X-Tenant-Subdomain", tenantSubdomain);
  }

  return fetch(buildUrl(endpoint), {
    credentials: "include",
    ...init,
    headers,
  });
}

export function getTenantSubdomain() {
  return detectTenantSubdomain();
}

async function safeParseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function refreshAuthSession() {
  const refresh = getStoredRefreshToken();
  const response = await request("/api/auth/refresh/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(refresh ? { refresh } : {}),
  });

  if (!response.ok) {
    throw new Error("No se pudo refrescar la sesion.");
  }

  const data = await safeParseJson(response);
  if (data?.access) {
    setStoredAccessToken(data.access);
  }
  if (data?.refresh) {
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
  }

  return data;
}

export async function requestWithAuthRetry(endpoint, init = {}) {
  const firstResponse = await request(endpoint, init);
  if (firstResponse.status !== 401) {
    return firstResponse;
  }

  try {
    await refreshAuthSession();
  } catch {
    return firstResponse;
  }

  return request(endpoint, init);
}

export async function requestJson(endpoint, init = {}) {
  const response = await request(endpoint, init);
  const data = await safeParseJson(response);

  if (!response.ok) {
    throw data || { detail: "No se pudo completar la solicitud." };
  }

  return data;
}

export async function requestJsonWithAuthRetry(endpoint, init = {}) {
  const response = await requestWithAuthRetry(endpoint, init);
  const data = await safeParseJson(response);

  if (!response.ok) {
    throw data || { detail: "No se pudo completar la solicitud." };
  }

  return data;
}
