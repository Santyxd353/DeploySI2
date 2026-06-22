import { useEffect, useState } from "react";
import { requestJson } from "../../services/apiClient";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

export default function BackupScheduleForm() {
  const [schedule, setSchedule] = useState(null);
  const [form, setForm] = useState({
    frequency: "daily",
    time_of_day: "02:00",
    day_of_week: "",
    day_of_month: "",
    cron_expression: "",
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Cargar configuración existente (un schedule por tenant)
  useEffect(() => {
    requestJson("/api/backups/schedule/")
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const scheduleData = data[0];
          setSchedule(scheduleData);
          setForm({
            frequency: scheduleData.frequency,
            time_of_day: scheduleData.time_of_day || "02:00",
            day_of_week: scheduleData.day_of_week || "",
            day_of_month: scheduleData.day_of_month || "",
            cron_expression: scheduleData.cron_expression || "",
            is_active: scheduleData.is_active,
          });
        }
      })
      .catch((err) => console.error("Error loading schedule", err));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      // Normalizar payload: convertir cadenas vacías a null para campos numéricos/optativos
      const payload = {
        ...form,
        day_of_week: form.day_of_week === "" ? null : form.day_of_week,
        day_of_month: form.day_of_month === "" ? null : form.day_of_month,
        time_of_day: form.time_of_day === "" ? null : form.time_of_day,
        cron_expression: form.cron_expression === "" ? null : form.cron_expression,
      };

      let data;
      if (schedule) {
        // Actualizar existente
        data = await requestJson(`/api/backups/schedule/${schedule.id}/`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMessage({ type: "success", text: "Programación actualizada correctamente" });
      } else {
        // Crear nuevo
        data = await requestJson("/api/backups/schedule/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSchedule(data);
        setMessage({ type: "success", text: "Programación creada correctamente" });
      }

      // Recargar para ver next_run actualizado
      const refreshData = await requestJson("/api/backups/schedule/");
      if (Array.isArray(refreshData) && refreshData.length > 0) {
        setSchedule(refreshData[0]);
      }
    } catch (error) {
      setMessage({ type: "error", text: error?.detail || "Error al guardar la configuración" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-6">
      <h2 className="text-xl font-semibold mb-4">Programar backup automático</h2>
      {message && (
        <div
          className={`p-3 mb-4 rounded ${
            message.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Frecuencia */}
        <div>
          <Label htmlFor="frequency">Frecuencia</Label>
          <select
            id="frequency"
            name="frequency"
            value={form.frequency}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="hourly">Cada hora</option>
            <option value="daily">Diario</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensual</option>
            <option value="custom">Expresión cron personalizada</option>
          </select>
        </div>

        {/* Hora del día (excepto hourly y custom) */}
        {!["hourly", "custom"].includes(form.frequency) && (
          <div>
            <Label htmlFor="time_of_day">Hora del día</Label>
            <Input
              type="time"
              id="time_of_day"
              name="time_of_day"
              value={form.time_of_day}
              onChange={handleChange}
            />
          </div>
        )}

        {/* Día de la semana (weekly) */}
        {form.frequency === "weekly" && (
          <div>
            <Label htmlFor="day_of_week">Día de la semana</Label>
            <select
              id="day_of_week"
              name="day_of_week"
              value={form.day_of_week}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">-- Seleccionar --</option>
              <option value="0">Domingo</option>
              <option value="1">Lunes</option>
              <option value="2">Martes</option>
              <option value="3">Miércoles</option>
              <option value="4">Jueves</option>
              <option value="5">Viernes</option>
              <option value="6">Sábado</option>
            </select>
          </div>
        )}

        {/* Día del mes (monthly) */}
        {form.frequency === "monthly" && (
          <div>
            <Label htmlFor="day_of_month">Día del mes</Label>
            <select
              id="day_of_month"
              name="day_of_month"
              value={form.day_of_month}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">-- Seleccionar --</option>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Expresión cron (custom) */}
        {form.frequency === "custom" && (
          <div>
            <Label htmlFor="cron_expression">Expresión cron</Label>
            <Input
              type="text"
              id="cron_expression"
              name="cron_expression"
              placeholder="Ej: 0 2 * * *"
              value={form.cron_expression}
              onChange={handleChange}
            />
            <p className="text-sm text-gray-500 mt-1">
              Formato: minuto hora día(mes) mes día(semana). Ej: 0 2 * * * → todos los
              días a las 2 AM.
            </p>
          </div>
        )}

        {/* Activo */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            checked={form.is_active}
            onChange={handleChange}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
          />
          <Label htmlFor="is_active">Activar respaldo automático</Label>
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : "Guardar configuración"}
        </Button>
      </form>

      {schedule && (
        <div className="mt-4 text-sm text-gray-600">
          {schedule.last_run && (
            <p>
              Última ejecución: {new Date(schedule.last_run).toLocaleString()}
            </p>
          )}
          {schedule.next_run && (
            <p>
              Próxima ejecución: {new Date(schedule.next_run).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}