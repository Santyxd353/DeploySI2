import { useState } from "react";
import { CloseIcon, ClipboardListIcon, UserIcon } from "../ui/Icons";
import { useAuth } from "../../context/AuthContext";
import RecetasListPanel from "./RecetasListPanel";
import RecetaMedicaFormModal from "./RecetaMedicaFormModal";

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

const TABS = [
  { id: "info", label: "Información", Icon: UserIcon },
  { id: "historial", label: "Historial Médico", Icon: ClipboardListIcon },
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
          ) : (
            <TabHistorialMedico cliente={cliente} />
          )}
        </div>
      </div>
    </div>
  );
}
