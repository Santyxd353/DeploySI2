import { useEffect, useMemo, useState } from "react";
import {
  listLaboratorios,
  createLaboratorio,
  updateLaboratorio,
  deleteLaboratorio,
  activarLaboratorio,
} from "../services/adminService";

const PAGE_SIZE = 8;

export default function useAdminLabs({ canViewLabs }) {
  const [labs, setLabs] = useState([]);
  const [labsSearch, setLabsSearch] = useState("");
  const [labsTotalCount, setLabsTotalCount] = useState(0);
  const [labsLoading, setLabsLoading] = useState(false);
  const [labsError, setLabsError] = useState("");
  const [labsPage, setLabsPage] = useState(1);
  const [labsStatusFilter, setLabsStatusFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);

  const [selectedLab, setSelectedLab] = useState(null);

  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [createForm, setCreateForm] = useState({
    nombre: "",
    pais: "",
    telefono: "",
    email: "",
    direccion: "",
    contacto_representante: "",
    estado: true,
  });

  const [editForm, setEditForm] = useState({
    nombre: "",
    pais: "",
    telefono: "",
    email: "",
    direccion: "",
    contacto_representante: "",
    estado: true,
  });
  

  const hasFilters = useMemo(() => {
    return Boolean(labsSearch.trim()) || labsStatusFilter !== "all";
  }, [labsSearch, labsStatusFilter]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(labsTotalCount / PAGE_SIZE));
  }, [labsTotalCount]);

  const paginationRangeText = useMemo(() => {
    if (!labsTotalCount) return "Mostrando 0 de 0 laboratorios";
    const start = (labsPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(labsPage * PAGE_SIZE, labsTotalCount);
    return `Mostrando ${start}-${end} de ${labsTotalCount} laboratorios`;
  }, [labsPage, labsTotalCount]);

  const loadLabs = async (pageParam = labsPage) => {
    const page = typeof pageParam === "number" ? pageParam : 1;
    if (!canViewLabs) return;

    setLabsLoading(true);
    setLabsError("");

    try {      
      const data = await listLaboratorios(undefined, {
        page,
        pageSize: PAGE_SIZE,
        search: labsSearch,
        status: labsStatusFilter,
      });

      setLabs(data?.results || []);
      setLabsTotalCount(data?.count || 0);
      setLabsPage(page);
    } catch (err) {
      setLabsError("Error al cargar laboratorios");
    } finally {
      setLabsLoading(false);
    }
  };

  useEffect(() => {
    setLabsPage(1);
  }, [labsSearch, labsStatusFilter]);

  useEffect(() => {
    loadLabs(labsPage);    
  }, [labsPage, labsSearch, labsStatusFilter, canViewLabs]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createLaboratorio(undefined, createForm);
      setShowCreateModal(false);
      setCreateForm({
        nombre: "",
        pais: "",
        telefono: "",
        email: "",
        direccion: "",
        contacto_representante: "",
      });
      loadLabs(1);
    } catch {
      setLabsError("Error al crear laboratorio");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEdit = (lab) => {
    setSelectedLab(lab);
    setEditForm(lab);
    setShowEditModal(true);
  };

  const handleOpenToggleModal = (lab) => {
    setSelectedLab(lab);
    setShowToggleModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setUpdating(true);

    try {
      await updateLaboratorio(undefined, selectedLab.id, editForm);
      setShowEditModal(false);
      loadLabs();
    } catch {
      setLabsError("Error al actualizar");
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmToggle = async () => {
    if (!selectedLab) return;

    setUpdating(true);

    try {
      await updateLaboratorio(undefined, selectedLab.id, {
        ...selectedLab,
        estado: !selectedLab.estado,
      });

      setShowToggleModal(false);
      setSelectedLab(null);
      loadLabs();
    } catch {
      setLabsError("Error al cambiar estado");
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleEstado = async (lab) => {
    try {
      if (lab.estado) {
        await deleteLaboratorio(undefined, lab.id);
      } else {
        await activarLaboratorio(undefined, lab.id);
      }
      loadLabs();
    } catch {
      setLabsError("Error al cambiar estado");
    }
  };

  return {
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
  };
}