import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { registerTenant } from "../../services/authService";
import { getErrorMessage } from "../../lib/utils";

export default function RegisterTenantPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre_farmacia: "",
    subdominio: "",
    email_admin: "",
    password: "",
    telefono: "",
    direccion: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const data = await registerTenant(form);
      setSuccess(data.detail || "Farmacia registrada correctamente.");
      setTimeout(() => navigate("/saas/login"), 1200);
    } catch (errorData) {
      setError(getErrorMessage(errorData, "No se pudo registrar la farmacia."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="farm-bg min-h-screen px-4 py-10 text-slate-800 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-2xl rounded-3xl border border-white/70 bg-white/90 p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-700">Alta de tenant</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Registrar farmacia</h1>
        <p className="mt-2 text-sm text-slate-600">Se creara esquema aislado, admin inicial y plan gratuito con trial de 14 dias.</p>

        {error ? (
          <Alert tone="danger" className="mt-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {success ? (
          <Alert tone="success" className="mt-4">
            <AlertTitle>Registro exitoso</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="tenant-name">Nombre de farmacia</Label>
            <Input id="tenant-name" value={form.nombre_farmacia} onChange={(e) => onChange("nombre_farmacia", e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenant-subdomain">Subdominio</Label>
            <Input id="tenant-subdomain" placeholder="farmacia1" value={form.subdominio} onChange={(e) => onChange("subdominio", e.target.value)} required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tenant-email">Email admin</Label>
              <Input id="tenant-email" type="email" value={form.email_admin} onChange={(e) => onChange("email_admin", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-password">Contrasena</Label>
              <Input id="tenant-password" type="password" value={form.password} onChange={(e) => onChange("password", e.target.value)} required />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tenant-phone">Telefono</Label>
              <Input id="tenant-phone" value={form.telefono} onChange={(e) => onChange("telefono", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-address">Direccion</Label>
              <Input id="tenant-address" value={form.direccion} onChange={(e) => onChange("direccion", e.target.value)} />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Registrando..." : "Registrar farmacia"}
          </Button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          ¿Ya tienes tenant? <Link className="font-semibold text-teal-700" to="/saas/login">Iniciar sesion global</Link>
        </p>
      </section>
    </main>
  );
}
