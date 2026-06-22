export default function ProductDetailModal({ show, selectedProductDetail, onClose, onEdit, buildImageUrl }) {
  if (!show || !selectedProductDetail) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 px-4 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div
        className="w-full sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl animate-in slide-in-from-bottom-5 sm:slide-in-from-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100 px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">Detalle del Producto</h2>
            <p className="text-sm text-slate-500 mt-1">Información completa del catálogo farmacéutico</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none transition-colors">
            ✕
          </button>
        </div>

        <div className="space-y-8 p-8">
          <div className="flex gap-6 flex-col sm:flex-row">
            <div className="w-full sm:w-48 flex-shrink-0">
              <div className="w-full aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                {selectedProductDetail.imagen ? (
                  <img src={buildImageUrl(selectedProductDetail.imagen)} alt={selectedProductDetail.nombre_comercial} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-slate-400 uppercase">Sin imagen</div>
                )}
              </div>
            </div>

            <div className="flex-1">
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre Comercial</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">{selectedProductDetail.nombre_comercial}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre Genérico</p>
                  <p className="text-base text-slate-700">{selectedProductDetail.nombre_generico || "—"}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SKU</p>
                    <p className="text-sm font-mono font-bold text-slate-900 mt-1">{selectedProductDetail.sku}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Código</p>
                    <p className="text-sm font-mono text-slate-700 mt-1">{selectedProductDetail.id}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Información Farmacéutica</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Laboratorio</p>
                <p className="text-sm text-slate-900 mt-1 font-medium">{selectedProductDetail.laboratorio_nombre}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoría</p>
                <p className="text-sm text-slate-900 mt-1 font-medium">{selectedProductDetail.categoria_nombre}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subcategoría</p>
                <p className="text-sm text-slate-900 mt-1 font-medium">{selectedProductDetail.subcategoria_nombre || "Sin subcategoría"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Forma Farmacéutica</p>
                <p className="text-sm text-slate-700 mt-1">{selectedProductDetail.forma_farmaceutica || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Concentración</p>
                <p className="text-sm text-slate-700 mt-1">{selectedProductDetail.concentracion || "—"}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Presentación</p>
                <p className="text-sm text-slate-700 mt-1">{selectedProductDetail.presentacion || "—"}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Precios e Inventario</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">Precio de Compra</p>
                <p className="text-2xl font-bold text-blue-900 mt-2">Bs. {parseFloat(selectedProductDetail.precio_compra).toFixed(2)}</p>
              </div>
              <div className="rounded-xl bg-teal-50 border border-teal-200 p-4">
                <p className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">Precio de Venta</p>
                <p className="text-2xl font-bold text-teal-900 mt-2">Bs. {parseFloat(selectedProductDetail.precio_venta).toFixed(2)}</p>
              </div>

              {selectedProductDetail.inventario && (
                <>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stock Actual</p>
                    <p
                      className={`text-xl font-bold mt-2 ${
                        selectedProductDetail.inventario.stock_actual <= 0
                          ? "text-rose-600"
                          : selectedProductDetail.inventario.stock_actual < selectedProductDetail.stock_minimo
                          ? "text-amber-600"
                          : "text-teal-600"
                      }`}
                    >
                      {selectedProductDetail.inventario.stock_actual} unidades
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stock Disponible</p>
                    <p className="text-xl font-bold text-slate-900 mt-2">{selectedProductDetail.inventario.stock_disponible || 0} unidades</p>
                  </div>
                </>
              )}

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stock Mínimo</p>
                <p className="text-lg font-bold text-slate-900 mt-2">{selectedProductDetail.stock_minimo} unidades</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unidad de Medida</p>
                <p className="text-sm text-slate-700 mt-2">{selectedProductDetail.unidad_medida || "—"}</p>
              </div>
            </div>
          </div>

          {selectedProductDetail.descripcion && (
            <div className="border-t border-slate-100 pt-6">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Descripción</p>
              <p className="text-sm text-slate-700 leading-relaxed">{selectedProductDetail.descripcion}</p>
            </div>
          )}

          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Regulaciones</h3>
            <div className="flex gap-3">
              {selectedProductDetail.requiere_receta && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-amber-50 border border-amber-200">
                  <span className="text-lg">📋</span>
                  <span className="text-xs font-semibold text-amber-700">Requiere Receta</span>
                </div>
              )}
              {selectedProductDetail.es_controlado && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-rose-50 border border-rose-200">
                  <span className="text-lg">🔒</span>
                  <span className="text-xs font-semibold text-rose-700">Medicamento Controlado</span>
                </div>
              )}
              {!selectedProductDetail.requiere_receta && !selectedProductDetail.es_controlado && (
                <p className="text-sm text-slate-500">Sin restricciones especiales</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
            <button onClick={() => onEdit(selectedProductDetail)} className="px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
              Editar
            </button>
            <button onClick={onClose} className="px-6 py-2.5 rounded-full border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
