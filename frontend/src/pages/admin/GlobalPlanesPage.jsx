import { useEffect, useState } from "react";
import GlobalAdminLayout from "../../components/admin/GlobalAdminLayout";
import { useAuth } from "../../context/AuthContext";
import { requestJsonWithAuthRetry } from "../../services/apiClient";

function fmt(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function GlobalPlanesPage() {
  const { user, logout } = useAuth();
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    requestJsonWithAuthRetry("/api/tenants/public/plans/")
      .then((data) => setPlanes(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <GlobalAdminLayout currentUser={user} onLogout={logout}>
      <div className="space-y-5">
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Configuración</p>
          <h1 className="text-2xl font-black text-slate-900">Planes</h1>
          <p className="text-sm text-slate-500">Planes de suscripción disponibles en la plataforma</p>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm">Cargando planes…</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {planes.map((plan) => (
              <div key={plan.id} className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{plan.nombre}</h3>
                    <p className="text-xs font-mono text-slate-400">{plan.slug}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    Activo
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">Precio mensual</p>
                    <p className="text-2xl font-black text-slate-900">
                      Bs. {fmt(plan.precio_mensual)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">Precio anual</p>
                    <p className="text-xl font-black text-slate-900">
                      Bs. {fmt(plan.precio_anual)}
                    </p>
                  </div>
                </div>

                {plan.descripcion && (
                  <p className="mt-3 text-xs text-slate-500">{plan.descripcion}</p>
                )}

                {plan.features && Object.keys(plan.features).length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Features</p>
                    <div className="space-y-1">
                      {Object.entries(plan.features).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{key}</span>
                          <span className="font-semibold text-slate-800">
                            {typeof val === "boolean" ? (val ? "✓" : "✗") : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {planes.length === 0 && (
              <div className="col-span-3 py-12 text-center text-slate-400 text-sm">
                No hay planes configurados
              </div>
            )}
          </div>
        )}
      </div>
    </GlobalAdminLayout>
  );
}
