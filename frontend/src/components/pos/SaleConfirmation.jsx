import { useEffect, useMemo, useRef, useState } from "react";
import { clientesService } from "../../services/clientesService";
import RecetaMedicaFormModal from "../crm/RecetaMedicaFormModal";
import { CloseIcon } from "../ui/Icons";

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function SaleConfirmation({ cart, totals, processing, onConfirm, onCancel }) {
  const [paymentMethod, setPaymentMethod] = useState("qr");
  const [cashReceived, setCashReceived] = useState("");
  const [ciNit, setCiNit] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);

  const [selectedRecetaId, setSelectedRecetaId] = useState("");
  const [recetas, setRecetas] = useState(null);
  const [loadingRecetas, setLoadingRecetas] = useState(false);
  const [showRecetaForm, setShowRecetaForm] = useState(false);
  const [recetasKey, setRecetasKey] = useState(0);

  const ciNitRef = useRef(null);
  const debouncedCiNit = useDebounce(ciNit.trim(), 400);

  const hasRxItems = useMemo(() => cart.some((i) => i.requiere_receta), [cart]);
  const clienteIdNum = clienteEncontrado?.id ?? null;

  // Buscar cliente por CI/NIT
  useEffect(() => {
    const query = debouncedCiNit;
    if (!query) {
      setClienteEncontrado(null);
      return;
    }
    setBuscandoCliente(true);
    clientesService
      .listar({ search: query, page_size: 10, estado: "true" })
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const exacto = list.find(
          (c) => c.ci_nit?.trim().toLowerCase() === query.toLowerCase()
        );
        setClienteEncontrado(exacto ?? null);
      })
      .catch(() => setClienteEncontrado(null))
      .finally(() => setBuscandoCliente(false));
  }, [debouncedCiNit]);

  // Cargar recetas cuando cambia el cliente encontrado y hay items Rx
  useEffect(() => {
    if (!hasRxItems || !clienteIdNum) {
      setRecetas(null);
      setSelectedRecetaId("");
      return;
    }
    setLoadingRecetas(true);
    const today = new Date().toISOString().slice(0, 10);
    clientesService
      .listarRecetas(clienteIdNum, { estado: "aprobada", page_size: 50 })
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const vigentes = list.filter(
          (r) => !r.fecha_vencimiento || r.fecha_vencimiento >= today
        );
        setRecetas(vigentes);
        setSelectedRecetaId("");
      })
      .catch(() => setRecetas([]))
      .finally(() => setLoadingRecetas(false));
  }, [clienteIdNum, hasRxItems, recetasKey]);

  const totalAmount = Number(totals.total || 0);
  const cashReceivedNumber = Number(String(cashReceived).replace(",", "."));
  const isCashPayment = paymentMethod === "efectivo";
  const hasValidCashAmount = Number.isFinite(cashReceivedNumber) && cashReceivedNumber >= totalAmount;
  const cashChange = hasValidCashAmount ? cashReceivedNumber - totalAmount : 0;
  const cashBlocked = isCashPayment && !hasValidCashAmount;
  const confirmBlocked = (hasRxItems && (!clienteIdNum || !selectedRecetaId)) || cashBlocked;

  const cashSuggestions = useMemo(() => {
    const roundedToTen = Math.ceil(totalAmount / 10) * 10;
    const roundedToFifty = Math.ceil(totalAmount / 50) * 50;
    return Array.from(new Set([totalAmount, roundedToTen, roundedToFifty]))
      .filter((value) => value >= totalAmount)
      .slice(0, 3);
  }, [totalAmount]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (confirmBlocked) return;
    const base = clienteEncontrado
      ? { cliente_id: clienteEncontrado.id }
      : {
          cliente_data: {
            nombres: nombres.trim() || "Cliente",
            apellidos: apellidos.trim() || "Mostrador",
          },
        };
    onConfirm({
      ...base,
      paymentMethod,
      cashReceived: isCashPayment ? cashReceivedNumber : null,
      cashChange: isCashPayment ? cashChange : null,
      selectedRecetaId: selectedRecetaId ? Number(selectedRecetaId) : null,
    });
  };

  const fullName = clienteEncontrado
    ? [clienteEncontrado.nombres, clienteEncontrado.apellidos].filter(Boolean).join(" ")
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-black text-slate-900">Confirmar venta</h2>
          <button type="button" onClick={onCancel} className="text-slate-400 transition hover:text-slate-600">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Resumen de items */}
          <div className="max-h-52 overflow-y-auto px-6 py-4">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-2">Producto</th>
                  <th className="pb-2 pr-2">Cant.</th>
                  <th className="pb-2 pr-2">Precio</th>
                  <th className="pb-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.producto_id} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <span className="font-medium text-slate-800">{item.nombre}</span>
                      {item.requiere_receta ? (
                        <span className="ml-1.5 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                          Rx
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2 text-slate-600">{item.cantidad}</td>
                    <td className="py-2 pr-2 text-slate-600">Bs {Number(item.precio_unitario).toFixed(2)}</td>
                    <td className="py-2 text-right font-bold text-emerald-700">
                      Bs {item.subtotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-100 px-6 py-3">
            <div className="flex items-center justify-between text-base font-black text-slate-900">
              <span>Total</span>
              <span>Bs {totals.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Identificación del cliente */}
          <div className="border-t border-slate-100 px-6 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Elige metodo de pago
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("qr")}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  paymentMethod === "qr"
                    ? "border-teal-500 bg-teal-50 shadow-sm"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <span className="block text-sm font-black text-slate-900">QR simulado</span>
                <span className="mt-1 block text-xs font-semibold text-slate-500">Muestra QR antes de cobrar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("efectivo");
                  if (!cashReceived) setCashReceived(totalAmount.toFixed(2));
                }}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  paymentMethod === "efectivo"
                    ? "border-teal-500 bg-teal-50 shadow-sm"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <span className="block text-sm font-black text-slate-900">Efectivo</span>
                <span className="mt-1 block text-xs font-semibold text-slate-500">Confirma venta directa</span>
              </button>
            </div>

            {isCashPayment ? (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-emerald-800">
                      Monto recibido
                    </label>
                    <input
                      type="number"
                      min={totalAmount.toFixed(2)}
                      step="0.01"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder={`Minimo Bs ${totalAmount.toFixed(2)}`}
                      className="h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    />
                  </div>
                  <div className="rounded-xl bg-white px-4 py-3 text-right shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cambio</p>
                    <p className={`text-lg font-black ${hasValidCashAmount ? "text-emerald-700" : "text-rose-600"}`}>
                      Bs {cashChange.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {cashSuggestions.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCashReceived(value.toFixed(2))}
                      className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-black text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-100"
                    >
                      Bs {value.toFixed(2)}
                    </button>
                  ))}
                </div>
                {cashBlocked ? (
                  <p className="mt-3 text-xs font-bold text-rose-600">
                    El monto recibido debe ser igual o mayor al total para calcular el cambio.
                  </p>
                ) : (
                  <p className="mt-3 text-xs font-semibold text-emerald-700">
                    Cambio calculado automaticamente para entregar al cliente.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-100 px-6 py-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Datos del cliente
            </p>

            {/* CI/NIT input */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                CI / NIT <span className="text-slate-400">— opcional</span>
              </label>
              <div className="relative">
                <input
                  ref={ciNitRef}
                  type="text"
                  value={ciNit}
                  onChange={(e) => setCiNit(e.target.value)}
                  placeholder="Ej: 12345678"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 pr-8 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
                {buscandoCliente ? (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                    ...
                  </span>
                ) : null}
              </div>
            </div>

            {/* Estado de búsqueda */}
            {debouncedCiNit && !buscandoCliente ? (
              clienteEncontrado ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-black text-white">
                    {clienteEncontrado.nombres?.[0]?.toUpperCase() ?? "C"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-emerald-800">{fullName}</p>
                    {clienteEncontrado.email ? (
                      <p className="truncate text-[10px] text-emerald-600">{clienteEncontrado.email}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setCiNit(""); setClienteEncontrado(null); }}
                    className="ml-auto flex-shrink-0 text-emerald-500 hover:text-emerald-700"
                    title="Limpiar"
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <p className="text-xs text-amber-700 font-semibold">
                  No se encontró cliente con CI/NIT "{debouncedCiNit}". Se registrará como cliente de mostrador.
                </p>
              )
            ) : null}

            {/* Nombres/apellidos: solo si no hay cliente encontrado */}
            {!clienteEncontrado && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Nombres <span className="text-slate-400">- opcional</span>
                  </label>
                  <input
                    type="text"
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                    placeholder="Cliente"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Apellidos <span className="text-slate-400">- opcional</span>
                  </label>
                  <input
                    type="text"
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    placeholder="Mostrador"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sección receta — solo si hay items Rx */}
          {hasRxItems ? (
            <div className="border-t border-amber-100 bg-amber-50/50 px-6 py-4 space-y-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                  ⚠ Requieren receta médica
                </p>
                <ul className="mt-1 space-y-0.5">
                  {cart.filter((i) => i.requiere_receta).map((i) => (
                    <li key={i.producto_id} className="text-xs text-slate-600 font-medium">
                      • {i.nombre}
                    </li>
                  ))}
                </ul>
              </div>

              {!clienteIdNum ? (
                <p className="text-xs font-semibold text-rose-600">
                  Ingrese el CI/NIT del cliente para verificar su receta vigente.
                </p>
              ) : loadingRecetas ? (
                <p className="text-xs text-slate-500">Verificando recetas del cliente...</p>
              ) : recetas?.length === 0 ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2">
                  <p className="text-xs font-bold text-rose-700">
                    El cliente no tiene receta aprobada y vigente.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowRecetaForm(true)}
                    className="text-xs font-semibold text-indigo-600 underline"
                  >
                    + Registrar receta para este cliente
                  </button>
                </div>
              ) : recetas?.length > 0 ? (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    Receta a usar <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedRecetaId}
                    onChange={(e) => setSelectedRecetaId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  >
                    <option value="">— seleccionar receta —</option>
                    {recetas.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.codigo}
                        {r.fecha_vencimiento ? ` · vence ${r.fecha_vencimiento}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Acciones */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={processing}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={processing || confirmBlocked}
              title={
                confirmBlocked
                  ? cashBlocked
                    ? "Ingrese el monto recibido para calcular el cambio"
                    : !clienteIdNum
                    ? "Ingrese el CI/NIT del cliente para continuar"
                    : "Seleccione una receta vigente para continuar"
                  : undefined
              }
              className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60"
            >
              {processing
                ? "Procesando..."
                : paymentMethod === "qr"
                  ? `Generar QR - Bs ${totals.total.toFixed(2)}`
                  : `Confirmar efectivo - Cambio Bs ${cashChange.toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>

      {/* Modal de registro rápido de receta */}
      {showRecetaForm && clienteIdNum ? (
        <RecetaMedicaFormModal
          clienteId={clienteIdNum}
          clienteNombre={fullName ?? `Cliente #${clienteIdNum}`}
          onClose={() => setShowRecetaForm(false)}
          onSaved={() => {
            setShowRecetaForm(false);
            setRecetasKey((k) => k + 1);
          }}
        />
      ) : null}
    </div>
  );
}
