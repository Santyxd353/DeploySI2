import { useEffect, useRef, useState } from "react";

function BarcodeIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7v10" />
      <path d="M7 7v10" />
      <path d="M11 7v10" />
      <path d="M15 7v10" />
      <path d="M18 7v10" />
      <path d="M21 7v10" />
      <path d="M3 5h18" />
      <path d="M3 19h18" />
    </svg>
  );
}

function CameraIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8h4l2-3h4l2 3h4v11H4z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}

const STATUS_STYLES = {
  idle: "border-slate-200 bg-slate-50 text-slate-600",
  loading: "border-cyan-200 bg-cyan-50 text-cyan-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-rose-200 bg-rose-50 text-rose-700",
};

const CAMERA_LABEL_PATTERN = /(back|rear|environment|trasera|posterior)/i;

const getCameraErrorMessage = (error) => {
  const detail = error?.message || String(error || "");
  if (/permission|denied|notallowed/i.test(detail)) {
    return "Permiso de camara rechazado. Habilita la camara en el navegador.";
  }
  if (/notfound|not found|devices? found|no camera/i.test(detail)) {
    return "No se encontro una camara disponible.";
  }
  if (/notreadable|could not start|source|trackstart/i.test(detail)) {
    return "No se pudo iniciar la camara. Cierra otras apps que usen la camara y vuelve a intentar.";
  }
  return detail || "Sin permiso de camara o camara no disponible.";
};

export default function BarcodeScannerInput({
  label = "Escanear codigo de barras",
  placeholder = "Escanea o escribe SKU y presiona Enter",
  buttonLabel = "Escanear con camara",
  onScan,
  disabled = false,
  autoFocus = false,
  className = "",
}) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState({ type: "idle", text: "Listo para escanear." });
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("Preparando camara...");
  const scannerRef = useRef(null);
  const inputRef = useRef(null);
  const readerIdRef = useRef(`barcode-reader-${Math.random().toString(36).slice(2)}`);
  const processingRef = useRef(false);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!cameraOpen) return undefined;
    let cancelled = false;

    const startScanner = async () => {
      try {
        setCameraStatus("Solicitando permiso de camara...");
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("La camara solo funciona en localhost o HTTPS.");
        }

        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;

        const formatsToSupport = [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.QR_CODE,
        ];
        const cameras = await Html5Qrcode.getCameras();
        if (cancelled) return;
        if (!cameras.length) {
          throw new Error("No se encontro una camara disponible.");
        }

        const orderedCameras = [
          ...cameras.filter((camera) => CAMERA_LABEL_PATTERN.test(camera.label || "")),
          ...cameras.filter((camera) => !CAMERA_LABEL_PATTERN.test(camera.label || "")),
        ];
        let lastError = null;

        for (const camera of orderedCameras) {
          if (cancelled) return;
          try {
            await stopScanner();
            const scanner = new Html5Qrcode(readerIdRef.current, {
              verbose: false,
              formatsToSupport,
              useBarCodeDetectorIfSupported: true,
            });
            scannerRef.current = scanner;
            setCameraStatus(`Iniciando ${camera.label || "camara disponible"}...`);
            await scanner.start(
              camera.id,
              { fps: 10, qrbox: { width: 300, height: 160 }, disableFlip: false },
              async (decodedText) => {
                if (processingRef.current) return;
                processingRef.current = true;
                await stopScanner();
                setCameraOpen(false);
                await submitCode(decodedText);
                processingRef.current = false;
              },
              () => {}
            );
            setCameraStatus(`Camara lista: ${camera.label || "camara disponible"}. Apunta al codigo de barras.`);
            return;
          } catch (error) {
            lastError = error;
            await stopScanner();
          }
        }

        throw lastError || new Error("No se pudo iniciar ninguna camara.");
      } catch (error) {
        console.error("Error al iniciar lector de codigo:", error);
        const message = getCameraErrorMessage(error);
        setCameraStatus(message);
        setStatus({ type: "error", text: message });
        setCameraOpen(false);
      }
    };

    startScanner();
    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [cameraOpen]);

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
      await scanner.clear();
    } catch {
      // Camera cleanup can throw if browser already released stream.
    }
  };

  const submitCode = async (rawCode = code) => {
    const normalized = String(rawCode || "").trim();
    if (!normalized || disabled) return;
    setCode(normalized);
    setStatus({ type: "loading", text: "Buscando producto..." });
    try {
      await onScan(normalized);
      setStatus({ type: "success", text: "Producto encontrado." });
      setCode("");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } catch (error) {
      setStatus({ type: "error", text: error?.message || "No encontrado." });
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submitCode();
  };

  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
          <BarcodeIcon className="h-4 w-4 text-teal-700" />
          {label}
        </label>
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          disabled={disabled}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CameraIcon className="h-4 w-4" />
          {buttonLabel}
        </button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-900 outline-none transition placeholder:font-sans placeholder:text-slate-400 focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-500"
        />
        <button
          type="button"
          onClick={() => submitCode()}
          disabled={disabled || !code.trim()}
          className="h-11 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Buscar
        </button>
      </div>
      <p className={`mt-2 rounded-xl border px-3 py-2 text-xs font-semibold ${STATUS_STYLES[status.type] || STATUS_STYLES.idle}`}>
        {status.text}
      </p>

      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-950">Escanear codigo</h3>
                <p className="text-sm text-slate-500">{cameraStatus}</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await stopScanner();
                  setCameraOpen(false);
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
            <div id={readerIdRef.current} className="min-h-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950" />
          </div>
        </div>
      )}
    </section>
  );
}
