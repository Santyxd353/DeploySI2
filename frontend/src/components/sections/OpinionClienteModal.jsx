import { useCallback, useEffect, useRef, useState } from "react";
import { opinionesService } from "../../services/opinionesService";
import { CloseIcon, SparkIcon } from "../ui/Icons";

const TIPOS = [
  { value: "general", label: "Experiencia general" },
  { value: "servicio", label: "Atención y servicio" },
];

const ESTADO_LABEL = {
  pendiente: "Pendiente",
  respondida: "Respondida",
  escalada: "Escalada",
  archivada: "Archivada",
};

const TIPO_LABEL = {
  general: "General",
  servicio: "Servicio",
  venta: "Venta",
  producto: "Producto",
};

function StarRating({ value, onChange, readonly = false }) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={`text-2xl transition-transform ${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"} ${
            star <= display ? "text-amber-400" : "text-slate-200"
          }`}
          aria-label={`${star} estrellas`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function MisOpinionesList() {
  const [opiniones, setOpiniones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    opinionesService
      .mias()
      .then((data) => {
        if (!cancelled) setOpiniones(data.results ?? data);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar tus opiniones.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <p className="py-8 text-center text-xs text-rose-500">{error}</p>;
  }

  if (opiniones.length === 0) {
    return (
      <div className="py-10 text-center">
        <SparkIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
        <p className="text-sm text-slate-500">Aún no has dejado ninguna opinión.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {opiniones.map((op) => (
        <li
          key={op.id}
          className="rounded-xl border border-slate-100 bg-slate-50 p-3"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StarRating value={op.puntuacion} readonly />
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                {TIPO_LABEL[op.tipo] ?? op.tipo}
              </span>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                op.estado === "respondida"
                  ? "bg-emerald-100 text-emerald-700"
                  : op.estado === "escalada"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {ESTADO_LABEL[op.estado] ?? op.estado}
            </span>
          </div>
          <p className="text-xs text-slate-700">{op.comentario}</p>
          {op.respuesta_staff && (
            <div className="mt-2 rounded-lg border-l-2 border-teal-400 bg-teal-50 px-3 py-2">
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-700">
                Respuesta de la farmacia
              </p>
              <p className="text-xs text-teal-800">{op.respuesta_staff}</p>
            </div>
          )}
          <p className="mt-1 text-right text-[10px] text-slate-400">
            {new Date(op.created_at ?? op.fecha_creacion).toLocaleDateString("es-ES", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function OpinionClienteModal({ onClose }) {
  const [tab, setTab] = useState("nueva");
  const [rating, setRating] = useState(0);
  const [tipo, setTipo] = useState("general");
  const [comentario, setComentario] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const backdropRef = useRef(null);

  const handleBackdropClick = useCallback(
    (e) => { if (e.target === backdropRef.current) onClose(); },
    [onClose]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      setError("Selecciona una puntuación.");
      return;
    }
    if (comentario.trim().length < 10) {
      setError("El comentario debe tener al menos 10 caracteres.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await opinionesService.crear({ tipo, puntuacion: rating, comentario: comentario.trim() });
      setSubmitted(true);
    } catch (err) {
      const msg =
        err?.detail ||
        err?.tipo?.[0] ||
        err?.venta?.[0] ||
        err?.producto?.[0] ||
        err?.non_field_errors?.[0] ||
        "No se pudo enviar la opinión. Intenta más tarde.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-teal-700 to-cyan-600 px-6 py-4">
          <div className="flex items-center gap-2">
            <SparkIcon className="h-5 w-5 text-white/80" />
            <h2 className="text-base font-black text-white">Tus Opiniones</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          {[
            { key: "nueva", label: "Nueva opinión" },
            { key: "mias", label: "Mis opiniones" },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 py-3 text-xs font-bold transition ${
                tab === key
                  ? "border-b-2 border-teal-600 text-teal-700"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-5">
          {tab === "nueva" ? (
            submitted ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                  <span className="text-3xl">✓</span>
                </div>
                <p className="font-bold text-slate-800">¡Gracias por tu opinión!</p>
                <p className="mt-1 text-xs text-slate-500">
                  Tu comentario fue recibido y lo revisaremos pronto.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setRating(0);
                    setComentario("");
                    setTipo("general");
                    setTab("mias");
                  }}
                  className="mt-4 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-teal-600"
                >
                  Ver mis opiniones
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    ¿Qué quieres valorar?
                  </label>
                  <div className="flex gap-2">
                    {TIPOS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setTipo(t.value)}
                        className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition ${
                          tipo === t.value
                            ? "border-teal-500 bg-teal-50 text-teal-700"
                            : "border-slate-200 text-slate-600 hover:border-teal-300"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Tu puntuación
                  </label>
                  <StarRating value={rating} onChange={setRating} />
                  <p className="mt-1 text-[11px] text-slate-400">
                    {rating === 0
                      ? "Selecciona de 1 a 5 estrellas"
                      : ["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"][rating]}
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Tu comentario
                  </label>
                  <textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    maxLength={500}
                    rows={4}
                    placeholder="Cuéntanos tu experiencia..."
                    className="w-full resize-none rounded-xl border border-slate-200 p-3 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
                    required
                  />
                  <p className="text-right text-[10px] text-slate-400">
                    {comentario.length}/500
                  </p>
                </div>

                {error && (
                  <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-teal-700 py-2.5 text-sm font-bold text-white transition hover:bg-teal-600 disabled:opacity-60"
                >
                  {submitting ? "Enviando..." : "Enviar opinión"}
                </button>
              </form>
            )
          ) : (
            <MisOpinionesList />
          )}
        </div>
      </div>
    </div>
  );
}
