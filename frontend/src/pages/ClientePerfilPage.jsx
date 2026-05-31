import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { clientesService } from "../services/clientesService";
import HistorialComprasPanel from "../components/crm/HistorialComprasPanel";

export default function ClientePerfilPage() {
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const [clienteId, setClienteId] = useState(null);
  const [loadingCliente, setLoadingCliente] = useState(false);

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

            {/* Historial de compras */}
            {clienteId && (
              <div className="mt-8 border-t border-slate-100 pt-6">
                <h2 className="mb-4 text-lg font-bold text-slate-900">Mis compras</h2>
                <HistorialComprasPanel clienteId={clienteId} />
              </div>
            )}
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
            <Button onClick={handleLogout} className="bg-rose-600 text-white hover:bg-rose-500">
              Cerrar sesion
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
