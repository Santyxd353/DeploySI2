import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";

export default function ToggleLabModal({
  isOpen,
  onClose,
  onConfirm,
  loading,
  selectedLab,
}) {
  if (!isOpen) return null;

  const isActive = selectedLab?.estado;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Cambiar estado laboratorio"
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
                El laboratorio <strong>{selectedLab?.nombre}</strong> será dado de baja.
                Podrás dar de alta posteriormente.
              </>
            ) : (
              <>
                El laboratorio <strong>{selectedLab?.nombre}</strong> será dado de alta.
              </>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 pt-5">
          <div className="flex items-center justify-end gap-2">
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