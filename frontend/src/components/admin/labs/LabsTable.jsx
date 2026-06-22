import { Button } from "../../ui/button";

export default function LabsTable({ labs, labsLoading, onEdit, onToggleEstado, canManage }) {
  if (labsLoading) {
    return <p className="text-sm text-slate-600">Cargando laboratorios...</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <th>Nombre</th>
            <th>País</th>
            <th>Email</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {labs.map((lab) => (
            <tr key={lab.id} className="border-b">
              <td>{lab.nombre}</td>
              <td>{lab.pais}</td>
              <td>{lab.email || "-----"}</td>
              <td>
                <span className={lab.estado ? "text-green-600" : "text-red-600"}>
                  {lab.estado ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td>
                <Button variant="secondary" size="sm" onClick={() => onEdit(lab)} disabled={!canManage}>
                  Editar
                </Button>
                <Button size="sm" onClick={() => onToggleEstado(lab)} disabled={!canManage}
                  className={lab.estado ? "bg-rose-600 text-white hover:bg-rose-500"
                                : "bg-emerald-600 text-white hover:bg-emerald-500"
                            }
                >
                  {lab.estado ? "Baja" : "Alta"}
                </Button>
              </td>
            </tr>
          ))}

          {!labs.length && (
            <tr>
              <td colSpan={5} className="text-center py-4">
                No hay laboratorios
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}