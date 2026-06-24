function CloseIcon({ className = "h-6 w-6" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function PrintIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4"
      />
    </svg>
  );
}

export default function DetalleVentaModal({ venta, isOpen, onClose }) {
  if (!isOpen || !venta) {
    return null;
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center px-4 py-6">
        <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="text-xl font-bold text-slate-900">
              Detalle de Compra #{venta.id}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition print:hidden"
              >
                <PrintIcon className="h-4 w-4" />
                Imprimir
              </button>
              <button
                onClick={onClose}
                className="rounded-lg p-2 hover:bg-slate-100 transition print:hidden"
              >
                <CloseIcon className="h-6 w-6 text-slate-600" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-6 px-6 py-6">
            {/* Estado y fecha */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase">
                  Estado
                </p>
                <p className="mt-1">
                  <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${
                    venta.estado === "pagada"
                      ? "bg-green-100 text-green-700"
                      : venta.estado === "entregada"
                      ? "bg-blue-100 text-blue-700"
                      : venta.estado === "cancelada"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {venta.estado_label}
                  </span>
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase">
                  Fecha
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {new Date(venta.created_at).toLocaleDateString()}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase">
                  Hora
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {new Date(venta.created_at).toLocaleTimeString()}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase">
                  Total
                </p>
                <p className="mt-1 text-lg font-bold text-teal-600">
                  Bs {venta.total.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Observaciones */}
            {venta.observacion && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-600 uppercase">
                  Observaciones
                </p>
                <p className="mt-1 text-sm text-slate-900">{venta.observacion}</p>
              </div>
            )}

            {/* Detalles de productos */}
            <div>
              <h3 className="mb-3 font-semibold text-slate-900">
                Productos ({venta.detalles?.length || 0})
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-2 text-left font-semibold text-slate-600">
                        Producto
                      </th>
                      <th className="px-4 py-2 text-center font-semibold text-slate-600">
                        Cantidad
                      </th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-600">
                        Precio
                      </th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-600">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(venta.detalles || []).map((detalle, idx) => (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-slate-900">
                              {detalle.producto_nombre}
                            </p>
                            <p className="text-xs text-slate-500">
                              SKU: {detalle.producto_sku}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold">
                            {detalle.cantidad}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          Bs {parseFloat(detalle.precio_unitario).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          Bs {parseFloat(detalle.subtotal).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totales */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-semibold text-slate-900">
                    Bs {(
                      venta.total -
                      (venta.descuento || 0) +
                      (venta.impuesto || 0)
                    ).toFixed(2)}
                  </span>
                </div>

                {venta.descuento > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Descuento:</span>
                    <span className="font-semibold text-green-600">
                      -Bs {venta.descuento.toFixed(2)}
                    </span>
                  </div>
                )}

                {venta.impuesto > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Impuesto:</span>
                    <span className="font-semibold text-slate-900">
                      Bs {venta.impuesto.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="border-t border-slate-300 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Total a pagar:</span>
                    <span className="text-xl font-bold text-teal-600">
                      Bs {venta.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 px-6 py-4">
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white hover:bg-teal-700 transition print:hidden"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .fixed {
            position: static;
          }
          div:has(> .bg-black) {
            display: none;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
