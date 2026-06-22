import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthPageShell from "../../components/auth/AuthPageShell";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { EyeIcon, EyeOffIcon } from "../../components/ui/Icons";
import { getErrorMessage } from "../../lib/utils";
import { registerUser } from "../../services/authService";
import { useAuth } from "../../context/AuthContext";
import { getTenantSubdomain } from "../../services/apiClient";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const tenantSubdomain = getTenantSubdomain();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tenantSubdomain) {
      navigate("/saas/register-farmacia", { replace: true });
      return;
    }
    if (!loading && user) {
      navigate(user.can_access_admin ? "/admin" : "/", { replace: true });
    }
  }, [loading, user, navigate, tenantSubdomain]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const data = await registerUser(form);
      setMessage(data.detail || "Registro completado. Revisa tu correo para activar tu cuenta.");
      setForm({ first_name: "", last_name: "", email: "", password: "" });
    } catch (errorData) {
      setError(getErrorMessage(errorData, "No se pudo completar el registro."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageShell
      eyebrow="Registro"
      title="Crear cuenta"
      description="Prepara el acceso del cliente desde una pantalla dedicada, sin mezclarlo con la logica comercial de la portada."
    >
      {message ? (
        <Alert tone="success">
          <AlertTitle>Registro completado</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert tone="danger">
          <AlertTitle>No se pudo completar el registro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="register-first-name-page">Nombre</Label>
            <Input
              id="register-first-name-page"
              placeholder="Juan"
              value={form.first_name}
              onChange={(event) => setForm((prev) => ({ ...prev, first_name: event.target.value }))}
              required
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-last-name-page">Apellido</Label>
            <Input
              id="register-last-name-page"
              placeholder="Perez"
              value={form.last_name}
              onChange={(event) => setForm((prev) => ({ ...prev, last_name: event.target.value }))}
              required
              disabled={submitting}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-email-page">Correo electronico</Label>
          <Input
            id="register-email-page"
            type="email"
            placeholder="tu@correo.com"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            autoComplete="email"
            required
            disabled={submitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-password-page">Contrasena</Label>
          <div className="relative">
            <Input
              id="register-password-page"
              className="pr-12"
              placeholder="Minimo 6 caracteres"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              autoComplete="new-password"
              required
              disabled={submitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
              disabled={submitting}
            >
              {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>

      <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-4 text-sm text-slate-600">
        ¿Ya tienes cuenta?{" "}
        <Link to="/login" className="font-semibold text-emerald-700 transition hover:text-emerald-600">
          Inicia sesion
        </Link>
      </div>
    </AuthPageShell>
  );
}