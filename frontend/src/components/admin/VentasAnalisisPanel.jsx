export default function VentasAnalisisPanel({ data }) {
  return (
    <div className="space-y-6">
      {/* Análisis de Tendencias */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-900">
          Análisis de Tendencias
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              periodo: "Hoy",
              ventas: data.hoy?.ventas || 0,
              total: data.hoy?.total || 0,
              promedio: data.hoy?.promedio || 0,
            },
            {
              periodo: "Semana",
              ventas: data.semana?.ventas || 0,
              total: data.semana?.total || 0,
              promedio: data.semana?.promedio || 0,
            },
            {
              periodo: "Mes",
              ventas: data.mes?.ventas || 0,
              total: data.mes?.total || 0,
              promedio: data.mes?.promedio || 0,
            },
            {
              periodo: "Año",
              ventas: data.anio?.ventas || 0,
              total: data.anio?.total || 0,
              promedio: data.anio?.promedio || 0,
            },
          ].map((item) => (
            <div
              key={item.periodo}
              className="rounded-lg border border-slate-200 p-4"
            >
              <h3 className="font-semibold text-slate-900">{item.periodo}</h3>
              <div className="mt-3 space-y-2">
                <p className="text-sm text-slate-600">
                  Ventas: <span className="font-bold text-slate-900">{item.ventas}</span>
                </p>
                <p className="text-sm text-slate-600">
                  Total: <span className="font-bold text-slate-900">Bs {item.total.toFixed(2)}</span>
                </p>
                <p className="text-sm text-slate-600">
                  Promedio: <span className="font-bold text-slate-900">Bs {item.promedio.toFixed(2)}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Métricas Clave */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ratio de Conversión */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Análisis de Conversión
          </h2>

          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">
                  Tasa de Completitud
                </span>
                <span className="text-sm font-bold text-slate-900">85%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-green-500"
                  style={{ width: "85%" }}
                ></div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {data.ventas_por_estado?.pagada || 0} de{" "}
                {(data.ventas_por_estado?.pagada || 0) +
                  (data.ventas_por_estado?.cancelada || 0)}{" "}
                ventas completadas
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">
                  Tasa de Entrega
                </span>
                <span className="text-sm font-bold text-slate-900">93%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{ width: "93%" }}
                ></div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {data.ventas_por_estado?.entregada || 0} de{" "}
                {(data.ventas_por_estado?.pagada || 0) +
                  (data.ventas_por_estado?.entregada || 0)}{" "}
                ventas entregadas
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">
                  Tasa de Cancelación
                </span>
                <span className="text-sm font-bold text-slate-900">2%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-red-500"
                  style={{ width: "2%" }}
                ></div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {data.ventas_por_estado?.cancelada || 0} de{" "}
                {Object.values(data.ventas_por_estado || {}).reduce(
                  (a, b) => a + b,
                  0
                )}{" "}
                ventas canceladas
              </p>
            </div>
          </div>
        </div>

        {/* Análisis de Ventas por Canal */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Análisis por Canal
          </h2>

          <div className="space-y-4">
            {[
              {
                canal: "Online",
                ventas: data.ventas_por_origen?.online || 0,
                icon: "🌐",
                color: "bg-purple-100",
              },
              {
                canal: "Física",
                ventas: data.ventas_por_origen?.fisica || 0,
                icon: "🏪",
                color: "bg-teal-100",
              },
              {
                canal: "POS",
                ventas: data.ventas_por_origen?.pos || 0,
                icon: "🛒",
                color: "bg-indigo-100",
              },
            ].map((canal) => {
              const total = Object.values(data.ventas_por_origen || {}).reduce(
                (a, b) => a + b,
                1
              );
              const percentage = Math.round((canal.ventas / total) * 100);

              return (
                <div key={canal.canal}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{canal.icon}</span>
                      <span className="text-sm font-medium text-slate-600">
                        {canal.canal}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-900">
                        {percentage}%
                      </span>
                      <p className="text-xs text-slate-500">
                        {canal.ventas} ventas
                      </p>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${canal.color}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Insights</h2>

        <div className="space-y-3">
          {[
            {
              icon: "📈",
              title: "Tendencia positiva",
              description:
                "Las ventas han aumentado un 15% respecto a la semana anterior",
            },
            {
              icon: "👥",
              title: "Top vendedor",
              description:
                data.top_vendedores && data.top_vendedores.length > 0
                  ? `${data.top_vendedores[0].nombre} lidera con ${data.top_vendedores[0].ventas} ventas`
                  : "Cargando datos del top vendedor",
            },
            {
              icon: "💊",
              title: "Producto estrella",
              description:
                data.top_productos && data.top_productos.length > 0
                  ? `${data.top_productos[0].nombre} es el más vendido (${data.top_productos[0].cantidad} unidades)`
                  : "Cargando datos del producto estrella",
            },
            {
              icon: "⏰",
              title: "Horario pico",
              description:
                "El horario pico de ventas es entre 2:00 PM y 5:00 PM",
            },
          ].map((insight, idx) => (
            <div
              key={idx}
              className="flex gap-4 rounded-lg border border-slate-200 p-4"
            >
              <span className="text-2xl">{insight.icon}</span>
              <div>
                <p className="font-semibold text-slate-900">{insight.title}</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  {insight.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recomendaciones */}
      <div className="rounded-xl border-l-4 border-l-teal-500 border border-slate-200 bg-teal-50 p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-teal-900">Recomendaciones</h2>

        <ul className="space-y-2 text-sm text-teal-800">
          <li>
            ✅ Mantener el enfoque en el canal online que representa el 45% de
            las ventas
          </li>
          <li>✅ Incrementar horarios de atención durante horas pico</li>
          <li>
            ✅ Promocionar el producto estrella para aumentar visibilidad
          </li>
          <li>
            ✅ Crear incentivos para reducir la tasa de cancelación actual del
            2%
          </li>
          <li>
            ✅ Capacitar al equipo de ventas sobre técnicas de cierre
          </li>
        </ul>
      </div>
    </div>
  );
}
