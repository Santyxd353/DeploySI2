function money(value) {
  return `Bs ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getSale(payload) {
  return payload?.venta || payload || {};
}

function getInvoice(payload, sale) {
  return {
    ...(sale?.factura_detalle || {}),
    ...(payload?.factura || {}),
  };
}

export default function SaleNote({ payload, onNewSale, className = "" }) {
  const sale = getSale(payload);
  const invoice = getInvoice(payload, sale);
  const cliente = sale?.cliente_detalle || {};
  const vendedor = sale?.vendedor_detalle || {};
  const detalles = Array.isArray(sale?.detalles) ? sale.detalles : [];

  if (!sale?.id) return null;

  const clienteNombre =
    invoice?.nombre_cliente ||
    [cliente.nombres, cliente.apellidos].filter(Boolean).join(" ").trim() ||
    "Cliente mostrador";
  const clienteCi = invoice?.nit_ci || cliente.ci_nit || "";
  const clienteEmail = invoice?.email_cliente || cliente.email || "";

  return (
    <section className={`rounded-[24px] border border-slate-200 bg-white p-5 text-slate-900 shadow-xl ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-700">Nota de venta</p>
          <h2 className="mt-1 text-2xl font-black">Venta #{sale.id}</h2>
          <p className="text-sm text-slate-500">{formatDate(sale.created_at || invoice.fecha_emision)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Comprobante</p>
          <p className="text-lg font-black text-teal-700">{invoice.numero || invoice.numero_factura || "Pendiente"}</p>
        </div>
      </div>

      <div className="grid gap-3 border-b border-slate-200 py-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Cliente</p>
          <p className="mt-1 font-black">{clienteNombre}</p>
          <p className="text-sm text-slate-600">CI/NIT: {clienteCi || "No registrado"}</p>
          <p className="text-sm text-slate-600">{clienteEmail || "Sin correo"}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Atencion</p>
          <p className="mt-1 font-black">{vendedor.nombre || "Venta online"}</p>
          <p className="text-sm text-slate-600">Estado: {sale.estado || "pagada"}</p>
          <p className="text-sm text-slate-600">Origen: {sale.origen || "-"}</p>
          {sale.observacion ? (
            <p className="mt-1 text-sm font-semibold text-slate-700">{sale.observacion}</p>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto py-4">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-black uppercase tracking-widest text-slate-500">
              <th className="py-2 pr-3">SKU</th>
              <th className="py-2 pr-3">Producto</th>
              <th className="py-2 pr-3 text-right">Cant.</th>
              <th className="py-2 pr-3 text-right">Precio</th>
              <th className="py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {detalles.map((item) => (
              <tr key={item.id || `${item.producto}-${item.producto_nombre}`} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-mono text-xs text-slate-500">{item.producto_sku || "-"}</td>
                <td className="py-2 pr-3 font-bold text-slate-800">{item.producto_nombre || item.producto || "-"}</td>
                <td className="py-2 pr-3 text-right">{item.cantidad}</td>
                <td className="py-2 pr-3 text-right">{money(item.precio_unitario)}</td>
                <td className="py-2 text-right font-black">{money(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto max-w-xs space-y-2 border-t border-slate-200 pt-4">
        <div className="flex justify-between text-sm text-slate-600">
          <span>Subtotal</span>
          <span>{money(sale.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-600">
          <span>Descuento</span>
          <span>{money(sale.descuento)}</span>
        </div>
        <div className="flex justify-between text-lg font-black text-slate-950">
          <span>Total</span>
          <span className="text-teal-700">{money(sale.total)}</span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-3 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50"
        >
          Imprimir nota
        </button>
        {onNewSale ? (
          <button
            type="button"
            onClick={onNewSale}
            className="rounded-2xl bg-teal-700 px-4 py-2.5 text-sm font-black text-white hover:bg-teal-600"
          >
            Nueva venta
          </button>
        ) : null}
      </div>
    </section>
  );
}
