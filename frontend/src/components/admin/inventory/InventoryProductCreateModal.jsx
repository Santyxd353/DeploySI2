import { useMemo, useRef, useState } from "react";
import { getApiBaseUrl } from "../../../services/apiClient";

function fieldClassName() {
  return "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:ring-1 focus:ring-teal-600";
}

export default function InventoryProductCreateModal({
  show,
  saving,
  editMode = false,
  error,
  formData,
  currentUser,
  categorias,
  subcategorias,
  laboratorios,
  onClose,
  onSubmit,
  onInputChange,
}) {
  const fileInputRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fechaActual = useMemo(() => new Date().toLocaleDateString("es-BO"), []);
  const usuarioAuditoria = useMemo(() => {
    const fullName = [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(" ").trim();
    return fullName || currentUser?.username || currentUser?.email || "Usuario";
  }, [currentUser]);

  const buildImageUrl = (imagen) => {
    if (!imagen) return "";
    if (/^https?:\/\//i.test(imagen)) return imagen;
    const baseUrl = getApiBaseUrl().replace(/\/$/, "");
    const normalized = String(imagen).trim().replace(/\\/g, "/");
    if (normalized.startsWith("/media/")) return `${baseUrl}${normalized}`;
    if (normalized.startsWith("media/")) return `${baseUrl}/${normalized}`;
    if (normalized.startsWith("/productos/")) return `${baseUrl}/media${normalized}`;
    if (normalized.startsWith("productos/")) return `${baseUrl}/media/${normalized}`;
    return `${baseUrl}${normalized.startsWith("/") ? "" : "/"}${normalized}`;
  };

  const imagePreview = useMemo(() => {
    if (formData?.imagen && typeof formData.imagen !== "string") {
      return URL.createObjectURL(formData.imagen);
    }
    const persisted = formData?.imagen_url || (typeof formData?.imagen === "string" ? formData.imagen : "");
    return buildImageUrl(persisted);
  }, [formData?.imagen, formData?.imagen_url]);

  const handleImageFile = (file) => {
    if (!file) return;
    const acceptedMime = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"]);
    const fileName = String(file.name || "").toLowerCase();
    const byExtension = [".png", ".jpg", ".jpeg", ".webp", ".svg"].some((ext) => fileName.endsWith(ext));
    const byMime = acceptedMime.has(String(file.type || "").toLowerCase());
    // Some environments report empty/odd mime types, so accept valid extensions too.
    if (!byMime && !byExtension) return;
    onInputChange({
      target: {
        name: "imagen",
        type: "file",
        files: [file],
      },
    });
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/45 px-4 py-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[1320px] rounded-2xl border border-slate-200 bg-slate-100 p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900">{editMode ? "Editar Producto" : "Anadir Nuevo Producto"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-8 py-7">
              <p className="mt-2 text-sm font-semibold text-slate-700">Complete los detalles tecnicos del medicamento para actualizar el catalogo maestro.</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-6 px-8 py-7">
              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-900">Nombre Comercial *</span>
                  <input name="nombre_comercial" value={formData.nombre_comercial} onChange={onInputChange} className={fieldClassName()} placeholder="Ej: Paracetamol 500mg" required />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-900">Nombre Generico</span>
                  <input name="nombre_generico" value={formData.nombre_generico} onChange={onInputChange} className={fieldClassName()} placeholder="Ej: Paracetamol" />
                </label>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-900">SKU *</span>
                  <input name="sku" value={formData.sku} onChange={onInputChange} className={`${fieldClassName()} font-mono uppercase`} placeholder="BOL-INTI-PARA500" required />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-900">Laboratorio *</span>
                  <select name="laboratorio_id" value={formData.laboratorio_id} onChange={onInputChange} className={fieldClassName()} required>
                    <option value="">Selecciona laboratorio...</option>
                    {laboratorios.map((lab) => (
                      <option key={lab.id} value={lab.id}>
                        {lab.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-900">Categoria *</span>
                  <select name="categoria_id" value={formData.categoria_id} onChange={onInputChange} className={fieldClassName()} required>
                    <option value="">Selecciona categoria...</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-900">Subcategoria</span>
                  <select name="subcategoria_id" value={formData.subcategoria_id} onChange={onInputChange} className={fieldClassName()} disabled={!formData.categoria_id}>
                    <option value="">Sin subcategoria</option>
                    {subcategorias.map((subcat) => (
                      <option key={subcat.id} value={subcat.id}>
                        {subcat.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-900">Forma farmaceutica</span>
                  <select name="forma_farmaceutica" value={formData.forma_farmaceutica} onChange={onInputChange} className={fieldClassName()}>
                    <option value="tableta">Tableta</option>
                    <option value="capsula">Capsula</option>
                    <option value="jarabe">Jarabe</option>
                    <option value="inyectable">Inyectable</option>
                    <option value="crema">Crema</option>
                    <option value="gotas">Gotas</option>
                    <option value="suspension">Suspension</option>
                    <option value="polvo">Polvo</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-900">Concentracion</span>
                  <input name="concentracion" value={formData.concentracion} onChange={onInputChange} className={fieldClassName()} placeholder="Ej: 500mg" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-900">Presentacion</span>
                  <input name="presentacion" value={formData.presentacion} onChange={onInputChange} className={fieldClassName()} placeholder="Ej: Caja x 30 tabletas" />
                </label>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-900">Precio de compra (Bs.) *</span>
                  <input type="number" min="0" step="0.01" name="precio_compra" value={formData.precio_compra} onChange={onInputChange} className={`${fieldClassName()} font-mono`} placeholder="0.00" required />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-900">Precio de venta (Bs.) *</span>
                  <input type="number" min="0" step="0.01" name="precio_venta" value={formData.precio_venta} onChange={onInputChange} className={`${fieldClassName()} font-mono`} placeholder="0.00" required />
                </label>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-900">Stock minimo</span>
                  <input type="number" min="0" name="stock_minimo" value={formData.stock_minimo} onChange={onInputChange} className={`${fieldClassName()} font-mono`} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-900">Unidad de medida</span>
                  <select name="unidad_medida" value={formData.unidad_medida} onChange={onInputChange} className={fieldClassName()}>
                    <option value="unidad">Unidad</option>
                    <option value="caja">Caja</option>
                    <option value="blister">Blister</option>
                    <option value="frasco">Frasco</option>
                    <option value="tubo">Tubo</option>
                  </select>
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-900">Descripcion</span>
                <textarea name="descripcion" value={formData.descripcion} onChange={onInputChange} className={fieldClassName()} rows="3" placeholder="Describe el producto, uso recomendado o detalles relevantes" />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <input type="checkbox" name="requiere_receta" checked={formData.requiere_receta} onChange={onInputChange} className="h-5 w-5 rounded border-slate-300 accent-teal-700" />
                  <span className="text-sm font-medium text-slate-800">Requiere Receta</span>
                </label>
                <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <input type="checkbox" name="es_controlado" checked={formData.es_controlado} onChange={onInputChange} className="h-5 w-5 rounded border-slate-300 accent-teal-700" />
                  <span className="text-sm font-medium text-slate-800">Es Controlado</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-6">
                <button type="button" onClick={onClose} disabled={saving} className="rounded-lg px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-8 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                  {saving ? "Guardando..." : editMode ? "Guardar cambios" : "Crear"}
                </button>
              </div>
            </form>
          </section>

          <aside className="space-y-5">
            <div
              className={`overflow-hidden rounded-xl border bg-white p-3 transition-colors ${
                isDragActive ? "border-teal-500 ring-2 ring-teal-100" : "border-slate-200"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragActive(true);
              }}
              onDragLeave={() => setIsDragActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragActive(false);
                const file = event.dataTransfer?.files?.[0];
                handleImageFile(file);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                name="imagen"
                accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(event) => handleImageFile(event.target.files?.[0])}
                className="hidden"
              />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full text-left">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview producto" className="h-40 w-full rounded-lg object-cover" />
                ) : (
                  <div className="flex h-40 flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 text-center">
                    <p className="text-sm font-semibold text-slate-800">Arrastra imagen aqui</p>
                    <p className="mt-1 text-xs text-slate-500">o haz clic para cargar desde tu dispositivo</p>
                    <p className="mt-2 text-[11px] text-slate-400">PNG, JPG, WEBP, SVG</p>
                  </div>
                )}
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h4 className="text-lg font-semibold text-slate-900">Tips de Registro</h4>
              <ul className="mt-4 space-y-4 text-slate-700">
                <li><span className="mr-2 font-bold text-blue-800">01.</span>Estandarizacion de Nombres: use siempre el nombre generico seguido de la concentracion.</li>
                <li><span className="mr-2 font-bold text-blue-800">02.</span>Criterio FEFO: el SKU debe ser unico y consistente con fabrica.</li>
                <li><span className="mr-2 font-bold text-blue-800">03.</span>Stock Critico: configure el minimo segun lead time del proveedor.</li>
              </ul>
              <div className="mt-5 rounded-lg border-l-4 border-blue-700 bg-blue-50 p-4 text-slate-700">
                <p className="font-semibold text-blue-900">Necesita ayuda?</p>
                <p className="mt-1 text-sm">Consulte el manual de farmacovigilancia para la categorizacion correcta.</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Info de Auditoria</h4>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Usuario:</span><span className="font-semibold">{usuarioAuditoria}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Fecha:</span><span className="font-semibold">{fechaActual}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Sede:</span><span className="font-semibold">Almacen Central</span></div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

