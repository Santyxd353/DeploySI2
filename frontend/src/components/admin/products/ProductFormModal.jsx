export default function ProductFormModal({
  show,
  editingProduct,
  formData,
  categorias,
  subcategorias,
  laboratorios,
  imagePreview,
  saving,
  onClose,
  onSubmit,
  onInputChange,
  buildImageUrl,
}) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/30 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl sm:animate-in sm:slide-in-from-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100 px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">{editingProduct ? "Editar Producto" : "Crear Nuevo Producto"}</h2>
            <p className="text-sm text-slate-500 mt-1">Rellena los detalles del producto farmacéutico</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none transition-colors">
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-6 p-8">
          <div className="grid gap-6 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre Comercial *</span>
              <input
                type="text"
                name="nombre_comercial"
                value={formData.nombre_comercial}
                onChange={onInputChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all outline-none"
                placeholder="Ej: Paracetamol 500mg"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre Genérico</span>
              <input
                type="text"
                name="nombre_generico"
                value={formData.nombre_generico}
                onChange={onInputChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all outline-none"
                placeholder="Ej: Paracetamol"
              />
            </label>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">SKU *</span>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={onInputChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all outline-none font-mono"
                placeholder="BOL-INTI-PARA500"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Laboratorio *</span>
              <select
                name="laboratorio_id"
                value={formData.laboratorio_id}
                onChange={onInputChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all outline-none"
                required
              >
                <option value="">Selecciona laboratorio...</option>
                {laboratorios.map((lab) => (
                  <option key={lab.id} value={lab.id}>{lab.nombre}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <label className="space-y-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoría *</span>
              <select
                name="categoria_id"
                value={formData.categoria_id}
                onChange={onInputChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all outline-none"
                required
              >
                <option value="">Selecciona categoría...</option>
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subcategoría</span>
              <select
                name="subcategoria_id"
                value={formData.subcategoria_id}
                onChange={onInputChange}
                disabled={!formData.categoria_id}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all outline-none disabled:opacity-60"
              >
                <option value="">Sin subcategoría</option>
                {subcategorias.map((subcat) => (
                  <option key={subcat.id} value={subcat.id}>{subcat.nombre}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Forma Farmacéutica</span>
              <select
                name="forma_farmaceutica"
                value={formData.forma_farmaceutica}
                onChange={onInputChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all outline-none"
              >
                <option value="tableta">Tableta</option>
                <option value="capsula">Cápsula</option>
                <option value="jarabe">Jarabe</option>
                <option value="inyectable">Inyectable</option>
                <option value="crema">Crema</option>
                <option value="pomada">Pomada</option>
                <option value="solucion">Solución</option>
              </select>
            </label>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Concentración</span>
              <input
                type="text"
                name="concentracion"
                value={formData.concentracion}
                onChange={onInputChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all outline-none"
                placeholder="Ej: 500mg"
              />
            </label>
            <label className="space-y-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Presentación</span>
              <input
                type="text"
                name="presentacion"
                value={formData.presentacion}
                onChange={onInputChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all outline-none"
                placeholder="Ej: Caja x 30 tabletas"
                required
              />
            </label>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Precio de Compra (Bs.) *</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="precio_compra"
                value={formData.precio_compra}
                onChange={onInputChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all outline-none font-mono"
                placeholder="0.00"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Precio de Venta (Bs.) *</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="precio_venta"
                value={formData.precio_venta}
                onChange={onInputChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all outline-none font-mono"
                placeholder="0.00"
                required
              />
            </label>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stock Mínimo</span>
              <input
                type="number"
                min="0"
                name="stock_minimo"
                value={formData.stock_minimo}
                onChange={onInputChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all outline-none"
                placeholder="10"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unidad de Medida</span>
              <select
                name="unidad_medida"
                value={formData.unidad_medida}
                onChange={onInputChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all outline-none"
              >
                <option value="unidad">Unidad</option>
                <option value="caja">Caja</option>
                <option value="blister">Blister</option>
                <option value="frasco">Frasco</option>
                <option value="tubo">Tubo</option>
              </select>
            </label>
          </div>

          <label className="space-y-2">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Imagen del Producto</span>
            <div className="flex gap-4">
              <div className="flex-1">
                <input
                  type="file"
                  name="imagen"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={onInputChange}
                  className="block w-full text-sm text-slate-500 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-br file:from-teal-50 file:to-teal-100 file:text-teal-700 file:px-4 file:py-2 hover:file:from-teal-100 hover:file:to-teal-200 file:cursor-pointer"
                />
              </div>
              {(imagePreview || editingProduct?.imagen) && (
                <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-teal-200 bg-teal-50 flex-shrink-0">
                  <img src={imagePreview || buildImageUrl(editingProduct.imagen)} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </label>

          <label className="space-y-2">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descripción</span>
            <textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={onInputChange}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all outline-none"
              rows="3"
              placeholder="Describe el producto, uso recomendado o detalles relevantes"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                name="requiere_receta"
                checked={formData.requiere_receta}
                onChange={onInputChange}
                className="w-5 h-5 rounded border-slate-300 cursor-pointer accent-teal-600"
              />
              <span className="text-sm font-medium text-slate-700">Requiere Receta</span>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                name="es_controlado"
                checked={formData.es_controlado}
                onChange={onInputChange}
                className="w-5 h-5 rounded border-slate-300 cursor-pointer accent-teal-600"
              />
              <span className="text-sm font-medium text-slate-700">Es Controlado</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-full border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-br from-teal-600 to-teal-700 shadow-lg shadow-teal-600/20 hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {saving ? "Guardando..." : editingProduct ? "Actualizar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
