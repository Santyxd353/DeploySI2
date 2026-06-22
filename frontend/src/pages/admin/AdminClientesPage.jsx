import { useEffect, useMemo, useState } from "react";
import CRMLayout from "../../components/crm/CRMLayout";
import ClienteDetallePanel from "../../components/crm/ClienteDetallePanel";
import { clientesService } from "../../services/clientesService";
import { useAuth } from "../../context/AuthContext";

const CLIENTES_PAGE_SIZE = 10;

const initialForm = {
  tipo: "registrado",
  nombres: "",
  apellidos: "",
  email: "",
  telefono: "",
  ci_nit: "",
  direccion: "",
  fecha_nacimiento: "",
  genero: "",
  alergias: "",
  medicamentos_frecuentes: "",
  medico_habitual: "",
  observaciones: "",
  estado: true,
};

function normalizeListResponse(response) {
  if (Array.isArray(response)) {
    return { results: response, count: response.length };
  }

  return {
    results: Array.isArray(response?.results) ? response.results : [],
    count: Number.isInteger(response?.count) ? response.count : 0,
  };
}

export default function AdminClientesPage() {
  const { hasPermission } = useAuth();
  const canViewClientes = hasPermission("clientes.ver");
  const canManageClientes = hasPermission("clientes.gestionar") || hasPermission("clientes.ver");

  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [viewingCliente, setViewingCliente] = useState(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / CLIENTES_PAGE_SIZE));
  const hasFilters = Boolean(debouncedSearch.trim()) || statusFilter !== "all" || tipoFilter !== "all";

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadClientes();
  }, [page, debouncedSearch, statusFilter, tipoFilter]);

  const loadClientes = async () => {
    if (!canViewClientes) return;
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        page_size: CLIENTES_PAGE_SIZE,
      };

      const normalized = debouncedSearch.trim();
      if (normalized) params.search = normalized;
      if (statusFilter !== "all") params.estado = statusFilter;
      if (tipoFilter !== "all") params.tipo = tipoFilter;

      const response = await clientesService.listar(params);
      const { results, count } = normalizeListResponse(response);
      setClientes(results);
      setTotalCount(count);

      const nextTotalPages = Math.max(1, Math.ceil(count / CLIENTES_PAGE_SIZE));
      if (page > nextTotalPages) setPage(nextTotalPages);
    } catch (err) {
      console.error("Error al cargar clientes:", err);
      setError("No se pudieron cargar los clientes.");
      setClientes([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(initialForm);
    setEditingCliente(null);
    setShowForm(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const payload = {
      tipo: formData.tipo,
      nombres: formData.nombres.trim(),
      apellidos: formData.apellidos.trim(),
      email: formData.email.trim(),
      telefono: formData.telefono.trim(),
      ci_nit: formData.ci_nit.trim(),
      direccion: formData.direccion.trim(),
      fecha_nacimiento: formData.fecha_nacimiento || null,
      genero: formData.genero,
      alergias: formData.alergias.trim(),
      medicamentos_frecuentes: formData.medicamentos_frecuentes.trim(),
      medico_habitual: formData.medico_habitual.trim(),
      observaciones: formData.observaciones.trim(),
      estado: Boolean(formData.estado),
    };

    if (!payload.nombres) {
      setError("El nombre es obligatorio.");
      return;
    }

    try {
      setSaving(true);
      if (editingCliente) {
        await clientesService.actualizar(editingCliente.id, payload);
      } else {
        await clientesService.crear(payload);
      }
      resetForm();
      loadClientes();
    } catch (err) {
      console.error("Error al guardar cliente:", err);
      if (typeof err === "object" && err !== null) {
        const firstField = Object.keys(err)[0];
        const firstError = Array.isArray(err[firstField]) ? err[firstField][0] : err[firstField];
        setError(firstError || "No se pudo guardar el cliente.");
      } else {
        setError("No se pudo guardar el cliente.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cliente) => {
    setEditingCliente(cliente);
    setFormData({
      tipo: cliente.tipo || "registrado",
      nombres: cliente.nombres || "",
      apellidos: cliente.apellidos || "",
      email: cliente.email || "",
      telefono: cliente.telefono || "",
      ci_nit: cliente.ci_nit || "",
      direccion: cliente.direccion || "",
      fecha_nacimiento: cliente.fecha_nacimiento || "",
      genero: cliente.genero || "",
      alergias: cliente.alergias || "",
      medicamentos_frecuentes: cliente.medicamentos_frecuentes || "",
      medico_habitual: cliente.medico_habitual || "",
      observaciones: cliente.observaciones || "",
      estado: Boolean(cliente.estado),
    });
    setShowForm(true);
  };

  const handleDelete = async (cliente) => {
    if (!window.confirm(`¿Deseas desactivar al cliente ${cliente.nombres} ${cliente.apellidos || ""}?`)) return;
    setError("");
    try {
      await clientesService.eliminar(cliente.id);
      loadClientes();
    } catch (err) {
      console.error("Error al desactivar cliente:", err);
      setError("No se pudo desactivar el cliente.");
    }
  };

  const paginationText = useMemo(() => {
    if (!totalCount) return "Mostrando 0 de 0";
    const start = (page - 1) * CLIENTES_PAGE_SIZE + 1;
    const end = Math.min(page * CLIENTES_PAGE_SIZE, totalCount);
    return `Mostrando ${start}-${end} de ${totalCount}`;
  }, [page, totalCount]);

  if (!canViewClientes) {
    return (
      <CRMLayout activeSection="clientes">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-md">
          <h1 className="text-2xl font-black text-slate-900">CRM / Clientes</h1>
          <p className="mt-2 text-sm text-rose-600">No tienes permisos para ver esta sección.</p>
        </section>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout activeSection="clientes">
      <section className="rounded-[28px] border border-slate-200 bg-white/97 p-4 shadow-md sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Clientes</h1>
            <p className="text-sm text-slate-500">Gestión de clientes de tu farmacia</p>
          </div>
          {canManageClientes ? (
            <button
              type="button"
              onClick={() => {
                setEditingCliente(null);
                setFormData(initialForm);
                setShowForm(true);
              }}
              className="rounded-xl bg-sky-900 px-4 py-2 text-sm font-bold text-white hover:bg-sky-800"
            >
              Nuevo cliente
            </button>
          ) : null}
        </div>

        <div className="mb-3 grid gap-2 md:grid-cols-4">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nombre, email, CI/NIT..."
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300 md:col-span-2"
          />
          <select
            value={tipoFilter}
            onChange={(e) => {
              setTipoFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
          >
            <option value="all">Todos los tipos</option>
            <option value="registrado">Registrado</option>
            <option value="invitado">Invitado</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
          >
            <option value="all">Todos los estados</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>

        {hasFilters ? (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setDebouncedSearch("");
                setStatusFilter("all");
                setTipoFilter("all");
                setPage(1);
              }}
              className="text-xs font-bold text-sky-700 hover:text-sky-900"
            >
              Limpiar filtros
            </button>
          </div>
        ) : null}

        {error ? <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Teléfono</th>
                <th className="px-3 py-2">CI/NIT</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">Cargando clientes...</td>
                </tr>
              ) : clientes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">No hay clientes para mostrar.</td>
                </tr>
              ) : (
                clientes.map((cliente) => (
                  <tr key={cliente.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold text-slate-800">{`${cliente.nombres} ${cliente.apellidos || ""}`.trim()}</td>
                    <td className="px-3 py-2 text-slate-700">{cliente.tipo}</td>
                    <td className="px-3 py-2 text-slate-700">{cliente.email || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{cliente.telefono || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{cliente.ci_nit || "-"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${cliente.estado ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {cliente.estado ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewingCliente(cliente)}
                          className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(cliente)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cliente)}
                          className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          Desactivar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-slate-500">{paginationText}</p>
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-xs font-semibold text-slate-500">{page} / {totalPages}</span>
            <button
              type="button"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>

        {viewingCliente ? (
          <ClienteDetallePanel
            cliente={viewingCliente}
            onClose={() => setViewingCliente(null)}
          />
        ) : null}

        {showForm ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4" onClick={resetForm}>
            <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-xl font-black text-slate-900">{editingCliente ? "Editar cliente" : "Nuevo cliente"}</h2>
              <form className="mt-4 max-h-[75vh] space-y-3 overflow-y-auto pr-1" onSubmit={handleSubmit}>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Datos personales</p>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">Nombres *</span>
                    <input
                      value={formData.nombres}
                      onChange={(e) => setFormData((prev) => ({ ...prev, nombres: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
                      required
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">Apellidos</span>
                    <input
                      value={formData.apellidos}
                      onChange={(e) => setFormData((prev) => ({ ...prev, apellidos: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">Email</span>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">Teléfono</span>
                    <input
                      value={formData.telefono}
                      onChange={(e) => setFormData((prev) => ({ ...prev, telefono: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">CI/NIT</span>
                    <input
                      value={formData.ci_nit}
                      onChange={(e) => setFormData((prev) => ({ ...prev, ci_nit: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">Fecha de nacimiento</span>
                    <input
                      type="date"
                      value={formData.fecha_nacimiento}
                      onChange={(e) => setFormData((prev) => ({ ...prev, fecha_nacimiento: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">Género</span>
                    <select
                      value={formData.genero}
                      onChange={(e) => setFormData((prev) => ({ ...prev, genero: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
                    >
                      <option value="">Sin especificar</option>
                      <option value="M">Masculino</option>
                      <option value="F">Femenino</option>
                      <option value="O">Otro</option>
                    </select>
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-500">Dirección</span>
                  <input
                    value={formData.direccion}
                    onChange={(e) => setFormData((prev) => ({ ...prev, direccion: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
                    placeholder="Calle, ciudad, departamento"
                  />
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-slate-500">Tipo</span>
                    <select
                      value={formData.tipo}
                      onChange={(e) => setFormData((prev) => ({ ...prev, tipo: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
                    >
                      <option value="registrado">Registrado</option>
                      <option value="invitado">Invitado</option>
                    </select>
                  </label>
                  <label className="flex items-end gap-2 pb-2">
                    <input
                      type="checkbox"
                      checked={formData.estado}
                      onChange={(e) => setFormData((prev) => ({ ...prev, estado: e.target.checked }))}
                    />
                    <span className="text-sm font-semibold text-slate-700">Cliente activo</span>
                  </label>
                </div>

                <p className="pt-1 text-xs font-bold uppercase tracking-wide text-slate-400">Información clínica</p>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-500">Alergias</span>
                  <textarea
                    value={formData.alergias}
                    onChange={(e) => setFormData((prev) => ({ ...prev, alergias: e.target.value }))}
                    rows={2}
                    placeholder="Ej: penicilina, sulfas, látex..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-500">Medicamentos frecuentes</span>
                  <textarea
                    value={formData.medicamentos_frecuentes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, medicamentos_frecuentes: e.target.value }))}
                    rows={2}
                    placeholder="Medicamentos que consume regularmente..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-500">Médico habitual</span>
                  <input
                    value={formData.medico_habitual}
                    onChange={(e) => setFormData((prev) => ({ ...prev, medico_habitual: e.target.value }))}
                    placeholder="Nombre del médico o centro de salud"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-500">Observaciones</span>
                  <textarea
                    value={formData.observaciones}
                    onChange={(e) => setFormData((prev) => ({ ...prev, observaciones: e.target.value }))}
                    rows={3}
                    placeholder="Notas clínicas, preferencias u otras observaciones relevantes..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-300"
                  />
                </label>

                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-sky-900 px-4 py-2 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-60"
                  >
                    {saving ? "Guardando..." : editingCliente ? "Actualizar" : "Crear cliente"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </section>
    </CRMLayout>
  );
}
