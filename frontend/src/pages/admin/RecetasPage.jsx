import { useState } from "react";
import CRMLayout from "../../components/crm/CRMLayout";
import RecetasListPanel from "../../components/crm/RecetasListPanel";
import RecetaMedicaFormModal from "../../components/crm/RecetaMedicaFormModal";
import { useAuth } from "../../context/AuthContext";

export default function RecetasPage() {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "farmaceutico";

  const [showForm, setShowForm] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const handleSaved = () => setReloadKey((k) => k + 1);

  return (
    <CRMLayout activeSection="recetas">
      <section className="rounded-[28px] border border-slate-200 bg-white/97 p-4 shadow-md sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Recetas médicas</h1>
            <p className="text-sm text-slate-500">
              Gestión y validación de recetas de todos los clientes
            </p>
          </div>
          {canManage ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
            >
              + Nueva receta
            </button>
          ) : null}
        </div>

        {/* List — key fuerza re-mount al recargar tras guardar */}
        <RecetasListPanel key={reloadKey} clienteId={null} />
      </section>

      {showForm ? (
        <RecetaMedicaFormModal
          clienteId={null}
          clienteNombre="Seleccionar cliente"
          onClose={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      ) : null}
    </CRMLayout>
  );
}
