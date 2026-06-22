import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { getErrorMessage } from "../../lib/utils";
import { globalLogin } from "../../services/authService";
import { useAuth } from "../../context/AuthContext";

export default function GlobalLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", subdominio: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const data = await globalLogin(form);
      login(data.user, data.tenant || null);

      if (!data.tenant) {
        const target = data.global?.dashboard_path || "/admin/global/tenants";
        navigate(target, { replace: true });
        return;
      }

      const rootDomain = import.meta.env.VITE_ROOT_DOMAIN || "localhost";
      const targetHost = `${data.tenant.subdomain}.${rootDomain}`;
      const portPart = window.location.port ? `:${window.location.port}` : "";
      window.location.href = `${window.location.protocol}//${targetHost}${portPart}${data.tenant.dashboard_path || "/"}`;
    } catch (errorData) {
      setError(getErrorMessage(errorData, "No se pudo iniciar sesion global."));
      setSubmitting(false);
    }
  };

  return (
    <main className="farm-bg min-h-screen px-4 py-10 text-slate-800 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-xl rounded-3xl border border-white/70 bg-white/90 p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-700">Acceso SaaS</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Login global</h1>

        {error ? (
          <Alert tone="danger" className="mt-4">
            <AlertTitle>Error de acceso</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="global-email">Correo</Label>
            <Input id="global-email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="global-pass">Contrasena</Label>
            <Input id="global-pass" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="global-subdomain">Subdominio (opcional)</Label>
            <Input id="global-subdomain" placeholder="farmacia1" value={form.subdominio} onChange={(e) => setForm((p) => ({ ...p, subdominio: e.target.value }))} />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          ¿Aun sin tenant? <Link className="font-semibold text-teal-700" to="/saas/register-farmacia">Registra tu farmacia</Link>
        </p>
      </section>
    </main>
  );
}
