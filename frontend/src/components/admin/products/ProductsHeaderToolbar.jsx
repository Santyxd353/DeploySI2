import { SearchIcon } from "../../ui/Icons";

export default function ProductsHeaderToolbar({
  categorias,
  subcategorias,
  searchTerm,
  categoryFilter,
  subcategoryFilter,
  productosLength,
  totalProductosCount,
  loading,
  onOpenCategoryModal,
  onOpenCreate,
  onSearchChange,
  onCategoryFilterChange,
  onSubcategoryFilterChange,
}) {
  return (
    <>
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Gestión de Productos</h2>
          <p className="text-slate-500 text-sm">Gestión centralizada del catálogo farmacéutico</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenCategoryModal}
            className="flex items-center space-x-2 px-6 py-2.5 rounded-full text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all"
          >
            <span className="text-lg">+</span>
            <span>Nueva Categoría</span>
          </button>
          <button
            onClick={onOpenCreate}
            className="flex items-center space-x-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-br from-teal-600 to-teal-700 shadow-lg shadow-teal-600/20 hover:opacity-90 transition-all"
          >
            <span className="text-lg">+</span>
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <span className="mb-2 block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Búsqueda</span>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Buscar por SKU, nombre o laboratorio..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-sm focus:ring-1 focus:ring-teal-400 focus:border-teal-400 placeholder:text-slate-400 transition-all"
              />
            </div>
          </div>

          <div>
            <span className="mb-2 block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoría</span>
            <select
              value={categoryFilter}
              onChange={(event) => onCategoryFilterChange(event.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-teal-400 focus:border-teal-400 transition-all"
            >
              <option value="all">Todas las categorías</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={String(categoria.id)}>
                  {categoria.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="mb-2 block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subcategoría</span>
            <select
              value={subcategoryFilter}
              onChange={(event) => onSubcategoryFilterChange(event.target.value)}
              disabled={categoryFilter === "all"}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-teal-400 focus:border-teal-400 transition-all disabled:opacity-60"
            >
              <option value="all">Todas</option>
              {subcategorias.map((subcategoria) => (
                <option key={subcategoria.id} value={String(subcategoria.id)}>
                  {subcategoria.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between pt-4 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            En esta página: <span className="text-slate-900 font-extrabold">{productosLength}</span> de <span className="text-slate-700">{totalProductosCount}</span> productos
          </span>
          {loading ? <span className="text-xs font-semibold text-teal-700">Actualizando...</span> : null}
        </div>
      </div>
    </>
  );
}
