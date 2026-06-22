import { useMemo, useState } from "react";
import { clientesService } from "../../services/clientesService";
import { CloseIcon } from "../ui/Icons";

const BADGE = {
  aprobada: "bg-emerald-100 text-emerald-700",
  pendiente: "bg-amber-100 text-amber-700",
  rechazada: "bg-rose-100 text-rose-700",
  vencida: "bg-rose-100 text-rose-700",
};

export default function ValidarRecetaModal({ receta, onClose, onValidada }) {
  const [observacion, setObservacion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmedExpired, setConfirmedExpired] = useState(false);

  const expiryStatus = useMemo(() => {
    if (!receta?.fecha_vencimiento) return "ok";
    const dias = receta.dias_para_vencer;
    if (typeof dias === "number") {
      if (dias < 0) return "expired";
      if (dias <= 7) return "soon";
    }
    return "ok";
  }, [receta]);

  if (!receta) return null;

  const handleValidar = async (nuevoEstado) => {
    if (nuevoEstado === "aprobada" && expiryStatus === "expired" && !confirmedExpired) return;
    setError("");
    try {
      setSaving(true);
      await clientesService.validarReceta(receta.id, nuevoEstado, observacion);
      onValidada?.();
      onClose();
    } catch (err) {
      setError(
        (err && (err.error || err.detail)) ||
          "No se pudo validar la receta. Intenta de nuevo."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[28px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-[28px] bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4 text-white">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-200">Validar receta</p>
            <h2 className="text-lg font-black font-mono">{receta.codigo}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 transition hover:bg-white/20"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Receta info */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">Estado actual</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${BADGE[receta.estado] ?? "bg-slate-100 text-slate-600"}`}>
                {receta.estado}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">Emisión</span>
              <span className="text-slate-700">{receta.fecha_emision || "—"}</span>
            </div>
            {receta.fecha_vencimiento ? (
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Vencimiento</span>
                <span className="text-slate-700">{receta.fecha_vencimiento}</span>
              </div>
            ) : null}
            {receta.fecha_validez ? (
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Validez</span>
                <span className="text-slate-700">{receta.fecha_validez}</span>
              </div>
            ) : null}
            {receta.archivo_url ? (
              <a
                href={receta.archivo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center rounded-xl border border-indigo-200 bg-indigo-50 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                Ver archivo adjunto
              </a>
            ) : null}
            {receta.firma_digital_url ? (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500">Firma digital</span>
                <a href={receta.firma_digital_url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={receta.firma_digital_url}
                    alt="Firma digital"
                    className="h-16 w-auto rounded-xl border border-slate-200 object-contain shadow-sm hover:opacity-80 transition"
                  />
                </a>
              </div>
            ) : null}
          </div>

          {expiryStatus === "expired" ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-bold text-rose-700">
                <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                Receta vencida
              </p>
              <p className="text-xs text-rose-600">
                Esta receta venció hace {Math.abs(receta.dias_para_vencer)} día(s). Para aprobarla debes confirmar explícitamente.
              </p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmedExpired}
                  onChange={(e) => setConfirmedExpired(e.target.checked)}
                  className="mt-0.5 accent-rose-600"
                />
                <span className="text-xs font-semibold text-rose-700">
                  Confirmo que apruebo esta receta a pesar de estar vencida
                </span>
              </label>
            </div>
          ) : expiryStatus === "soon" ? (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-bold text-orange-700">
                <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                Próxima a vencer
              </p>
              <p className="mt-0.5 text-xs text-orange-600">
                Esta receta vence en {receta.dias_para_vencer} día(s). Verifica antes de aprobar.
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>
          ) : null}

          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-500">Observación (opcional)</span>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={3}
              placeholder="Motivo de aprobación o rechazo..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
            />
          </label>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleValidar("rechazada")}
              className="flex-1 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              {saving ? "..." : "Rechazar"}
            </button>
            <button
              type="button"
              disabled={saving || (expiryStatus === "expired" && !confirmedExpired)}
              onClick={() => handleValidar("aprobada")}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              title={expiryStatus === "expired" && !confirmedExpired ? "Confirma que apruebas la receta vencida" : undefined}
            >
              {saving ? "..." : "Aprobar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
