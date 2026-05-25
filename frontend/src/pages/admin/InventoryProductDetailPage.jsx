import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import { useAuth } from "../../context/AuthContext";
import { lotesService, productosService, movimientosService } from "../../services/inventarioService";
import { getApiBaseUrl } from "../../services/apiClient";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";

const _SVG_PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360"><rect width="100%" height="100%" fill="#f1f5f9" /><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="20">Imagen no disponible</text></svg>`;
const IMAGE_PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(_SVG_PLACEHOLDER)}`;

function buildImageUrl(imagen) {
  if (!imagen) return "";
  if (/^https?:\/\//i.test(imagen)) return imagen;
  const baseUrl = getApiBaseUrl().replace(/\/$/, "");
  const raw = String(imagen).trim();
  const normalized = raw.replace(/\\/g, "/");
  if (normalized.startsWith("/media/")) return `${baseUrl}${normalized}`;
  if (normalized.startsWith("media/")) return `${baseUrl}/${normalized}`;
  if (normalized.startsWith("/productos/")) return `${baseUrl}/media${normalized}`;
  if (normalized.startsWith("productos/")) return `${baseUrl}/media/${normalized}`;
  return `${baseUrl}${normalized.startsWith("/") ? "" : "/"}${normalized}`;
}

function StatusBadge({ estado }) {
  const tone =
    estado === "disponible"
      ? "bg-emerald-100 text-emerald-700"
      : estado === "stock_bajo"
      ? "bg-amber-100 text-amber-700"
      : "bg-rose-100 text-rose-700";

  const label =
    estado === "disponible"
      ? "Disponible"
      : estado === "stock_bajo"
      ? "Stock bajo"
      : "Sin stock";

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return amount.toLocaleString("es-BO", { style: "currency", currency: "BOB", minimumFractionDigits: 2 });
}

export default function InventoryProductDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("lotes");
  const [movements, setMovements] = useState([]);
  const [lots, setLots] = useState([]);
  const [loadingLots, setLoadingLots] = useState(false);
  const [processingLotId, setProcessingLotId] = useState(null);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const lotsRequestSeq = useRef(0);

  const canViewInventory = hasPermission("inventario.ver");
  const sourceTab = searchParams.get("tab") || "stock";

  const inventario = product?.inventario || {};

  const totalInventory = useMemo(() => {
    const count = Number(inventario.stock_actual ?? 0);
    return Number.isFinite(count) ? count : 0;
  }, [inventario.stock_actual]);

  const marginText = useMemo(() => {
    const compra = Number(product?.precio_compra);
    const venta = Number(product?.precio_venta);
    if (!Number.isFinite(compra) || compra <= 0 || !Number.isFinite(venta)) return "-";
    return `${Math.round(((venta - compra) / compra) * 100)}%`;
  }, [product?.precio_compra, product?.precio_venta]);

  const hasFefoAlert = useMemo(() => {
    if (!lots.length) return false;
    const now = Date.now();
    return lots.some((lot) => {
      if (!lot.fecha_vencimiento) return false;
      const exp = new Date(lot.fecha_vencimiento).getTime();
      return exp > now && exp - now <= 1000 * 60 * 60 * 24 * 30;
    });
  }, [lots]);

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const cargarProducto = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const detalle = await productosService.obtener(id);
      setProduct(detalle);
    } catch (err) {
      console.error("Error cargando detalle de producto:", err);
      setError("No se pudo cargar el detalle del producto.");
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const cargarMovimientos = useCallback(async () => {
    if (!id) return;
    try {
      setLoadingMovements(true);
      const data = await movimientosService.listar({ producto_id: id, page_size: 20, ordering: "-fecha_movimiento" });
      setMovements(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error("Error cargando movimientos del producto:", err);
      setMovements([]);
    } finally {
      setLoadingMovements(false);
    }
  }, [id]);

  const cargarLotes = useCallback(async () => {
    if (!id) return;
    const requestId = ++lotsRequestSeq.current;
    try {
      setLoadingLots(true);
      const data = await lotesService.listar({ producto: id, producto_id: id, ordering: "-fecha_ingreso" });
      if (requestId === lotsRequestSeq.current) {
        setLots(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.error("Error cargando lotes del producto:", err);
      if (requestId === lotsRequestSeq.current) {
        setLots([]);
      }
    } finally {
      if (requestId === lotsRequestSeq.current) {
        setLoadingLots(false);
      }
    }
  }, [id]);

  const handleBloquearLote = async (lotId) => {
    try {
      setProcessingLotId(lotId);
      await lotesService.bloquear(lotId);
      await Promise.all([cargarLotes(), cargarProducto()]);
    } catch (err) {
      console.error("Error bloqueando lote:", err);
      setError(err?.message || "No se pudo bloquear el lote.");
    } finally {
      setProcessingLotId(null);
    }
  };

  const handleAnularLote = async (lotId) => {
    const motivo = window.prompt("Motivo de anulación (vencimiento o alerta_fabricante):", "alerta_fabricante");
    if (!motivo) return;
    try {
      setProcessingLotId(lotId);
      await lotesService.anular(lotId, { motivo_anulacion: motivo });
      await Promise.all([cargarLotes(), cargarProducto(), cargarMovimientos()]);
    } catch (err) {
      console.error("Error anulando lote:", err);
      setError(err?.message || "No se pudo anular el lote.");
    } finally {
      setProcessingLotId(null);
    }
  };

  useEffect(() => {
    if (!canViewInventory) return;
    cargarProducto();
  }, [canViewInventory, cargarProducto]);

  useEffect(() => {
    if (!product) return;
    cargarLotes();
    cargarMovimientos();
  }, [product, cargarLotes, cargarMovimientos]);

  if (!canViewInventory) {
    return (
      <AdminLayout activeSection="inventory" currentUser={user} onLogout={handleLogout}>
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-md">
          <h1 className="text-2xl font-black text-slate-900">Admin / Inventarios</h1>
          <p className="mt-2 text-sm text-rose-600">No tienes permisos para ver esta sección.</p>
        </section>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeSection="inventory" currentUser={user} onLogout={handleLogout}>
      <div className="space-y-4 px-0 py-0 lg:px-0">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-700">Modulo inventarios</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Dashboard de inventarios</h1>
              <p className="mt-1 text-sm text-slate-500">Vista operativa del inventario con métricas clave, movimientos y control de auditoría.</p>
            </div>
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 pb-1.5 text-xs font-semibold text-slate-500">
              <button
                type="button"
                onClick={() => navigate('/admin/inventarios?view=dashboard')}
                className={`px-2 py-1 transition-colors ${sourceTab === "dashboard" ? "border-b-2 border-blue-600 text-slate-900" : "text-slate-600 hover:text-slate-900 hover:border-b-2 hover:border-slate-300"}`}
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/inventarios?view=stock')}
                className={`px-2 py-1 transition-colors ${sourceTab === "stock" ? "border-b-2 border-blue-600 text-slate-900" : "text-slate-600 hover:text-slate-900 hover:border-b-2 hover:border-slate-300"}`}
              >
                Inventario
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/inventarios?view=movimientos')}
                className={`px-2 py-1 transition-colors ${sourceTab === "movimientos" ? "border-b-2 border-blue-600 text-slate-900" : "text-slate-600 hover:text-slate-900 hover:border-b-2 hover:border-slate-300"}`}
              >
                Movimientos
              </button>
              <button
                type="button"
                className="px-2 py-1 text-slate-600 transition hover:text-slate-900 hover:border-b-2 hover:border-slate-300"
              >
                Alertas
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-teal-700">Detalle de producto</p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">{product?.nombre_comercial || "Detalle de Producto"}</h1>
              <p className="mt-1 text-sm text-slate-500">Detalle maestro de producto y gestión de lotes.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/admin/inventarios?view=entradas&producto_id=${id}&tab=${sourceTab}`)}
              >
                Ajuste manual
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate("/admin/reportes")}>Reporte merma</Button>
              <Button
                size="sm"
                onClick={() => navigate(`/admin/inventarios?view=entradas&producto_id=${id}&tab=${sourceTab}`)}
              >
                Registrar entrada
              </Button>
            </div>
          </div>
        </section>

        {error ? (
          <Alert tone="danger">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            Cargando detalle del producto...
          </section>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="space-y-5">
              <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <div className="space-y-5">
                  <div className="rounded-3xl overflow-hidden border border-slate-200 bg-white">
                    {product?.imagen ? (
                      <img
                        src={buildImageUrl(product.imagen)}
                        alt={product.nombre_comercial}
                        className="h-72 w-full object-contain bg-slate-50"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = IMAGE_PLACEHOLDER;
                        }}
                        />
                    ) : (
                      <div className="flex h-72 items-center justify-center bg-slate-100 text-sm font-semibold text-slate-500">Imagen no disponible</div>
                    )}
                  </div>

                  <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">SKU</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{product.sku || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Categoría</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{product.categoria_nombre || "-"}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Laboratorio</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{product.laboratorio_nombre || "-"}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Presentación</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{product.presentacion || "-"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[32px] border border-slate-200 bg-white p-5">
                    <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Product Specifications</h2>
                    <div className="mt-4 space-y-3 text-sm text-slate-700">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <span className="font-semibold text-slate-900">Laboratorio</span>
                        <span>{product.laboratorio_nombre || "-"}</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <span className="font-semibold text-slate-900">Presentación</span>
                        <span>{product.presentacion || "-"}</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <span className="font-semibold text-slate-900">Almacenamiento</span>
                        <span>Temp. Ambiente (15-25°C)</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <span className="font-semibold text-slate-900">Controlled Item</span>
                        <span>{product.es_controlado ? "Sí" : "No"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[32px] border border-slate-200 bg-white p-5">
                    <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">PRICING MATRIX</h2>
                    <div className="mt-4 grid gap-3">
                      <div className="rounded-3xl bg-slate-50 p-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Cost (Avg)</p>
                        <p className="mt-2 text-xl font-black text-slate-900">{formatCurrency(product.precio_compra)}</p>
                      </div>
                      <div className="rounded-3xl bg-slate-50 p-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Sale Price</p>
                        <p className="mt-2 text-xl font-black text-slate-900">{formatCurrency(product.precio_venta)}</p>
                      </div>
                      <div className="rounded-3xl bg-slate-50 p-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Margin</p>
                        <p className="mt-2 text-xl font-black text-teal-700">{marginText}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[32px] border border-slate-200 bg-emerald-50 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-800">TOTAL INVENTORY</p>
                        <p className="mt-3 text-4xl font-black text-slate-950">{Number.isFinite(totalInventory) ? totalInventory.toLocaleString("es-BO") : "-"}</p>
                      </div>
                      <div className="rounded-3xl bg-white p-3 text-slate-900 shadow-sm">ðŸ“¦</div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            <main className="space-y-5">
              <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Active Lots (FEFO)</h2>
                    <p className="mt-1 text-sm text-slate-500">Fecha de expiración y stock por lote.</p>
                  </div>
                  <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab("lotes")}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        activeTab === "lotes" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Lotes
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("movimientos")}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        activeTab === "movimientos" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Kardex
                    </button>
                  </div>
                </div>

                <div className="mt-6">
                  {activeTab === "lotes" ? (
                    <div className="space-y-4">
                      {hasFefoAlert ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                          FEFO Alert: algún lote expira en menos de 30 días. Prioriza su distribución.
                        </div>
                      ) : null}

                      {loadingLots ? (
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                          Cargando lotes...
                        </div>
                      ) : lots.length ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                              <tr>
                                <th className="px-4 py-3">Priority</th>
                                <th className="px-4 py-3">Lot ID</th>
                                <th className="px-4 py-3">Expiration</th>
                                <th className="px-4 py-3 text-right">Stock</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Accion</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {lots.map((lot, index) => {
                                const expiration = lot.fecha_vencimiento ? new Date(lot.fecha_vencimiento) : null;
                                const daysLeft = expiration ? Math.ceil((expiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                                const statusClass =
                                  daysLeft === null
                                    ? "bg-slate-100 text-slate-700"
                                    : daysLeft <= 0
                                    ? "bg-rose-100 text-rose-700"
                                    : daysLeft <= 30
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-emerald-100 text-emerald-700";
                                return (
                                  <tr key={lot.id || `${lot.numero_lote}-${index}`} className="border-b border-slate-100">
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass}`}>
                                        {daysLeft !== null ? `${daysLeft <= 30 ? "P1" : "P2"}` : "P3"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-800">{lot.numero_lote || lot.id || "-"}</td>
                                    <td className="px-4 py-3 text-slate-700">{expiration ? expiration.toISOString().slice(0, 10) : "-"}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{Number(lot.cantidad_disponible || 0).toLocaleString("es-BO")}</td>
                                    <td className="px-4 py-3">
                                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass}`}>
                                        {daysLeft === null ? "Desconocido" : daysLeft <= 0 ? "Critico" : daysLeft <= 30 ? "Urgente" : "Activo"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      {lot.estado === "disponible" ? (
                                        <div className="inline-flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => handleBloquearLote(lot.id)}
                                            disabled={processingLotId === lot.id}
                                            className="rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                          >
                                            Bloquear
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleAnularLote(lot.id)}
                                            disabled={processingLotId === lot.id}
                                            className="rounded-lg border border-rose-300 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                          >
                                            Anular
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-slate-500">Sin accion</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                          No hay lotes activos registrados para este producto.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {loadingMovements ? (
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">Cargando historial de movimientos...</div>
                      ) : movements.length ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                              <tr>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3">Tipo</th>
                                <th className="px-4 py-3">Cantidad</th>
                                <th className="px-4 py-3">Anterior</th>
                                <th className="px-4 py-3">Final</th>
                                <th className="px-4 py-3">Responsable</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {movements.map((row) => {
                                const tipo = row?.tipo_movimiento || "Movimiento";
                                const cantidad = Number(row?.cantidad ?? 0);
                                const isNegative = ["venta", "salida", "merma", "vencimiento", "ajuste_negativo"].includes(tipo);
                                return (
                                  <tr key={row.id || `${row.producto_sku}-${row.fecha_movimiento}`}> 
                                    <td className="px-4 py-3 text-slate-700">{row.fecha_movimiento ? new Date(row.fecha_movimiento).toLocaleString("es-BO") : "-"}</td>
                                    <td className="px-4 py-3 text-slate-700 capitalize">{tipo}</td>
                                    <td className={`px-4 py-3 font-semibold ${isNegative ? "text-rose-600" : "text-emerald-700"}`}>
                                      {`${isNegative ? "-" : "+"}${Math.abs(cantidad).toLocaleString("es-BO")}`}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">{Number(row.stock_anterior ?? 0).toLocaleString("es-BO")}</td>
                                    <td className="px-4 py-3 text-slate-900 font-semibold">{Number(row.stock_posterior ?? 0).toLocaleString("es-BO")}</td>
                                    <td className="px-4 py-3 text-slate-600">{row.usuario_nombre || row.referencia || "-"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                          No hay movimientos registrados para este producto.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </main>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}



