import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import { useAuth } from "../../context/AuthContext";
import useAdminLabs from "../../hooks/useAdminLabs";

import LabsTable from "../../components/admin/labs/LabsTable";
import LabsToolbar from "../../components/admin/labs/LabsToolbar";
import LabsPagination from "../../components/admin/labs/LabsPagination";
import CreateLabModal from "../../components/admin/labs/CreateLabModal";
import EditLabModal from "../../components/admin/labs/EditLabModal";
import ToggleLabModal from "../../components/admin/labs/ToggleLabModal";

export default function AdminLaboratoriosPage() {
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();

  const canViewLabs = hasPermission("laboratorios.ver");
  const canManageLabs = hasPermission("laboratorios.gestionar");

  const {
    labs,
    labsSearch,
    setLabsSearch,
    labsLoading,
    labsError,
    labsPage,
    setLabsPage,
    totalPages,
    paginationRangeText,
    loadLabs,
    labsStatusFilter,
    setLabsStatusFilter,
    showCreateModal,
    setShowCreateModal,
    showEditModal,
    setShowEditModal,
    createForm,
    setCreateForm,
    editForm,
    setEditForm,
    creating,
    handleCreate,
    handleEdit,
    handleOpenEdit,
    handleToggleEstado,
    handleOpenToggleModal,
    handleConfirmToggle,
    showToggleModal,
    setShowToggleModal,
    selectedLab,
    updating,
  } = useAdminLabs({ canViewLabs });

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  if (!canViewLabs) {
    return (
          <AdminLayout activeSection="labs" currentUser={user} onLogout={handleLogout}>
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-md">
              <h1 className="text-2xl font-black text-slate-900">Admin / Laboratorios</h1>
              <p className="mt-2 text-sm text-rose-600">No tienes permisos para ver esta seccion.</p>
            </section>
          </AdminLayout>
    );
  }

  return (
    <AdminLayout activeSection="labs" currentUser={user} onLogout={handleLogout}>
      <section className="rounded-[28px] border border-slate-200 bg-white/97 p-4 shadow-md sm:p-5">
        <LabsToolbar
          search={labsSearch}
          setSearch={setLabsSearch}
          status={labsStatusFilter}
          setStatus={setLabsStatusFilter}
          onCreate={() => setShowCreateModal(true)}
          onRefresh={loadLabs}
        />

        {labsError && <p className="text-red-500">{labsError}</p>}

        <LabsTable
          labs={labs}
          labsLoading={labsLoading}
          canManage={canManageLabs}
          onEdit={handleOpenEdit}
          //onToggleEstado={handleToggleEstado}
          onToggleEstado={handleOpenToggleModal}
        />

        <LabsPagination
          page={labsPage}
          paginationRangeText={paginationRangeText}
          totalPages={totalPages}
          text={paginationRangeText}
          loading={labsLoading}
          onPrev={() => setLabsPage((prev) => Math.max(1, prev - 1))}
          onNext={() => setLabsPage((prev) => Math.min(totalPages, prev + 1))}
        />

        <CreateLabModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
          form={createForm}
          onChange={setCreateForm}
          loading={creating}
        />

        <EditLabModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEdit}
          form={editForm}
          onChange={setEditForm}
        />

        <ToggleLabModal
          isOpen={showToggleModal}
          onClose={() => setShowToggleModal(false)}
          onConfirm={handleConfirmToggle}
          loading={updating}
          selectedLab={selectedLab}
        />
      </section>
    </AdminLayout>
  );
}