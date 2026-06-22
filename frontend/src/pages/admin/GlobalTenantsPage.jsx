import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { getErrorMessage } from "../../lib/utils";
import { getGlobalTenants, updateGlobalTenantStatus } from "../../services/authService";
import GlobalAdminLayout from "../../components/admin/GlobalAdminLayout";
import { useAuth } from "../../context/AuthContext";

const STATUS_OPTIONS = ["activo", "suspendido", "cancelado"];

const STATUS_STYLES = {
  activo: "bg-emerald-100 text-emerald-700",
  suspendido: "bg-amber-100 text-amber-700",
  cancelado: "bg-rose-100 text-rose-700",
};

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("es-BO", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return "-";
  }
}

export default function GlobalTenantsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [pendingTenantId, setPendingTenantId] = useState(null);

  const load = () => {
    setLoading(true);
    getGlobalTenants()
      .then(setTenants)
      .catch((err) => setError(getErrorMessage(err, "No se pudo cargar tenants globales.")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleStatusChange = async (tenantId, status) => {
    setError("");
    setPendingTenantId(tenantId);
    try {
      await updateGlobalTenantStatus(tenantId, status);
      load();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo actualizar estado del tenant."));
    } finally {
      setPendingTenantId(null);
    }
  };

  const filteredTenants = useMemo(() => {
    return tenants.filter((tenant) => {
      const matchStatus = statusFilter === "all" || tenant.status === statusFilter;
      if (!matchStatus) return false;

      const q = query.trim().toLowerCase();
      if (!q) return true;

      const haystack = [tenant.name, tenant.subdomain, tenant.schema_name, tenant.contact_email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [tenants, statusFilter, query]);

  const dashboardStats = useMemo(() => {
    const activos = tenants.filter((tenant) => tenant.status === "activo").length;
    const suspendidos = tenants.filter((tenant) => tenant.status === "suspendido").length;
    const cancelados = tenants.filter((tenant) => tenant.status === "cancelado").length;
    const enTrial = tenants.filter((tenant) => tenant.trial_end_at && new Date(tenant.trial_end_at) >= new Date()).length;

    return [
      { label: "Farmacias registradas", value: tenants.length },
      { label: "Activas", value: activos },
      { label: "Suspendidas", value: suspendidos },
      { label: "En trial", value: enTrial + ` / canceladas ${cancelados}` },
    ];
  }, [tenants]);

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <GlobalAdminLayout
      currentUser={user}
      onLogout={handleLogout}
      title="Dashboard de farmacias registradas"
      subtitle="Control operativo global de tenants"
      actions={<Button variant="secondary" onClick={load}>Actualizar datos</Button>}
    >
      <section className="space-y-6">
        <header className="hero-shell rounded-3xl border border-white/70 p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Superadmin global</p>
              <h1 className="mt-1 text-3xl font-extrabold text-slate-900">Dashboard de farmacias registradas</h1>
              <p className="mt-2 text-sm text-slate-600">Monitorea estado operativo y administra activación, suspensión y cancelación.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {dashboardStats.map((item) => (
              <article key={item.label} className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{item.value}</p>
              </article>
            ))}
          </div>
        </header>

        {error ? (
          <Alert tone="danger">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm sm:p-5">
          <div className="mb-4 grid gap-2 md:grid-cols-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por farmacia, subdominio, schema o email..."
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-300 md:col-span-2"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-300"
            >
              <option value="all">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="suspendido">Suspendido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Farmacia</th>
                <th className="px-4 py-3">Subdominio</th>
                <th className="px-4 py-3">Schema</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Creado</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Cargando farmacias...</td>
                  </tr>
                ) : filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No hay resultados con los filtros actuales.</td>
                  </tr>
                ) : (
                  filteredTenants.map((tenant) => (
                    <tr key={tenant.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-semibold text-slate-800">{tenant.name}</td>
                      <td className="px-4 py-3 text-slate-600">{tenant.subdomain}.localhost</td>
                      <td className="px-4 py-3 text-slate-600">{tenant.schema_name}</td>
                      <td className="px-4 py-3 text-slate-600">{tenant.contact_email || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(tenant.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLES[tenant.status] || "bg-slate-100 text-slate-700"}`}>
                          {tenant.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {STATUS_OPTIONS.map((status) => (
                            <Button
                              key={status}
                              variant={status === "activo" ? "default" : "secondary"}
                              size="sm"
                              disabled={pendingTenantId === tenant.id || tenant.status === status}
                              onClick={() => handleStatusChange(tenant.id, status)}
                            >
                              {status}
                            </Button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </GlobalAdminLayout>
  );
}
