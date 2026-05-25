import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { buscarProductos, crearVentaPOS, listarCategorias } from "../../services/posService";
import ProductSearch from "../../components/pos/ProductSearch";
import Cart from "../../components/pos/Cart";
import SaleConfirmation from "../../components/pos/SaleConfirmation";
import { LogOutIcon, CloseIcon } from "../../components/ui/Icons";

const PAGE_SIZE = 20;

export default function POSPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cart, setCart] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saleResult, setSaleResult] = useState(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [categorias, setCategorias] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();
    listarCategorias({ estado: true })
      .then((res) => {
        const cats = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
        setCategorias(cats);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    cargarProductos();
  }, [debouncedQuery, page, selectedCategory]);

  const cargarProductos = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, page_size: PAGE_SIZE, estado: true };
      const trimmed = debouncedQuery.trim();
      if (trimmed) {
        params.search = trimmed;
      }
      if (selectedCategory) {
        params.categoria = selectedCategory;
      }
      const res = await buscarProductos(params);
      const results = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
      setProductos(results);
      setTotalCount(res?.count || results.length);
    } catch (err) {
      console.error("Error al buscar productos:", err);
      setError("No se pudieron cargar los productos.");
      setProductos([]);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = useCallback((producto) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.producto_id === producto.id);
      if (existing) {
        return prev.map((item) =>
          item.producto_id === producto.id
            ? { ...item, cantidad: item.cantidad + 1, subtotal: (item.cantidad + 1) * item.precio_unitario }
            : item
        );
      }
      return [
        ...prev,
        {
          producto_id: producto.id,
          sku: producto.sku,
          nombre: producto.nombre_comercial,
          precio_unitario: Number(producto.precio_venta),
          cantidad: 1,
          subtotal: Number(producto.precio_venta),
          stock_disponible: producto.inventario?.stock_disponible ?? 0,
          requiere_receta: Boolean(producto.requiere_receta),
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((productoId, cantidad) => {
    if (cantidad <= 0) return;
    setCart((prev) =>
      prev.map((item) =>
        item.producto_id === productoId
          ? { ...item, cantidad, subtotal: cantidad * item.precio_unitario }
          : item
      )
    );
  }, []);

  const removeFromCart = useCallback((productoId) => {
    setCart((prev) => prev.filter((item) => item.producto_id !== productoId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setSaleResult(null);
  }, []);

  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    return { subtotal, total: subtotal };
  }, [cart]);

  const handleConfirmSale = useCallback(async (clienteData) => {
    setProcessing(true);
    setError(null);
    try {
      const { selectedRecetaId, cliente_id, cliente_data } = clienteData;
      const payload = {
        items: cart.map((item) => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          ...(item.requiere_receta && selectedRecetaId
            ? { receta_id: selectedRecetaId }
            : {}),
        })),
        estado: "pagada",
        ...(cliente_id ? { cliente_id } : { cliente_data }),
      };
      const result = await crearVentaPOS(payload);
      setSaleResult(result);
      setCart([]);
      setShowConfirm(false);
    } catch (err) {
      const msg = err?.detail || err?.message || "Error al procesar la venta.";
      setError(msg);
    } finally {
      setProcessing(false);
    }
  }, [cart]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const displayName = useMemo(() => {
    return [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || user?.username || "Usuario";
  }, [user]);

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between bg-gradient-to-r from-teal-700 to-cyan-700 px-4 py-3 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-black tracking-tight">POS - Farmacia SaludPlus</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-teal-100">{displayName}</span>
          <span className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-teal-100">
            {user?.role || "usuario"}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            <LogOutIcon className="h-4 w-4" />
            Salir
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-3 flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {saleResult && (
        <div className="mx-4 mt-3 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <span>Venta #{saleResult.id} procesada exitosamente — Total: Bs {Number(saleResult.total).toFixed(2)}</span>
          <button type="button" onClick={() => setSaleResult(null)} className="text-emerald-500 hover:text-emerald-700">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-1 gap-0 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <ProductSearch
            query={query}
            onQueryChange={setQuery}
            productos={productos}
            loading={loading}
            onAddToCart={addToCart}
            searchRef={searchRef}
            categorias={categorias}
            selectedCategory={selectedCategory}
            onCategoryChange={(val) => { setSelectedCategory(val); setPage(1); }}
          />
          {totalCount > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2">
              <span className="text-xs text-slate-500">
                {productos.length} de {totalCount} productos
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="text-xs text-slate-500">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>

        <Cart
          cart={cart}
          onUpdateQuantity={updateQuantity}
          onRemove={removeFromCart}
          onClear={clearCart}
          totals={cartTotals}
          onCheckout={() => setShowConfirm(true)}
          disabled={cart.length === 0}
        />
      </div>

      {showConfirm && (
        <SaleConfirmation
          cart={cart}
          totals={cartTotals}
          processing={processing}
          onConfirm={handleConfirmSale}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
