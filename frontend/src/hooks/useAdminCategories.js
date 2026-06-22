import { useEffect, useState } from "react";
import {
  listCategorias,
  listSubcategorias,
  createCategoria,
  updateCategoria,
  deleteCategoria,
  createSubcategoria,
  deleteSubcategoria,
  updateSubcategoria,
} from "../services/adminService";

export default function useAdminCategories({ canView }) {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [expanded, setExpanded] = useState({});
  const [loadingSubs, setLoadingSubs] = useState({});

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [createForm, setCreateForm] = useState({
    nombre: "",
    descripcion: "",
  });

  const [showSubCreateModal, setShowSubCreateModal] = useState(false);
  const [showSubEditModal, setShowSubEditModal] = useState(false);
  const [showSubToggleModal, setShowSubToggleModal] = useState(false);

  const [selectedSub, setSelectedSub] = useState(null);

  const [subForm, setSubForm] = useState({
    nombre: "",
  });

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);

  const pageSize = 8;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, count);
  const paginationRangeText = `Mostrando ${start} - ${end} de ${count} categorías`;

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);

    try {
      await createCategoria(undefined, createForm);
      setShowCreateModal(false);
      setCreateForm({ nombre: "", descripcion: "" });
      loadCategorias(page); 
    } catch (err) {
      setError("Error al crear categoría");
    } finally {
      setCreating(false);
    }
  };


  // CARGAR SOLO CATEGORIAS
  const loadCategorias = async (pageParam = page) => {
    if (!canView) return;

    setLoading(true);
    setError("");

    try {
      const response = await listCategorias(undefined, {
        page: pageParam,
        search,
        status: statusFilter,
      });

      const cats = response?.results || [];

      const normalized = cats.map((cat) => ({
        ...cat,
        subcategorias: [],
        subLoaded: false,
      }));

      setCategorias(normalized);

      setCount(response.count || 0);
      setTotalPages(Math.ceil((response.count || 0) / pageSize));
      setPage(pageParam);

    } catch (err) {
      console.error(err);
      setError("Error al cargar categorías");
    } finally {
      setLoading(false);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      loadCategorias(page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      loadCategorias(page - 1);
    }
  };

  useEffect(() => {
    loadCategorias(1); 
  }, [canView, search, statusFilter]);

  useEffect(() => {
    loadCategorias(page);
  }, [page]);

  // CARGAR SUBCATEGORIAS (LAZY)
  const loadSubcategorias = async (categoriaId) => {
    try {
      setLoadingSubs((prev) => ({ ...prev, [categoriaId]: true }));

      const response = await listSubcategorias(undefined, {
        categoria: categoriaId,
        status: "all",
      });
      const subs = response?.results || [];

      setCategorias((prev) =>
        prev.map((cat) =>
          cat.id === categoriaId
            ? { ...cat, subcategorias: subs, subLoaded: true }
            : cat
        )
      );
    } catch (err) {
      console.error(err);
      setError("Error al cargar subcategorías");
    } finally {
      setLoadingSubs((prev) => ({ ...prev, [categoriaId]: false }));
    }
  };

  // TOGGLE EXPAND (INTELIGENTE)
  const toggleExpand = async (id) => {
    const isExpanded = expanded[id];

    // si se va a abrir → cargar subcategorías si no están cargadas
    if (!isExpanded) {
      const cat = categorias.find((c) => c.id === id);

      if (cat && !cat.subLoaded) {
        await loadSubcategorias(id);
      }
    }

    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const refresh = () => {
    loadCategorias(page);
  };

  const categoriasFiltradas = categorias.filter((cat) => {
    const matchesSearch = cat.nombre
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "active"
        ? cat.estado === true
        : cat.estado === false;

    return matchesSearch && matchesStatus;
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);

  const [selected, setSelected] = useState(null);
  const [showSubModal, setShowSubModal] = useState(false);

  const [editForm, setEditForm] = useState({
      nombre: "",
      descripcion: "",
  });

  const [updating, setUpdating] = useState(false);

  const handleOpenEdit = (cat) => {
    setSelected(cat);
    setEditForm(cat);
    setShowEditModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setUpdating(true);

    try {
      await updateCategoria(undefined, selected.id, editForm);
      setShowEditModal(false);
      loadCategorias(page);
    } catch {
      setError("Error al actualizar");
    } finally {
      setUpdating(false);
    }
  };

  const handleOpenToggle = (cat) => {
    setSelected(cat);
    setShowToggleModal(true);
  };

  const handleConfirmToggle = async () => {
    try {
      if (selected.estado) {
        await deleteCategoria(undefined, selected.id);
      } else {
        await updateCategoria(undefined, selected.id, {
          estado: true,
        });
      }

      setShowToggleModal(false);
      loadCategorias(page);
    } catch {
      setError("Error al cambiar estado");
    }
  };

  const handleOpenSub = (cat) => {
    setSelected(cat);
    setShowSubCreateModal(true);
  };

  const handleCreateSub = async (e) => {
    e.preventDefault();
    setUpdating(true);

    try {
      await createSubcategoria(undefined, {
        ...subForm,
        categoria: selected.id,
      });

      setShowSubCreateModal(false);
      setSubForm({ nombre: "" });

      loadSubcategorias(selected.id);
    } catch {
      setError("Error al crear subcategoría");
    } finally {
      setUpdating(false);
    }
  };

  const handleOpenEditSub = (sub) => {
    setSelectedSub(sub);
    setSubForm(sub);
    setShowSubEditModal(true);
  };

  const handleEditSub = async (e) => {
    e.preventDefault();
    setUpdating(true);

    try {
      await updateSubcategoria(undefined, selectedSub.id, subForm);
      setShowSubEditModal(false);
      loadSubcategorias(selectedSub.categoria);
    } catch {
      setError("Error al editar subcategoría");
    } finally {
      setUpdating(false);
    }
  };

  const handleOpenToggleSub = (sub) => {
    setSelectedSub(sub);
    setShowSubToggleModal(true);
  };

  const handleConfirmToggleSub = async () => {
    try {
      if (selectedSub.estado) {
        await deleteSubcategoria(undefined, selectedSub.id);
      } else {
        await updateSubcategoria(undefined, selectedSub.id, {
          estado: true,
        });
      }

      setShowSubToggleModal(false);
      loadSubcategorias(selectedSub.categoria);
    } catch {
      setError("Error al cambiar estado");
    }
  };
  
  return {
    categorias: categoriasFiltradas,
    loading,
    error,
    expanded,
    loadingSubs,
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

    handleOpenEdit,
    handleEdit,
    showEditModal,
    setShowEditModal,
    editForm,
    setEditForm,

    handleOpenToggle,
    handleConfirmToggle,
    showToggleModal,
    setShowToggleModal,

    handleOpenSub,
    handleCreateSub,
    showSubModal,
    setShowSubModal,
    subForm,
    setSubForm,

    selected,
    updating,

    showSubCreateModal,
    setShowSubCreateModal,

    handleOpenEditSub,
    handleOpenToggleSub,
    handleEditSub,
    handleConfirmToggleSub,
    showSubEditModal,
    setShowSubEditModal,
    showSubToggleModal,
    setShowSubToggleModal,
    selectedSub,

    page,
    setPage,
    totalPages,
    paginationRangeText,
    handleNextPage,
    handlePrevPage,
  };
}