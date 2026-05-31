import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/routing/ProtectedRoute";
import AdminRoute from "./components/routing/AdminRoute";
import POSRoute from "./components/routing/POSRoute";
import PageLoader from "./components/routing/PageLoader";
import { getTenantSubdomain } from "./services/apiClient";

// Lazy-loaded pages
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminRolesPermisosPage = lazy(() => import("./pages/admin/AdminRolesPermisosPage"));
const AdminInventariosPage = lazy(() => import("./pages/admin/AdminInventariosPage"));
const InventoryProductDetailPage = lazy(() => import("./pages/admin/InventoryProductDetailPage"));
const AdminProductosPage = lazy(() => import("./pages/admin/AdminProductosPage"));
const AdminLaboratariosPage = lazy(() => import("./pages/admin/AdminLaboratoriosPage"));
const AdminCategoriasPage = lazy(() => import("./pages/admin/AdminCategoriasPage"));
const AdminClientesPage = lazy(() => import("./pages/admin/AdminClientesPage"));
const AdminPuntosPage = lazy(() => import("./pages/admin/AdminPuntosPage"));
const RecetasPage = lazy(() => import("./pages/admin/RecetasPage"));
const AdminBitacoraPage = lazy(() => import("./pages/admin/AdminBitacoraPage"));
const AdminBackupsPage = lazy(() => import("./pages/admin/AdminBackupsPage"));
const AdminPrediccionesPage = lazy(() => import("./pages/admin/AdminPrediccionesPage"));
const AdminReportesPage = lazy(() => import("./pages/admin/AdminReportesPage"));
const AdminTratamientosPage = lazy(() => import("./pages/admin/AdminTratamientosPage"));
const ClientePerfilPage = lazy(() => import("./pages/ClientePerfilPage"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));
const VerifyEmailPage = lazy(() => import("./pages/auth/VerifyEmailPage"));
const POSPage = lazy(() => import("./pages/pos/POSPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const SaaSLandingPage = lazy(() => import("./pages/saas/SaaSLandingPage"));
const RegisterTenantPage = lazy(() => import("./pages/saas/RegisterTenantPage"));
const GlobalLoginPage = lazy(() => import("./pages/saas/GlobalLoginPage"));
const TenantSubscriptionPage = lazy(() => import("./pages/admin/TenantSubscriptionPage"));
const GlobalTenantsPage = lazy(() => import("./pages/admin/GlobalTenantsPage"));
const SegmentacionClientesPage = lazy(() => import("./pages/admin/SegmentacionClientesPage"));

function App() {
  const hasTenantSubdomain = Boolean(getTenantSubdomain());

  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Rutas públicas */}
            <Route path="/" element={hasTenantSubdomain ? <HomePage /> : <SaaSLandingPage />} />
            <Route path="/saas/register-farmacia" element={<RegisterTenantPage />} />
            <Route path="/saas/login" element={<GlobalLoginPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />

            {/* Rutas protegidas para clientes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/perfil" element={<ClientePerfilPage />} />
            </Route>

            {/* Rutas de administración */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<Navigate to="/admin/resumen" replace />} />
              <Route path="/admin/resumen" element={<AdminDashboardPage />} />
              <Route path="/admin/usuarios" element={<AdminUsersPage />} />
              <Route path="/admin/roles-permisos" element={<AdminRolesPermisosPage />} />
              <Route path="/admin/inventarios" element={<AdminInventariosPage />} />
              <Route path="/admin/inventarios/producto/:id" element={<InventoryProductDetailPage />} />
              <Route path="/admin/productos" element={<AdminProductosPage />} />
              <Route path="/admin/categorias" element={<AdminCategoriasPage />} />
              <Route path="/admin/laboratorios" element={<AdminLaboratariosPage />} />
              <Route path="/admin/clientes" element={<AdminClientesPage />} />
              <Route path="/admin/puntos" element={<AdminPuntosPage />} />
              <Route path="/admin/recetas" element={<RecetasPage />} />
              <Route path="/admin/bitacora" element={<AdminBitacoraPage />} />
              <Route path="/admin/backups" element={<AdminBackupsPage />} />
              <Route path="/admin/predicciones" element={<AdminPrediccionesPage />} />
              <Route path="/admin/reportes" element={<AdminReportesPage />} />
              <Route path="/admin/tratamientos" element={<AdminTratamientosPage />} />
              <Route path="/admin/suscripcion" element={<TenantSubscriptionPage />} />
              <Route path="/admin/global/tenants" element={<GlobalTenantsPage />} />
              <Route path="/admin/segmentacion-clientes" element={<SegmentacionClientesPage />} />
            </Route>

            {/* Punto de venta (POS) */}
            <Route element={<POSRoute />}>
              <Route path="/pos" element={<POSPage />} />
            </Route>

            {/* Ruta comodín */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
