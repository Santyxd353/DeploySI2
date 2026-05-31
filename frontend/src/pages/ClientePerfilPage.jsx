import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { clientesService } from "../services/clientesService";
import { puntosService } from "../services/puntosService";
import HistorialComprasPanel from "../components/crm/HistorialComprasPanel";
import { SparkIcon } from "../components/ui/Icons";

export default function ClientePerfilPage() {
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const [clienteId, setClienteId] = useState(null);
  const [loadingCliente, setLoadingCliente] = useState(false);
  const [puntosCuenta, setPuntosCuenta] = useState(null);
  const [puntosConfig, setPuntosConfig] = useState(null);
  const [loadingPuntos, setLoadingPuntos] = useState(true);

  // Obtener el cliente asociado al usuario logueado
  useEffect(() => {
    if (user && user.id) {
      setLoadingCliente(true);
      clientesService
        .listar({ usuario: user.id })
        .then((res) => {
          const clientes = Array.isArray(res) ? res : res.results || [];
          if (clientes.length > 0) {
            setClienteId(clientes[0].id);
          }
        })
        .catch(() => {
          setClienteId(null);
        })
        .finally(() => setLoadingCliente(false));
    }
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    setLoadingPuntos(true);
    puntosService.miCuenta()
      .then((data) => {
        setPuntosCuenta(data.cuenta || null);
        setPuntosConfig(data.configuracion || null);
      })
      .catch(() => {})
      .finally(() => setLoadingPuntos(false));
  }, []);

  const fullName = useMemo(() => {
    return [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  }, [user]);

  const displayName = useMemo(() => {
    return fullName || user?.username || "Cliente";
  }, [fullName, user]);

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <main className="farm-bg min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(240,249,255,0.92))]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">Farmacia SaludPlus</p>
            <CardTitle>Mi cuenta</CardTitle>
            <CardDescription>Toda tu informacion personal en un solo lugar.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 pt-6">
            <div className="grid gap-3 sm:grid-cols-2">
                <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{displayName}</p>
                </article>
                <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Correo</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{user?.email || "Sin correo"}</p>
                </article>
                <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Usuario</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{user?.username || "Sin usuario"}</p>
                </article>
                <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de cuenta</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">Cliente</p>
                </article>
              </div>

            {/* Tarjeta de puntos */}
            <div className="mt-6">
              <Card className="overflow-hidden border-0 bg-gradient-to-br from-cyan-700 via-sky-700 to-indigo-700 text-white shadow-xl shadow-sky-200/40">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                        <SparkIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardDescription className="text-cyan-100">Programa de fidelidad</CardDescription>
                        <CardTitle className="text-white">Mis puntos</CardTitle>
                      </div>
                    </div>
                    <Link
                      to="/mis-puntos"
                      className="shrink-0 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/30"
                    >
                      Ver catalogo
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-100">Saldo disponible</p>
                    <p className="mt-1 text-3xl font-black">
                      {loadingPuntos ? "..." : (puntosCuenta?.puntos_disponibles ?? 0)}
                    </p>
                    <p className="mt-0.5 text-xs text-cyan-200">puntos</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-100">Nivel</p>
                    <p className="mt-1 text-3xl font-black">
                      {loadingPuntos
                        ? "..."
                        : { bronce: "Bronce", plata: "Plata", oro: "Oro", diamante: "Diamante" }[puntosCuenta?.nivel] || "Bronce"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-100">Regla de canje</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-white/90">
                      {puntosConfig
                        ? `Bs ${Number(puntosConfig.bolivianos_por_punto).toFixed(2)} = 1 punto`
                        : "Bs 10 = 1 punto"}
                    </p>
                    <p className="text-xs text-cyan-100">
                      {puntosConfig
                        ? `Min. ${puntosConfig.puntos_minimos_canje} pts para canjear`
                        : "100 puntos minimos"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

          
          </CardContent>

          <CardFooter className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/60 py-4">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Volver al inicio
            </Link>
            <Link
              to="/mis-compras"
              className="inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              Mis compras
            </Link>
            <Link
              to="/mis-puntos"
              className="inline-flex items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100"
            >
              Mis puntos
            </Link>
            <Button onClick={handleLogout} className="bg-rose-600 text-white hover:bg-rose-500">
              Cerrar sesion
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
