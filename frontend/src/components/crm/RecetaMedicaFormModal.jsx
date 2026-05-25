import { useEffect, useRef, useState } from "react";
import { clientesService } from "../../services/clientesService";
import { CloseIcon, SearchIcon } from "../ui/Icons";

const today = () => new Date().toISOString().slice(0, 10);

const ACCEPTED_RECETA = ".pdf,.jpg,.jpeg,.png";
const ACCEPTED_FIRMA = ".jpg,.jpeg,.png";
const MAX_SIZE_MB = 5;

const initialForm = {
  codigo: "",
  fecha_emision: today(),
  fecha_vencimiento: "",
  observacion: "",
  medico_nombre: "",
  medico_licencia: "",
  medico_especialidad: "",
};

// ── FileDropZone ─────────────────────────────────────────────────────────────
function FileDropZone({ file, onChange, error, accept, label, hint }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files) => {
    const f = files[0];
    if (f) onChange(f);
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition ${
          dragging
            ? "border-indigo-400 bg-indigo-50"
            : file
            ? "border-emerald-300 bg-emerald-50"
            : "border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50"
        }`}
      >
        {file ? (
          <>
            <p className="text-sm font-bold text-emerald-700">{file.name}</p>
            <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <p className="text-[11px] text-indigo-600 underline">Cambiar archivo</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-600">{label}</p>
            <p className="text-xs text-slate-400">{hint} — máx. {MAX_SIZE_MB} MB</p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

// ── ImagePreview ──────────────────────────────────────────────────────────────
function ImagePreview({ file, existingUrl, onClear }) {
  const [objectUrl, setObjectUrl] = useState(null);

  useEffect(() => {
    if (!file) { setObjectUrl(null); return; }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const src = objectUrl || existingUrl;
  if (!src) return null;

  return (
    <div className="relative inline-block">
      <img
        src={src}
        alt="Vista previa firma"
        className="h-20 w-auto rounded-xl border border-slate-200 object-contain shadow-sm"
      />
      <button
        type="button"
        onClick={onClear}
        className="absolute -right-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white shadow"
        title="Quitar imagen"
      >
        <CloseIcon className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── ClienteSelect ─────────────────────────────────────────────────────────────
function ClienteSelect({ value, onChange, error }) {
  const [clientes, setClientes] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clientesService
      .listar({ page_size: 200, ordering: "nombres" })
      .then((res) => setClientes(Array.isArray(res) ? res : (res?.results ?? [])))
      .finally(() => setLoading(false));
  }, []);

  const filtered = clientes.filter((c) => {
    const q = search.toLowerCase();
    return !q || `${c.nombres} ${c.apellidos}`.toLowerCase().includes(q) || (c.ci_nit || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-1">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente..."
          className="w-full rounded-xl border border-slate-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-indigo-400"
        />
      </div>
      <select
        size={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border px-3 py-1 text-sm outline-none focus:border-indigo-400 ${error ? "border-rose-400" : "border-slate-200"}`}
      >
        <option value="">— seleccionar —</option>
        {loading ? <option disabled>Cargando...</option> : filtered.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombres} {c.apellidos} {c.ci_nit ? `· ${c.ci_nit}` : ""}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function RecetaMedicaFormModal({ clienteId, clienteNombre, receta, onClose, onSaved }) {
  const isEditing = Boolean(receta);

  const [form, setForm] = useState(initialForm);
  const [selectedClienteId, setSelectedClienteId] = useState(clienteId ? String(clienteId) : "");
  const [archivo, setArchivo] = useState(null);
  const [firmaFile, setFirmaFile] = useState(null);
  const [clearFirma, setClearFirma] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [globalError, setGlobalError] = useState("");

  // Pre-fill when editing
  useEffect(() => {
    if (receta) {
      setForm({
        codigo: receta.codigo ?? "",
        fecha_emision: receta.fecha_emision ?? today(),
        fecha_vencimiento: receta.fecha_vencimiento ?? "",
        observacion: receta.observacion ?? "",
        medico_nombre: receta.medico?.nombre ?? "",
        medico_licencia: receta.medico?.licencia ?? "",
        medico_especialidad: receta.medico?.especialidad ?? "",
      });
      setSelectedClienteId(receta.cliente ? String(receta.cliente) : "");
    } else {
      setForm({ ...initialForm, fecha_emision: today() });
      setSelectedClienteId(clienteId ? String(clienteId) : "");
    }
    setArchivo(null);
    setFirmaFile(null);
    setClearFirma(false);
    setFieldErrors({});
    setGlobalError("");
  }, [receta, clienteId]);

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const validateFile = (f) => {
    if (!f) return "";
    const ext = f.name.split(".").pop().toLowerCase();
    if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) return "Solo se permiten archivos PDF, JPG o PNG.";
    if (f.size > MAX_SIZE_MB * 1024 * 1024) return `El archivo no puede superar los ${MAX_SIZE_MB} MB.`;
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError("");

    const resolvedClienteId = clienteId ?? selectedClienteId;
    const errors = {};
    if (!resolvedClienteId) errors.cliente = "Debes seleccionar un cliente.";
    if (!form.codigo.trim()) errors.codigo = "El código es obligatorio.";
    if (!form.fecha_emision) errors.fecha_emision = "La fecha de emisión es obligatoria.";
    if (!isEditing) {
      const fileErr = validateFile(archivo);
      if (!archivo) errors.archivo = "El archivo es obligatorio.";
      else if (fileErr) errors.archivo = fileErr;
    } else {
      const fileErr = validateFile(archivo);
      if (archivo && fileErr) errors.archivo = fileErr;
    }

    if (Object.keys(errors).length) { setFieldErrors(errors); return; }

    const fd = new FormData();
    fd.append("cliente", resolvedClienteId);
    fd.append("codigo", form.codigo.trim());
    fd.append("fecha_emision", form.fecha_emision);
    if (form.fecha_vencimiento) fd.append("fecha_vencimiento", form.fecha_vencimiento);
    if (form.observacion.trim()) fd.append("observacion", form.observacion.trim());
    if (archivo) fd.append("archivo", archivo);

    // Medico fields
    if (form.medico_nombre.trim()) {
      fd.append("medico_nombre", form.medico_nombre.trim());
      fd.append("medico_licencia", form.medico_licencia.trim());
      fd.append("medico_especialidad", form.medico_especialidad.trim());
    }
    if (firmaFile) fd.append("medico_firma_imagen", firmaFile);

    try {
      setSaving(true);
      if (isEditing) {
        await clientesService.actualizarReceta(receta.id, fd);
      } else {
        await clientesService.crearReceta(fd);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      if (err && typeof err === "object") {
        const fErrors = {};
        let hasField = false;
        for (const [k, v] of Object.entries(err)) {
          if (k === "detail" || k === "non_field_errors") continue;
          fErrors[k] = Array.isArray(v) ? v[0] : String(v);
          hasField = true;
        }
        if (hasField) setFieldErrors(fErrors);
        else setGlobalError(err.detail || "No se pudo guardar la receta.");
      } else {
        setGlobalError("No se pudo guardar la receta.");
      }
    } finally {
      setSaving(false);
    }
  };

  const existingFirmaUrl = receta?.medico?.firma_imagen_url ?? null;
  const showFirmaPreview = !clearFirma && (firmaFile || existingFirmaUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-[28px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between rounded-t-[28px] bg-gradient-to-r from-indigo-700 to-violet-700 px-6 py-4 text-white">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-200">
              {isEditing ? "Editar receta" : "Nueva receta"}
            </p>
            <h2 className="text-lg font-black">{clienteNombre ?? "Receta médica"}</h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 transition hover:bg-white/20">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="max-h-[78vh] overflow-y-auto">
          <div className="space-y-4 p-6">
            {globalError ? <p className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{globalError}</p> : null}

            {/* Cliente selector (solo en crear sin clienteId) */}
            {!clienteId && !isEditing ? (
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500">Cliente *</span>
                <ClienteSelect
                  value={selectedClienteId}
                  onChange={(v) => { setSelectedClienteId(v); setFieldErrors((p) => ({ ...p, cliente: "" })); }}
                  error={fieldErrors.cliente}
                />
              </div>
            ) : null}

            {/* Código + Fecha emisión */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-bold text-slate-500">Código de receta *</span>
                <input
                  value={form.codigo}
                  onChange={(e) => set("codigo", e.target.value)}
                  placeholder="Ej: REC-2026-001"
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-indigo-400 ${fieldErrors.codigo ? "border-rose-400" : "border-slate-200"}`}
                />
                {fieldErrors.codigo ? <p className="text-xs text-rose-600">{fieldErrors.codigo}</p> : null}
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold text-slate-500">Fecha de emisión *</span>
                <input
                  type="date"
                  value={form.fecha_emision}
                  onChange={(e) => set("fecha_emision", e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-indigo-400 ${fieldErrors.fecha_emision ? "border-rose-400" : "border-slate-200"}`}
                />
                {fieldErrors.fecha_emision ? <p className="text-xs text-rose-600">{fieldErrors.fecha_emision}</p> : null}
              </label>
            </div>

            {/* Fecha vencimiento */}
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-500">Fecha de vencimiento</span>
              <input
                type="date"
                value={form.fecha_vencimiento}
                min={form.fecha_emision}
                onChange={(e) => set("fecha_vencimiento", e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </label>

            {/* Archivo receta */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500">
                Archivo de receta{!isEditing ? " *" : " (opcional al editar)"}
              </span>
              <FileDropZone
                file={archivo}
                onChange={(f) => { setArchivo(f); setFieldErrors((p) => ({ ...p, archivo: "" })); }}
                error={fieldErrors.archivo}
                accept={ACCEPTED_RECETA}
                label="Arrastra o haz clic para subir"
                hint="PDF, JPG, PNG"
              />
            </div>

            {/* Observaciones */}
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-500">Observaciones</span>
              <textarea
                value={form.observacion}
                onChange={(e) => set("observacion", e.target.value)}
                rows={2}
                placeholder="Notas adicionales..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </label>

            {/* ── Datos del médico ── */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Datos del médico</p>

              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">Nombre del médico</span>
                <input
                  value={form.medico_nombre}
                  onChange={(e) => set("medico_nombre", e.target.value)}
                  placeholder="Dr. Juan Pérez"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-bold text-slate-500">N° de licencia</span>
                  <input
                    value={form.medico_licencia}
                    onChange={(e) => set("medico_licencia", e.target.value)}
                    placeholder="Ej: LIC-1234"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-bold text-slate-500">Especialidad</span>
                  <input
                    value={form.medico_especialidad}
                    onChange={(e) => set("medico_especialidad", e.target.value)}
                    placeholder="Ej: Medicina general"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  />
                </label>
              </div>

              {/* Firma / sello */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-500">Firma / Sello del médico</span>
                {showFirmaPreview ? (
                  <ImagePreview
                    file={firmaFile}
                    existingUrl={!firmaFile ? existingFirmaUrl : null}
                    onClear={() => { setFirmaFile(null); setClearFirma(true); }}
                  />
                ) : (
                  <FileDropZone
                    file={firmaFile}
                    onChange={(f) => { setFirmaFile(f); setClearFirma(false); }}
                    error={fieldErrors.medico_firma_imagen}
                    accept={ACCEPTED_FIRMA}
                    label="Arrastra o haz clic para subir firma"
                    hint="JPG, PNG"
                  />
                )}
                {fieldErrors.medico_firma_imagen ? (
                  <p className="text-xs text-rose-600">{fieldErrors.medico_firma_imagen}</p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
              {saving ? "Guardando..." : isEditing ? "Actualizar receta" : "Subir receta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
