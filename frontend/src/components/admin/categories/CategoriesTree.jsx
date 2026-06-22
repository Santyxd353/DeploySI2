import { ChevronDownIcon, ChevronRightIcon } from "../../ui/Icons";
//import { ChevronDownIcon } from "../../ui/Icons";

export default function CategoriesTree({
  categorias,
  expanded,
  toggleExpand,
  onCreateSub,
  onEditCat,
  onDeleteCat,
  onEditSub,
  onDeleteSub,
  canManage,
}) {
  return (
    <div className="space-y-2">
      {categorias.map((cat) => (
        <div key={cat.id} className="border rounded-xl p-2 bg-white shadow-sm">
          
          {/* CATEGORIA */}
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => toggleExpand(cat.id)}
            >
              
              {expanded[cat.id] ? (
                <ChevronRightIcon className="h-4 w-4" />
              ) : (                
                <ChevronDownIcon className="h-4 w-4" />
              )}

              <span className="font-semibold">{cat.nombre}</span>
            </div>

            <div className="flex gap-2 text-sm px-0">
              {cat.estado && (
                <button 
                  className="rounded-xl px-4 py-2 border border-gray-400 hover:bg-gray-100 disabled:opacity-40 transition-colors" 
                  onClick={() => onEditCat?.(cat)} 
                  disabled={!canManage}
                >
                  Editar
                </button>
              )}

              <button 
                onClick={() => onDeleteCat(cat)}
                disabled={!canManage}
                className={cat.estado ? "rounded-xl px-4 py-2 bg-rose-600 text-white hover:bg-rose-500"
                                : "rounded-xl px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white"
              }>
                {cat.estado ? "Baja" : "Alta"}
              </button>                            

              {cat.estado && (
                <button 
                  className="rounded-xl px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white"
                  onClick={() => onCreateSub?.(cat)}
                >
                  <strong>+</strong> Subcat.
                </button>
              )}              
            </div>
          </div>

          {/* SUBCATEGORIAS */}
          {expanded[cat.id] && (
            <div className="ml-6 mt-2 space-y-1">
              {cat.subcategorias?.length > 0 ? (
                cat.subcategorias.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex justify-between text-sm bg-slate-50 px-3 py-2 rounded"
                  >
                    <span>{sub.nombre}</span>

                    <div className="flex gap-2">
                      {sub.estado && (
                        <button 
                          onClick={() => onEditSub?.(sub)}
                          disabled={!canManage}
                          className="rounded-lg px-3 py-1 border border-gray-400 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                        >
                          Editar
                        </button>
                      )}                     

                      <button 
                        onClick={() => onDeleteSub(sub)}
                        disabled={!canManage}
                        className={sub.estado ? "rounded-lg px-3 py-1 bg-rose-600 text-white hover:bg-rose-500"
                                        : "rounded-lg px-3 py-1 bg-teal-700 hover:bg-teal-600 text-white"
                      }>
                        {sub.estado ? "Baja" : "Alta"}
                      </button>

                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">
                  Sin subcategorías
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}