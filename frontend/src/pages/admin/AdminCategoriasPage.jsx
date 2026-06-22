import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import { useAuth } from "../../context/AuthContext";
import useAdminCategories from "../../hooks/useAdminCategories";

import CategoriesToolbar from "../../components/admin/categories/CategoriesToolbar";
import CategoriesTree from "../../components/admin/categories/CategoriesTree";
import CreateCategoryModal from "../../components/admin/categories/CreateCategoryModal";
import EditCategoryModal from "../../components/admin/categories/EditCategoryModal";
import ToggleCategoryModal from "../../components/admin/categories/ToggleCategoryModal";

import CreateSubcategoryModal from "../../components/admin/categories/CreateSubcategoryModal";
import EditSubcategoryModal from "../../components/admin/categories/EditSubcategoryModal";
import ToggleSubcategoryModal from "../../components/admin/categories/ToggleSubcategoryModal";
import CatsPagination from "../../components/admin/categories/CatsPagination";

export default function AdminCategoriesPage() {
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();

  const canView = hasPermission("categorias.ver");
  const canManage = hasPermission("categorias.gestionar");

  const {
    categorias,
    loading,
    error,
    expanded,
    toggleExpand,
    refresh,

    search,
    setSearch,
    statusFilter,
    setStatusFilter,

    showCreateModal,
    setShowCreateModal,
    createForm,
    setCreateForm,
    handleCreate,
    creating,

    showEditModal,
    setShowEditModal,
    editForm,
    setEditForm,
    handleEdit,

    handleOpenEdit,
    handleOpenToggle,
    handleOpenSub,

    handleConfirmToggle,
    showToggleModal,
    setShowToggleModal,
    selected,
    updating,

    subForm,
    setSubForm,
    handleCreateSub,

    showSubEditModal,
    setShowSubEditModal,
    handleEditSub,

    showSubToggleModal,
    setShowSubToggleModal,
    handleConfirmToggleSub,
    selectedSub,
    showSubCreateModal,
    setShowSubCreateModal,
    handleOpenEditSub,
    handleOpenToggleSub,
    page,
    setPage,
    totalPages,
    paginationRangeText,
    handleNextPage,
    handlePrevPage,

  } = useAdminCategories({ canView });

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  if (!canView) {
    return (
      <AdminLayout activeSection="categories" currentUser={user} onLogout={handleLogout}>
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-md">
          <h1 className="text-2xl font-black text-slate-900">Admin / Laboratorios</h1>
          <p className="mt-2 text-sm text-rose-600">No tienes permisos para ver esta seccion.</p>
        </section>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeSection="categories" currentUser={user} onLogout={handleLogout}>
      <section className="rounded-[28px] border border-slate-200 bg-white/97 p-4 shadow-md sm:p-5">
        
        <CategoriesToolbar
          search={search}
          setSearch={setSearch}
          status={statusFilter}
          setStatus={setStatusFilter}
          onCreate={canManage ? () => setShowCreateModal(true) : undefined}
          onRefresh={refresh}
        />

        {error && <p className="text-red-500">{error}</p>}

        <CategoriesTree
          categorias={categorias}
          expanded={expanded}
          toggleExpand={toggleExpand}

          onEditCat={handleOpenEdit}
          onCreateSub={handleOpenSub}
          onDeleteCat={handleOpenToggle}

          onEditSub={handleOpenEditSub}
          onDeleteSub={handleOpenToggleSub}

          canManage={canManage}
        />

        <CatsPagination
          page={page}
          totalPages={totalPages}
          paginationRangeText={paginationRangeText}
          onPrev={handlePrevPage}
          onNext={handleNextPage}
          loading={loading}
        />

        <CreateCategoryModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
          form={createForm}
          onChange={setCreateForm}
          loading={creating}
          canManage={canManage}
        />

        <EditCategoryModal 
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEdit}
          form={editForm}
          onChange={setEditForm}
          disabled={!canManage}
        />

        <ToggleCategoryModal
          isOpen={showToggleModal}
          onClose={() => setShowToggleModal(false)}
          onConfirm={handleConfirmToggle}
          loading={updating}
          selected={selected}
          disabled={!canManage}
        />

        <CreateSubcategoryModal
          isOpen={showSubCreateModal}
          onClose={() => setShowSubCreateModal(false)}
          onSubmit={handleCreateSub}
          form={subForm}
          onChange={setSubForm}
          loading={updating}
          categoria={selected}
        />

        <EditSubcategoryModal
          isOpen={showSubEditModal}
          onClose={() => setShowSubEditModal(false)}
          onSubmit={handleEditSub}
          form={subForm}
          onChange={setSubForm}
          loading={updating}
          categoria={selected}
        />

        <ToggleSubcategoryModal
          isOpen={showSubToggleModal}
          onClose={() => setShowSubToggleModal(false)}
          onConfirm={handleConfirmToggleSub}
          loading={updating}
          selected={selectedSub}
        />
      </section>
    </AdminLayout>
  );
}