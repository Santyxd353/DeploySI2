import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import HistorialComprasPanel from "../components/crm/HistorialComprasPanel";

function BackIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ShoppingBagIcon({ className = "h-6 w-6" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  );
}

/**
 * HU-18: Página "Mis Compras" para ROLE_CLIENTE.
 * Muestra el historial de ventas del cliente autenticado con paginación y filtros.
 * El backend infiere el cliente a partir del JWT — no se necesita cliente_id.
 */
export default function MisComprasPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <main className="farm-bg min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/perfil"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <BackIcon className="h-4 w-4" />
            Mi perfil
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Card principal */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          {/* Card header */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-700 to-violet-700 px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
                <ShoppingBagIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-200">
                  Farmacia SaludPlus
                </p>
                <h1 className="text-xl font-black">Mis compras</h1>
              </div>
            </div>
            {user ? (
              <p className="mt-2 text-sm text-indigo-200">
                {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || user.email}
              </p>
            ) : null}
          </div>

          {/* Historial con paginación — sin clienteId: el backend usa el JWT */}
          <div className="p-5 sm:p-6">
            <HistorialComprasPanel pageSize={10} />
          </div>

        </div>

        {/* Footer links */}
        <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm">
          <Link to="/" className="text-slate-500 transition hover:text-indigo-600">
            Ir a la tienda
          </Link>
          <span className="text-slate-300">·</span>
          <Link to="/perfil" className="text-slate-500 transition hover:text-indigo-600">
            Mi perfil
          </Link>
          <span className="text-slate-300">·</span>
          <Link to="/tratamientos" className="text-slate-500 transition hover:text-indigo-600">
            Mis tratamientos
          </Link>
        </div>

      </div>
    </main>
  );
}
