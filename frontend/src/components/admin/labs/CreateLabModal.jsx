import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { CloseIcon } from "../../ui/Icons";
import { Input } from "../../ui/input";

export default function CreateLabModal({
  isOpen,
  onClose,
  onSubmit,
  form,
  onChange,
  loading,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Crear laboratorio"
    >
      <Card className="w-full max-w-lg overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(240,249,255,0.92))]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
                Backoffice
              </p>
              <CardTitle>Crear laboratorio</CardTitle>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-500 hover:text-slate-700"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-5">
          <form className="space-y-3" onSubmit={onSubmit}>
            <Input
              type="text"
              placeholder="Nombre"
              value={form.nombre}
              onChange={(e) => onChange({ ...form, nombre: e.target.value })}
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="text"
                placeholder="País"
                value={form.pais}
                onChange={(e) => onChange({ ...form, pais: e.target.value })}
                required
              />

              <Input
                type="text"
                placeholder="Teléfono"
                value={form.telefono}
                onChange={(e) => onChange({ ...form, telefono: e.target.value })}
              />
            </div>

            <Input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => onChange({ ...form, email: e.target.value })}
            />

            <Input
              type="text"
              placeholder="Dirección"
              value={form.direccion}
              onChange={(e) => onChange({ ...form, direccion: e.target.value })}
            />

            <Input
              type="text"
              placeholder="Contacto representante"
              value={form.contacto_representante}
              onChange={(e) =>
                onChange({ ...form, contacto_representante: e.target.value })
              }
            />

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-700 hover:bg-teal-600"
            >
              {loading ? "Creando..." : "Crear laboratorio"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}