export default function ProductCategoryModal({
  show,
  categoryForm,
  categoryError,
  categorySaving,
  onClose,
  onSubmit,
  onFormChange,
}) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 px-3 sm:px-4 py-3 sm:py-6 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] bg-white rounded-3xl shadow-2xl animate-in slide-in-from-bottom-5 sm:slide-in-from-center overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-slate-50 to-white border-b border-slate-100 px-5 sm:px-8 py-5 sm:py-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">Nueva Categoría</h2>
            <p className="text-sm text-slate-500 mt-1">Agrega una nueva categoría al catálogo</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none transition-colors">
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex max-h-[calc(92vh-96px)] flex-col">
          <div className="space-y-5 overflow-y-auto px-5 sm:px-8 py-5 sm:py-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-1">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre de la Categoría *</span>
                <input
                  type="text"
                  value={categoryForm.nombre}
                  onChange={(e) => onFormChange((prev) => ({ ...prev, nombre: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all outline-none"
                  placeholder="Ej: Analgésicos"
                  required
                  autoFocus
                />
              </label>

              <label className="space-y-2 sm:col-span-1">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descripción (Opcional)</span>
                <textarea
                  value={categoryForm.descripcion}
                  onChange={(e) => onFormChange((prev) => ({ ...prev, descripcion: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all outline-none"
                  placeholder="Describe la categoría o sus usos"
                  rows="3"
                />
              </label>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subcategorías Opcionales</p>
                <button
                  type="button"
                  onClick={() =>
                    onFormChange((prev) => ({
                      ...prev,
                      subcategorias: [...(prev.subcategorias || []), { nombre: "", descripcion: "" }],
                    }))
                  }
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  + Agregar
                </button>
              </div>

              {(categoryForm.subcategorias || []).map((item, index) => (
                <div key={index} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subcategoría {index + 1}</span>
                    {(categoryForm.subcategorias || []).length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          onFormChange((prev) => ({
                            ...prev,
                            subcategorias: (prev.subcategorias || []).filter((_, i) => i !== index),
                          }))
                        }
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                      >
                        Quitar
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 block">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre</span>
                      <input
                        type="text"
                        value={item.nombre || ""}
                        onChange={(e) =>
                          onFormChange((prev) => ({
                            ...prev,
                            subcategorias: (prev.subcategorias || []).map((sub, i) =>
                              i === index ? { ...sub, nombre: e.target.value } : sub
                            ),
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all outline-none"
                        placeholder="Ej: Antiinflamatorios"
                      />
                    </label>

                    <label className="space-y-1 block">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descripción</span>
                      <textarea
                        value={item.descripcion || ""}
                        onChange={(e) =>
                          onFormChange((prev) => ({
                            ...prev,
                            subcategorias: (prev.subcategorias || []).map((sub, i) =>
                              i === index ? { ...sub, descripcion: e.target.value } : sub
                            ),
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all outline-none"
                        placeholder="Describe la subcategoría"
                        rows="2"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {categoryError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-medium">
                {categoryError}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-5 sm:px-8 py-4 border-t border-slate-100 bg-white/95">
            <button
              type="button"
              onClick={onClose}
              className="px-5 sm:px-6 py-2.5 rounded-full border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              disabled={categorySaving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={categorySaving || !categoryForm.nombre.trim()}
              className="px-5 sm:px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-br from-teal-600 to-teal-700 shadow-lg shadow-teal-600/20 hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {categorySaving ? "Creando..." : "Crear Categoría"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
