import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthPageShell from "../../components/auth/AuthPageShell";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { EyeIcon, EyeOffIcon } from "../../components/ui/Icons";
import { getErrorMessage } from "../../lib/utils";
import { loginUser } from "../../services/authService";
import { useAuth } from "../../context/AuthContext";
import { getTenantSubdomain } from "../../services/apiClient";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, login } = useAuth();
  const tenantSubdomain = getTenantSubdomain();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tenantSubdomain) {
      navigate("/saas/login", { replace: true });
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

    try {
      const data = await loginUser(form);
      login(data.user, null, { access: data.access, refresh: data.refresh });
      navigate(data.user.can_access_admin ? "/admin" : "/", { replace: true });
    } catch (errorData) {
      setError(getErrorMessage(errorData, "No se pudo iniciar sesion."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageShell
      eyebrow="Acceso"
      title="Iniciar sesion"
      description="Accede a tu cuenta para continuar con compras, pedidos y herramientas segun tu rol."
    >
      {error ? (
        <Alert tone="danger">
          <AlertTitle>No se pudo iniciar sesion</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="login-email-page">Correo electronico</Label>
          <Input
            id="login-email-page"
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
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password-page">Contrasena</Label>
            <Link to="/forgot-password" className="text-xs font-semibold text-emerald-700 transition hover:text-emerald-600">
              ¿La olvidaste?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="login-password-page"
              className="pr-12"
              placeholder="Tu contrasena"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              autoComplete="current-password"
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
          {submitting ? "Ingresando..." : "Iniciar sesion"}
        </Button>
      </form>

      <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-4 text-sm text-slate-600">
        ¿Aun no tienes cuenta?{" "}
        <Link to="/register" className="font-semibold text-emerald-700 transition hover:text-emerald-600">
          Crear cuenta
        </Link>
      </div>
    </AuthPageShell>
  );
}