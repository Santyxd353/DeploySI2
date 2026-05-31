import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { puntosService } from "../services/puntosService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { SparkIcon, HistoryIcon } from "../components/ui/Icons";

const NIVEL_LABEL = { bronce: "Bronce", plata: "Plata", oro: "Oro", diamante: "Diamante" };
const NIVEL_PROXIMO = { bronce: "Plata", plata: "Oro", oro: "Diamante", diamante: null };
const NIVEL_UMBRAL = { bronce: 500, plata: 2000, oro: 10000, diamante: null };
const TIPO_LABEL = {
  descuento_compra: "Descuento en compra",
  producto_farmacia: "Producto gratis",
  cupon_externo: "Cupon externo",
};

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl bg-slate-100 p-6">
      <div className="mb-4 h-4 w-1/3 rounded bg-slate-200" />
      <div className="h-8 w-1/2 rounded bg-slate-200" />
    </div>
  );
}

export default function MisPuntosPage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [cuenta, setCuenta] = useState(null);
  const [config, setConfig] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canjeando, setCanjeando] = useState(null);
  const [voucher, setVoucher] = useState(null);
  const [canjeError, setCanjeError] = useState("");

  useEffect(() => {
    if (isAdmin) navigate("/admin", { replace: true });
  }, [isAdmin, navigate]);

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      puntosService.miCuenta(),
      puntosService.historialMiCuenta(),
      puntosService.catalogoPublico(),
    ])
      .then(([miCuentaData, histData, catData]) => {
        setCuenta(miCuentaData.cuenta || null);
        setConfig(miCuentaData.configuracion || null);
        const hist = puntosService.normalizeList(histData);
        setHistorial(hist.results.slice(0, 20));
        const cat = puntosService.normalizeList(catData);
        setCatalogo(cat.results);
      })
      .catch(() => setError("No se pudo cargar tu informacion de puntos. Intentalo de nuevo."))
      .finally(() => setLoading(false));
  }, []);

  const nivel = cuenta?.nivel || "bronce";
  const nivelLabel = NIVEL_LABEL[nivel] || "Bronce";
  const nivelProximo = NIVEL_PROXIMO[nivel];
  const umbralProximo = NIVEL_UMBRAL[nivel];
  const saldo = cuenta?.puntos_disponibles ?? 0;
  const acumulados = cuenta?.puntos_acumulados ?? cuenta?.total_puntos_ganados ?? 0;

  const progresoNivel = useMemo(() => {
    if (!umbralProximo) return 100;
    return Math.min(100, Math.round((saldo / umbralProximo) * 100));
  }, [saldo, umbralProximo]);

  const handleCanjear = async (item) => {
    if (canjeando) return;
    setCanjeError("");
    setVoucher(null);
    setCanjeando(item.id);
    try {
      const resultado = await puntosService.canjear(item.id);
      setVoucher(resultado);
      const nuevaMiCuenta = await puntosService.miCuenta();
      setCuenta(nuevaMiCuenta.cuenta || null);
      setConfig(nuevaMiCuenta.configuracion || null);
      const hist = puntosService.normalizeList(await puntosService.historialMiCuenta());
      setHistorial(hist.results.slice(0, 20));
    } catch (err) {
      const msg =
        err?.detail || err?.message || "No se pudo completar el canje. Verifica tu saldo.";
      setCanjeError(String(msg));
    } finally {
      setCanjeando(null);
    }
  };

  return (
    <main className="farm-bg min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
              Farmacia SaludPlus
            </p>
            <h1 className="text-2xl font-black text-slate-900">Mis puntos</h1>
            <p className="text-sm text-slate-500">Revisa tu saldo, historial y catalogo de premios.</p>
          </div>
          <Link
            to="/perfil"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Volver al perfil
          </Link>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        {/* Tarjeta principal */}
        {loading ? (
          <SkeletonCard />
        ) : (
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-cyan-700 via-sky-700 to-indigo-700 text-white shadow-xl shadow-sky-200/40">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                  <SparkIcon className="h-6 w-6" />
                </div>
                <div>
                  <CardDescription className="text-cyan-100">Programa de fidelidad</CardDescription>
                  <CardTitle className="text-white">Tu cuenta de puntos</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-100">
                    Saldo disponible
                  </p>
                  <p className="mt-1 text-4xl font-black">{saldo}</p>
                  <p className="text-xs text-cyan-200">puntos</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-100">
                    Acumulados totales
                  </p>
                  <p className="mt-1 text-4xl font-black">{acumulados}</p>
                  <p className="text-xs text-cyan-200">en toda tu historia</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-100">
                    Nivel actual
                  </p>
                  <p className="mt-1 text-4xl font-black">{nivelLabel}</p>
                  {config && (
                    <p className="text-xs text-cyan-200">
                      Bs {Number(config.bolivianos_por_punto).toFixed(2)} = 1 punto
                    </p>
                  )}
                </div>
              </div>

              {/* Progreso al siguiente nivel */}
              {nivelProximo && (
                <div className="rounded-2xl bg-white/10 p-4">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-cyan-100">
                    <span>Progreso hacia nivel {nivelProximo}</span>
                    <span>
                      {saldo} / {umbralProximo} pts
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-white transition-all duration-500"
                      style={{ width: `${progresoNivel}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-cyan-200">
                    Te faltan {Math.max(0, umbralProximo - saldo)} puntos para llegar a {nivelProximo}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          {/* Historial */}
          <Card className="shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <HistoryIcon className="h-5 w-5 text-slate-500" />
                <CardTitle className="text-lg">Historial reciente</CardTitle>
              </div>
              <CardDescription>Ultimos 20 movimientos de tus puntos</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse rounded-xl bg-slate-100 p-4 h-16" />
                  ))}
                </div>
              ) : historial.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Todavia no tienes movimientos. ¡Realiza tu primera compra para ganar puntos!
                </p>
              ) : (
                <div className="space-y-2">
                  {historial.map((mov) => (
                    <div
                      key={mov.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {mov.descripcion || mov.tipo}
                        </p>
                        <p className="text-xs text-slate-400">{formatDateTime(mov.creado_en)}</p>
                      </div>
                      <span
                        className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${
                          mov.puntos >= 0
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {mov.puntos >= 0 ? "+" : ""}
                        {mov.puntos} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Catalogo de recompensas */}
          <Card className="shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <SparkIcon className="h-5 w-5 text-cyan-600" />
                <CardTitle className="text-lg">Catalogo de premios</CardTitle>
              </div>
              <CardDescription>Canjea tus puntos por recompensas</CardDescription>
            </CardHeader>
            <CardContent>
              {canjeError && (
                <div className="mb-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {canjeError}
                </div>
              )}

              {voucher && (
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <p className="text-sm font-black text-emerald-800">¡Canje exitoso!</p>
                  {voucher.codigo_voucher && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-emerald-600">Tu codigo de voucher:</p>
                      <p className="mt-1 rounded-lg bg-white px-3 py-2 font-mono text-lg font-black text-emerald-700 tracking-widest">
                        {voucher.codigo_voucher}
                      </p>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-emerald-600">
                    Presenta este codigo al momento de tu proxima compra.
                  </p>
                  <button
                    className="mt-2 text-xs font-semibold text-emerald-700 underline"
                    onClick={() => setVoucher(null)}
                  >
                    Cerrar
                  </button>
                </div>
              )}

              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="animate-pulse rounded-xl bg-slate-100 p-4 h-20" />
                  ))}
                </div>
              ) : catalogo.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No hay recompensas disponibles en este momento. ¡Sigue acumulando puntos!
                </p>
              ) : (
                <div className="space-y-3">
                  {catalogo.map((item) => {
                    const tieneStock = item.stock_disponible === null || item.stock_disponible === undefined || item.stock_disponible > 0;
                    const tienePuntos = saldo >= item.puntos_requeridos;
                    const puntasFaltantes = Math.max(0, item.puntos_requeridos - saldo);
                    const disabled = !tienePuntos || !tieneStock || canjeando === item.id;

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-slate-800">{item.nombre}</p>
                              <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-700">
                                {TIPO_LABEL[item.tipo] || item.tipo}
                              </span>
                            </div>
                            {item.descripcion && (
                              <p className="mt-0.5 text-xs text-slate-500">{item.descripcion}</p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-black text-indigo-700">{item.puntos_requeridos} pts</span>
                              {item.stock_disponible !== null && item.stock_disponible !== undefined && (
                                <span className={`font-semibold ${item.stock_disponible > 0 ? "text-slate-400" : "text-rose-500"}`}>
                                  {item.stock_disponible > 0 ? `Stock: ${item.stock_disponible}` : "Sin stock"}
                                </span>
                              )}
                              {!tienePuntos && (
                                <span className="text-amber-600 font-semibold">
                                  Te faltan {puntasFaltantes} pts
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={disabled}
                            onClick={() => handleCanjear(item)}
                            className="shrink-0 bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-40"
                          >
                            {canjeando === item.id ? "Canjeando..." : "Canjear"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
