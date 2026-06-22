import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "../../lib/utils";
import { getPublicPlans } from "../../services/authService";
import { Button } from "../../components/ui/button";

export default function SaaSLandingPage() {
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPublicPlans()
      .then(setPlans)
      .catch((err) => setError(getErrorMessage(err, "No se pudieron cargar los planes.")));
    const timer = setTimeout(() => setLoading(false), 280);
    return () => clearTimeout(timer);
  }, []);

  const stats = useMemo(() => {
    const totalPlanes = plans.length;
    const minPrecio = plans.length ? Math.min(...plans.map((plan) => Number(plan.precio_mensual || 0))) : 0;
    const maxUsuarios = plans.length ? Math.max(...plans.map((plan) => Number(plan.limite_usuarios || 0))) : 0;
    const planesConIA = plans.filter((plan) => plan.permite_reportes_ia || plan.permite_predicciones).length;

    return [
      { label: "Planes activos", value: String(totalPlanes || "--") },
      { label: "Desde", value: minPrecio ? `$${minPrecio}/mes` : "--" },
      { label: "Usuarios por plan", value: maxUsuarios ? `${maxUsuarios}+` : "--" },
      { label: "Planes con IA", value: String(planesConIA || "0") },
    ];
  }, [plans]);

  const capabilities = [
    {
      title: "Aislamiento por tenant",
      text: "Cada farmacia opera en su propio esquema y conserva datos totalmente separados.",
    },
    {
      title: "Facturación recurrente",
      text: "Suscripciones mensuales o anuales con control de estado del tenant en tiempo real.",
    },
    {
      title: "Operación clínica y comercial",
      text: "Inventario, ventas, reportes y seguridad por rol en una sola plataforma.",
    },
  ];

  return (
    <main className="farm-bg min-h-screen px-4 py-10 text-slate-800 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-8">
        <header className="hero-shell relative overflow-hidden rounded-3xl border border-white/70 p-8 shadow-sm sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-emerald-300/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-20 h-48 w-48 rounded-full bg-sky-300/25 blur-3xl" />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <p className="rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Plataforma SaaS para farmacias
            </p>
            <div className="flex gap-2">
              <Link to="/saas/login">
                <Button variant="secondary" size="sm">Acceso global</Button>
              </Link>
              <Link to="/saas/register-farmacia">
                <Button size="sm">Crear farmacia</Button>
              </Link>
            </div>
          </div>

          <h1 className="relative mt-6 max-w-4xl text-3xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
            Controla múltiples farmacias desde una arquitectura multi-tenant segura y escalable.
          </h1>
          <p className="relative mt-4 max-w-3xl text-slate-600">
            Lanza tu operación en minutos con subdominios dedicados, gestión administrativa por roles y planes de suscripción listos para crecer.
          </p>

          <div className="relative mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((item) => (
              <article key={item.label} className="rounded-2xl border border-white/70 bg-white/75 px-4 py-3 shadow-sm backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className="mt-1 text-xl font-black text-slate-900">{item.value}</p>
              </article>
            ))}
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {capabilities.map((feature) => (
            <article key={feature.title} className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
              <h2 className="text-base font-extrabold text-slate-900">{feature.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{feature.text}</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-black text-slate-900">Planes disponibles</h2>
              <p className="text-sm text-slate-500">Selecciona la capacidad ideal para tu farmacia.</p>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {plans.map((plan) => (
                <article key={plan.slug} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{plan.slug}</p>
                  <h3 className="mt-1 text-lg font-black text-slate-900">{plan.nombre}</h3>
                  <p className="mt-3 text-2xl font-extrabold text-emerald-700">${plan.precio_mensual}/mes</p>
                  <p className="text-xs font-semibold text-slate-500">o ${plan.precio_anual}/año</p>

                  <ul className="mt-4 space-y-1 text-sm text-slate-600">
                    <li>Usuarios: {plan.limite_usuarios}</li>
                    <li>Productos: {plan.limite_productos}</li>
                    <li>Inventario: {plan.limite_inventario_items}</li>
                    <li>Almacenamiento: {plan.limite_almacenamiento_mb} MB</li>
                    <li>Reportes IA: {plan.permite_reportes_ia ? "Incluido" : "No incluido"}</li>
                    <li>Backups: {plan.permite_backups ? "Incluido" : "No incluido"}</li>
                    <li>Predicciones: {plan.permite_predicciones ? "Incluido" : "No incluido"}</li>
                  </ul>

                  <Link to="/saas/register-farmacia" className="mt-4 inline-block">
                    <Button size="sm">Elegir plan</Button>
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/85 p-6 text-center shadow-sm">
          <h3 className="text-2xl font-black text-slate-900">¿Listo para lanzar tu farmacia?</h3>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
            Empieza hoy con una implementación guiada, configuración por subdominio y panel administrativo listo para operar.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link to="/saas/register-farmacia">
              <Button>Registrar mi farmacia</Button>
            </Link>
            <Link to="/saas/login">
              <Button variant="secondary">Soy superusuario</Button>
            </Link>
          </div>
        </section>

        {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      </section>
    </main>
  );
}
