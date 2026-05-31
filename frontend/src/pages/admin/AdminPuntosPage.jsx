import { useEffect, useMemo, useState } from "react";
import CRMLayout from "../../components/crm/CRMLayout";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { CheckCircleIcon, CloseIcon, SparkIcon } from "../../components/ui/Icons";
import { puntosService } from "../../services/puntosService";
import { useAuth } from "../../context/AuthContext";

const EMPTY_CONFIG = {
  activo: true,
  bolivianos_por_punto: "10.00",
  puntos_minimos_canje: 100,
  dias_expiracion: 0,
};

const EMPTY_CATALOGO = {
  nombre: "",
  tipo: "descuento_compra",
  descripcion: "",
  puntos_requeridos: 100,
  valor_descuento_bs: "",
  producto: "",
  codigo_cupon_externo: "",
  instrucciones_canje: "",
  url_externa: "",
  stock_disponible: 1,
  limite_por_cliente: 1,
  activo: true,
  valido_hasta: "",
};

const TIPO_RECOMPENSA_META = {
  descuento_compra: {
    label: "Descuento en compra",
    helper: "Crea un premio tipo vale para descontar Bs en la próxima compra.",
  },
  producto_farmacia: {
    label: "Producto de farmacia",
    helper: "Permite canjear por un producto interno con control de stock.",
  },
  cupon_externo: {
    label: "Cupón externo",
    helper: "Ideal para alianzas con terceros como restaurantes o servicios externos.",
  },
};

const NO_STOCK_MODAL_MESSAGE = "El producto seleccionado no tiene stock disponible.";

function normalizeList(response) {
  return puntosService.normalizeList(response);
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getProductoStock(producto) {
  return Number(producto?.inventario?.stock_disponible ?? producto?.inventario?.stock_actual ?? 0);
}

function getStockBadgeStyles(stock) {
  if (stock <= 0) return "bg-rose-100 text-rose-700";
  if (stock <= 5) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

function getStockLabel(stock) {
  if (stock <= 0) return "Sin stock";
  if (stock <= 5) return "Stock bajo";
  return "Disponible";
}

export default function AdminPuntosPage() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [configuracion, setConfiguracion] = useState(null);
  const [configForm, setConfigForm] = useState(EMPTY_CONFIG);

  const [catalogo, setCatalogo] = useState([]);
  const [catalogoForm, setCatalogoForm] = useState(EMPTY_CATALOGO);
  const [catalogoEditingId, setCatalogoEditingId] = useState(null);
  const [showCreateSuccessModal, setShowCreateSuccessModal] = useState(false);
  const [createdRewardName, setCreatedRewardName] = useState("");
  const [showStockWarningModal, setShowStockWarningModal] = useState(false);

  const [productosFarmacia, setProductosFarmacia] = useState([]);
  const [productosLoading, setProductosLoading] = useState(false);
  const [productoSearch, setProductoSearch] = useState("");
  const [productoCategoria, setProductoCategoria] = useState("");
  const [productoStockEstado, setProductoStockEstado] = useState("all");
  const [categoriasProducto, setCategoriasProducto] = useState([]);

  const [cuentas, setCuentas] = useState([]);
  const [cuentasSearch, setCuentasSearch] = useState("");

  const [canjes, setCanjes] = useState([]);
  const [transacciones, setTransacciones] = useState([]);

  const handleLogout = async () => {
    await logout();
  };

  const loadData = async (search = cuentasSearch) => {
    setLoading(true);
    setError("");
    try {
      const [configRes, catalogoRes, cuentasRes, canjesRes, transaccionesRes] = await Promise.all([
        puntosService.configuracionListar(),
        puntosService.catalogoListar(),
        puntosService.cuentasListar(search ? { search } : {}),
        puntosService.canjesListar(),
        puntosService.transaccionesListar(),
      ]);

      const configList = normalizeList(configRes).results;
      const catalogoList = normalizeList(catalogoRes).results;
      const cuentasList = normalizeList(cuentasRes).results;
      const canjesList = normalizeList(canjesRes).results;
      const transaccionesList = normalizeList(transaccionesRes).results;

      const currentConfig = configList[0] || null;

      setConfiguracion(currentConfig);
      setConfigForm(
        currentConfig
          ? {
              activo: Boolean(currentConfig.activo),
              bolivianos_por_punto: String(currentConfig.bolivianos_por_punto ?? "10.00"),
              puntos_minimos_canje: currentConfig.puntos_minimos_canje ?? 100,
              dias_expiracion: currentConfig.dias_expiracion ?? 0,
            }
          : EMPTY_CONFIG
      );
      setCatalogo(catalogoList);
      setCuentas(cuentasList);
      setCanjes(canjesList);
      setTransacciones(transaccionesList);
    } catch (err) {
      console.error("Error cargando puntos:", err);
      setError("No se pudo cargar la administración de puntos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData(cuentasSearch);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentasSearch]);

  useEffect(() => {
    const loadCategoriasProducto = async () => {
      try {
        const response = await puntosService.categoriasInventarioListar({ estado: true, page_size: 200 });
        setCategoriasProducto(normalizeList(response).results);
      } catch (err) {
        console.error("Error cargando categorías de productos:", err);
      }
    };

    loadCategoriasProducto();
  }, []);

  useEffect(() => {
    const rewardIsProducto = catalogoForm.tipo === "producto_farmacia";
    if (!rewardIsProducto) {
      setProductosFarmacia([]);
      return;
    }

    const loadProductosFarmacia = async () => {
      setProductosLoading(true);
      try {
        const params = {
          estado: true,
          page_size: 40,
          search: productoSearch.trim() || undefined,
          categoria: productoCategoria || undefined,
          stock_estado: productoStockEstado !== "all" ? productoStockEstado : undefined,
        };
        const response = await puntosService.productosFarmaciaListar(params);
        setProductosFarmacia(normalizeList(response).results);
      } catch (err) {
        console.error("Error cargando productos para recompensa:", err);
        setProductosFarmacia([]);
      } finally {
        setProductosLoading(false);
      }
    };

    const timer = setTimeout(loadProductosFarmacia, 250);
    return () => clearTimeout(timer);
  }, [catalogoForm.tipo, productoCategoria, productoSearch, productoStockEstado]);

  const resumen = useMemo(
    () => ({
      cuentas: cuentas.length,
      catalogo: catalogo.length,
      canjes: canjes.length,
      transacciones: transacciones.length,
      puntosEmitidos: cuentas.reduce((total, cuenta) => total + (cuenta.puntos_acumulados || 0), 0),
      puntosActivos: cuentas.reduce((total, cuenta) => total + (cuenta.puntos_disponibles || 0), 0),
    }),
    [canjes.length, catalogo.length, cuentas, transacciones.length]
  );

  const handleConfigSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      activo: Boolean(configForm.activo),
      bolivianos_por_punto: String(configForm.bolivianos_por_punto || "10.00"),
      puntos_minimos_canje: parseInt(configForm.puntos_minimos_canje, 10) || 100,
      dias_expiracion: parseInt(configForm.dias_expiracion, 10) || 0,
    };

    try {
      const response = configuracion
        ? await puntosService.configuracionActualizar(configuracion.id, payload)
        : await puntosService.configuracionCrear(payload);
      setConfiguracion(response);
      await loadData();
    } catch (err) {
      console.error("Error guardando configuración:", err);
      setError(err?.detail || "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  const resetCatalogoForm = () => {
    setCatalogoForm(EMPTY_CATALOGO);
    setCatalogoEditingId(null);
  };

  const isCreatingReward = !catalogoEditingId;
  const rewardType = catalogoForm.tipo;
  const isDescuento = rewardType === "descuento_compra";
  const isCuponExterno = rewardType === "cupon_externo";
  const isProductoFarmacia = rewardType === "producto_farmacia";

  const productoSeleccionado = useMemo(
    () => productosFarmacia.find((item) => String(item.id) === String(catalogoForm.producto)),
    [catalogoForm.producto, productosFarmacia]
  );

  const recompensaPreview = useMemo(() => {
    const nombre = catalogoForm.nombre.trim() || "Sin nombre";
    const tipoLabel = TIPO_RECOMPENSA_META[rewardType]?.label || rewardType;
    const puntos = parseInt(catalogoForm.puntos_requeridos, 10) || 0;
    const stock = parseNumber(catalogoForm.stock_disponible, 0);
    const stockLabel = stock > 0 ? String(stock) : "Pendiente";
    return { nombre, tipoLabel, puntos, stockLabel };
  }, [catalogoForm.nombre, catalogoForm.puntos_requeridos, catalogoForm.stock_disponible, rewardType]);

  const handleCatalogoSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      nombre: catalogoForm.nombre.trim(),
      tipo: catalogoForm.tipo,
      descripcion: catalogoForm.descripcion.trim(),
      puntos_requeridos: parseInt(catalogoForm.puntos_requeridos, 10) || 0,
      valor_descuento_bs: String(catalogoForm.valor_descuento_bs || "0.00"),
      producto: isProductoFarmacia ? parseInt(catalogoForm.producto, 10) || null : null,
      codigo_cupon_externo: catalogoForm.codigo_cupon_externo.trim(),
      instrucciones_canje: catalogoForm.instrucciones_canje.trim(),
      url_externa: catalogoForm.url_externa.trim(),
      stock_disponible: parseNumber(catalogoForm.stock_disponible, 1),
      limite_por_cliente: parseInt(catalogoForm.limite_por_cliente, 10) || 1,
      activo: Boolean(catalogoForm.activo),
      valido_hasta: catalogoForm.valido_hasta || null,
    };

    try {
      if (!payload.nombre) {
        throw new Error("El nombre de la recompensa es obligatorio.");
      }

      if (payload.stock_disponible <= 0) {
        throw new Error("El stock de la recompensa debe ser mayor a 0.");
      }

      if (isProductoFarmacia && !payload.producto) {
        throw new Error("Selecciona un producto del catálogo para esta recompensa.");
      }

      if (isProductoFarmacia && productoSeleccionado && getProductoStock(productoSeleccionado) <= 0) {
        throw new Error(NO_STOCK_MODAL_MESSAGE);
      }

      if (catalogoEditingId) {
        await puntosService.catalogoActualizar(catalogoEditingId, payload);
      } else {
        await puntosService.catalogoCrear(payload);
        setCreatedRewardName(payload.nombre);
        setShowCreateSuccessModal(true);
      }

      resetCatalogoForm();
      await loadData();
    } catch (err) {
      console.error("Error guardando catálogo:", err);
      if (err?.message === NO_STOCK_MODAL_MESSAGE) {
        setShowStockWarningModal(true);
        return;
      }
      setError(err?.message || err?.detail || "No se pudo guardar el catálogo.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditCatalogo = (item) => {
    setCatalogoEditingId(item.id);
    setCatalogoForm({
      nombre: item.nombre || "",
      tipo: item.tipo || "descuento_compra",
      descripcion: item.descripcion || "",
      puntos_requeridos: item.puntos_requeridos ?? 0,
      valor_descuento_bs: item.valor_descuento_bs ?? "0.00",
      producto: item.producto ?? "",
      codigo_cupon_externo: item.codigo_cupon_externo || "",
      instrucciones_canje: item.instrucciones_canje || "",
      url_externa: item.url_externa || "",
      stock_disponible: item.stock_disponible > 0 ? item.stock_disponible : 1,
      limite_por_cliente: item.limite_por_cliente ?? 1,
      activo: Boolean(item.activo),
      valido_hasta: item.valido_hasta || "",
    });
  };

  const handleDeleteCatalogo = async (item) => {
    if (!window.confirm(`¿Eliminar la recompensa ${item.nombre}?`)) return;
    setSaving(true);
    try {
      await puntosService.catalogoEliminar(item.id);
      await loadData();
    } catch (err) {
      console.error("Error eliminando catálogo:", err);
      setError(err?.detail || "No se pudo eliminar la recompensa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMLayout activeSection="puntos">
      <section className="space-y-4">
        <div className="rounded-[28px] border border-slate-200 bg-white/97 p-4 shadow-md sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">CRM / Puntos</p>
              <h1 className="text-2xl font-black text-slate-900">Programa de fidelidad</h1>
              <p className="text-sm text-slate-500">Configura reglas, canjes y recompensas del tenant.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl bg-cyan-50 px-4 py-2 text-cyan-700">
              <SparkIcon className="h-5 w-5" />
              <span className="text-sm font-black">{user?.role || "usuario"}</span>
            </div>
          </div>
        </div>

        {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="shadow-md">
            <CardContent className="p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Cuentas</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{resumen.cuentas}</p>
              <p className="mt-1 text-xs text-slate-500">Clientes con cuenta de puntos</p>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Catálogo</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{resumen.catalogo}</p>
              <p className="mt-1 text-xs text-slate-500">Recompensas habilitadas</p>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Puntos emitidos</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{resumen.puntosEmitidos}</p>
              <p className="mt-1 text-xs text-slate-500">Acumulados en clientes</p>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardContent className="p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Puntos activos</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{resumen.puntosActivos}</p>
              <p className="mt-1 text-xs text-slate-500">Disponibles para canje</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Configuración general</CardTitle>
              <CardDescription>Define la regla base de acumulación y canje</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleConfigSubmit}>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(configForm.activo)}
                    onChange={(e) => setConfigForm((prev) => ({ ...prev, activo: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Sistema activo
                </label>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">Bs por punto</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={configForm.bolivianos_por_punto}
                      onChange={(e) => setConfigForm((prev) => ({ ...prev, bolivianos_por_punto: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">Puntos mínimos</label>
                    <input
                      type="number"
                      min="1"
                      value={configForm.puntos_minimos_canje}
                      onChange={(e) => setConfigForm((prev) => ({ ...prev, puntos_minimos_canje: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">Expiración en días</label>
                    <input
                      type="number"
                      min="0"
                      value={configForm.dias_expiracion}
                      onChange={(e) => setConfigForm((prev) => ({ ...prev, dias_expiracion: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" className="bg-sky-900 hover:bg-sky-800" disabled={saving}>
                    Guardar configuración
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Ajuste rápido de reglas</CardTitle>
              <CardDescription>La regla debe ser fácil de explicar en caja</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl bg-cyan-50 p-4 text-cyan-900">
                <p className="text-xs font-bold uppercase tracking-widest text-cyan-700">Regla sugerida</p>
                <p className="mt-1 text-lg font-black">Bs 10 = 1 punto</p>
                <p className="mt-1 text-sm text-cyan-800">100 puntos = Bs 5 de descuento</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-bold text-slate-800">Cobertura del cliente</p>
                <p className="mt-1">Los puntos solo se muestran al cliente si su cuenta existe y tiene movimientos asociados.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-bold text-slate-800">Canjes permitidos</p>
                <p className="mt-1">El cliente nunca ve el inventario completo, solo las recompensas activadas en este catálogo.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Catálogo de recompensas</CardTitle>
            <CardDescription>Crea recompensas guiado por tipo para reducir errores de configuración</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" onSubmit={handleCatalogoSubmit}>
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-700">Paso 1 · Tipo de recompensa</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {Object.entries(TIPO_RECOMPENSA_META).map(([key, meta]) => {
                    const active = rewardType === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCatalogoForm((prev) => ({ ...prev, tipo: key }))}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          active
                            ? "border-cyan-600 bg-cyan-600 text-white"
                            : "border-cyan-200 bg-white text-slate-700 hover:border-cyan-300"
                        }`}
                      >
                        <p className="text-xs font-black">{meta.label}</p>
                        <p className={`mt-1 text-[11px] ${active ? "text-cyan-100" : "text-slate-500"}`}>{meta.helper}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Paso 2 · Datos principales</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">Nombre</label>
                  <input
                    value={catalogoForm.nombre}
                    onChange={(e) => setCatalogoForm((prev) => ({ ...prev, nombre: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                    placeholder='Ej: Cupón Pizza Hut'
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">Tipo</label>
                  <select
                    value={catalogoForm.tipo}
                    onChange={(e) => setCatalogoForm((prev) => ({ ...prev, tipo: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                  >
                    <option value="descuento_compra">Descuento en compra</option>
                    <option value="producto_farmacia">Producto de farmacia</option>
                    <option value="cupon_externo">Cupón externo</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">Puntos</label>
                  <input
                    type="number"
                    min="1"
                    value={catalogoForm.puntos_requeridos}
                    onChange={(e) => setCatalogoForm((prev) => ({ ...prev, puntos_requeridos: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">Descuento Bs</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={catalogoForm.valor_descuento_bs}
                    onChange={(e) => setCatalogoForm((prev) => ({ ...prev, valor_descuento_bs: e.target.value }))}
                    disabled={!isDescuento}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  {!isDescuento ? <p className="mt-1 text-[11px] text-slate-400">Solo aplica para recompensas de descuento.</p> : null}
                </div>
              </div>

              <textarea
                value={catalogoForm.descripcion}
                onChange={(e) => setCatalogoForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                className="min-h-[90px] rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                placeholder="Descripción visible para el cliente"
              />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Paso 3 · Datos de canje</p>
                {isProductoFarmacia ? (
                  <div className="mb-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-700">Producto base de recompensa</p>
                    <p className="mt-1 text-xs text-cyan-900">Filtra por nombre o SKU, categoría y estado de stock para elegir el producto correcto.</p>

                    <div className="mt-2 grid gap-2 lg:grid-cols-3">
                      <input
                        value={productoSearch}
                        onChange={(e) => setProductoSearch(e.target.value)}
                        placeholder="Buscar por nombre o SKU"
                        className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400"
                      />
                      <select
                        value={productoCategoria}
                        onChange={(e) => setProductoCategoria(e.target.value)}
                        className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400"
                      >
                        <option value="">Todas las categorías</option>
                        {categoriasProducto.map((categoria) => (
                          <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>
                        ))}
                      </select>
                      <select
                        value={productoStockEstado}
                        onChange={(e) => setProductoStockEstado(e.target.value)}
                        className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400"
                      >
                        <option value="all">Todos los estados de stock</option>
                        <option value="disponible">Con stock disponible</option>
                        <option value="stock_bajo">Stock bajo</option>
                        <option value="sin_stock">Sin stock</option>
                      </select>
                    </div>

                    <div className="mt-3 overflow-x-auto rounded-xl border border-cyan-100 bg-white">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-cyan-50 text-cyan-800">
                          <tr>
                            <th className="px-3 py-2">Producto</th>
                            <th className="px-3 py-2">SKU</th>
                            <th className="px-3 py-2">Categoría</th>
                            <th className="px-3 py-2">Stock</th>
                            <th className="px-3 py-2 text-right">Seleccionar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productosLoading ? (
                            <tr>
                              <td colSpan={5} className="px-3 py-4 text-center text-slate-500">Buscando productos...</td>
                            </tr>
                          ) : productosFarmacia.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-3 py-4 text-center text-slate-500">No se encontraron productos con esos filtros.</td>
                            </tr>
                          ) : (
                            productosFarmacia.map((producto) => {
                              const stock = getProductoStock(producto);
                              const selected = String(catalogoForm.producto) === String(producto.id);
                              return (
                                <tr key={producto.id} className="border-t border-cyan-100">
                                  <td className="px-3 py-2 font-semibold text-slate-800">{producto.nombre_comercial}</td>
                                  <td className="px-3 py-2 text-slate-600">{producto.sku}</td>
                                  <td className="px-3 py-2 text-slate-600">{producto.categoria_nombre || "Sin categoría"}</td>
                                  <td className="px-3 py-2">
                                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${getStockBadgeStyles(stock)}`}>
                                      {getStockLabel(stock)} ({stock})
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCatalogoForm((prev) => ({
                                          ...prev,
                                          producto: String(producto.id),
                                          nombre: prev.nombre?.trim() ? prev.nombre : producto.nombre_comercial,
                                          stock_disponible: stock > 0 ? stock : 1,
                                        }));
                                      }}
                                      className={`rounded-lg border px-2 py-1 font-semibold ${
                                        selected
                                          ? "border-cyan-700 bg-cyan-700 text-white"
                                          : "border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                                      }`}
                                    >
                                      {selected ? "Seleccionado" : "Elegir"}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {catalogoForm.producto ? (
                      <p className="mt-2 text-xs text-cyan-800">
                        Producto elegido: <span className="font-bold">{productoSeleccionado?.nombre_comercial || `ID ${catalogoForm.producto}`}</span>
                        {productoSeleccionado?.sku ? ` · SKU ${productoSeleccionado.sku}` : ""}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-cyan-800">Debes elegir un producto para crear la recompensa tipo producto.</p>
                    )}
                  </div>
                ) : null}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">Código cupón</label>
                  <input
                    value={catalogoForm.codigo_cupon_externo}
                    onChange={(e) => setCatalogoForm((prev) => ({ ...prev, codigo_cupon_externo: e.target.value }))}
                    disabled={!isCuponExterno}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">URL externa</label>
                  <input
                    value={catalogoForm.url_externa}
                    onChange={(e) => setCatalogoForm((prev) => ({ ...prev, url_externa: e.target.value }))}
                    disabled={!isCuponExterno}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">Stock</label>
                  <input
                    type="number"
                    min="1"
                    value={catalogoForm.stock_disponible}
                    onChange={(e) => setCatalogoForm((prev) => ({ ...prev, stock_disponible: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Debe ser mayor a 0. No se permiten recompensas ilimitadas.</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">Límite por cliente</label>
                  <input
                    type="number"
                    min="1"
                    value={catalogoForm.limite_por_cliente}
                    onChange={(e) => setCatalogoForm((prev) => ({ ...prev, limite_por_cliente: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <textarea
                value={catalogoForm.instrucciones_canje}
                onChange={(e) => setCatalogoForm((prev) => ({ ...prev, instrucciones_canje: e.target.value }))}
                className="min-h-[90px] rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                placeholder={isCuponExterno ? "Instrucciones para usar el cupón externo" : "Instrucciones para canje"}
              />

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">Vence</label>
                  <input
                    type="date"
                    value={catalogoForm.valido_hasta}
                    onChange={(e) => setCatalogoForm((prev) => ({ ...prev, valido_hasta: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(catalogoForm.activo)}
                    onChange={(e) => setCatalogoForm((prev) => ({ ...prev, activo: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Activo
                </label>
                <div className="flex items-end justify-end gap-2">
                  {catalogoEditingId ? (
                    <Button type="button" variant="secondary" onClick={resetCatalogoForm} disabled={saving}>
                      Cancelar edición
                    </Button>
                  ) : null}
                  <Button type="submit" className="bg-sky-900 hover:bg-sky-800" disabled={saving}>
                    {catalogoEditingId ? "Actualizar recompensa" : "Crear recompensa"}
                  </Button>
                </div>
              </div>
              </div>

              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-sky-700">Vista previa rápida</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{recompensaPreview.nombre}</p>
                <p className="text-xs text-slate-600">Tipo: {recompensaPreview.tipoLabel} · Costo: {recompensaPreview.puntos} pts · Stock: {recompensaPreview.stockLabel}</p>
              </div>
            </form>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Puntos</th>
                    <th className="px-3 py-2">Stock</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-slate-500">Cargando catálogo...</td>
                    </tr>
                  ) : catalogo.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-slate-500">No hay recompensas configuradas.</td>
                    </tr>
                  ) : (
                    catalogo.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-800">{item.nombre}</td>
                        <td className="px-3 py-2 text-slate-600">{item.tipo}</td>
                        <td className="px-3 py-2 text-slate-600">{item.puntos_requeridos}</td>
                        <td className="px-3 py-2 text-slate-600">{item.stock_disponible}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${item.activo ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                            {item.activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditCatalogo(item)}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCatalogo(item)}
                              className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Cuentas de clientes</CardTitle>
              <CardDescription>Consulta y filtra el saldo de puntos por cliente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex items-center gap-2">
                <input
                  value={cuentasSearch}
                  onChange={(e) => setCuentasSearch(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                />
                <Button type="button" variant="secondary" onClick={() => loadData("")}>Limpiar</Button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Saldo</th>
                      <th className="px-3 py-2">Nivel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-slate-500">Cargando cuentas...</td>
                      </tr>
                    ) : cuentas.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-slate-500">No hay cuentas para mostrar.</td>
                      </tr>
                    ) : (
                      cuentas.map((cuenta) => (
                        <tr key={cuenta.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-800">
                            {cuenta.cliente_detalle
                              ? `${cuenta.cliente_detalle.nombres} ${cuenta.cliente_detalle.apellidos || ""}`.trim()
                              : `Cliente #${cuenta.cliente}`}
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-700">{cuenta.puntos_disponibles}</td>
                          <td className="px-3 py-2 text-slate-600">{cuenta.nivel}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Canjes recientes</CardTitle>
              <CardDescription>Historial de recompensas entregadas al cliente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loading ? (
                  <p className="text-sm text-slate-500">Cargando canjes...</p>
                ) : canjes.length === 0 ? (
                  <p className="text-sm text-slate-500">Aún no hay canjes registrados.</p>
                ) : (
                  canjes.slice(0, 6).map((canje) => (
                    <div key={canje.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{canje.catalogo_detalle?.nombre || `Canje #${canje.id}`}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDateTime(canje.creado_en)}</p>
                        </div>
                        <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-black text-indigo-700">
                          {canje.puntos_usados} pts
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Transacciones de puntos</CardTitle>
            <CardDescription>Control operativo de puntos ganados, canjeados y ajustes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Puntos</th>
                    <th className="px-3 py-2">Saldo</th>
                    <th className="px-3 py-2">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-500">Cargando transacciones...</td>
                    </tr>
                  ) : transacciones.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-500">No hay transacciones para mostrar.</td>
                    </tr>
                  ) : (
                    transacciones.slice(0, 8).map((tx) => (
                      <tr key={tx.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-600">{formatDate(tx.creado_en)}</td>
                        <td className="px-3 py-2 text-slate-700">{tx.tipo}</td>
                        <td className={`px-3 py-2 font-semibold ${tx.puntos >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {tx.puntos >= 0 ? "+" : ""}{tx.puntos}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{tx.saldo_resultante}</td>
                        <td className="px-3 py-2 text-slate-600">{tx.descripcion || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {showCreateSuccessModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4" onClick={() => setShowCreateSuccessModal(false)}>
          <div
            className="w-full max-w-md rounded-3xl border border-emerald-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <CheckCircleIcon className="h-6 w-6" />
              </div>
              <button
                type="button"
                onClick={() => setShowCreateSuccessModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
                aria-label="Cerrar"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <h3 className="mt-3 text-xl font-black text-slate-900">Recompensa creada</h3>
            <p className="mt-1 text-sm text-slate-600">
              La recompensa <span className="font-bold text-slate-800">{createdRewardName || "nueva"}</span> se creó exitosamente y ya está disponible en el catálogo.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowCreateSuccessModal(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showStockWarningModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4" onClick={() => setShowStockWarningModal(false)}>
          <div
            className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                <CloseIcon className="h-6 w-6" />
              </div>
              <button
                type="button"
                onClick={() => setShowStockWarningModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
                aria-label="Cerrar"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <h3 className="mt-3 text-xl font-black text-slate-900">Producto sin stock</h3>
            <p className="mt-1 text-sm text-slate-600">{NO_STOCK_MODAL_MESSAGE}</p>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowStockWarningModal(false)}>
                Entendido
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </CRMLayout>
  );
}