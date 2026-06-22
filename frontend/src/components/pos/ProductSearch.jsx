import { useMemo } from "react";
import { SearchIcon } from "../ui/Icons";

function buildImageUrl(imagen) {
  if (!imagen) return "";
  if (/^https?:\/\//i.test(imagen)) return imagen;
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
  return `${baseUrl}${imagen.startsWith("/") ? "" : "/"}${imagen}`;
}

export default function ProductSearch({ query, onQueryChange, productos, loading, onAddToCart, searchRef, categorias, selectedCategory, onCategoryChange }) {
  const sortedCategorias = useMemo(() => {
    return [...categorias].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [categorias]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar producto por nombre o código SKU..."
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
        >
          <option value="">Todas las categorías</option>
          {sortedCategorias.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          </div>
        )}

        {!loading && productos.length === 0 && query.trim() && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <SearchIcon className="mb-3 h-12 w-12" />
            <p className="text-sm font-medium">No se encontraron productos</p>
            <p className="text-xs">Intenta con otro nombre o código</p>
          </div>
        )}

        {!loading && productos.length === 0 && !query.trim() && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <SearchIcon className="mb-3 h-12 w-12" />
            <p className="text-sm font-medium">Busca productos por nombre o código SKU</p>
            <p className="text-xs">Seleccioná una categoría para filtrar</p>
          </div>
        )}

        {!loading && productos.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {productos.map((p) => {
              const stock = p.inventario?.stock_disponible ?? 0;
              const sinStock = stock <= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={sinStock}
                  onClick={() => onAddToCart(p)}
                  className={`group flex flex-col rounded-2xl border bg-white p-3 text-left shadow-sm transition-all duration-150 ${
                    sinStock
                      ? "cursor-not-allowed border-slate-100 opacity-50"
                      : "border-slate-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg active:scale-[0.98]"
                  }`}
                >
                  {p.imagen && (
                    <div className="mb-2 flex h-24 items-center justify-center overflow-hidden rounded-xl bg-slate-50">
                      <img
                        src={buildImageUrl(p.imagen)}
                        alt={p.nombre_comercial}
                        className="max-h-full max-w-full object-contain transition-transform duration-150 group-hover:scale-105"
                      />
                    </div>
                  )}
                  <p className="mb-0.5 text-xs font-bold text-teal-700 uppercase">{p.categoria_nombre}</p>
                  <p className="mb-1 text-sm font-bold text-slate-800 line-clamp-2">{p.nombre_comercial}</p>
                  {p.presentacion && (
                    <p className="mb-1 text-xs text-slate-500">{p.presentacion}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-base font-black text-emerald-700">
                      Bs {Number(p.precio_venta).toFixed(2)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase transition-all ${
                        sinStock
                          ? "bg-rose-100 text-rose-700"
                          : stock <= (p.inventario?.stock_minimo || 0)
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {sinStock ? "Sin stock" : `${stock} disp.`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
