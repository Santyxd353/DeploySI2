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

function checkPasswordRequirements(password) {
  return {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()\-_=+[\]{};:'",.<>?/\\|`~]/.test(password),
  };
}

const REQUIREMENTS = [
  { key: "minLength", label: "Mínimo 8 caracteres" },
  { key: "uppercase", label: "Una letra mayúscula" },
  { key: "lowercase", label: "Una letra minúscula" },
  { key: "number", label: "Un número" },
  { key: "special", label: "Un carácter especial (!@#$%...)" },
];

function PasswordRequirements({ password, visible }) {
  if (!visible) return null;
  const checks = checkPasswordRequirements(password);
  return (
    <ul className="mt-2 space-y-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      {REQUIREMENTS.map(({ key, label }) => (
        <li key={key} className={`flex items-center gap-2 text-xs font-medium ${checks[key] ? "text-emerald-600" : "text-slate-400"}`}>
          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${checks[key] ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-400"}`}>
            {checks[key] ? "✓" : "✗"}
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const tenantSubdomain = getTenantSubdomain();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
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

    const checks = checkPasswordRequirements(form.password);
    const missing = REQUIREMENTS.filter(({ key }) => !checks[key]).map(({ label }) => label);
    if (missing.length > 0) {
      setError(`La contraseña debe incluir: ${missing.join(", ")}.`);
      return;
    }

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
          <Label htmlFor="register-password-page">Contraseña</Label>
          <div className="relative">
            <Input
              id="register-password-page"
              className="pr-12"
              placeholder="Mínimo 8 caracteres"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              autoComplete="new-password"
              required
              disabled={submitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              disabled={submitting}
            >
              {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </button>
          </div>
          <PasswordRequirements password={form.password} visible={passwordFocused || form.password.length > 0} />
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
