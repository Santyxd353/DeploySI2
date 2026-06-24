import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import { requestJsonWithAuthRetry } from "../../services/apiClient";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-BO", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function fmtPrice(n) {
  return Number(n ?? 0).toLocaleString("es-BO", { minimumFractionDigits: 2 });
}

const ESTADO_LABELS = {
  active: "Activa", trialing: "En período de prueba",
  past_due: "Pago vencido", canceled: "Cancelada",
};
const ESTADO_COLORS = {
  active: "bg-emerald-100 text-emerald-700",
  trialing: "bg-blue-100 text-blue-700",
  past_due: "bg-orange-100 text-orange-700",
  canceled: "bg-slate-100 text-slate-500",
};

// ── Feature row ───────────────────────────────────────────────────────────────
function Feature({ label, value }) {
  const isEnabled = value === true;
  const isDisabled = value === false;
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-600">{label}</span>
      {isEnabled ? (
        <span className="text-xs font-bold text-emerald-600">✓ Incluido</span>
      ) : isDisabled ? (
        <span className="text-xs text-slate-400">— No incluido</span>
      ) : (
        <span className="text-xs font-semibold text-slate-700">{value}</span>
      )}
    </div>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, ciclo, esCurrent, esUpgrade, onUpgrade, loading }) {
  const precioCiclo = ciclo === "anual" ? plan.precio_anual : plan.precio_mensual;
  const precioMensualEq = ciclo === "anual"
    ? (Number(plan.precio_anual) / 12).toFixed(2)
    : plan.precio_mensual;
  const ahorroAnual = Number(plan.precio_mensual) * 12 - Number(plan.precio_anual);
  const descPct = ahorroAnual > 0
    ? Math.round((ahorroAnual / (Number(plan.precio_mensual) * 12)) * 100)
    : 0;

  return (
    <div
      className={`relative flex flex-col rounded-[24px] border-2 p-5 transition-all ${
        esCurrent
          ? "border-teal-500 bg-teal-50/60 shadow-lg shadow-teal-100"
          : esUpgrade
          ? "border-slate-200 bg-white hover:border-teal-300 hover:shadow-md"
          : "border-slate-100 bg-slate-50 opacity-60"
      }`}
    >
      {/* Badge plan actual */}
      {esCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-teal-600 px-4 py-1 text-[11px] font-black text-white shadow">
            Tu plan actual
          </span>
        </div>
      )}

      {/* Nombre + precio */}
      <div className="mb-4 text-center">
        <h3 className="text-lg font-black text-slate-900">{plan.nombre}</h3>
        <div className="mt-2">
          <span className="text-3xl font-black text-slate-900">
            Bs. {fmtPrice(precioCiclo)}
          </span>
          <span className="ml-1 text-sm text-slate-500">
            /{ciclo === "anual" ? "año" : "mes"}
          </span>
        </div>
        {ciclo === "anual" && Number(plan.precio_anual) > 0 && (
          <p className="mt-0.5 text-xs text-slate-500">
            Bs. {fmtPrice(precioMensualEq)}/mes
            {descPct > 0 && (
              <span className="ml-1 font-bold text-emerald-600">— {descPct}% menos</span>
            )}
          </p>
        )}
      </div>

      {/* Features */}
      <div className="mb-5 flex-1 rounded-2xl bg-white/80 p-3">
        <Feature
          label="Usuarios"
          value={plan.limite_usuarios === 0 ? "Ilimitados" : plan.limite_usuarios}
        />
        <Feature
          label="Productos"
          value={plan.limite_productos === 0 ? "Ilimitados" : plan.limite_productos}
        />
        <Feature
          label="Items inventario"
          value={plan.limite_inventario_items === 0 ? "Ilimitados" : plan.limite_inventario_items}
        />
        <Feature label="Reportes con IA" value={plan.permite_reportes_ia} />
        <Feature label="Backups automáticos" value={plan.permite_backups} />
        <Feature label="Predicciones ML" value={plan.permite_predicciones} />
      </div>

      {/* CTA */}
      {esCurrent ? (
        <div className="rounded-2xl bg-teal-600/10 py-2.5 text-center text-sm font-bold text-teal-700">
          Plan activo
        </div>
      ) : esUpgrade ? (
        <button
          type="button"
          onClick={() => onUpgrade(plan.slug, ciclo === "anual" ? "annual" : "monthly")}
          disabled={loading}
          className="rounded-2xl bg-teal-600 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-60"
        >
          {loading ? "Procesando…" : `Actualizar a ${plan.nombre}`}
        </button>
      ) : (
        <div className="rounded-2xl bg-slate-200/60 py-2.5 text-center text-xs font-semibold text-slate-400">
          Plan inferior al actual
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function TenantSubscriptionPage() {
  const [searchParams] = useSearchParams();
  const verificacionHecha = useRef(false); // evita doble llamada por React Strict Mode
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [ciclo, setCiclo] = useState("mensual");
  const [loading, setLoading] = useState(true);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  // Al volver de Stripe: verificar pago directamente con la API (no depende del webhook)
  useEffect(() => {
    // React Strict Mode llama el efecto dos veces en dev — lo bloqueamos con ref
    if (verificacionHecha.current) return;

    const status = searchParams.get("status");
    const sessionId = searchParams.get("sid");

    if (status === "ok") {
      verificacionHecha.current = true;
      setToast({ type: "success", msg: "¡Pago procesado! Activando tu plan…" });

      const activar = async () => {
        try {
          // Verificar con Stripe directamente y actualizar suscripción
          if (sessionId) {
            const sub = await requestJsonWithAuthRetry("/api/tenants/billing/verificar/", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ session_id: sessionId }),
            });
            setSubscription(sub);
            setToast({ type: "success", msg: `¡Plan "${sub.plan?.nombre}" activado exitosamente!` });
          } else {
            // Fallback: recargar suscripción actual (si el webhook ya llegó)
            const sub = await requestJsonWithAuthRetry("/api/tenants/billing/current/").catch(() => null);
            if (sub) setSubscription(sub);
            setToast({ type: "success", msg: "¡Plan actualizado correctamente!" });
          }
        } catch (e) {
          setToast({ type: "success", msg: "Pago exitoso. Recarga la página si el plan no se actualizó." });
        }
      };

      activar();
      const t = setTimeout(() => setToast(null), 7000);
      return () => clearTimeout(t);
    } else if (status === "cancel") {
      setToast({ type: "info", msg: "Pago cancelado. Tu plan no fue modificado." });
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  useEffect(() => {
    Promise.all([
      requestJsonWithAuthRetry("/api/tenants/billing/current/").catch(() => null),
      requestJsonWithAuthRetry("/api/tenants/public/plans/"),
    ])
      .then(([sub, plansData]) => {
        setSubscription(sub);
        const list = Array.isArray(plansData) ? plansData : plansData.results ?? [];
        // Ordenar por precio mensual ascendente
        setPlans(list.sort((a, b) => Number(a.precio_mensual) - Number(b.precio_mensual)));
      })
      .catch(() => setError("No se pudo cargar la información de suscripción."))
      .finally(() => setLoading(false));
  }, []);

  async function handleUpgrade(planSlug, billingCycle) {
    setError("");
    setUpgradeLoading(true);
    try {
      const data = await requestJsonWithAuthRetry("/api/tenants/billing/checkout/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_slug: planSlug,
          billing_cycle: billingCycle,
          // Enviar el origen real para que la success_url funcione desde cualquier IP
          frontend_origin: window.location.origin,
        }),
      });
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (e) {
      setError(e?.detail || e?.message || "No se pudo iniciar el pago.");
    } finally {
      setUpgradeLoading(false);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const data = await requestJsonWithAuthRetry("/api/tenants/billing/portal/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frontend_origin: window.location.origin }),
      });
      if (data.portal_url) {
        window.open(data.portal_url, "_blank");
      }
    } catch (e) {
      setError(e?.detail || "No se pudo abrir el portal de facturación.");
    } finally {
      setPortalLoading(false);
    }
  }

  // Determinar plan actual por precio (mayor precio = mayor jerarquía)
  const precioActual = Number(subscription?.plan?.precio_mensual ?? 0);

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Toast */}
        {toast && (
          <div
            className={`rounded-[22px] px-5 py-4 text-sm font-semibold shadow-sm ${
              toast.type === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-blue-200 bg-blue-50 text-blue-800"
            }`}
          >
            {toast.type === "success" ? "✓ " : "ℹ "}{toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Facturación</p>
              <h1 className="text-2xl font-black text-slate-900">Plan y suscripción</h1>
              <p className="text-sm text-slate-500">Gestiona el plan de tu farmacia y los pagos</p>
            </div>
            {subscription?.stripe_customer_id && (
              <button
                type="button"
                onClick={handlePortal}
                disabled={portalLoading}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {portalLoading ? "Cargando…" : "🔗 Gestionar facturación"}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-[22px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Suscripción actual */}
        {!loading && subscription && (
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              Suscripción actual
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 space-y-1">
                <p className="text-xl font-black text-slate-900">
                  {subscription.plan?.nombre ?? "Sin plan"}
                </p>
                <p className="text-sm text-slate-500">
                  {subscription.fecha_inicio ? `Desde ${fmtDate(subscription.fecha_inicio)}` : ""}
                  {subscription.fecha_fin ? ` · Vence ${fmtDate(subscription.fecha_fin)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    ESTADO_COLORS[subscription.estado] ?? "bg-slate-100 text-slate-600"
                  }`}
                >
                  {ESTADO_LABELS[subscription.estado] ?? subscription.estado}
                </span>
                {subscription.auto_renovar && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                    🔄 Auto-renovación activa
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && !subscription && !error && (
          <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            No tienes una suscripción activa aún. Elige un plan para comenzar.
          </div>
        )}

        {/* Toggle mensual / anual */}
        {!loading && plans.length > 0 && (
          <>
            <div className="flex items-center justify-center gap-1">
              <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setCiclo("mensual")}
                  className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${
                    ciclo === "mensual"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Mensual
                </button>
                <button
                  type="button"
                  onClick={() => setCiclo("anual")}
                  className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition ${
                    ciclo === "anual"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Anual
                  {plans.some((p) => Number(p.precio_anual) > 0 && Number(p.precio_mensual) * 12 > Number(p.precio_anual)) && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      ciclo === "anual" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"
                    }`}>
                      Ahorra
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Grid de planes */}
            <div className={`grid gap-4 ${plans.length <= 3 ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4"}`}>
              {plans.map((plan) => {
                const esCurrent = subscription?.plan?.slug === plan.slug;
                const precioEste = Number(plan.precio_mensual);
                const esUpgrade = !esCurrent && precioEste > precioActual;

                return (
                  <PlanCard
                    key={plan.slug}
                    plan={plan}
                    ciclo={ciclo}
                    esCurrent={esCurrent}
                    esUpgrade={esUpgrade}
                    onUpgrade={handleUpgrade}
                    loading={upgradeLoading}
                  />
                );
              })}
            </div>

            {/* Nota modo prueba */}
            <div className="rounded-[22px] border border-slate-100 bg-slate-50 px-5 py-3 text-center">
              <p className="text-xs text-slate-500">
                🔒 Pagos seguros via Stripe · Modo de prueba activo ·{" "}
                <span className="font-semibold">Usa tarjeta de prueba: 4242 4242 4242 4242</span>
              </p>
            </div>
          </>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
