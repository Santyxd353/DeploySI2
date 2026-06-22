import { useCallback, useEffect, useMemo, useState } from "react";

import { tratamientosAdminService } from "../services/tratamientosService";

const PAGE_SIZE = 8;

const EMPTY_FORM = {
  producto: "",
  nombre_publico: "",
  dosis_cantidad: "",
  unidad_dosis: "",
  frecuencia_horas: "",
  frecuencia_minutos: "",
  duracion_dias: "",
  duracion_minutos: "",
  instrucciones: "",
  activo: true,
};

export default function useAdminTratamientos({ canView, canManage }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("all");

  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [productQuery, setProductQuery] = useState("");
  const [productOptions, setProductOptions] = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productFilterMode, setProductFilterMode] = useState("all");

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), [totalCount]);

  const paginationRangeText = useMemo(() => {
    if (!totalCount) return "Mostrando 0 de 0 tratamientos";
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, totalCount);
    return `Mostrando ${start}-${end} de ${totalCount} tratamientos`;
  }, [page, totalCount]);

  const loadData = useCallback(async () => {
    if (!canView) return;

    setLoading(true);
    setError("");

    try {
      const params = {
        page,
        page_size: PAGE_SIZE,
        q: search.trim() || undefined,
        activo: estadoFilter === "all" ? undefined : estadoFilter === "active",
      };
      const data = await tratamientosAdminService.listarBase(params);
      setItems(Array.isArray(data?.results) ? data.results : []);
      setTotalCount(Number.isInteger(data?.count) ? data.count : 0);
    } catch (e) {
      setError(e?.detail || "No se pudieron cargar los tratamientos.");
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [canView, page, search, estadoFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [search, estadoFilter]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setEditingId(null);
    setProductQuery("");
    setProductOptions([]);
  };

  const filteredProductOptions = useMemo(() => {
    if (productFilterMode === "withoutTreatment") {
      return productOptions.filter((p) => !p?.tiene_tratamiento_base);
    }
    if (productFilterMode === "withTreatment") {
      return productOptions.filter((p) => Boolean(p?.tiene_tratamiento_base));
    }
    return productOptions;
  }, [productFilterMode, productOptions]);

  const estimatedDoses = useMemo(() => {
    const frecuenciaMinutosRaw = form.frecuencia_minutos.trim();
    const duracionMinutosRaw = form.duracion_minutos.trim();

    const frecuenciaMinutos = frecuenciaMinutosRaw ? Number(frecuenciaMinutosRaw) : Number(form.frecuencia_horas) * 60;
    const duracionTotalMinutos = duracionMinutosRaw ? Number(duracionMinutosRaw) : Number(form.duracion_dias) * 24 * 60;

    if (!Number.isFinite(frecuenciaMinutos) || frecuenciaMinutos <= 0) return null;
    if (!Number.isFinite(duracionTotalMinutos) || duracionTotalMinutos <= 0) return null;

    return Math.max(1, Math.ceil(duracionTotalMinutos / frecuenciaMinutos));
  }, [form.frecuencia_horas, form.frecuencia_minutos, form.duracion_dias, form.duracion_minutos]);

  const validateForm = useCallback(() => {
    const nextErrors = {};

    const dosis = Number(form.dosis_cantidad);
    const frecuenciaHoras = Number(form.frecuencia_horas);
    const frecuenciaMinutos = form.frecuencia_minutos.trim() ? Number(form.frecuencia_minutos) : null;
    const duracionDias = Number(form.duracion_dias);
    const duracionMinutos = form.duracion_minutos.trim() ? Number(form.duracion_minutos) : null;

    if (!form.producto) nextErrors.producto = "Debes seleccionar un producto válido.";
    if (!form.nombre_publico.trim()) nextErrors.nombre_publico = "Ingresa un nombre público para el tratamiento.";
    if (!form.unidad_dosis.trim()) nextErrors.unidad_dosis = "Ingresa una unidad de dosis (ej: mg, ml).";
    if (!form.instrucciones.trim()) nextErrors.instrucciones = "Agrega instrucciones claras para el paciente.";

    if (!Number.isFinite(dosis) || dosis <= 0) {
      nextErrors.dosis_cantidad = "La dosis debe ser mayor que 0.";
    }
    if (!Number.isFinite(frecuenciaHoras) || frecuenciaHoras < 1) {
      nextErrors.frecuencia_horas = "La frecuencia en horas debe ser mayor o igual a 1.";
    }
    if (frecuenciaMinutos !== null && (!Number.isFinite(frecuenciaMinutos) || frecuenciaMinutos < 1)) {
      nextErrors.frecuencia_minutos = "La frecuencia en minutos debe ser mayor o igual a 1.";
    }
    if (!Number.isFinite(duracionDias) || duracionDias < 1) {
      nextErrors.duracion_dias = "La duración en días debe ser mayor o igual a 1.";
    }
    if (duracionMinutos !== null && (!Number.isFinite(duracionMinutos) || duracionMinutos < 1)) {
      nextErrors.duracion_minutos = "La duración en minutos debe ser mayor o igual a 1.";
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [form]);

  const saveForm = async () => {
    if (!canManage) return false;

    if (!validateForm()) {
      setError("Revisa los campos marcados en rojo.");
      return false;
    }

    const dosis = Number(form.dosis_cantidad);
    const frecuenciaHoras = Number(form.frecuencia_horas);
    const frecuenciaMinutos = form.frecuencia_minutos.trim() ? Number(form.frecuencia_minutos) : null;
    const duracionDias = Number(form.duracion_dias);
    const duracionMinutos = form.duracion_minutos.trim() ? Number(form.duracion_minutos) : null;

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const isEditing = Boolean(editingId);
      const payload = {
        producto: Number(form.producto),
        nombre_publico: form.nombre_publico.trim(),
        dosis_cantidad: form.dosis_cantidad,
        unidad_dosis: form.unidad_dosis.trim(),
        frecuencia_horas: frecuenciaHoras,
        frecuencia_minutos: frecuenciaMinutos,
        duracion_dias: duracionDias,
        duracion_minutos: duracionMinutos,
        instrucciones: form.instrucciones.trim(),
        activo: Boolean(form.activo),
      };

      if (isEditing) {
        await tratamientosAdminService.actualizarBase(editingId, payload);
      } else {
        await tratamientosAdminService.crearBase(payload);
      }

      setSuccessMessage(
        isEditing
          ? "Tratamiento actualizado exitosamente."
          : "Tratamiento creado exitosamente."
      );

      resetForm();
      await loadData();
      return true;
    } catch (e) {
      setError(e?.detail || "No se pudo guardar el tratamiento.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setFormErrors({});
    setForm({
      producto: String(item.producto || ""),
      nombre_publico: item.nombre_publico || "",
      dosis_cantidad: String(item.dosis_cantidad || "1"),
      unidad_dosis: item.unidad_dosis || "mg",
      frecuencia_horas: String(item.frecuencia_horas || "8"),
      frecuencia_minutos: item.frecuencia_minutos ? String(item.frecuencia_minutos) : "",
      duracion_dias: String(item.duracion_dias || "7"),
      duracion_minutos: item.duracion_minutos ? String(item.duracion_minutos) : "",
      instrucciones: item.instrucciones || "",
      activo: Boolean(item.activo),
    });
    setProductQuery(item.producto_nombre ? `${item.producto_nombre} (${item.producto_sku})` : "");
    setProductOptions([]);
  };

  const deactivate = async (id) => {
    if (!canManage) return;

    setError("");
    setSuccessMessage("");
    try {
      await tratamientosAdminService.desactivarBase(id);
      await loadData();
      setSuccessMessage("Tratamiento desactivado exitosamente.");
    } catch (e) {
      setError(e?.detail || "No se pudo desactivar el tratamiento.");
    }
  };

  const searchProducts = useCallback(async (q) => {
    if (!canManage) return;

    const normalized = q.trim();
    setProductQuery(q);

    if (!normalized || normalized.length < 2) {
      setProductOptions([]);
      return;
    }

    setProductLoading(true);
    try {
      const data = await tratamientosAdminService.buscarProductos(normalized);
      setProductOptions(Array.isArray(data) ? data : []);
    } catch {
      setProductOptions([]);
    } finally {
      setProductLoading(false);
    }
  }, [canManage]);

  const pickProduct = (product) => {
    setForm((prev) => ({ ...prev, producto: String(product.id), nombre_publico: prev.nombre_publico || product.nombre_comercial }));
    setFormErrors((prev) => ({ ...prev, producto: undefined }));
    setProductQuery(`${product.nombre_comercial} (${product.sku})`);
    setProductOptions([]);
  };

  const setFormField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  return {
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
    setProductQuery,
    productOptions,
    filteredProductOptions,
    productLoading,
    productFilterMode,
    setProductFilterMode,
    estimatedDoses,
    searchProducts,
    pickProduct,
  };
}
