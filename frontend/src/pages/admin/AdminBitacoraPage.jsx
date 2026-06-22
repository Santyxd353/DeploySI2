import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import BitacoraView from "../../components/admin/BitacoraView";
import { useAuth } from "../../context/AuthContext";

export default function AdminBitacoraPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <AdminLayout
      activeSection="bitacora"
      currentUser={user}
      onLogout={handleLogout}
    >
      <BitacoraView />
    </AdminLayout>
  );
}
