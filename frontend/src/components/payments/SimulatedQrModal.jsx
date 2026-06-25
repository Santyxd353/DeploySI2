function hashPayload(payload) {
  let hash = 2166136261;
  const text = String(payload || "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildMatrix(payload, size = 25) {
  let seed = hashPayload(payload);
  const next = () => {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507);
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
    return (seed ^= seed >>> 16) >>> 0;
  };

  const matrix = Array.from({ length: size }, () => Array(size).fill(false));
  const finder = (row, col) => {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const border = x === 0 || y === 0 || x === 6 || y === 6;
        const center = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        matrix[row + y][col + x] = border || center;
      }
    }
  };

  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const inFinder =
        (row < 7 && col < 7) ||
        (row < 7 && col >= size - 7) ||
        (row >= size - 7 && col < 7);
      if (!inFinder) {
        matrix[row][col] = next() % 100 < 42;
      }
    }
  }
  return matrix;
}

function SimulatedQr({ payload }) {
  const matrix = buildMatrix(payload);
  return (
    <div className="grid h-60 w-60 grid-cols-[repeat(25,minmax(0,1fr))] gap-[2px] rounded-2xl border border-slate-200 bg-white p-4 shadow-inner">
      {matrix.flatMap((row, rowIndex) =>
        row.map((active, colIndex) => (
          <span
            key={`${rowIndex}-${colIndex}`}
            className={active ? "rounded-[2px] bg-slate-950" : "rounded-[2px] bg-white"}
          />
        ))
      )}
    </div>
  );
}

export default function SimulatedQrModal({
  open,
  title = "Pago QR simulado",
  amount,
  operationCode,
  payload,
  processing = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  const qrPayload = payload || JSON.stringify({ operationCode, amount, type: "QR_SIMULADO" });

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-700">Transaccion simulada</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">
            La venta solo se registrara si presionas Realizar pago.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
          <SimulatedQr payload={qrPayload} />
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Monto</p>
              <p className="mt-1 text-3xl font-black text-teal-700">Bs {Number(amount || 0).toFixed(2)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Codigo</p>
              <p className="mt-1 break-all font-mono text-sm font-black text-slate-900">{operationCode}</p>
            </div>
            <p className="rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              QR de demostracion para el proyecto. No conecta con banco real.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancelar pago
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={processing}
            className="rounded-2xl bg-teal-700 px-4 py-3 text-sm font-black text-white shadow-lg transition hover:bg-teal-600 disabled:opacity-60"
          >
            {processing ? "Procesando..." : "Realizar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
