import { Button } from "../../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../ui/card";

export default function ToggleCategoryModal({
  isOpen,
  onClose,
  onConfirm,
  loading,
  selected,
}) {
  if (!isOpen) return null;

  const isActive = selected?.estado;

  return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Cambiar estado categoría"
      >
      <Card className="w-full max-w-md overflow-hidden">
        <CardHeader
          className={`border-b border-slate-100 ${
            isActive
              ? "bg-[linear-gradient(135deg,rgba(255,241,242,0.92),rgba(255,255,255,0.92))]"
              : "bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(240,249,255,0.92))]"
          }`}
        >
          <CardTitle>
            {isActive ? "Confirmar dar de Baja" : "Confirmar dar de Alta"}
          </CardTitle>

          <CardDescription>
            {isActive ? (
              <>
                La categoría <strong>{selected?.nombre}</strong> será dada de baja.
                Podrás dar de alta posteriormente.
              </>
            ) : (
              <>
                La categoría <strong>{selected?.nombre}</strong> será dada de alta.
              </>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 pt-5">
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>

            <Button
              onClick={onConfirm}
              disabled={loading}
              className={`text-white ${
                isActive
                  ? "bg-rose-600 hover:bg-rose-500"
                  : "bg-emerald-600 hover:bg-emerald-500"
              }`}
            >
              {loading
                ? "Procesando..."
                : isActive
                ? "Dar de baja"
                : "Dar de alta"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}