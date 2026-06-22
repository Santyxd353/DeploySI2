import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function POSRoute() {
  const { user, loading, hasPermission } = useAuth();

  const canAccessPOS =
    hasPermission("ventas.gestionar") ||
    user?.role === "cajero" ||
    user?.role === "farmaceutico" ||
    user?.role === "admin";

  if (loading) {
    return (
      <main className="farm-bg flex min-h-screen items-center justify-center px-4 py-10">
        <p className="text-sm text-slate-500">Verificando acceso...</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessPOS) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
