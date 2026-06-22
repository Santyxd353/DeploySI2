import { useState, useEffect, useCallback } from "react";
import { backupService } from "../../services/backupService";
import AdminLayout from "../../components/admin/AdminLayout";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  DatabaseIcon,
  SaveIcon,
  LoaderIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  HistoryIcon,
  RestoreIcon,
} from "../../components/ui/Icons";
import BackupScheduleForm from "../../components/admin/BackupScheduleForm";

export default function AdminBackupsPage() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  // Estado para el modal de confirmación de restauración
  const [confirmModal, setConfirmModal] = useState({ open: false, backup: null });
  const [restoring, setRestoring] = useState(false);

  const cargarHistorial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await backupService.getHistorial();
      setBackups(data);
    } catch (err) {
      setError(err?.detail || "Error al cargar el historial");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  const handleCrearBackup = async () => {
    setCreating(true);
    setMensaje(null);
    setError(null);
    try {
      const response = await backupService.crearBackup();
      setMensaje(response.message || "Backup creado exitosamente");
      setTimeout(() => {
        cargarHistorial();
      }, 1000);
    } catch (err) {
      setError(err?.error || "Error al crear el backup");
    } finally {
      setCreating(false);
    }
  };

  const handleRestaurar = async () => {
    if (!confirmModal.backup) return;
    setRestoring(true);
    setMensaje(null);
    setError(null);
    try {
      const response = await backupService.restaurarBackup(confirmModal.backup.id);
      setMensaje(response.message || "Restauración completada exitosamente");
      setConfirmModal({ open: false, backup: null });
      cargarHistorial();
    } catch (err) {
      setError(err?.error || "Error al restaurar el backup");
      setConfirmModal({ open: false, backup: null });
    } finally {
      setRestoring(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return "-";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("es-BO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              <DatabaseIcon className="inline-block w-8 h-8 mr-2 text-blue-600" />
              Gestión de Backups
            </h1>
            <p className="text-gray-500 mt-1">
              Crea y administra copias de seguridad de la base de datos y archivos multimedia
            </p>
          </div>
          <Button
            onClick={handleCrearBackup}
            disabled={creating}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-lg"
          >
            {creating ? (
              <>
                <LoaderIcon className="animate-spin -ml-1 mr-2 h-5 w-5" />
                Creando backup...
              </>
            ) : (
              <>
                <SaveIcon className="-ml-1 mr-2 h-5 w-5" />
                Crear Backup Ahora
              </>
            )}
          </Button>
        </div>

        {mensaje && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
            <AlertDescription className="text-green-800">{mensaje}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert className="bg-red-50 border-red-200">
            <AlertTriangleIcon className="h-5 w-5 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <HistoryIcon className="h-5 w-5" />
              Historial de Backups
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <LoaderIcon className="animate-spin h-8 w-8 text-blue-600" />
                <span className="ml-2 text-gray-500">Cargando historial...</span>
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <DatabaseIcon className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2">No hay backups registrados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tamaño
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Archivo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Error
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {backups.map((backup) => (
                      <tr key={backup.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {formatDate(backup.timestamp)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              backup.backup_type === "manual"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {backup.backup_type === "manual" ? "Manual" : "Automático"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-sm ${
                              backup.status === "success" ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {backup.status === "success" ? (
                              <CheckCircleIcon className="h-4 w-4" />
                            ) : (
                              <AlertTriangleIcon className="h-4 w-4" />
                            )}
                            {backup.status === "success" ? "Éxito" : "Fallido"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {formatBytes(backup.file_size)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {backup.file_path ? (
                            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                              {backup.file_path.split("/").pop()}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-red-500 max-w-xs truncate">
                          {backup.error_message || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {backup.status === "success" && backup.file_path ? (
                            <button
                              onClick={() => setConfirmModal({ open: true, backup })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors"
                            >
                              <RestoreIcon className="h-3.5 w-3.5" />
                              Restaurar
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        <BackupScheduleForm />
      </div>

      {/* Modal de confirmación de restauración */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangleIcon className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">¿Restaurar este backup?</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Esta acción reemplazará los datos actuales de tu farmacia con los datos del backup seleccionado.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 space-y-1">
              <p className="font-semibold">⚠ Advertencias importantes:</p>
              <ul className="list-disc list-inside space-y-1 text-amber-700">
                <li>Los datos actuales serán reemplazados por los del backup.</li>
                <li>Esta acción no se puede deshacer.</li>
                <li>Se recomienda crear un backup actual antes de restaurar.</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              <span className="font-medium">Backup a restaurar: </span>
              {formatDate(confirmModal.backup?.timestamp)}
              <span className="ml-2 text-gray-400">
                ({formatBytes(confirmModal.backup?.file_size)})
              </span>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setConfirmModal({ open: false, backup: null })}
                disabled={restoring}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRestaurar}
                disabled={restoring}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {restoring ? (
                  <>
                    <LoaderIcon className="animate-spin mr-2 h-4 w-4" />
                    Restaurando...
                  </>
                ) : (
                  <>
                    <RestoreIcon className="mr-2 h-4 w-4" />
                    Sí, restaurar ahora
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}