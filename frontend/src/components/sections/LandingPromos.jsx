import { useEffect, useRef, useState } from "react";
import { popularBrands, promoBlocks } from "../../data/homeData";
import { publicidadService } from "../../services/publicidadService";
import { useOutsideClick } from "../../hooks/useOutsideClick";
import { CloseIcon, CalendarIcon, MegaphoneIcon } from "../ui/Icons";
import { Button } from "../ui/button";

function CampanaModal({ campana, onClose }) {
  const ref = useRef(null);
  useOutsideClick(ref, onClose);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const descuento = parseFloat(campana.descuento);
  const diasRestantes = Math.max(
    0,
    Math.ceil((new Date(campana.fecha_fin) - new Date()) / (1000 * 60 * 60 * 24))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        ref={ref}
        className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
      >
        {/* Imagen o header de color */}
        {campana.imagen_url ? (
          <div className="relative">
            <img
              src={campana.imagen_url}
              alt={campana.titulo}
              className="h-48 w-full object-cover"
            />
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-indigo-600 to-violet-600">
            <MegaphoneIcon className="h-12 w-12 text-white/60" />
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Contenido */}
        <div className="space-y-4 p-5">
          {/* Descuento badge */}
          {descuento > 0 && (
            <div className="flex justify-center">
              <span className="rounded-full bg-indigo-600 px-5 py-1.5 text-2xl font-black text-white">
                {descuento}% OFF
              </span>
            </div>
          )}

          {/* Título */}
          <div className="text-center">
            <h3 className="text-xl font-black leading-tight text-slate-900">{campana.titulo}</h3>
          </div>

          {/* Descripción */}
          {campana.descripcion && (
            <p className="text-center text-sm leading-relaxed text-slate-600">
              {campana.descripcion}
            </p>
          )}

          {/* Vigencia */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-500">
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>Inicio</span>
              </div>
              <span className="font-bold text-slate-800">{campana.fecha_inicio}</span>
            </div>
            <div className="my-2 h-px bg-slate-200" />
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-500">
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>Vence</span>
              </div>
              <span className="font-bold text-slate-800">{campana.fecha_fin}</span>
            </div>
            <div className="my-2 h-px bg-slate-200" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Tiempo restante</span>
              <span
                className={`font-black ${
                  diasRestantes <= 3
                    ? "text-rose-600"
                    : diasRestantes <= 7
                    ? "text-amber-600"
                    : "text-green-600"
                }`}
              >
                {diasRestantes === 0
                  ? "Vence hoy"
                  : `${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}`}
              </span>
            </div>
          </div>

          {/* Segmentos */}
          {campana.segmentos?.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {campana.segmentos.map((s) => (
                <span
                  key={s.id}
                  className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700"
                >
                  {s.nombre}
                </span>
              ))}
            </div>
          )}

          <Button
            onClick={onClose}
            className="w-full bg-indigo-600 font-bold hover:bg-indigo-700"
          >
            Entendido
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function LandingPromos() {
  const [campanas, setCampanas] = useState([]);
  const [modalCampana, setModalCampana] = useState(null);

  useEffect(() => {
    publicidadService
      .activas()
      .then((data) => setCampanas(Array.isArray(data) ? data : (data.results ?? [])))
      .catch(() => setCampanas([]));
  }, []);

  return (
    <section className="space-y-4">

      {/* ── Campañas dinámicas desde la API ─────────────────────────────────── */}
      {campanas.length > 0 && (
        <div className="space-y-3">
          <p className="px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600">
            Promociones activas
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {campanas.map((campana, i) => {
              const tono = i % 2 === 0 ? "primary" : "secondary";
              return (
                <article
                  key={campana.id}
                  className={`rounded-[28px] border p-5 shadow-2xl shadow-slate-200/60 sm:p-6 ${
                    tono === "primary"
                      ? "border-indigo-200 bg-gradient-to-br from-indigo-600 to-violet-600 text-white"
                      : "border-teal-200 bg-gradient-to-br from-white to-teal-50 text-slate-800"
                  }`}
                >
                  {campana.imagen_url && (
                    <img
                      src={campana.imagen_url}
                      alt={campana.titulo}
                      className="mb-3 h-28 w-full rounded-2xl object-cover"
                    />
                  )}
                  <p
                    className={`text-[11px] font-bold uppercase tracking-[0.2em] ${
                      tono === "primary" ? "text-indigo-200" : "text-teal-700"
                    }`}
                  >
                    {parseFloat(campana.descuento) > 0
                      ? `${parseFloat(campana.descuento)}% de descuento`
                      : "Promoción especial"}
                  </p>
                  <h3 className="mt-2 text-xl font-black leading-tight">{campana.titulo}</h3>
                  {campana.descripcion && (
                    <p
                      className={`mt-2 line-clamp-2 text-sm leading-relaxed ${
                        tono === "primary" ? "text-indigo-100" : "text-slate-600"
                      }`}
                    >
                      {campana.descripcion}
                    </p>
                  )}
                  <p
                    className={`mt-2 text-[11px] ${
                      tono === "primary" ? "text-indigo-300" : "text-slate-400"
                    }`}
                  >
                    Válido hasta {campana.fecha_fin}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setModalCampana(campana)}
                    className={`mt-4 ${
                      tono === "primary"
                        ? "bg-white text-indigo-700 hover:bg-indigo-50"
                        : "bg-teal-700 text-white hover:bg-teal-600"
                    }`}
                  >
                    Ver más
                  </Button>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Bloques estáticos siempre visibles ──────────────────────────────── */}
      <div className="grid gap-3 md:grid-cols-2">
        {promoBlocks.map((promo) => (
          <article
            key={promo.title}
            className={`rounded-[28px] border p-5 shadow-2xl shadow-slate-200/60 sm:p-6 ${
              promo.tone === "primary"
                ? "border-teal-200 bg-gradient-to-br from-teal-600 to-cyan-600 text-white"
                : "border-sky-200 bg-gradient-to-br from-white to-sky-50 text-slate-800"
            }`}
          >
            <p
              className={`text-[11px] font-bold uppercase tracking-[0.2em] ${
                promo.tone === "primary" ? "text-teal-100" : "text-sky-700"
              }`}
            >
              Destacado
            </p>
            <h3 className="mt-2 text-xl font-black leading-tight">{promo.title}</h3>
            <p
              className={`mt-2 text-sm leading-relaxed ${
                promo.tone === "primary" ? "text-teal-50" : "text-slate-600"
              }`}
            >
              {promo.description}
            </p>
            <Button
              size="sm"
              className={`mt-4 ${
                promo.tone === "primary"
                  ? "bg-white text-teal-700 hover:bg-teal-50"
                  : "bg-sky-700 text-white hover:bg-sky-600"
              }`}
            >
              {promo.cta}
            </Button>
          </article>
        ))}
      </div>

      {/* ── Marcas populares ────────────────────────────────────────────────── */}
      <div className="rounded-[28px] border border-slate-200 bg-white/97 p-4 shadow-md">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Marcas populares</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {popularBrands.map((brand) => (
            <span
              key={brand}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              {brand}
            </span>
          ))}
        </div>
      </div>

      {/* ── Modal de detalle de campaña ──────────────────────────────────────── */}
      {modalCampana && (
        <CampanaModal
          campana={modalCampana}
          onClose={() => setModalCampana(null)}
        />
      )}
    </section>
  );
}
