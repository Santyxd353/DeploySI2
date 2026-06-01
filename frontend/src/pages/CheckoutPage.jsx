import { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "../components/ui/button";
import { carritoService, pagosService } from "../services/carritoService";
import { puntosService } from "../services/puntosService";
import { useAuth } from "../context/AuthContext";

// Cargar Stripe con la clave pública
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

// Estilos para los elementos de Stripe
const stripeElementStyles = {
  style: {
    base: {
      fontSize: "16px",
      color: "#1e293b",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      "::placeholder": {
        color: "#94a3b8",
      },
    },
    invalid: {
      color: "#e53e3e",
      iconColor: "#e53e3e",
    },
  },
};

function formatPrecio(valor) {
  const numero = Number(valor || 0);
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 2,
  }).format(numero);
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatFecha(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function extractErrorMessage(err) {
  if (!err) return "No se pudo completar el pago.";
  if (typeof err === "string") return err;
  if (err.detail) return err.detail;
  if (err.message) return err.message;
  return "No se pudo completar el pago.";
}

// Componente interno del formulario de pago
function PaymentForm({ total, onSuccess, onError, onCartCleared, onCartSynced }) {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [nombreCliente, setNombreCliente] = useState("");
  const [emailCliente, setEmailCliente] = useState("");
  const [telefono, setTelefono] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      onError("Stripe no está listo. Intente nuevamente.");
      return;
    }

    if (!nombreCliente || !emailCliente) {
      onError("Por favor complete su nombre y email");
      return;
    }

    setProcessing(true);
    onError(null);

    try {
      console.log("===== INICIANDO PAGO =====");
      console.log("Usuario autenticado:", user ? `Sí (ID: ${user.id})` : "No");
      console.log("Total a pagar:", total);
      
      let identificadorCarrito = null;
      
      if (user) {
        console.log("🔐 Usuario autenticado, usando sesión");
        identificadorCarrito = null;
      } else {
        console.log("👤 Usuario invitado, buscando token...");
        identificadorCarrito = localStorage.getItem('carrito_token');
        
        if (!identificadorCarrito) {
          const carritoData = await carritoService.listar();
          identificadorCarrito = carritoData?.invitado_token;
          if (identificadorCarrito) {
            localStorage.setItem('carrito_token', identificadorCarrito);
          }
        }
        console.log("Token para invitado:", identificadorCarrito);
        
        if (!identificadorCarrito) {
          throw new Error("No se encontró token de carrito.");
        }
      }

      // 1. Revalidar carrito en backend para usar monto exacto del servidor
      const carritoActual = await carritoService.listar();
      const totalBackend = toNumber(carritoActual?.total, 0);
      if (totalBackend <= 0) {
        throw new Error("El carrito esta vacio o no tiene total valido.");
      }
      onCartSynced?.(carritoActual);

      // 2. Crear PaymentIntent
      console.log("1. Creando PaymentIntent...");
      const intentData = await pagosService.crearIntent(Number(totalBackend.toFixed(2)));
      console.log("PaymentIntent creado:", intentData);

      // 3. Confirmar pago con Stripe
      console.log("2. Confirmando pago con Stripe...");
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        intentData.client_secret,
        {
          payment_method: {
            card: elements.getElement(CardNumberElement),
            billing_details: {
              name: nombreCliente,
              email: emailCliente,
            },
          },
        }
      );

      if (error) {
        console.error("Error en Stripe:", error);
        throw new Error(error.message);
      }

      console.log("PaymentIntent resultado:", paymentIntent);

      if (paymentIntent.status === "succeeded") {
        console.log("3. Pago exitoso, confirmando venta en backend...");
        
        const confirmData = await pagosService.confirmarPago(
          paymentIntent.id,
          identificadorCarrito,
          {
            nombre_cliente: nombreCliente,
            email_cliente: emailCliente,
            telefono: telefono,
          }
        );
        
        console.log("Venta confirmada:", confirmData);

        // ✅ Limpiar TODO el carrito después del pago exitoso
        carritoService.vaciar();
        localStorage.removeItem('carrito_token');
        
        // Notificar al componente padre que el carrito se limpió
        if (onCartCleared) {
          onCartCleared();
        }
        
        if (onSuccess) {
          onSuccess(confirmData);
        }
      } else {
        throw new Error(`El pago no se completó. Estado: ${paymentIntent.status}`);
      }
    } catch (err) {
      console.error("ERROR en handleSubmit:", err);
      onError(extractErrorMessage(err));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">
          Nombre completo *
        </label>
        <input
          type="text"
          value={nombreCliente}
          onChange={(e) => setNombreCliente(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          required
          placeholder="Juan Perez"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">
          Correo electrónico *
        </label>
        <input
          type="email"
          value={emailCliente}
          onChange={(e) => setEmailCliente(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          required
          placeholder="juan@example.com"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">
          Teléfono (opcional)
        </label>
        <input
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          placeholder="77777777"
        />
      </div>

      {/* Campos de tarjeta separados */}
      <div className="space-y-3">
        <label className="block text-sm font-bold text-slate-700 mb-1">
          Datos de la tarjeta
        </label>
        
        {/* Número de tarjeta */}
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1">Número de tarjeta</p>
          <div className="rounded-lg border border-slate-300 p-3 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500">
            <CardNumberElement options={stripeElementStyles} />
          </div>
        </div>

        {/* Fecha de expiración y CVC en fila */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">Fecha (MM/AA)</p>
            <div className="rounded-lg border border-slate-300 p-3 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500">
              <CardExpiryElement options={stripeElementStyles} />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">CVC</p>
            <div className="rounded-lg border border-slate-300 p-3 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500">
              <CardCvcElement options={stripeElementStyles} />
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-2">
          Modo prueba: usar tarjeta <span className="font-mono font-bold">4242 4242 4242 4242</span>, cualquier fecha futura y CVC 123
        </p>
      </div>

      <Button
        type="submit"
        disabled={processing || !stripe}
        className="mt-4 h-11 w-full bg-teal-700 text-base font-black hover:bg-teal-600 disabled:opacity-50"
      >
        {processing ? "Procesando pago..." : `Pagar ${formatPrecio(total)}`}
      </Button>
    </form>
  );
}

// Componente principal
export default function CheckoutPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [paymentError, setPaymentError] = useState(null);
  const [metodoEntrega, setMetodoEntrega] = useState("domicilio");
  const [showFacturaDetalle, setShowFacturaDetalle] = useState(false);
  const [facturaDetalle, setFacturaDetalle] = useState(null);
  const [facturaLoading, setFacturaLoading] = useState(false);
  const [facturaError, setFacturaError] = useState(null);
  const [bolivianosPorPunto, setBolivianosPorPunto] = useState(null);

  const hydrateCartFromBackend = (data) => {
    const backendItems = Array.isArray(data?.items) ? data.items : [];
    if (backendItems.length === 0) {
      setItems([]);
      setSubtotal(0);
      setTotal(0);
      return;
    }

    const cartItems = backendItems.map((item) => ({
      id: item.producto,
      nombre_comercial: item.producto_nombre,
      precio_venta: toNumber(item.precio_unitario),
      cantidad: toNumber(item.cantidad, 1),
    }));

    setItems(cartItems);
    setSubtotal(toNumber(data?.subtotal));
    setTotal(toNumber(data?.total));
  };

  // Cargar carrito desde state o desde backend
  useEffect(() => {
    const loadCart = async () => {
      setLoading(true);
      try {
        console.log("===== CARGANDO CARRITO =====");
        
        const stateItems = state?.items || [];
        const stateSubtotal = state?.subtotal || 0;
        const stateTotal = state?.total || 0;

        if (stateItems.length > 0) {
          console.log("Cargando desde state:", stateItems);
          setItems(stateItems);
          setSubtotal(stateSubtotal);
          setTotal(stateTotal);
        }

        console.log("Cargando desde backend...");
        const data = await carritoService.listar();
        console.log("Respuesta del carrito:", data);
        hydrateCartFromBackend(data);
      } catch (error) {
        console.error("Error al cargar carrito:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCart();
  }, [state]);

  useEffect(() => {
    if (!user) return;
    puntosService
      .miCuenta()
      .then((data) => {
        const cfg = data?.configuracion;
        if (cfg?.bolivianos_por_punto) setBolivianosPorPunto(Number(cfg.bolivianos_por_punto));
      })
      .catch(() => {});
  }, [user]);

  // ✅ Limpiar items del carrito cuando se vuelve a la página después del pago
  useEffect(() => {
    // Si hay un pago exitoso en el state, no limpiamos
    if (paymentSuccess) return;
    
    // Verificar si acabamos de volver de un pago exitoso
    const hasJustPaid = sessionStorage.getItem('just_paid');
    if (hasJustPaid) {
      sessionStorage.removeItem('just_paid');
      setItems([]);
      setSubtotal(0);
      setTotal(0);
    }
  }, [paymentSuccess]);

  const envio = 0;
  const impuesto = 0;
  const totalConEnvio = total;

  const handlePaymentSuccess = (data) => {
    console.log("Pago exitoso, data:", data);
    // Marcar que se realizó un pago exitoso
    sessionStorage.setItem('just_paid', 'true');
    setPaymentSuccess(data);
    setShowFacturaDetalle(false);
    setFacturaDetalle(null);
    setFacturaError(null);
  };

  const handlePaymentError = (error) => {
    console.error("Error en pago:", error);
    setPaymentError(error);
  };

  const handleCartCleared = () => {
    // Limpiar items locales después del pago
    setItems([]);
    setSubtotal(0);
    setTotal(0);
  };

  const handleVerFactura = async () => {
    const numeroFactura = paymentSuccess?.factura?.numero;
    if (!numeroFactura) {
      setFacturaError("No se encontró el número de factura para esta compra.");
      return;
    }

    setShowFacturaDetalle(true);
    setFacturaLoading(true);
    setFacturaError(null);

    try {
      const data = await pagosService.obtenerFactura(numeroFactura);
      setFacturaDetalle(data);
    } catch (error) {
      setFacturaError(extractErrorMessage(error));
    } finally {
      setFacturaLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="farm-bg min-h-screen px-4 py-8">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-lg font-semibold">Cargando...</p>
        </div>
      </main>
    );
  }

  if (paymentSuccess) {
    return (
      <main className="farm-bg min-h-screen px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl bg-white p-8 text-center shadow-xl">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-2">¡Pago exitoso!</h2>
            <p className="text-slate-600 mb-6">
              Su compra ha sido registrada correctamente.
            </p>
            <div className="mb-6 rounded-xl bg-slate-100 p-4">
              <p className="text-sm font-semibold text-slate-500">Número de factura</p>
              <p className="text-2xl font-black text-teal-700">
                {paymentSuccess.factura?.numero || "Pendiente"}
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => navigate("/", { replace: true })}
                className="bg-teal-700 px-6 hover:bg-teal-600"
              >
                Volver al catálogo
              </Button>
              <Button
                variant="outline"
                onClick={handleVerFactura}
                className="border-slate-300"
              >
                Ver factura
              </Button>
            </div>

            {facturaError && (
              <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-left">
                <p className="text-sm text-red-600">{facturaError}</p>
              </div>
            )}

            {showFacturaDetalle && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-xl font-black text-slate-900">Detalle de factura</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="border-slate-300"
                      onClick={() => window.print()}
                      disabled={facturaLoading || !facturaDetalle}
                    >
                      Imprimir
                    </Button>
                    <Button
                      variant="outline"
                      className="border-slate-300"
                      onClick={() => setShowFacturaDetalle(false)}
                    >
                      Cerrar
                    </Button>
                  </div>
                </div>

                {facturaLoading && (
                  <p className="text-sm font-semibold text-slate-600">Cargando factura...</p>
                )}

                {!facturaLoading && facturaDetalle && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl bg-white p-4 border border-slate-200">
                        <p className="text-xs font-semibold text-slate-500">Factura</p>
                        <p className="text-lg font-black text-slate-900">{facturaDetalle.numero_factura}</p>
                        <p className="mt-2 text-xs font-semibold text-slate-500">Fecha de emisión</p>
                        <p className="text-sm font-bold text-slate-800">{formatFecha(facturaDetalle.fecha_emision)}</p>
                        <p className="mt-2 text-xs font-semibold text-slate-500">Tipo</p>
                        <p className="text-sm font-bold text-slate-800">{facturaDetalle.tipo || "simple"}</p>
                      </div>

                      <div className="rounded-xl bg-white p-4 border border-slate-200">
                        <p className="text-xs font-semibold text-slate-500">Cliente</p>
                        <p className="text-sm font-bold text-slate-800">{facturaDetalle.nombre_cliente || "-"}</p>
                        <p className="text-sm text-slate-700">{facturaDetalle.email_cliente || "-"}</p>
                        <p className="mt-2 text-xs font-semibold text-slate-500">NIT/CI</p>
                        <p className="text-sm font-bold text-slate-800">{facturaDetalle.nit_ci || "No registrado"}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                      <p className="mb-3 text-sm font-black text-slate-900">Items comprados</p>
                      <div className="space-y-2">
                        {(facturaDetalle.items || []).map((item, idx) => (
                          <div key={`${item.producto}-${idx}`} className="flex items-start justify-between rounded-lg bg-slate-50 p-2">
                            <div>
                              <p className="text-sm font-bold text-slate-800">{item.producto}</p>
                              <p className="text-xs text-slate-500">
                                {item.cantidad} x {formatPrecio(item.precio_unitario)}
                              </p>
                            </div>
                            <p className="text-sm font-black text-slate-900">{formatPrecio(item.subtotal)}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 border-t border-slate-200 pt-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-600">Total cobrado</span>
                        <span className="text-lg font-black text-teal-700">
                          {formatPrecio(facturaDetalle?.venta?.total)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (items.length === 0 && !loading) {
    return (
      <main className="farm-bg min-h-screen px-4 py-8">
        <div className="mx-auto max-w-6xl text-center">
          <div className="rounded-2xl bg-white p-8 shadow-xl">
            <p className="text-lg font-semibold text-slate-600 mb-4">
              Tu carrito está vacío
            </p>
            <Button onClick={() => navigate("/")} className="bg-teal-700 hover:bg-teal-600">
              Ir al catálogo
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="farm-bg min-h-screen px-4 py-8 text-slate-800 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-6xl space-y-5">
        <div className="rounded-[24px] border border-sky-100 bg-white p-4 shadow-2xl shadow-slate-200/60 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-slate-900">Confirmar compra</h1>
              <p className="text-sm font-semibold text-slate-500">
                Finaliza tu pedido con pago en línea con tarjeta de crédito.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/")}>
              Volver
            </Button>
          </div>

          {paymentError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">{paymentError}</p>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              {/* Carrito */}
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-xl font-black text-slate-900">Carrito de compra</h2>
                <div className="mt-3 space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between rounded-lg border border-slate-200 bg-slate-50 p-2.5"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-800">{item.nombre_comercial}</p>
                        <p className="text-xs font-semibold text-slate-500">
                          Cantidad: {item.cantidad}
                        </p>
                      </div>
                      <p className="text-sm font-black text-slate-900">
                        {formatPrecio(item.precio_venta * item.cantidad)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Método de entrega */}
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-xl font-black text-slate-900">Método de entrega</h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMetodoEntrega("domicilio")}
                    className={`rounded-lg border p-3 text-left ${
                      metodoEntrega === "domicilio"
                        ? "border-teal-400 bg-teal-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-800">Entrega a domicilio</p>
                    <p className="text-xs font-semibold text-slate-500">24 a 48 horas</p>
                    <p className="text-sm font-black text-teal-700">+{formatPrecio(5)}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetodoEntrega("retiro")}
                    className={`rounded-lg border p-3 text-left ${
                      metodoEntrega === "retiro"
                        ? "border-teal-400 bg-teal-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-800">Retiro en tienda</p>
                    <p className="text-xs font-semibold text-slate-500">Disponible en 2 horas</p>
                    <p className="text-sm font-black text-teal-700">Gratis</p>
                  </button>
                </div>
              </section>

              {/* Formulario de pago con Stripe */}
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-xl font-black text-slate-900">Datos de pago</h2>
                <div className="mt-3">
                  <Elements stripe={stripePromise}>
                    <PaymentForm
                      total={totalConEnvio}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      onCartCleared={handleCartCleared}
                      onCartSynced={hydrateCartFromBackend}
                    />
                  </Elements>
                </div>
              </section>
            </div>

            {/* Resumen */}
            <aside className="h-fit rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-6">
              <h2 className="text-xl font-black text-slate-900">Resumen del pedido</h2>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between font-medium text-slate-600">
                  <span>Subtotal ({items.length} items)</span>
                  <span>{formatPrecio(subtotal)}</span>
                </div>
                <div className="flex justify-between font-medium text-slate-600">
                  <span>Envío</span>
                  <span>{formatPrecio(envio)}</span>
                </div>
                <div className="flex justify-between font-medium text-slate-600">
                  <span>Impuesto (8.25%)</span>
                  <span>{formatPrecio(impuesto)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 text-lg font-black text-slate-900 flex justify-between">
                  <span>Total</span>
                  <span>{formatPrecio(totalConEnvio)}</span>
                </div>
              </div>
              {user && bolivianosPorPunto && totalConEnvio > 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-cyan-50 border border-cyan-100 px-3 py-2.5">
                  <span className="text-lg">✨</span>
                  <div>
                    <p className="text-xs font-black text-cyan-800">
                      +{Math.floor(totalConEnvio / bolivianosPorPunto)} puntos con esta compra
                    </p>
                    <p className="text-[10px] text-cyan-600">
                      Se acreditan automaticamente al confirmar el pago
                    </p>
                  </div>
                </div>
              )}
              <p className="mt-3 text-center text-xs font-semibold text-slate-500">
                Pago seguro SSL con tarjeta de crédito.
              </p>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}