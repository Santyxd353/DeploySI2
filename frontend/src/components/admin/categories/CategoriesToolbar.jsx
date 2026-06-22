import { Button } from "../../ui/button";
import { Input } from "../../ui/input";

export default function CategoriesToolbar({
  search,
  setSearch,
  status,
  setStatus,
  onCreate,
  onRefresh,
  canManage,
}) {
  return (
    <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black text-slate-900">
            Gestión de Categorías
            </h3>

            <div className="flex flex-wrap gap-2">
            <Button
                size="sm"                
                onClick={onCreate}
                disabled={!onCreate}
                className="bg-teal-700 hover:bg-teal-600"
            >
                Nueva Categoría
            </Button>

            <Button variant="secondary" size="sm" onClick={onRefresh}>
                Actualizar lista
            </Button>
            </div>
        </div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        
        {/* LEFT */}
        <div className="flex flex-1 gap-2">
            <Input
                type="text"
                placeholder="Buscar categoría..."
                className="border-slate-200 bg-slate-50 focus:border-sky-300 focus:ring-sky-100"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />

            <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            </select>
        </div>
        </div>
    </>    
  );
}