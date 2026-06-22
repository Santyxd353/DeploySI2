import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AdminLayout from "../../components/admin/AdminLayout";
import { useAuth } from "../../context/AuthContext";
import useAdminTratamientos from "../../hooks/useAdminTratamientos";

export default function AdminTratamientosPage() {
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();

  const canView = hasPermission("tratamientos.ver");
  const canManage = hasPermission("tratamientos.gestionar");

  const {
    items,
    loading,
    error,
    successMessage,
    setSuccessMessage,
    page,
    setPage,
    totalPages,
    paginationRangeText,
    search,
    setSearch,
    estadoFilter,
    setEstadoFilter,
    loadData,
    form,
    setForm,
    setFormField,
    formErrors,
    saveForm,
    resetForm,
    editingId,
    startEdit,
    deactivate,
    saving,
    productQuery,
    productOptions,
    filteredProductOptions,
    productLoading,
    productFilterMode,
    setProductFilterMode,
    estimatedDoses,
    searchProducts,
    pickProduct,
  } = useAdminTratamientos({ canView, canManage });

  const [showFormPanel, setShowFormPanel] = useState(false);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);

  const headerTitle = useMemo(
    () => (editingId ? "Editar tratamiento base" : "Crear tratamiento base"),
    [editingId]
  );

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const openCreatePanel = () => {
    setSuccessMessage("");
    resetForm();
    setShowFormPanel(true);
  };

  const onSubmitForm = () => {
    if (editingId) {
      saveForm();
      return;
    }
    setShowCreateConfirm(true);
  };

  const confirmCreateTreatment = async () => {
    const ok = await saveForm();
    if (ok) {
      setShowCreateConfirm(false);
    }
  };

  if (!canView) {
    return (
      <AdminLayout activeSection="treatments" currentUser={user} onLogout={handleLogout}>
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-md">
          <h1 className="text-2xl font-black text-slate-900">Admin / Tratamientos</h1>
          <p className="mt-2 text-sm text-rose-600">No tienes permisos para ver esta sección.</p>
        </section>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeSection="treatments" currentUser={user} onLogout={handleLogout}>
      <section className="space-y-4 rounded-[28px] border border-slate-200 bg-white/97 p-4 shadow-md sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-xl font-black text-slate-900">Tratamientos base</h1>
          <button
            type="button"
            onClick={openCreatePanel}
            disabled={!canManage}
            className="rounded-xl bg-teal-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            Crear tratamiento
          </button>
          <button
            type="button"
            onClick={loadData}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refrescar
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por producto, SKU o nombre de tratamiento"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>

        {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
        {successMessage ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">Dosis</th>
                <th className="px-3 py-2">Frecuencia</th>
                <th className="px-3 py-2">Duración</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={6}>
                    Cargando tratamientos...
                  </td>
                </tr>
              ) : items.length ? (
                items.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-900">{row.nombre_publico}</p>
                      <p className="text-xs text-slate-500">{row.producto_nombre} ({row.producto_sku})</p>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {row.dosis_cantidad} {row.unidad_dosis}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {`Cada ${row.frecuencia_horas} h`}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {`${row.duracion_dias} días`}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                          row.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {row.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() => {
                            startEdit(row);
                            setShowFormPanel(true);
                          }}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={!canManage || !row.activo}
                          onClick={() => deactivate(row.id)}
                          className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 disabled:opacity-40"
                        >
                          Desactivar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={6}>
                    No hay tratamientos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-500">{paginationRangeText}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || loading}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || loading}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      {showFormPanel ? (
      <section className="mt-4 space-y-4 rounded-[28px] border border-slate-200 bg-white/97 p-4 shadow-md sm:p-5">
        <div className="flex items-center gap-2">
          <h2 className="mr-auto text-lg font-black text-slate-900">{headerTitle}</h2>
          {editingId || showFormPanel ? (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setSuccessMessage("");
                setShowFormPanel(false);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              Cerrar
            </button>
          ) : null}
        </div>

        <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          Tip para farmacia: completa primero producto, dosis, frecuencia en horas y duración en días. Ejemplo recomendado: 1 tableta, cada 8 horas, por 7 días.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="relative md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Producto *</label>
            <input
              value={productQuery}
              onChange={(e) => searchProducts(e.target.value)}
              placeholder="Ejemplo: Paracetamol o SKU PARA-500"
              disabled={!canManage || Boolean(editingId)}
              className={`w-full rounded-xl px-3 py-2 text-sm outline-none disabled:bg-slate-50 ${
                formErrors.producto ? "border border-rose-400 focus:border-rose-500" : "border border-slate-200 focus:border-teal-500"
              }`}
            />
            {productLoading ? <p className="mt-1 text-xs text-slate-500">Buscando...</p> : null}
            {formErrors.producto ? <p className="mt-1 text-xs font-semibold text-rose-600">{formErrors.producto}</p> : null}

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setProductFilterMode("all")}
                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                  productFilterMode === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setProductFilterMode("withoutTreatment")}
                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                  productFilterMode === "withoutTreatment" ? "bg-teal-700 text-white" : "bg-teal-100 text-teal-800"
                }`}
              >
                Sin tratamiento base
              </button>
              <button
                type="button"
                onClick={() => setProductFilterMode("withTreatment")}
                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                  productFilterMode === "withTreatment" ? "bg-amber-600 text-white" : "bg-amber-100 text-amber-800"
                }`}
              >
                Con tratamiento base
              </button>
            </div>

            {filteredProductOptions.length ? (
              <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                {filteredProductOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => pickProduct(option)}
                    className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{option.nombre_comercial}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          option.tiene_tratamiento_base
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {option.tiene_tratamiento_base ? "Con tratamiento" : "Libre"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{option.sku}</p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <label className="space-y-1">
            <span className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Nombre público *</span>
            <input
              value={form.nombre_publico}
              onChange={(e) => setFormField("nombre_publico", e.target.value)}
              disabled={!canManage}
              placeholder="Ejemplo: Paracetamol 500 mg adulto"
              className={`w-full rounded-xl px-3 py-2 text-sm outline-none disabled:bg-slate-50 ${
                formErrors.nombre_publico ? "border border-rose-400 focus:border-rose-500" : "border border-slate-200 focus:border-teal-500"
              }`}
            />
            {formErrors.nombre_publico ? <p className="text-xs font-semibold text-rose-600">{formErrors.nombre_publico}</p> : null}
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Unidad dosis *</span>
            <input
              value={form.unidad_dosis}
              onChange={(e) => setFormField("unidad_dosis", e.target.value)}
              disabled={!canManage}
              placeholder="Ejemplo: mg, ml, tableta"
              className={`w-full rounded-xl px-3 py-2 text-sm outline-none disabled:bg-slate-50 ${
                formErrors.unidad_dosis ? "border border-rose-400 focus:border-rose-500" : "border border-slate-200 focus:border-teal-500"
              }`}
            />
            {formErrors.unidad_dosis ? <p className="text-xs font-semibold text-rose-600">{formErrors.unidad_dosis}</p> : null}
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Dosis cantidad *</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.dosis_cantidad}
              onChange={(e) => setFormField("dosis_cantidad", e.target.value)}
              disabled={!canManage}
              placeholder="Ejemplo: 1 o 0.5"
              className={`w-full rounded-xl px-3 py-2 text-sm outline-none disabled:bg-slate-50 ${
                formErrors.dosis_cantidad ? "border border-rose-400 focus:border-rose-500" : "border border-slate-200 focus:border-teal-500"
              }`}
            />
            {formErrors.dosis_cantidad ? <p className="text-xs font-semibold text-rose-600">{formErrors.dosis_cantidad}</p> : null}
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Frecuencia (horas) *</span>
            <input
              type="number"
              min="1"
              value={form.frecuencia_horas}
              onChange={(e) => setFormField("frecuencia_horas", e.target.value)}
              disabled={!canManage}
              placeholder="Ejemplo: cada 8 horas"
              className={`w-full rounded-xl px-3 py-2 text-sm outline-none disabled:bg-slate-50 ${
                formErrors.frecuencia_horas ? "border border-rose-400 focus:border-rose-500" : "border border-slate-200 focus:border-teal-500"
              }`}
            />
            {formErrors.frecuencia_horas ? <p className="text-xs font-semibold text-rose-600">{formErrors.frecuencia_horas}</p> : null}
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Duración (días) *</span>
            <input
              type="number"
              min="1"
              value={form.duracion_dias}
              onChange={(e) => setFormField("duracion_dias", e.target.value)}
              disabled={!canManage}
              placeholder="Ejemplo: 7 días"
              className={`w-full rounded-xl px-3 py-2 text-sm outline-none disabled:bg-slate-50 ${
                formErrors.duracion_dias ? "border border-rose-400 focus:border-rose-500" : "border border-slate-200 focus:border-teal-500"
              }`}
            />
            {formErrors.duracion_dias ? <p className="text-xs font-semibold text-rose-600">{formErrors.duracion_dias}</p> : null}
          </label>

          <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900 md:col-span-2">
            {estimatedDoses
              ? `Dosis objetivo estimada: ${estimatedDoses} tomas.`
              : "Completa frecuencia y duración válidas para estimar tomas."}
          </div>

          <label className="space-y-1 md:col-span-2">
            <span className="block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Instrucciones *</span>
            <textarea
              rows={3}
              value={form.instrucciones}
              onChange={(e) => setFormField("instrucciones", e.target.value)}
              disabled={!canManage}
              placeholder="Ejemplo: Tomar después de comidas. No consumir con alcohol."
              className={`w-full rounded-xl px-3 py-2 text-sm outline-none disabled:bg-slate-50 ${
                formErrors.instrucciones ? "border border-rose-400 focus:border-rose-500" : "border border-slate-200 focus:border-teal-500"
              }`}
            />
            {formErrors.instrucciones ? <p className="text-xs font-semibold text-rose-600">{formErrors.instrucciones}</p> : null}
          </label>

          <label className="inline-flex items-center gap-2 md:col-span-2">
            <input
              type="checkbox"
              checked={Boolean(form.activo)}
              onChange={(e) => setFormField("activo", e.target.checked)}
              disabled={!canManage}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Tratamiento activo</span>
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={resetForm}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={onSubmitForm}
            disabled={!canManage || saving || !form.producto}
            className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear tratamiento"}
          </button>
        </div>
      </section>
      ) : null}

      {showCreateConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">¿Confirmar creación del tratamiento?</h3>
            <p className="mt-2 text-sm text-slate-600">Antes de crear, valida estas reglas clínicas y operativas:</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Dosis mayor que 0 y unidad de dosis clara.</li>
              <li>Frecuencia en horas mayor o igual a 1.</li>
              <li>Duración en días mayor o igual a 1.</li>
              <li>Nombre público e instrucciones comprensibles para paciente.</li>
              <li>Producto correcto (SKU/nombre) y sin confusión con otro tratamiento.</li>
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateConfirm(false)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmCreateTreatment}
                className="rounded-xl bg-teal-700 px-3 py-2 text-sm font-semibold text-white"
              >
                Sí, crear tratamiento
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
