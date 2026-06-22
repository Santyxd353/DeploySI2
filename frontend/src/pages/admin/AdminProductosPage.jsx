import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import ProductsPagination from "../../components/admin/ProductsPagination";
import ProductsHeaderToolbar from "../../components/admin/products/ProductsHeaderToolbar";
import ProductsTable from "../../components/admin/products/ProductsTable";
import ProductFormModal from "../../components/admin/products/ProductFormModal";
import ProductCategoryModal from "../../components/admin/products/ProductCategoryModal";
import ProductDetailModal from "../../components/admin/products/ProductDetailModal";
import { useAuth } from "../../context/AuthContext";
import { productosService, categoriasService, subcategoriasService, laboratoriosService } from "../../services/inventarioService";
import { getApiBaseUrl } from "../../services/apiClient";

const PRODUCTOS_PAGE_SIZE = 10;

function normalizeListResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.results)) return response.results;
  return [];
}

function buildImageUrl(imagen) {
  if (!imagen) return "";
  if (/^https?:\/\//i.test(imagen)) return imagen;
  const baseUrl = getApiBaseUrl().replace(/\/$/, "");
  return `${baseUrl}${imagen.startsWith("/") ? "" : "/"}${imagen}`;
}

export default function AdminProductosPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [laboratorios, setLaboratorios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProductDetail, setSelectedProductDetail] = useState(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [categoryForm, setCategoryForm] = useState({
    nombre: "",
    descripcion: "",
    subcategorias: [{ nombre: "", descripcion: "" }],
  });
  const [imagePreview, setImagePreview] = useState("");
  const [productosPage, setProductosPage] = useState(1);
  const [totalProductosCount, setTotalProductosCount] = useState(0);
  const [formData, setFormData] = useState({
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
  });

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    cargarDatos();
  }, [productosPage, debouncedSearchTerm, categoryFilter, subcategoryFilter]);

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = {
        page: productosPage,
        page_size: PRODUCTOS_PAGE_SIZE,
      };

      const normalizedSearch = debouncedSearchTerm.trim();
      if (normalizedSearch) {
        query.search = normalizedSearch;
      }

      if (categoryFilter !== "all") {
        query.categoria = categoryFilter;
      }

      if (subcategoryFilter !== "all") {
        query.subcategoria = subcategoryFilter;
      }

      const [productosRes, categoriasRes, subcategoriasRes, laboratoriosRes] = await Promise.all([
        productosService.listar(query),
        categoriasService.listar({ estado: true }),
        subcategoriasService.listar({ estado: true }),
        laboratoriosService.listar({ estado: true }),
      ]);
      setProductos(Array.isArray(productosRes?.results) ? productosRes.results : Array.isArray(productosRes) ? productosRes : []);

      const totalCount = Number.isInteger(productosRes?.count) ? productosRes.count : (Array.isArray(productosRes) ? productosRes.length : 0);
      setTotalProductosCount(totalCount);

      const nextTotalPages = Math.max(1, Math.ceil(totalCount / PRODUCTOS_PAGE_SIZE));
      if (productosPage > nextTotalPages) {
        setProductosPage(nextTotalPages);
      }

      setCategorias(normalizeListResponse(categoriasRes));
      setSubcategorias(normalizeListResponse(subcategoriasRes));
      setLaboratorios(normalizeListResponse(laboratoriosRes));
    } catch (err) {
      console.error("Error al cargar datos:", err);
      setError("No se pudieron cargar los productos. Intente de nuevo.");
      setProductos([]);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "file") {
      const file = e.target.files?.[0] || null;
      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(file ? URL.createObjectURL(file) : editingProduct?.imagen ? buildImageUrl(editingProduct.imagen) : "");
      setFormData((prev) => ({
        ...prev,
        [name]: file,
      }));
      return;
    }

    if (name === "categoria_id") {
      setFormData((prev) => ({
        ...prev,
        categoria_id: value,
        subcategoria_id: "",
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Validación y envío
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validar campos numéricos
    const precioCompra = parseFloat(formData.precio_compra);
    const precioVenta = parseFloat(formData.precio_venta);
    const stockMinimo = parseInt(formData.stock_minimo, 10);
    const categoriaId = parseInt(formData.categoria_id, 10);
    const laboratorioId = parseInt(formData.laboratorio_id, 10);

    if (isNaN(precioCompra) || precioCompra < 0) {
      setError("El precio de compra debe ser un número válido mayor o igual a 0.");
      return;
    }
    if (isNaN(precioVenta) || precioVenta < 0) {
      setError("El precio de venta debe ser un número válido mayor o igual a 0.");
      return;
    }
    if (isNaN(stockMinimo) || stockMinimo < 0) {
      setError("El stock mínimo debe ser un número entero válido.");
      return;
    }
    if (isNaN(categoriaId)) {
      setError("Debes seleccionar una categoría.");
      return;
    }
    if (isNaN(laboratorioId)) {
      setError("Debes seleccionar un laboratorio.");
      return;
    }

    const subcategoriaId = formData.subcategoria_id ? parseInt(formData.subcategoria_id, 10) : null;
    if (formData.subcategoria_id && Number.isNaN(subcategoriaId)) {
      setError("Debes seleccionar una subcategoría válida.");
      return;
    }

    // Construir payload con los tipos correctos
    const payload = new FormData();
    payload.append("sku", formData.sku.trim());
    payload.append("nombre_comercial", formData.nombre_comercial.trim());
    payload.append("nombre_generico", formData.nombre_generico.trim());
    payload.append("descripcion", formData.descripcion.trim());
    payload.append("categoria_id", String(categoriaId));
    if (subcategoriaId) {
      payload.append("subcategoria_id", String(subcategoriaId));
    }
    payload.append("laboratorio_id", String(laboratorioId));
    payload.append("forma_farmaceutica", formData.forma_farmaceutica);
    payload.append("concentracion", formData.concentracion.trim());
    payload.append("presentacion", formData.presentacion.trim());
    payload.append("unidad_medida", formData.unidad_medida);
    payload.append("precio_compra", String(precioCompra));
    payload.append("precio_venta", String(precioVenta));
    payload.append("stock_minimo", String(stockMinimo));
    payload.append("requiere_receta", String(formData.requiere_receta));
    payload.append("es_controlado", String(formData.es_controlado));
    payload.append("estado", String(formData.estado ?? editingProduct?.estado ?? true));
    if (formData.imagen) {
      payload.append("imagen", formData.imagen);
    }

    try {
      setSaving(true);
      if (editingProduct) {
        await productosService.actualizar(editingProduct.id, payload);
      } else {
        await productosService.crear(payload);
      }
      resetForm();
      cargarDatos();
    } catch (err) {
      console.error("Error al guardar:", err);
      let msg = "Error al guardar el producto. Revise los datos.";
      if (err.detail) msg = err.detail;
      else if (err.message) msg = err.message;
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setError(null);
    setShowForm(true);
  };

  const handleOpenCategoryModal = () => {
    setShowCategoryModal(true);
    setCategoryError("");
    setCategoryForm({
      nombre: "",
      descripcion: "",
      subcategorias: [{ nombre: "", descripcion: "" }],
    });
  };

  const handleCloseCategoryModal = () => {
    setShowCategoryModal(false);
    setCategoryError("");
    setCategoryForm({
      nombre: "",
      descripcion: "",
      subcategorias: [{ nombre: "", descripcion: "" }],
    });
  };

  const handleOpenDetailModal = (producto) => {
    setSelectedProductDetail(producto);
    setShowDetailModal(true);
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedProductDetail(null);
  };

  const handleEdit = (producto) => {
    handleCloseDetailModal();
    setEditingProduct(producto);
    setError(null);
    setFormData({
      sku: producto.sku,
      nombre_comercial: producto.nombre_comercial,
      nombre_generico: producto.nombre_generico,
      descripcion: producto.descripcion,
      categoria_id: producto.categoria,
      subcategoria_id: producto.subcategoria || "",
      laboratorio_id: producto.laboratorio,
      forma_farmaceutica: producto.forma_farmaceutica,
      concentracion: producto.concentracion,
      presentacion: producto.presentacion,
      unidad_medida: producto.unidad_medida,
      precio_compra: producto.precio_compra,
      precio_venta: producto.precio_venta,
      stock_minimo: producto.stock_minimo,
      requiere_receta: producto.requiere_receta,
      es_controlado: producto.es_controlado,
      estado: producto.estado ?? true,
      imagen: null,
    });
    setImagePreview(buildImageUrl(producto.imagen));
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar este producto?")) return;
    setError(null);
    try {
      await productosService.eliminar(id);
      cargarDatos();
    } catch (err) {
      console.error("Error al eliminar:", err);
      setError("Error al eliminar el producto");
    }
  };

  const resetForm = () => {
    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setShowForm(false);
    setEditingProduct(null);
    setImagePreview("");
    setFormData({
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
    });
  };

  const handleCreateCategory = async (event) => {
    event.preventDefault();
    setCategoryError("");

    const nombre = categoryForm.nombre.trim();
    if (!nombre) {
      setCategoryError("El nombre de la categoría es obligatorio.");
      return;
    }

    try {
      setCategorySaving(true);
      const nuevaCategoria = await categoriasService.crear({
        nombre,
        descripcion: categoryForm.descripcion.trim(),
        estado: true,
      });

      const categoriaCreada = nuevaCategoria?.id ? nuevaCategoria : null;
      if (categoriaCreada) {
        setCategorias((prev) => [categoriaCreada, ...prev].sort((a, b) => a.nombre.localeCompare(b.nombre)));

        const subcategoriasToCreate = (categoryForm.subcategorias || [])
          .map((item) => ({
            nombre: (item?.nombre || "").trim(),
            descripcion: (item?.descripcion || "").trim(),
          }))
          .filter((item) => item.nombre);

        if (subcategoriasToCreate.length > 0) {
          const createdSubcategorias = await Promise.all(
            subcategoriasToCreate.map((item) =>
              subcategoriasService.crear({
                categoria: categoriaCreada.id,
                nombre: item.nombre,
                descripcion: item.descripcion,
                estado: true,
              })
            )
          );

          const validCreated = createdSubcategorias.filter((item) => item?.id);
          if (validCreated.length > 0) {
            setSubcategorias((prev) =>
              [...validCreated, ...prev].sort((a, b) =>
                `${a.categoria_nombre || ""}-${a.nombre}`.localeCompare(`${b.categoria_nombre || ""}-${b.nombre}`)
              )
            );
          }
        }
      }

      setCategoryForm({
        nombre: "",
        descripcion: "",
        subcategorias: [{ nombre: "", descripcion: "" }],
      });
      handleCloseCategoryModal();
    } catch (err) {
      console.error("Error al crear categoría/subcategoría:", err);
      setCategoryError(err?.detail || "No se pudo crear la categoría o subcategoría.");
    } finally {
      setCategorySaving(false);
    }
  };

  const totalProductosPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalProductosCount / PRODUCTOS_PAGE_SIZE));
  }, [totalProductosCount]);

  const filteredSubcategoriasByCategoryFilter = useMemo(() => {
    if (categoryFilter === "all") return [];
    return subcategorias.filter((item) => String(item.categoria) === String(categoryFilter));
  }, [subcategorias, categoryFilter]);

  const filteredSubcategoriasForForm = useMemo(() => {
    if (!formData.categoria_id) return [];
    return subcategorias.filter((item) => String(item.categoria) === String(formData.categoria_id));
  }, [subcategorias, formData.categoria_id]);

  const paginationRangeText = useMemo(() => {
    if (!totalProductosCount) return "Mostrando 0 de 0 productos";
    const start = (productosPage - 1) * PRODUCTOS_PAGE_SIZE + 1;
    const end = Math.min(productosPage * PRODUCTOS_PAGE_SIZE, totalProductosCount);
    return `Mostrando ${start}-${end} de ${totalProductosCount} productos`;
  }, [productosPage, totalProductosCount]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  if (initialLoading) {
    return (
      <AdminLayout activeSection="products" currentUser={user} onLogout={handleLogout}>
        <div className="p-6">Cargando productos...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeSection="products" currentUser={user} onLogout={handleLogout}>
      <div className="space-y-6">
        <ProductsHeaderToolbar
          categorias={categorias}
          subcategorias={filteredSubcategoriasByCategoryFilter}
          searchTerm={searchTerm}
          categoryFilter={categoryFilter}
          subcategoryFilter={subcategoryFilter}
          productosLength={productos.length}
          totalProductosCount={totalProductosCount}
          loading={loading}
          onOpenCategoryModal={handleOpenCategoryModal}
          onOpenCreate={handleOpenCreate}
          onSearchChange={(value) => {
            setSearchTerm(value);
            setProductosPage(1);
          }}
          onCategoryFilterChange={(value) => {
            setCategoryFilter(value);
            setSubcategoryFilter("all");
            setProductosPage(1);
          }}
          onSubcategoryFilterChange={(value) => {
            setSubcategoryFilter(value);
            setProductosPage(1);
          }}
        />

        {/* Error Message */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-6 py-4 rounded-2xl text-sm font-medium">
            {error}
          </div>
        )}

        <ProductsTable
          productos={productos}
          onOpenDetailModal={handleOpenDetailModal}
          onEdit={handleEdit}
          onDelete={handleDelete}
          buildImageUrl={buildImageUrl}
        />

        {/* Paginación */}
        <ProductsPagination
          loading={loading}
          paginationRangeText={paginationRangeText}
          currentPage={productosPage}
          totalPages={totalProductosPages}
          onPreviousPage={() => setProductosPage((prev) => Math.max(1, prev - 1))}
          onNextPage={() => setProductosPage((prev) => Math.min(totalProductosPages, prev + 1))}
        />
      </div>

      <ProductFormModal
        show={showForm}
        editingProduct={editingProduct}
        formData={formData}
        categorias={categorias}
        subcategorias={filteredSubcategoriasForForm}
        laboratorios={laboratorios}
        imagePreview={imagePreview}
        saving={saving}
        onClose={resetForm}
        onSubmit={handleSubmit}
        onInputChange={handleInputChange}
        buildImageUrl={buildImageUrl}
      />

      <ProductCategoryModal
        show={showCategoryModal}
        categoryForm={categoryForm}
        categoryError={categoryError}
        categorySaving={categorySaving}
        onClose={handleCloseCategoryModal}
        onSubmit={handleCreateCategory}
        onFormChange={setCategoryForm}
      />

      <ProductDetailModal
        show={showDetailModal}
        selectedProductDetail={selectedProductDetail}
        onClose={handleCloseDetailModal}
        onEdit={handleEdit}
        buildImageUrl={buildImageUrl}
      />
    </AdminLayout>
  );
}