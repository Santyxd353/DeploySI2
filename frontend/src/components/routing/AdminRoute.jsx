import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Card, CardContent } from "../ui/card";

export default function AdminRoute() {
  const { user, loading, hasPermission } = useAuth();

  const hasBackofficeAccess =
    hasPermission("usuarios.ver") ||
    hasPermission("productos.ver") ||
    hasPermission("laboratorios.ver") ||
    hasPermission("categorias.ver") ||
    hasPermission("subcategorias.ver") ||
    hasPermission("inventario.ver") ||
    hasPermission("pedidos.ver") ||
    hasPermission("ventas.ver") ||
    hasPermission("reportes.ver") ||
    hasPermission("tratamientos.ver") ||
    hasPermission("clientes.ver");

  if (loading) {
    return (
      <main className="farm-bg flex min-h-screen items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Validando sesion...</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!hasBackofficeAccess) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
