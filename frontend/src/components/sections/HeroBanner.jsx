import { SparkIcon } from "../ui/Icons";
import { Button } from "../ui/button";

export default function HeroBanner() {
  return (
    <section className="hero-shell rounded-[28px] border border-sky-100 p-6 shadow-2xl shadow-slate-200/60 sm:p-8">
      <div className="grid items-center gap-8 md:grid-cols-2">
        <div>
          <p className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-widest text-teal-700">
            <SparkIcon className="h-3.5 w-3.5" />
            Salud y bienestar
          </p>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">
            Tu salud en buenas manos, con entrega rapida y atencion profesional
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Encuentra medicamentos, cuidado personal y productos de bienestar con una experiencia simple y confiable.
          </p>
          
        </div>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
          <div className="rounded-2xl border border-white/60 bg-white/85 p-4 text-sm font-semibold text-teal-800 shadow-sm">
            Medicamentos y productos certificados
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/85 p-4 text-sm font-semibold text-teal-800 shadow-sm">
            Entrega en el mismo dia en zonas habilitadas
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/85 p-4 text-sm font-semibold text-teal-800 shadow-sm">
            Asesoria farmaceutica para compras responsables
          </div>
        </div>
      </div>
    </section>
  );
}
