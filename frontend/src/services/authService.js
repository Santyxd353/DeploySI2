import { clearAuthTokens, getApiBaseUrl, getTenantSubdomain, requestJson, requestWithAuthRetry, setAuthTokens } from "./apiClient";

export function saveSession({ user, access, refresh }) {
  if (user) {
    localStorage.setItem("current_user", JSON.stringify(user));
  }
  setAuthTokens({ access, refresh });
}

export function saveTenantSession(tenant) {
  if (tenant) {
    localStorage.setItem("current_tenant", JSON.stringify(tenant));
  }
}

export function clearTenantSession() {
  localStorage.removeItem("current_tenant");
}

export function getStoredTenant() {
  const raw = localStorage.getItem("current_tenant");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem("current_user");
  clearTenantSession();
  clearAuthTokens();
}

export function getStoredUser() {
  const rawUser = localStorage.getItem("current_user");
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

export function canAccessAdmin(user) {
  return Boolean(user?.can_access_admin);
}

export async function registerUser(payload) {
  return requestJson("/api/auth/register/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload) {
  const subdomain = getTenantSubdomain();
  return requestJson("/api/auth/login/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, subdominio: subdomain || undefined }),
  });
}

export async function registerTenant(payload) {
  return requestJson("/api/tenants/public/register-tenant/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function globalLogin(payload) {
  return requestJson("/api/tenants/public/login/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getPublicPlans() {
  return requestJson("/api/tenants/public/plans/", { method: "GET" });
}

export async function getCurrentTenantSubscription() {
  return requestJson("/api/tenants/billing/current/", { method: "GET" });
}

export async function startTenantCheckout({ plan_slug, billing_cycle }) {
  return requestJson("/api/tenants/billing/checkout/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan_slug, billing_cycle }),
  });
}

export async function getGlobalTenants() {
  return requestJson("/api/tenants/global/tenants/", { method: "GET" });
}

export async function updateGlobalTenantStatus(tenantId, status) {
  return requestJson(`/api/tenants/global/tenants/${tenantId}/status/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function verifyEmail({ uid, token }) {
  return requestJson("/api/auth/verify-email/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, token }),
  });
}

export async function getCurrentUser() {
  const response = await requestWithAuthRetry("/api/auth/me/", {});

  if (!response.ok) {
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    const error = new Error(data?.detail || "Sesion invalida, vuelve a iniciar sesion.");
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function requestPasswordReset(email) {
  return requestJson("/api/auth/password-reset/request/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset({ uid, token, password, passwordConfirm }) {
  return requestJson("/api/auth/password-reset/confirm/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, token, password, password_confirm: passwordConfirm }),
  });
}

export async function logoutUser() {
  return requestJson("/api/auth/logout/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export { getApiBaseUrl };
