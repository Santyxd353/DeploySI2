import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import RegistroEntradaStockForm from "../../components/admin/RegistroEntradaStockForm";
import HistorialEntradasStock from "../../components/admin/HistorialEntradasStock";
import InventoryProductCreateModal from "../../components/admin/inventory/InventoryProductCreateModal";
import { useAuth } from "../../context/AuthContext";
import { categoriasService, laboratoriosService, movimientosService, productosService, subcategoriasService } from "../../services/inventarioService";
import { listAdminUsers } from "../../services/adminService";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  AlertTriangleIcon,
  CalendarIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClipboardListIcon,
  CogIcon,
  EyeIcon,
  PackageIcon,
  PencilIcon,
  SearchIcon,
} from "../../components/ui/Icons";

const KPI_CARDS = [
  { title: "Valor total", value: "$25,580.00", helper: "+ 4.2% vs mes anterior", tone: "text-slate-900" },
  { title: "Alertas activas", value: "18", helper: "Critico · Accion requerida", tone: "text-rose-600", highlight: "border-rose-200" },
  { title: "Stock bajo", value: "42", helper: "Reabastecimiento sugerido", tone: "text-slate-900" },
  { title: "Proximo a vencer", value: "156", helper: "Siguientes 30 dias", tone: "text-slate-900" },
];

const WEEKLY_MOVEMENT = [
  { day: "Lun", entrada: 160, salida: 125 },
  { day: "Mar", entrada: 200, salida: 180 },
  { day: "Mie", entrada: 230, salida: 150 },
  { day: "Jue", entrada: 180, salida: 215 },
  { day: "Vie", entrada: 250, salida: 200 },
  { day: "Sab", entrada: 125, salida: 80 },
  { day: "Dom", entrada: 90, salida: 70 },
];

function TypeBadge({ type }) {
  const tone =
    type === "Entrada"
      ? "bg-emerald-100 text-emerald-700"
      : type === "Venta"
      ? "bg-blue-100 text-blue-700"
      : "bg-amber-100 text-amber-700";

  return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${tone}`}>{type}</span>;
}

function StatusBadge({ estado, label }) {
  const tone =
    estado === "disponible"
      ? "bg-emerald-100 text-emerald-700"
      : estado === "stock_bajo"
      ? "bg-amber-100 text-amber-700"
      : "bg-rose-100 text-rose-700";

  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>{label}</span>;
}

function SummaryCard({ label, value, helper }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </article>
  );
}

export default function AdminInventariosPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout, hasPermission } = useAuth();

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [stockItems, setStockItems] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [stockError, setStockError] = useState("");
  const [stockSearchInput, setStockSearchInput] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState("");
  const [stockSubcategoryFilter, setStockSubcategoryFilter] = useState("");
  const [stockLaboratoryFilter, setStockLaboratoryFilter] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [stockPage, setStockPage] = useState(1);
  const [stockTotalPages, setStockTotalPages] = useState(1);
  const [stockTotalCount, setStockTotalCount] = useState(0);
  const [stockResumen, setStockResumen] = useState(null);
  const [loadingResumen, setLoadingResumen] = useState(false);
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [loadingEditProduct, setLoadingEditProduct] = useState(false);
  const [createProductError, setCreateProductError] = useState("");
  const [categorias, setCategorias] = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [laboratorios, setLaboratorios] = useState([]);
  const [createForm, setCreateForm] = useState({
    sku: "",
    nombre_comercial: "",
    nombre_generico: "",
    descripcion: "",
    categoria_id: "",
    subcategoria_id: "",
    laboratorio_id: "",
    forma_farmaceutica: "tableta",
    concentracion: "",
    presentacion: "",
    unidad_medida: "unidad",
    precio_compra: "",
    precio_venta: "",
    stock_minimo: 0,
    requiere_receta: false,
    es_controlado: false,
    estado: true,
    imagen: null,
    imagen_url: "",
  });
  const [recentMovements, setRecentMovements] = useState([]);
  const [loadingRecentMovements, setLoadingRecentMovements] = useState(false);
  const [movementRows, setMovementRows] = useState([]);
  const [loadingMovementRows, setLoadingMovementRows] = useState(false);
  const [movementTypeFilter, setMovementTypeFilter] = useState("");
  const [movementUserFilter, setMovementUserFilter] = useState("");
  const [movementUsers, setMovementUsers] = useState([]);
  const [movementSearchFilter, setMovementSearchFilter] = useState("");
  const [movementDateFrom, setMovementDateFrom] = useState("");
  const [movementDateTo, setMovementDateTo] = useState("");
  const [movementPage, setMovementPage] = useState(1);
  const STOCK_PAGE_SIZE = 6;
  const MOVEMENTS_PAGE_SIZE = 6;

  const currentView = searchParams.get("view") || "dashboard";
  const selectedNavTab = searchParams.get("tab") || currentView;
  const canViewInventory = hasPermission("inventario.ver");
  const numberFormatter = useMemo(() => new Intl.NumberFormat("es-BO"), []);

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const setView = (view, extraParams = {}) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("view", view);
    if (view !== "movimientos") {
      nextParams.delete("tipo_movimiento");
      nextParams.delete("fecha_desde");
      nextParams.delete("fecha_hasta");
    }
    if (view !== "entradas") {
      nextParams.delete("producto_id");
    }
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") nextParams.delete(key);
      else nextParams.set(key, String(value));
    });
    setSearchParams(nextParams);
  };

  const cargarStock = useCallback(async () => {
    try {
      setLoadingStock(true);
      setStockError("");
      const params = { page: stockPage, page_size: STOCK_PAGE_SIZE };
      if (stockSearch) params.search = stockSearch;
      if (stockStatusFilter) params.stock_estado = stockStatusFilter;
      if (stockSubcategoryFilter) params.subcategoria = stockSubcategoryFilter;
      if (stockLaboratoryFilter) params.laboratorio = stockLaboratoryFilter;
      const data = await productosService.listar(params);
      const items = Array.isArray(data) ? data : data.results || [];
      setStockItems(items.slice(0, STOCK_PAGE_SIZE));
      const total = Array.isArray(data) ? items.length : data.count || items.length;
      setStockTotalCount(total);
      setStockTotalPages(Array.isArray(data) ? 1 : Math.max(1, Math.ceil(total / STOCK_PAGE_SIZE)));
    } catch (error) {
      console.error("Error cargando stock:", error);
      setStockError("No se pudo cargar el stock de inventario.");
      setStockItems([]);
    } finally {
      setLoadingStock(false);
    }
  }, [stockPage, stockSearch, stockStatusFilter, stockSubcategoryFilter, stockLaboratoryFilter, STOCK_PAGE_SIZE]);

  const cargarResumen = useCallback(async () => {
    try {
      setLoadingResumen(true);
      const data = await productosService.resumenStock();
      setStockResumen(data);
    } catch (error) {
      console.error("Error cargando resumen:", error);
    } finally {
      setLoadingResumen(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setStockSearch(stockSearchInput.trim());
      setStockPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [stockSearchInput]);

  useEffect(() => {
    setStockPage(1);
  }, [stockStatusFilter]);

  useEffect(() => {
    setStockPage(1);
  }, [stockSubcategoryFilter, stockLaboratoryFilter]);

  useEffect(() => {
    if (currentView === "stock") cargarStock();
  }, [currentView, stockSearch, stockStatusFilter, stockPage, cargarStock]);

  useEffect(() => {
    if (currentView === "stock") cargarResumen();
  }, [currentView, cargarResumen]);

  useEffect(() => {
    if (currentView !== "dashboard") return;
    let cancelled = false;
    const cargarRecientes = async () => {
      try {
        setLoadingRecentMovements(true);
        const data = await movimientosService.listar({ page: 1, page_size: 10, ordering: "-fecha_movimiento" });
        const items = Array.isArray(data) ? data : data?.results || [];
        if (!cancelled) setRecentMovements(items);
      } catch (error) {
        console.error("Error cargando movimientos recientes:", error);
        if (!cancelled) setRecentMovements([]);
      } finally {
        if (!cancelled) setLoadingRecentMovements(false);
      }
    };
    cargarRecientes();
    return () => {
      cancelled = true;
    };
  }, [currentView]);

  useEffect(() => {
    if (currentView !== "movimientos") return;
    setMovementDateFrom(searchParams.get("fecha_desde") || "");
    setMovementDateTo(searchParams.get("fecha_hasta") || "");
    const requestedType = searchParams.get("tipo_movimiento") || "";
    const normalizedType =
      requestedType === "ajuste_positivo" || requestedType === "ajuste_negativo"
        ? "ajuste"
        : requestedType;
    setMovementTypeFilter(normalizedType);
  }, [currentView]);

  useEffect(() => {
    if (currentView !== "movimientos") return;
    let cancelled = false;
    const cargarMovimientos = async () => {
      try {
        setLoadingMovementRows(true);
        const data = await movimientosService.listar({
          page: 1,
          page_size: 200,
          ordering: "-fecha_movimiento",
          ...(movementTypeFilter ? { tipo_movimiento: movementTypeFilter } : {}),
          ...(movementSearchFilter.trim() ? { search: movementSearchFilter.trim() } : {}),
          ...(movementDateFrom ? { fecha_desde: movementDateFrom } : {}),
          ...(movementDateTo ? { fecha_hasta: movementDateTo } : {}),
        });
        const items = Array.isArray(data) ? data : data?.results || [];
        if (!cancelled) setMovementRows(items);
      } catch (error) {
        console.error("Error cargando movimientos:", error);
        if (!cancelled) setMovementRows([]);
      } finally {
        if (!cancelled) setLoadingMovementRows(false);
      }
    };
    cargarMovimientos();
    return () => {
      cancelled = true;
    };
  }, [currentView, movementTypeFilter, movementSearchFilter, movementDateFrom, movementDateTo]);

  useEffect(() => {
    if (currentView !== "movimientos") return;
    let cancelled = false;

    const cargarUsuariosInventario = async () => {
      try {
        const data = await listAdminUsers(undefined, { page: 1, pageSize: 200, status: "active" });
        const users = Array.isArray(data?.results) ? data.results : [];
        const allowed = users.filter((item) => {
          const perms = Array.isArray(item?.permisos) ? item.permisos : [];
          return perms.includes("inventario.ver") || perms.includes("inventario.registrar_entrada");
        });

        const options = allowed.map((item) => ({
          id: String(item.id),
          label: `${item.first_name || ""} ${item.last_name || ""}`.trim() || item.email || item.username || `Usuario ${item.id}`,
        }));
        if (!cancelled) setMovementUsers(options);
      } catch (error) {
        console.error("Error cargando usuarios para filtro de movimientos:", error);
        if (!cancelled) {
          const fallback = Array.from(
            new Map(
              movementRows
                .filter((row) => row?.usuario)
                .map((row) => [String(row.usuario), { id: String(row.usuario), label: row?.usuario_nombre || `Usuario ${row.usuario}` }])
            ).values()
          );
          setMovementUsers(fallback);
        }
      }
    };

    cargarUsuariosInventario();
    return () => {
      cancelled = true;
    };
  }, [currentView, movementRows]);

  useEffect(() => {
    if (currentView !== "stock") return;
    let cancelled = false;
    Promise.all([
      categoriasService.listar({ estado: true }),
      subcategoriasService.listar({ estado: true }),
      laboratoriosService.listar({ estado: true }),
    ])
      .then(([categoriasRes, subcategoriasRes, laboratoriosRes]) => {
        if (cancelled) return;
        const normalize = (res) => (Array.isArray(res) ? res : res?.results || []);
        setCategorias(normalize(categoriasRes));
        setSubcategorias(normalize(subcategoriasRes));
        setLaboratorios(normalize(laboratoriosRes));
      })
      .catch((error) => {
        console.error("Error cargando catalogos para modal:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [currentView]);

  const normalizedInventoryItems = useMemo(() => {
    return stockItems.map((item) => {
      const stockActual = Number(item?.inventario?.stock_actual ?? 0);
      const stockMinimo = Number(item?.stock_minimo ?? 0);
      const estado = stockActual <= 0 ? "sin_stock" : stockActual <= stockMinimo ? "stock_bajo" : "disponible";
      const estadoLabel = estado === "sin_stock" ? "Sin stock" : estado === "stock_bajo" ? "Stock bajo" : "Disponible";
      return {
        id: item.id,
        nombre: item.nombre_comercial || "Producto sin nombre",
        sku: item.sku || "-",
        categoria: item.categoria_nombre || "Sin categoría",
        stock_actual: stockActual,
        stock_minimo: stockMinimo,
        estado,
        estado_label: estadoLabel,
        updated_at: item.updated_at || null,
      };
    });
  }, [stockItems]);

  const categoryOptions = useMemo(() => {
    return Array.from(new Set(normalizedInventoryItems.map((item) => item.categoria).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [normalizedInventoryItems]);

  const filteredInventoryItems = useMemo(() => {
    if (!selectedCategories.length) return normalizedInventoryItems;
    return normalizedInventoryItems.filter((item) => selectedCategories.includes(item.categoria));
  }, [normalizedInventoryItems, selectedCategories]);

  const stockSidebarSubcategories = useMemo(() => {
    if (!selectedCategories.length) return [];
    const selectedCategoryIds = categorias
      .filter((cat) => selectedCategories.includes(cat.nombre))
      .map((cat) => String(cat.id));
    return subcategorias.filter((sub) => selectedCategoryIds.includes(String(sub.categoria)));
  }, [categorias, subcategorias, selectedCategories]);

  useEffect(() => {
    if (!stockSubcategoryFilter) return;
    const exists = stockSidebarSubcategories.some((sub) => String(sub.id) === String(stockSubcategoryFilter));
    if (!exists) setStockSubcategoryFilter("");
  }, [stockSidebarSubcategories, stockSubcategoryFilter]);

  const hasInventoryFilters =
    stockSearchInput.trim() !== "" ||
    stockStatusFilter !== "" ||
    selectedCategories.length > 0 ||
    stockSubcategoryFilter !== "" ||
    stockLaboratoryFilter !== "";
  const subcategoriasDisponibles = useMemo(
    () => subcategorias.filter((item) => String(item.categoria) === String(createForm.categoria_id)),
    [subcategorias, createForm.categoria_id]
  );

  const resetCreateForm = () => {
    setCreateProductError("");
    setEditingProductId(null);
    setCreateForm({
      sku: "",
      nombre_comercial: "",
      nombre_generico: "",
      descripcion: "",
      categoria_id: "",
      subcategoria_id: "",
      laboratorio_id: "",
      forma_farmaceutica: "tableta",
      concentracion: "",
      presentacion: "",
      unidad_medida: "unidad",
      precio_compra: "",
      precio_venta: "",
      stock_minimo: 0,
      requiere_receta: false,
      es_controlado: false,
      estado: true,
      imagen: null,
      imagen_url: "",
    });
  };

  const handleCreateFormChange = (event) => {
    const { name, value, type, checked, files } = event.target;
    if (type === "file") {
      setCreateForm((prev) => ({ ...prev, [name]: files?.[0] || null }));
      return;
    }
    if (name === "categoria_id") {
      setCreateForm((prev) => ({ ...prev, categoria_id: value, subcategoria_id: "" }));
      return;
    }
    setCreateForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleCreateProduct = async (event) => {
    event.preventDefault();
    setCreateProductError("");

    const precioCompra = Number(createForm.precio_compra);
    const precioVenta = Number(createForm.precio_venta);
    const stockMinimo = Number(createForm.stock_minimo);
    const categoriaId = Number(createForm.categoria_id);
    const laboratorioId = Number(createForm.laboratorio_id);

    if (!Number.isFinite(precioCompra) || precioCompra < 0) return setCreateProductError("Precio de compra invalido.");
    if (!Number.isFinite(precioVenta) || precioVenta < 0) return setCreateProductError("Precio de venta invalido.");
    if (!Number.isFinite(stockMinimo) || stockMinimo < 0) return setCreateProductError("Stock minimo invalido.");
    if (!Number.isInteger(categoriaId)) return setCreateProductError("Selecciona una categoria.");
    if (!Number.isInteger(laboratorioId)) return setCreateProductError("Selecciona un laboratorio.");

    const payload = new FormData();
    payload.append("sku", createForm.sku.trim());
    payload.append("nombre_comercial", createForm.nombre_comercial.trim());
    payload.append("nombre_generico", createForm.nombre_generico.trim());
    payload.append("descripcion", createForm.descripcion.trim());
    payload.append("categoria_id", String(categoriaId));
    if (createForm.subcategoria_id) payload.append("subcategoria_id", String(Number(createForm.subcategoria_id)));
    payload.append("laboratorio_id", String(laboratorioId));
    payload.append("forma_farmaceutica", createForm.forma_farmaceutica);
    payload.append("concentracion", createForm.concentracion.trim());
    payload.append("presentacion", createForm.presentacion.trim());
    payload.append("unidad_medida", createForm.unidad_medida);
    payload.append("precio_compra", String(precioCompra));
    payload.append("precio_venta", String(precioVenta));
    payload.append("stock_minimo", String(stockMinimo));
    payload.append("requiere_receta", String(createForm.requiere_receta));
    payload.append("es_controlado", String(createForm.es_controlado));
    payload.append("estado", String(createForm.estado));
    if (createForm.imagen) payload.append("imagen", createForm.imagen);

    try {
      setCreatingProduct(true);
      if (editingProductId) {
        await productosService.actualizar(editingProductId, payload);
      } else {
        await productosService.crear(payload);
      }
      setShowCreateProductModal(false);
      resetCreateForm();
      await Promise.all([cargarStock(), cargarResumen()]);
    } catch (error) {
      console.error("Error creando producto:", error);
      const firstFieldError =
        error && typeof error === "object"
          ? Object.values(error).find((value) => Array.isArray(value) && value.length)?.[0]
          : "";
      setCreateProductError(firstFieldError || error?.detail || error?.message || "No se pudo crear el producto.");
    } finally {
      setCreatingProduct(false);
    }
  };

  const handleOpenEditProductModal = async (productId) => {
    try {
      setLoadingEditProduct(true);
      setCreateProductError("");
      const product = await productosService.obtener(productId);
      setCreateForm({
        sku: product.sku || "",
        nombre_comercial: product.nombre_comercial || "",
        nombre_generico: product.nombre_generico || "",
        descripcion: product.descripcion || "",
        categoria_id: product.categoria_id ? String(product.categoria_id) : product.categoria ? String(product.categoria) : "",
        subcategoria_id: product.subcategoria_id ? String(product.subcategoria_id) : product.subcategoria ? String(product.subcategoria) : "",
        laboratorio_id: product.laboratorio_id ? String(product.laboratorio_id) : product.laboratorio ? String(product.laboratorio) : "",
        forma_farmaceutica: product.forma_farmaceutica || "tableta",
        concentracion: product.concentracion || "",
        presentacion: product.presentacion || "",
        unidad_medida: product.unidad_medida || "unidad",
        precio_compra: product.precio_compra ?? "",
        precio_venta: product.precio_venta ?? "",
        stock_minimo: product.stock_minimo ?? 0,
        requiere_receta: Boolean(product.requiere_receta),
        es_controlado: Boolean(product.es_controlado),
        estado: product.estado ?? true,
        imagen: null,
        imagen_url: product.imagen_url || product.imagen || "",
      });
      setEditingProductId(productId);
      setShowCreateProductModal(true);
    } catch (error) {
      console.error("Error cargando producto para edicion:", error);
      setCreateProductError("No se pudo cargar el producto para editar.");
    } finally {
      setLoadingEditProduct(false);
    }
  };

  const filteredMovementRows = useMemo(() => {
    const hasInvalidRange = movementDateFrom && movementDateTo && movementDateFrom > movementDateTo;
    const effectiveFrom = hasInvalidRange ? movementDateTo : movementDateFrom;
    const effectiveTo = hasInvalidRange ? movementDateFrom : movementDateTo;
    return movementRows.filter((row) => {
      const byUser = movementUserFilter ? String(row?.usuario || "") === String(movementUserFilter) : true;
      const moveDate = row?.fecha_movimiento ? new Date(row.fecha_movimiento) : null;
      const byDateFrom = effectiveFrom ? (moveDate ? moveDate >= new Date(`${effectiveFrom}T00:00:00`) : false) : true;
      const byDateTo = effectiveTo ? (moveDate ? moveDate <= new Date(`${effectiveTo}T23:59:59`) : false) : true;
      return byUser && byDateFrom && byDateTo;
    });
  }, [movementRows, movementUserFilter, movementDateFrom, movementDateTo]);

  const pagedMovementRows = useMemo(() => {
    const start = (movementPage - 1) * MOVEMENTS_PAGE_SIZE;
    return filteredMovementRows.slice(start, start + MOVEMENTS_PAGE_SIZE);
  }, [filteredMovementRows, movementPage]);

  const movementTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredMovementRows.length / MOVEMENTS_PAGE_SIZE)),
    [filteredMovementRows.length]
  );

  if (!canViewInventory) {
    return (
      <AdminLayout activeSection="inventory" currentUser={user} onLogout={handleLogout}>
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-md">
          <h1 className="text-2xl font-black text-slate-900">Admin / Inventarios</h1>
          <p className="mt-2 text-sm text-rose-600">No tienes permisos para ver esta seccion.</p>
        </section>
      </AdminLayout>
    );
  }

  const chartMax = Math.max(...WEEKLY_MOVEMENT.flatMap((item) => [item.entrada, item.salida]), 1);

  return (
    <AdminLayout activeSection="inventory" currentUser={user} onLogout={handleLogout}>
      <div className="space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-700">Modulo inventarios</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Dashboard de inventarios</h1>
              <p className="mt-1 text-sm text-slate-500">Vista operativa del inventario con metricas clave, movimientos y control de auditoria.</p>
            </div>
            <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1 text-xs font-semibold text-slate-500">
                <button
                  type="button"
                  onClick={() => setView("dashboard", { tab: "dashboard" })}
                  className={`rounded-sm border px-2 py-1 transition-colors ${selectedNavTab === "dashboard" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"}`}
                >
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setView("stock", { tab: "stock" })}
                  className={`rounded-sm border px-2 py-1 transition-colors ${selectedNavTab === "stock" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"}`}
                >
                  Inventario
                </button>
                <button
                  type="button"
                  onClick={() => setView("movimientos", { tab: "movimientos" })}
                  className={`rounded-sm border px-2 py-1 transition-colors ${selectedNavTab === "movimientos" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"}`}
                >
                  Movimientos
                </button>
                <button
                  type="button"
                  className="rounded-sm border border-transparent px-2 py-1 text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
                >
                  Alertas
                </button>
              </div>
              <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => setView("entradas", { tab: selectedNavTab })}>
                Registrar Entrada
              </Button>
            </div>
          </div>
        </section>

        {currentView === "dashboard" ? (
          <section className="rounded-3xl border border-slate-200 bg-slate-100/70 p-3 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-3">
                <p className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Operaciones</p>
                <nav className="mt-2 space-y-1 text-sm">
                  <button
                    type="button"
                    onClick={() => setView("dashboard", { tab: "dashboard" })}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 ${
                      selectedNavTab === "dashboard" ? "bg-emerald-100 font-semibold text-emerald-800" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <PackageIcon className="h-4 w-4" /> Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("stock", { tab: "stock" })}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 ${
                      selectedNavTab === "stock" ? "bg-emerald-100 font-semibold text-emerald-800" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <ClipboardListIcon className="h-4 w-4" /> Inventario
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("movimientos", { tab: "movimientos" })}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 ${
                      selectedNavTab === "movimientos" ? "bg-emerald-100 font-semibold text-emerald-800" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <ChartBarIcon className="h-4 w-4" /> Movimientos
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("movimientos", { tab: "movimientos", tipo_movimiento: "ajuste" })}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-100"
                  >
                    <CogIcon className="h-4 w-4" /> Ajustes
                  </button>
                </nav>
                <p className="mt-4 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Control de calidad</p>
                <nav className="mt-2 space-y-1 text-sm">
                  <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-100"><AlertTriangleIcon className="h-4 w-4" /> Mermas</button>
                  <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-100"><ClipboardListIcon className="h-4 w-4" /> Reportes</button>
                </nav>
                <section className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Capacidad almacen</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700"><CheckCircleIcon className="h-3.5 w-3.5" /> Normal</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-200"><div className="h-2 w-[72%] rounded-full bg-emerald-500"></div></div>
                  <p className="mt-2 text-[11px] text-slate-500">72% ocupado · Proxima revision: 25/05/2026</p>
                  <p className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold text-slate-600"><CalendarIcon className="h-3.5 w-3.5" /> Actualizado hoy</p>
                </section>
              </aside>

              <main className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {KPI_CARDS.map((card) => (
                    <article key={card.title} className={`rounded-2xl border border-slate-200 bg-white p-4 ${card.highlight || ""}`}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{card.title}</p>
                      <p className={`mt-2 text-3xl font-black ${card.tone}`}>{card.value}</p>
                      <p className="mt-1 text-xs text-slate-500">{card.helper}</p>
                    </article>
                  ))}
                </div>

                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_290px]">
                  <article className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">Movimiento Semanal</h3>
                        <p className="text-xs text-slate-500">Entradas vs salidas de stock</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-700"></span>Entrada</span>
                        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400"></span>Salida</span>
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-7 gap-3">
                      {WEEKLY_MOVEMENT.map((item) => (
                        <div key={item.day} className="flex flex-col items-center gap-2">
                          <div className="flex h-40 items-end gap-1">
                            <div className="w-3 rounded-t bg-blue-700" style={{ height: `${(item.entrada / chartMax) * 100}%` }}></div>
                            <div className="w-3 rounded-t bg-emerald-400" style={{ height: `${(item.salida / chartMax) * 100}%` }}></div>
                          </div>
                          <p className="text-[11px] font-semibold text-slate-500">{item.day}</p>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-2xl bg-blue-700 p-4 text-white">
                    <h3 className="text-lg font-black">Auditoria Pendiente</h3>
                    <p className="mt-2 text-sm text-blue-100">Sector A1 - Farmaceuticos controlados. Requiere verificacion de ciclo trimestral.</p>
                    <div className="mt-12">
                      <p className="text-xs text-blue-100">Progreso</p>
                      <div className="mt-2 h-2 rounded-full bg-blue-400"><div className="h-2 w-1/4 rounded-full bg-white"></div></div>
                      <p className="mt-2 text-xs font-semibold">0 / 45 SKUs</p>
                      <Button className="mt-4 w-full bg-white text-blue-700 hover:bg-blue-50">Iniciar auditoria</Button>
                    </div>
                  </article>
                </div>

                <article className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-black text-slate-900">Actividad Reciente</h3>
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date();
                        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                        setView("movimientos", {
                          fecha_desde: firstDay.toISOString().slice(0, 10),
                          fecha_hasta: today.toISOString().slice(0, 10),
                        });
                      }}
                      className="rounded-xl border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      Ver historial completo
                    </button>
                  </div>
                  <div className="relative mt-3">
                    <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="border-y border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Producto</th><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Cantidad</th><th className="px-3 py-2">Usuario</th><th className="px-3 py-2">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                      {loadingRecentMovements ? (
                        <tr>
                          <td colSpan="6" className="px-3 py-8 text-center text-slate-500">Cargando actividad...</td>
                        </tr>
                      ) : recentMovements.length ? (
                        recentMovements.map((row) => {
                          const tipo = row?.tipo_movimiento || "ajuste";
                          const tipoLabel =
                            tipo === "entrada"
                              ? "Entrada"
                              : tipo === "salida" || tipo === "venta"
                              ? "Venta"
                              : "Ajuste";
                          const cantidadNumerica = Number(row?.cantidad || 0);
                          const esSalida = tipo === "salida" || tipo === "venta" || tipo === "merma" || tipo === "vencimiento";
                          const cantidad = `${esSalida ? "-" : "+"}${numberFormatter.format(Math.abs(cantidadNumerica))}`;
                          const fecha = row?.fecha_movimiento ? new Date(row.fecha_movimiento).toLocaleString("es-BO") : "-";
                          return (
                            <tr key={row?.id || `${row?.producto_sku}-${row?.fecha_movimiento}`} className="border-b border-slate-100">
                              <td className="px-3 py-2 text-slate-800">{row?.producto_nombre || "Producto"}</td>
                              <td className="px-3 py-2 text-xs text-slate-600">{row?.producto_sku || "-"}</td>
                              <td className="px-3 py-2"><TypeBadge type={tipoLabel} /></td>
                              <td className="px-3 py-2 font-semibold text-slate-700">{cantidad}</td>
                              <td className="px-3 py-2 text-slate-600">{row?.usuario_nombre || "-"}</td>
                              <td className="px-3 py-2 text-slate-500">{fecha}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="6" className="px-3 py-8 text-center text-slate-500">Sin movimientos recientes.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                    </div>
                    <div className="pointer-events-none sticky bottom-4 mt-2 flex justify-end pr-2">
                      <button
                        type="button"
                        onClick={() => setView("entradas", { tab: "dashboard" })}
                        className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-white bg-emerald-700 text-3xl font-semibold leading-none text-white shadow-xl transition hover:bg-emerald-600"
                        aria-label="Nuevo registro de entrada"
                        title="Nuevo registro de entrada"
                      >
                        +
                      </button>
                    </div>
                </div>
                </article>
              </main>
            </div>
          </section>
        ) : null}

        {currentView === "entradas" ? (
          <section className="space-y-8">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-md">
              <div>
                <h1 className="text-2xl font-black text-slate-900">Entrada de inventario</h1>
                <p className="mt-1 text-sm text-slate-600">Registra nuevas unidades y consulta el historial.</p>
              </div>
            </div>
            <div>
              <RegistroEntradaStockForm
                onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
                compact={false}
                initialProductoId={searchParams.get("producto_id")}
              />
            </div>
            <div>
              <HistorialEntradasStock refresh={refreshTrigger} />
            </div>
          </section>
        ) : null}

        {currentView === "stock" ? (
          <section className="rounded-[28px] border border-slate-200 bg-slate-100/70 p-3 shadow-md">
            <div className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Filtros avanzados</p>
                  {hasInventoryFilters ? (
                    <button
                      type="button"
                      onClick={() => {
                        setStockSearchInput("");
                        setStockSearch("");
                        setStockStatusFilter("");
                        setStockSubcategoryFilter("");
                        setStockLaboratoryFilter("");
                        setSelectedCategories([]);
                        setStockPage(1);
                      }}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                    >
                      Limpiar
                    </button>
                  ) : null}
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-bold text-slate-700">Categoria</p>
                  <div className="max-h-48 space-y-2 overflow-auto pr-1">
                    {categoryOptions.length ? (
                      categoryOptions.map((categoria) => (
                        <label key={categoria} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(categoria)}
                            onChange={(event) => {
                              setSelectedCategories((prev) =>
                                event.target.checked ? [...prev, categoria] : prev.filter((item) => item !== categoria)
                              );
                            }}
                            className="h-3.5 w-3.5 rounded border-slate-300"
                          />
                          <span className="truncate">{categoria}</span>
                        </label>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">Sin categorias disponibles</p>
                    )}
                  </div>
                </div>

                <div className="mt-5">
                  <p className="mb-2 text-xs font-bold text-slate-700">Subcategoria</p>
                  <select
                    value={stockSubcategoryFilter}
                    onChange={(event) => setStockSubcategoryFilter(event.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    aria-label="Filtrar por subcategoria"
                    disabled={!stockSidebarSubcategories.length}
                  >
                    <option value="">Todas las subcategorias</option>
                    {stockSidebarSubcategories.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-bold text-slate-700">Laboratorio</p>
                  <select
                    value={stockLaboratoryFilter}
                    onChange={(event) => setStockLaboratoryFilter(event.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    aria-label="Filtrar por laboratorio"
                  >
                    <option value="">Todos los laboratorios</option>
                    {laboratorios.map((lab) => (
                      <option key={lab.id} value={lab.id}>
                        {lab.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-5">
                  <p className="mb-2 text-xs font-bold text-slate-700">Estado de Stock</p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setStockStatusFilter((prev) => (prev === "disponible" ? "" : "disponible"))}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        stockStatusFilter === "disponible"
                          ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span>Optimo</span>
                      <span>{loadingResumen ? "-" : numberFormatter.format(stockResumen?.disponible ?? 0)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockStatusFilter((prev) => (prev === "stock_bajo" ? "" : "stock_bajo"))}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        stockStatusFilter === "stock_bajo"
                          ? "border-amber-400 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span>Stock Bajo</span>
                      <span>{loadingResumen ? "-" : numberFormatter.format(stockResumen?.stock_bajo ?? 0)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockStatusFilter((prev) => (prev === "sin_stock" ? "" : "sin_stock"))}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        stockStatusFilter === "sin_stock"
                          ? "border-rose-400 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span>Critico</span>
                      <span>{loadingResumen ? "-" : numberFormatter.format(stockResumen?.sin_stock ?? 0)}</span>
                    </button>
                  </div>
                </div>

                <Button className="mt-5 w-full" onClick={() => { cargarStock(); cargarResumen(); }} disabled={loadingStock}>
                  {loadingStock ? "Aplicando..." : "Aplicar filtros"}
                </Button>
              </aside>

              <main className="space-y-3">
                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">Catalogo Maestro</h2>
                      <p className="text-xs text-slate-500">Control de inventario centralizado y gestion de existencias.</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => { cargarStock(); cargarResumen(); }} disabled={loadingStock}>
                        Exportar
                      </Button>
                      <Button size="sm" onClick={() => { setCreateProductError(""); setShowCreateProductModal(true); }}>
                        Nuevo producto
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="relative min-w-[260px] flex-1">
                      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={stockSearchInput}
                        onChange={(event) => setStockSearchInput(event.target.value)}
                        placeholder="Buscar por SKU, Nombre Comercial o Generico..."
                        className="pl-9"
                        aria-label="Buscar inventario"
                      />
                    </div>
                    <SummaryCard label="Total SKUs" value={loadingResumen ? "-" : numberFormatter.format(stockResumen?.total_productos ?? 0)} helper="Registros activos" />
                    <SummaryCard label="Quiebre stock" value={loadingResumen ? "-" : numberFormatter.format(stockResumen?.sin_stock ?? 0)} helper="Sin disponibilidad" />
                  </div>

                  {stockError ? (
                    <Alert tone="danger" className="mt-4">
                      <AlertDescription>{stockError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="relative mt-4">
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                          <tr>
                            <th className="px-4 py-3">SKU</th>
                            <th className="px-4 py-3">Producto</th>
                            <th className="px-4 py-3">Categoria</th>
                            <th className="px-4 py-3 text-right">Total stock</th>
                            <th className="px-4 py-3 text-right">Stock minimo</th>
                            <th className="px-4 py-3">Estado</th>
                            <th className="px-4 py-3 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {loadingStock ? (
                            <tr>
                              <td colSpan="7" className="px-4 py-10 text-center">
                                <span className="inline-flex items-center gap-2 text-slate-500">
                                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"></span>
                                  Cargando inventario...
                                </span>
                              </td>
                            </tr>
                          ) : filteredInventoryItems.length ? (
                            filteredInventoryItems.map((item) => (
                              <tr key={item.id} className="transition-colors hover:bg-slate-50/80">
                                <td className="px-4 py-3 font-mono text-xs text-blue-700">{item.sku}</td>
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-slate-900">{item.nombre}</p>
                                  <p className="text-xs text-slate-500">{item.updated_at ? `Actualizado ${new Date(item.updated_at).toLocaleString()}` : ""}</p>
                                </td>
                                <td className="px-4 py-3 text-slate-700">{item.categoria}</td>
                                <td className="px-4 py-3 text-right font-semibold text-slate-900">{numberFormatter.format(item.stock_actual)}</td>
                                <td className="px-4 py-3 text-right text-slate-700">{numberFormatter.format(item.stock_minimo)}</td>
                                <td className="px-4 py-3"><StatusBadge estado={item.estado} label={item.estado_label} /></td>
                                <td className="px-4 py-3 text-right">
                                  <div className="inline-flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditProductModal(item.id)}
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                                      aria-label="Editar producto"
                                    >
                                      <PencilIcon className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/admin/inventarios/producto/${item.id}?tab=${currentView}`)}
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                                      aria-label="Ver producto"
                                    >
                                      <EyeIcon className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="7" className="px-4 py-10 text-center text-slate-500">
                                {hasInventoryFilters ? "No se encontraron productos con esos filtros." : "No hay productos disponibles en inventario."}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      </div>
                    </div>
                    <div className="pointer-events-none sticky bottom-4 mt-2 flex justify-end pr-2">
                      <button
                        type="button"
                        onClick={() => { setCreateProductError(""); setShowCreateProductModal(true); }}
                        className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-white bg-emerald-700 text-3xl font-semibold leading-none text-white shadow-xl transition hover:bg-emerald-600"
                        aria-label="Nuevo producto"
                        title="Nuevo producto"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {stockTotalPages > 1 && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="text-slate-600">Mostrando pagina {stockPage} de {stockTotalPages} · {stockTotalCount} productos</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setStockPage((p) => Math.max(1, p - 1))} disabled={stockPage <= 1 || loadingStock} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
                        <button type="button" onClick={() => setStockPage((p) => Math.min(stockTotalPages, p + 1))} disabled={stockPage >= stockTotalPages || loadingStock} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
                      </div>
                    </div>
                  )}
                </section>
              </main>
            </div>
          </section>
        ) : null}

        {currentView === "movimientos" ? (
          <section className="rounded-[28px] border border-slate-200 bg-slate-100/70 p-3 shadow-md">
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-4">
                <h2 className="text-2xl font-black text-slate-900">Movimientos</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <SummaryCard label="Entradas Mensuales" value={numberFormatter.format(filteredMovementRows.filter((r) => r?.tipo_movimiento === "entrada").length)} helper="+12.5%" />
                <SummaryCard label="Ventas/Salidas" value={numberFormatter.format(filteredMovementRows.filter((r) => ["venta", "salida"].includes(r?.tipo_movimiento)).length)} helper="+3.2%" />
                <SummaryCard label="Mermas (critico)" value={numberFormatter.format(filteredMovementRows.filter((r) => ["merma", "vencimiento"].includes(r?.tipo_movimiento)).length)} helper="-5.4%" />
                <SummaryCard label="Valor total auditado" value="$1.2M" helper="Estimado" />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-600">Rango de Fecha</label>
                    {(movementDateFrom || movementDateTo) && (
                      <button
                        type="button"
                        onClick={() => { setMovementDateFrom(""); setMovementDateTo(""); setMovementPage(1); }}
                        className="text-[11px] font-semibold text-blue-700 hover:text-blue-800"
                      >
                        Limpiar rango
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                    <input
                      type="date"
                      value={movementDateFrom}
                      onChange={(e) => { setMovementDateFrom(e.target.value); setMovementPage(1); }}
                      className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none"
                      aria-label="Fecha desde"
                      title="Fecha desde"
                    />
                    <span className="text-slate-400">a</span>
                    <input
                      type="date"
                      value={movementDateTo}
                      onChange={(e) => { setMovementDateTo(e.target.value); setMovementPage(1); }}
                      className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none"
                      aria-label="Fecha hasta"
                      title="Fecha hasta"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Tipo de Movimiento</label>
                  <select value={movementTypeFilter} onChange={(e) => { setMovementTypeFilter(e.target.value); setMovementPage(1); }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                    <option value="">Todos los tipos</option>
                    <option value="entrada">Entrada</option>
                    <option value="venta">Venta</option>
                    <option value="salida">Salida</option>
                    <option value="ajuste">Ajuste</option>
                    <option value="merma">Merma</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Producto / SKU</label>
                  <Input value={movementSearchFilter} onChange={(e) => { setMovementSearchFilter(e.target.value); setMovementPage(1); }} placeholder="Buscar SKU o Nombre..." />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Usuario Responsable</label>
                  <select
                    value={movementUserFilter}
                    onChange={(e) => { setMovementUserFilter(e.target.value); setMovementPage(1); }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Todos los usuarios</option>
                    {movementUsers.map((userOption) => (
                      <option key={userOption.id} value={userOption.id}>
                        {userOption.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button className="w-full" onClick={() => { setMovementPage(1); }}>Filtrar</Button>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Fecha / Hora</th>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2">Producto</th>
                        <th className="px-3 py-2">Cant.</th>
                        <th className="px-3 py-2">Previo</th>
                        <th className="px-3 py-2">Final</th>
                        <th className="px-3 py-2">Responsable / Ref</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingMovementRows ? (
                        <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">Cargando movimientos...</td></tr>
                      ) : pagedMovementRows.length ? (
                        pagedMovementRows.map((row) => {
                          const tipo = row?.tipo_movimiento || "entrada";
                          const tipoLabel =
                            tipo === "entrada" ? "Entrada" :
                            tipo === "venta" || tipo === "salida" ? "Venta" :
                            tipo.includes("ajuste") ? "Ajuste" :
                            tipo === "merma" ? "Merma" : "Movimiento";
                          const cant = Number(row?.cantidad || 0);
                          const isNegative = ["venta", "salida", "merma", "vencimiento"].includes(tipo);
                          return (
                            <tr key={row?.id} className="border-b border-slate-100">
                              <td className="px-3 py-2 text-slate-600">{row?.fecha_movimiento ? new Date(row.fecha_movimiento).toLocaleString("es-BO") : "-"}</td>
                              <td className="px-3 py-2"><TypeBadge type={tipoLabel} /></td>
                              <td className="px-3 py-2">
                                <p className="font-semibold text-slate-800">{row?.producto_nombre || "-"}</p>
                                <p className="text-xs text-slate-500">SKU: {row?.producto_sku || "-"}</p>
                              </td>
                              <td className={`px-3 py-2 font-semibold ${isNegative ? "text-rose-600" : "text-emerald-700"}`}>{`${isNegative ? "-" : "+"}${numberFormatter.format(Math.abs(cant))}`}</td>
                              <td className="px-3 py-2 text-slate-600">{numberFormatter.format(Number(row?.stock_anterior || 0))}</td>
                              <td className="px-3 py-2 font-semibold text-slate-800">{numberFormatter.format(Number(row?.stock_posterior || 0))}</td>
                              <td className="px-3 py-2 text-slate-600">
                                <p>{row?.usuario_nombre || "-"}</p>
                                <p className="text-xs text-slate-500">{row?.referencia || "-"}</p>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">Sin datos para los filtros seleccionados.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-slate-600">Mostrando {(movementPage - 1) * MOVEMENTS_PAGE_SIZE + (pagedMovementRows.length ? 1 : 0)} a {(movementPage - 1) * MOVEMENTS_PAGE_SIZE + pagedMovementRows.length} de {filteredMovementRows.length} registros</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setMovementPage((p) => Math.max(1, p - 1))} disabled={movementPage <= 1} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">Anterior</button>
                  <button type="button" onClick={() => setMovementPage((p) => Math.min(movementTotalPages, p + 1))} disabled={movementPage >= movementTotalPages} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">Siguiente</button>
                </div>
              </div>
            </section>
          </section>
        ) : null}
      </div>
      <InventoryProductCreateModal
        show={showCreateProductModal}
        saving={creatingProduct || loadingEditProduct}
        editMode={Boolean(editingProductId)}
        error={createProductError}
        currentUser={user}
        formData={createForm}
        categorias={categorias}
        subcategorias={subcategoriasDisponibles}
        laboratorios={laboratorios}
        onClose={() => {
          setShowCreateProductModal(false);
          resetCreateForm();
        }}
        onSubmit={handleCreateProduct}
        onInputChange={handleCreateFormChange}
      />
    </AdminLayout>
  );
}
