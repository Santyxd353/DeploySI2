import { useCallback, useEffect, useRef, useState } from "react";
import CRMLayout from "../../components/crm/CRMLayout";
import {
  CalendarIcon,
  CloseIcon,
  MegaphoneIcon,
  PencilIcon,
  SaveIcon,
} from "../../components/ui/Icons";
import { publicidadService } from "../../services/publicidadService";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TONO_SEGMENTO = {
  todos: "bg-slate-100 text-slate-700",
  champions: "bg-amber-100 text-amber-700",
  frecuentes: "bg-indigo-100 text-indigo-700",
  nuevos: "bg-green-100 text-green-700",
  en_riesgo: "bg-orange-100 text-orange-700",
  inactivos: "bg-rose-100 text-rose-700",
};

function Badge({ codigo, nombre }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TONO_SEGMENTO[codigo] ?? "bg-slate-100 text-slate-700"}`}>
      {nombre}
    </span>
  );
}

function buildFormData(fields, imagenFile) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (k === "segmentos_ids") {
      v.forEach((id) => fd.append("segmentos_ids", id));
    } else {
      fd.append(k, v);
    }
  });
  if (imagenFile) fd.append("imagen", imagenFile);
  return fd;
}

const EMPTY_FORM = {
  titulo: "",
  descripcion: "",
  descuento: "0",
  fecha_inicio: "",
  fecha_fin: "",
  activa: true,
  segmentos_ids: [],
};

// ── Modal de creación / edición ───────────────────────────────────────────────

function CampanaModal({ campana, segmentos, onClose, onSaved }) {
  const [form, setForm] = useState(
    campana
      ? {
          titulo: campana.titulo,
          descripcion: campana.descripcion,
          descuento: String(campana.descuento),
          fecha_inicio: campana.fecha_inicio,
          fecha_fin: campana.fecha_fin,
          activa: campana.activa,
          segmentos_ids: campana.segmentos.map((s) => s.id),
        }
      : { ...EMPTY_FORM }
  );
  const [imagenFile, setImagenFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  const toggle = (id) =>
    setForm((prev) => {
      const next = prev.segmentos_ids.includes(id)
        ? prev.segmentos_ids.filter((x) => x !== id)
        : [...prev.segmentos_ids, id];
      return { ...prev, segmentos_ids: next };
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.titulo.trim()) return setError("El título es obligatorio.");
    if (!form.fecha_inicio || !form.fecha_fin) return setError("Las fechas son obligatorias.");
    if (form.fecha_fin < form.fecha_inicio) return setError("La fecha de fin debe ser posterior a la de inicio.");

    setSaving(true);
    try {
      const fd = buildFormData(form, imagenFile);
      if (campana) {
        await publicidadService.actualizar(campana.id, fd);
      } else {
        await publicidadService.crear(fd);
      }
      onSaved();
    } catch (err) {
      setError(err?.message ?? "Error al guardar la campaña.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-2">
            <MegaphoneIcon className="h-5 w-5 text-indigo-600" />
            <h2 className="text-sm font-black text-slate-900">
              {campana ? "Editar campaña" : "Nueva campaña"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-200"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="max-h-[75vh] space-y-4 overflow-y-auto p-5">
          {error && (
            <p className="rounded-xl bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Título *</label>
            <input
              type="text"
              maxLength={120}
              value={form.titulo}
              onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="Ej: Semana del ahorro"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Descripción</label>
            <textarea
              rows={3}
              value={form.descripcion}
              onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="Describe la campaña..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Descuento (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.descuento}
                onChange={(e) => setForm((p) => ({ ...p, descuento: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.activa}
                  onChange={(e) => setForm((p) => ({ ...p, activa: e.target.checked }))}
                  className="h-4 w-4 rounded accent-indigo-600"
                />
                <span className="text-xs font-bold text-slate-700">Activa</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Fecha inicio *</label>
              <input
                type="date"
                value={form.fecha_inicio}
                onChange={(e) => setForm((p) => ({ ...p, fecha_inicio: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Fecha fin *</label>
              <input
                type="date"
                value={form.fecha_fin}
                onChange={(e) => setForm((p) => ({ ...p, fecha_fin: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          {/* Segmentos RFM */}
          <div>
            <label className="mb-2 block text-xs font-bold text-slate-700">
              Segmentos RFM objetivo
            </label>
            <div className="flex flex-wrap gap-2">
              {segmentos.map((seg) => {
                const sel = form.segmentos_ids.includes(seg.id);
                return (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => toggle(seg.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                      sel
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300"
                    }`}
                  >
                    {seg.nombre}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Sin selección = visible para todos los clientes
            </p>
          </div>

          {/* Imagen */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Imagen</label>
            {campana?.imagen_url && !imagenFile && (
              <img
                src={campana.imagen_url}
                alt="Imagen actual"
                className="mb-2 h-20 w-full rounded-xl object-cover"
              />
            )}
            {imagenFile && (
              <img
                src={URL.createObjectURL(imagenFile)}
                alt="Preview"
                className="mb-2 h-20 w-full rounded-xl object-cover"
              />
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => setImagenFile(e.target.files[0] || null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border border-dashed border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600"
            >
              {imagenFile ? "Cambiar imagen" : "Seleccionar imagen"}
            </button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              <SaveIcon className="h-3.5 w-3.5" />
              {saving ? "Guardando…" : campana ? "Guardar cambios" : "Crear campaña"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AdminPublicidadPage() {
  const [campanas, setCampanas] = useState([]);
  const [segmentos, setSegmentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroActiva, setFiltroActiva] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [modal, setModal] = useState(null); // null | "nueva" | campana-obj
  const [deleting, setDeleting] = useState(null);

  const PAGE_SIZE = 10;

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (search) params.search = search;
      if (filtroActiva !== "") params.activa = filtroActiva;

      const [res, segs] = await Promise.all([
        publicidadService.listar(params),
        segmentos.length ? Promise.resolve({ results: segmentos }) : publicidadService.listarSegmentos(),
      ]);

      setCampanas(res.results ?? res);
      setTotalPages(Math.max(1, Math.ceil((res.count ?? (res.results ?? res).length) / PAGE_SIZE)));
      if (!segmentos.length) setSegmentos(segs.results ?? segs);
    } catch {
      setCampanas([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, filtroActiva]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta campaña? Esta acción no se puede deshacer.")) return;
    setDeleting(id);
    try {
      await publicidadService.eliminar(id);
      await cargar();
    } finally {
      setDeleting(null);
    }
  };

  const handleSaved = () => {
    setModal(null);
    cargar();
  };

  const hoy = new Date().toISOString().slice(0, 10);

  const estadoCampana = (c) => {
    if (!c.activa) return { label: "Inactiva", cls: "bg-slate-100 text-slate-500" };
    if (c.fecha_fin < hoy) return { label: "Vencida", cls: "bg-rose-100 text-rose-600" };
    if (c.fecha_inicio > hoy) return { label: "Programada", cls: "bg-amber-100 text-amber-700" };
    return { label: "Activa", cls: "bg-green-100 text-green-700" };
  };

  return (
    <CRMLayout activeSection="publicidad">
      <div className="space-y-4">
        {/* Header card */}
        <div className="rounded-[28px] border border-slate-200 bg-white/97 p-5 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">Campañas Publicitarias</h2>
              <p className="text-xs text-slate-500">
                Crea y gestiona campañas segmentadas para tus clientes
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModal("nueva")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-700"
            >
              <MegaphoneIcon className="h-4 w-4" />
              Nueva campaña
            </button>
          </div>

          {/* Filtros */}
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar campaña…"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <select
              value={filtroActiva}
              onChange={(e) => { setFiltroActiva(e.target.value); setPage(1); }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
            >
              <option value="">Todas</option>
              <option value="true">Activas</option>
              <option value="false">Inactivas</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-[28px] border border-slate-200 bg-white/97 shadow-md">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-xs text-slate-400">
              Cargando campañas…
            </div>
          ) : campanas.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
              <MegaphoneIcon className="h-10 w-10 opacity-30" />
              <p className="text-xs font-semibold">No hay campañas registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3">Campaña</th>
                    <th className="px-4 py-3">Descuento</th>
                    <th className="px-4 py-3">Segmentos</th>
                    <th className="px-4 py-3">Vigencia</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campanas.map((c) => {
                    const { label, cls } = estadoCampana(c);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            {c.imagen_url ? (
                              <img
                                src={c.imagen_url}
                                alt={c.titulo}
                                className="h-10 w-10 flex-shrink-0 rounded-xl object-cover"
                              />
                            ) : (
                              <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                                <MegaphoneIcon className="h-5 w-5 text-indigo-400" />
                              </span>
                            )}
                            <div>
                              <p className="font-bold text-slate-900">{c.titulo}</p>
                              {c.descripcion && (
                                <p className="mt-0.5 max-w-xs truncate text-slate-400">
                                  {c.descripcion}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {parseFloat(c.descuento) > 0 ? (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 font-black text-green-700">
                              {parseFloat(c.descuento)}%
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {c.segmentos.length === 0 ? (
                            <Badge codigo="todos" nombre="Todos" />
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {c.segmentos.map((s) => (
                                <Badge key={s.id} codigo={s.codigo} nombre={s.nombre} />
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-slate-600">
                            <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                            <span>{c.fecha_inicio}</span>
                            <span className="text-slate-400">→</span>
                            <span>{c.fecha_fin}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 font-bold ${cls}`}>
                            {label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setModal(c)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600"
                              title="Editar"
                            >
                              <PencilIcon className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(c.id)}
                              disabled={deleting === c.id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-rose-400 transition hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50"
                              title="Eliminar"
                            >
                              <CloseIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-xs text-slate-500">
                Página {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <CampanaModal
          campana={modal === "nueva" ? null : modal}
          segmentos={segmentos}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </CRMLayout>
  );
}
