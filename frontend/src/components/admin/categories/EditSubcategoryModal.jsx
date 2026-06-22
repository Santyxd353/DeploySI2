import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { CloseIcon } from "../../ui/Icons";
import { Input } from "../../ui/input";

export default function CreateSubcategoryModal({
  isOpen,
  onClose,
  onSubmit,
  form,
  onChange,
  loading,
  categoria,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <Card className="w-full max-w-lg overflow-hidden">        
        <CardHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(240,249,255,0.92))]">
            <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
                Backoffice
              </p>
              <CardTitle>Editar subcategoría</CardTitle>
              <p className="text-sm text-slate-500 pt-4">
                Categoría: <strong>{categoria?.nombre}</strong>
              </p>
            </div>
            <button onClick={onClose}>
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-5">
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              placeholder="Nombre"
              value={form.nombre}
              onChange={(e) =>
                onChange({ ...form, nombre: e.target.value })
              }
              required
            />

            <Input
              type="text"
              placeholder="Descripción"
              value={form.descripcion}
              onChange={(e) =>
                onChange({ ...form, descripcion: e.target.value })
              }
            />

            <Button type="submit" disabled={loading}
                className="w-full bg-teal-700 hover:bg-teal-600"
            >
              {loading ? "Guardando..." : "Guardar cambios"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}