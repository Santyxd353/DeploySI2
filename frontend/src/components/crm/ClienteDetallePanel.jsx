import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CloseIcon, ClipboardListIcon, SparkIcon, UserIcon } from "../ui/Icons";
import { useAuth } from "../../context/AuthContext";
import RecetasListPanel from "./RecetasListPanel";
import RecetaMedicaFormModal from "./RecetaMedicaFormModal";
import { puntosService } from "../../services/puntosService";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-800">{value}</p>
    </div>
  );
}

function TabInformacion({ cliente }) {
  const generoLabel = { M: "Masculino", F: "Femenino", O: "Otro" };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Datos personales</p>
        <InfoRow label="Nombres" value={cliente.nombres} />
        <InfoRow label="Apellidos" value={cliente.apellidos} />
        <InfoRow label="Email" value={cliente.email} />
        <InfoRow label="Teléfono" value={cliente.telefono} />
        <InfoRow label="CI / NIT" value={cliente.ci_nit} />
        <InfoRow label="Género" value={generoLabel[cliente.genero]} />
        <InfoRow
          label="Fecha de nacimiento"
          value={
            cliente.fecha_nacimiento
              ? new Date(cliente.fecha_nacimiento + "T00:00:00").toLocaleDateString("es-BO", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })
              : null
          }
        />
        <InfoRow label="Dirección" value={cliente.direccion} />
      </div>
      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Información clínica</p>
        <InfoRow label="Alergias" value={cliente.alergias} />
        <InfoRow label="Medicamentos frecuentes" value={cliente.medicamentos_frecuentes} />
        <InfoRow label="Médico habitual" value={cliente.medico_habitual} />
        <InfoRow label="Observaciones" value={cliente.observaciones} />
      </div>
    </div>
  );
}

function TabHistorialMedico({ cliente }) {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "farmaceutico";
  const [showForm, setShowForm] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const fullName = [cliente.nombres, cliente.apellidos].filter(Boolean).join(" ");

  return (
    <>
      <RecetasListPanel
        key={reloadKey}
        clienteId={cliente.id}
        clienteNombre={fullName}
        onNuevaReceta={canManage ? () => setShowForm(true) : null}
      />

      {showForm ? (
        <RecetaMedicaFormModal
          clienteId={cliente.id}
          clienteNombre={fullName}
          onClose={() => setShowForm(false)}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      ) : null}
    </>
  );
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TabPuntos({ cliente }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = user?.role === "admin" || user?.role === "farmaceutico";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cuenta, setCuenta] = useState(null);
  const [configuracion, setConfiguracion] = useState(null);
  const [historial, setHistorial] = useState([]);

  const saldo = cuenta?.puntos_disponibles ?? 0;
  const historialReciente = useMemo(() => historial.slice(0, 6), [historial]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const cuentaResponse = await puntosService.cuentasListar({ cliente: cliente.id });
        const normalizedCuenta = puntosService.normalizeList(cuentaResponse);
        const currentCuenta = normalizedCuenta.results[0] || null;

        if (cancelled) return;

        setCuenta(currentCuenta);

        const [configResponse, historialResponse] = await Promise.all([
          puntosService.configuracionListar(),
          currentCuenta ? puntosService.transaccionesListar({ cliente: cliente.id }) : Promise.resolve({ results: [] }),
        ]);

        if (cancelled) return;

        const normalizedConfig = puntosService.normalizeList(configResponse);
        const normalizedHistorial = puntosService.normalizeList(historialResponse);

        setConfiguracion(normalizedConfig.results[0] || null);
        setHistorial(normalizedHistorial.results);
      } catch (err) {
        console.error("Error al cargar puntos:", err);
        if (!cancelled) setError("No se pudo cargar la información de puntos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [cliente.id]);

  const nivel = cuenta?.nivel || "bronce";
  const nivelLabel = { bronce: "Bronce", plata: "Plata", oro: "Oro", diamante: "Diamante" }[nivel] || "Bronce";

  return (
    <div className="space-y-4">
      <Card className="border-0 bg-gradient-to-br from-cyan-700 via-sky-700 to-indigo-700 text-white shadow-xl shadow-sky-200/40">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <SparkIcon className="h-6 w-6" />
            </div>
            <div>
              <CardDescription className="text-cyan-100">Programa de fidelidad</CardDescription>
              <CardTitle className="text-white">Puntos del cliente</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-100">Saldo actual</p>
            <p className="mt-1 text-3xl font-black">{loading ? "..." : saldo}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-100">Nivel</p>
            <p className="mt-1 text-3xl font-black">{loading ? "..." : nivelLabel}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-100">Regla base</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-white/90">
              {configuracion ? `Bs ${Number(configuracion.bolivianos_por_punto).toFixed(2)} = 1 punto` : "Bs 10 = 1 punto"}
            </p>
            <p className="text-xs text-cyan-100">
              {configuracion ? `${configuracion.puntos_minimos_canje} puntos mínimos para canjear` : "100 puntos mínimos para canjear"}
            </p>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Historial reciente</CardTitle>
            <CardDescription>Movimientos de puntos asociados al cliente</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Cargando historial...</p>
            ) : historialReciente.length === 0 ? (
              <p className="text-sm text-slate-500">Este cliente todavía no tiene movimientos de puntos.</p>
            ) : (
              <div className="space-y-3">
                {historialReciente.map((movimiento) => (
                  <div key={movimiento.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{movimiento.descripcion || movimiento.tipo}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDateTime(movimiento.creado_en)}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-black ${
                          movimiento.puntos >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {movimiento.puntos >= 0 ? "+" : ""}{movimiento.puntos} pts
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Acciones rápidas</CardTitle>
            <CardDescription>Administración y acceso al módulo completo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Recompensas</p>
              <p className="mt-1 text-sm text-slate-700">
                El cliente solo ve las recompensas habilitadas en el catálogo del tenant.
              </p>
            </div>

            {canManage ? (
              <Button className="w-full bg-sky-900 hover:bg-sky-800" onClick={() => navigate("/admin/puntos")}>
                Ir al módulo de puntos
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const TABS = [
  { id: "info", label: "Información", Icon: UserIcon },
  { id: "historial", label: "Historial Médico", Icon: ClipboardListIcon },
  { id: "puntos", label: "Puntos", Icon: SparkIcon },
];

export default function ClienteDetallePanel({ cliente, onClose }) {
  const [activeTab, setActiveTab] = useState("info");

  if (!cliente) return null;

  const fullName = [cliente.nombres, cliente.apellidos].filter(Boolean).join(" ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 px-0 sm:px-4 sm:py-4"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:h-[calc(100vh-2rem)] sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel header */}
        <div className="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-700 to-violet-700 p-5 text-white">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
                {cliente.tipo}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                  cliente.estado ? "bg-emerald-400/30 text-emerald-100" : "bg-rose-400/30 text-rose-100"
                }`}
              >
                {cliente.estado ? "Activo" : "Inactivo"}
              </span>
            </div>
            <h2 className="mt-1.5 truncate text-xl font-black">{fullName}</h2>
            {cliente.email ? (
              <p className="mt-0.5 truncate text-sm text-indigo-200">{cliente.email}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 transition hover:bg-white/20"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50 px-4">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-bold transition ${
                activeTab === id
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "info" ? (
            <TabInformacion cliente={cliente} />
          ) : activeTab === "historial" ? (
            <TabHistorialMedico cliente={cliente} />
          ) : (
            <TabPuntos cliente={cliente} />
          )}
        </div>
      </div>
    </div>
  );
}
