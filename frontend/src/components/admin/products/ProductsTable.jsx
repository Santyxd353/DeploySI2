export default function ProductsTable({ productos, onOpenDetailModal, onEdit, onDelete, buildImageUrl }) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-slate-100 text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="pl-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-70">Producto</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-70">SKU</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-70">Laboratorio</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-70">Categoría</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-70">Precio (Bs.)</th>
              <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-70">Stock</th>
              <th className="pr-8 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-70">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {productos.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-8 py-12 text-center text-slate-500 text-sm">
                  No hay productos para los filtros aplicados.
                </td>
              </tr>
            ) : (
              productos.map((producto) => (
                <tr
                  key={producto.id}
                  onClick={() => onOpenDetailModal(producto)}
                  className="bg-white hover:bg-teal-50/30 transition-colors group cursor-pointer border-b border-slate-100"
                >
                  <td className="pl-8 py-5">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-slate-200 bg-slate-100">
                        {producto.imagen ? (
                          <img src={buildImageUrl(producto.imagen)} alt={producto.nombre_comercial} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[9px] font-semibold text-slate-400 uppercase">
                            Sin imagen
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{producto.nombre_comercial}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{producto.nombre_generico || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-xs font-mono font-medium text-slate-700">{producto.sku}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-sm text-slate-700">{producto.laboratorio_nombre}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-sm text-slate-700">{producto.categoria_nombre}</span>
                      {producto.subcategoria_nombre ? (
                        <span className="mt-1 inline-flex w-fit rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700 ring-1 ring-inset ring-teal-200">
                          {producto.subcategoria_nombre}
                        </span>
                      ) : (
                        <span className="mt-1 text-[11px] text-slate-400">Sin subcategoría</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="text-sm font-mono font-bold text-slate-900">Bs. {parseFloat(producto.precio_venta).toFixed(2)}</span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    {producto.inventario ? (
                      <div className="flex flex-col items-center">
                        <span
                          className={`text-sm font-bold ${
                            producto.inventario.stock_actual <= 0
                              ? "text-rose-600"
                              : producto.inventario.stock_actual < producto.stock_minimo
                              ? "text-amber-600"
                              : "text-teal-600"
                          }`}
                        >
                          {producto.inventario.stock_actual}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {producto.inventario.stock_actual <= 0
                            ? "Sin stock"
                            : producto.inventario.stock_actual < producto.stock_minimo
                            ? "Stock bajo"
                            : "OK"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="pr-8 py-5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end space-x-2">
                      <button onClick={() => onEdit(producto)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors" title="Editar">
                        <span className="text-sm font-semibold">Editar</span>
                      </button>
                      <button onClick={() => onDelete(producto.id)} className="p-2 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors" title="Eliminar">
                        <span className="text-sm font-semibold">Eliminar</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
