import {
  CalendarIcon,
  CheckCircleIcon,
  ChartBarIcon,
  PackageIcon,
  StoreIcon,
  TrendingUp,
  UsersGroupIcon,
} from "../ui/Icons";

const CANAL_ICONS = {
  Online: ChartBarIcon,
  Física: StoreIcon,
};

export default function VentasAnalisisPanel({ data }) {
  return (
    <div className="space-y-4">
      {/* Análisis de Tendencias */}
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-black text-slate-900">Análisis de Tendencias</h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { periodo: "Hoy", ventas: data.hoy?.ventas || 0, total: data.hoy?.total || 0, promedio: data.hoy?.promedio || 0 },
            { periodo: "Semana", ventas: data.semana?.ventas || 0, total: data.semana?.total || 0, promedio: data.semana?.promedio || 0 },
            { periodo: "Mes", ventas: data.mes?.ventas || 0, total: data.mes?.total || 0, promedio: data.mes?.promedio || 0 },
            { periodo: "Año", ventas: data.anio?.ventas || 0, total: data.anio?.total || 0, promedio: data.anio?.promedio || 0 },
          ].map((item) => (
            <div key={item.periodo} className="rounded-xl border border-slate-200 p-4">
              <h3 className="font-black text-slate-900">{item.periodo}</h3>
              <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                <p>
                  Ventas: <span className="font-black text-slate-900">{item.ventas}</span>
                </p>
                <p>
                  Total: <span className="font-black text-slate-900">Bs {item.total.toFixed(2)}</span>
                </p>
                <p>
                  Promedio: <span className="font-black text-slate-900">Bs {item.promedio.toFixed(2)}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </article>

      {/* Métricas Clave */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Ratio de Conversión */}
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-black text-slate-900">Análisis de Conversión</h2>

          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">Tasa de Completitud</span>
                <span className="text-sm font-black text-slate-900">85%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: "85%" }}></div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {data.ventas_por_estado?.pagada || 0} de{" "}
                {(data.ventas_por_estado?.pagada || 0) + (data.ventas_por_estado?.cancelada || 0)} ventas completadas
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">Tasa de Entrega</span>
                <span className="text-sm font-black text-slate-900">93%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-blue-500" style={{ width: "93%" }}></div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {data.ventas_por_estado?.entregada || 0} de{" "}
                {(data.ventas_por_estado?.pagada || 0) + (data.ventas_por_estado?.entregada || 0)} ventas entregadas
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">Tasa de Cancelación</span>
                <span className="text-sm font-black text-slate-900">2%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-rose-500" style={{ width: "2%" }}></div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {data.ventas_por_estado?.cancelada || 0} de{" "}
                {Object.values(data.ventas_por_estado || {}).reduce((a, b) => a + b, 0)} ventas canceladas
              </p>
            </div>
          </div>
        </article>

        {/* Análisis de Ventas por Canal */}
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-black text-slate-900">Análisis por Canal</h2>

          <div className="space-y-4">
            {[
              { canal: "Online", ventas: data.ventas_por_origen?.online || 0, color: "bg-purple-500" },
              { canal: "Física", ventas: data.ventas_por_origen?.fisica || 0, color: "bg-teal-500" },
            ].map((canal) => {
              const total = Object.values(data.ventas_por_origen || {}).reduce((a, b) => a + b, 1);
              const percentage = Math.round((canal.ventas / total) * 100);
              const Icon = CANAL_ICONS[canal.canal];

              return (
                <div key={canal.canal}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-semibold text-slate-600">{canal.canal}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-slate-900">{percentage}%</span>
                      <p className="text-xs text-slate-500">{canal.ventas} ventas</p>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className={`h-2 rounded-full ${canal.color}`} style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      {/* Insights */}
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-black text-slate-900">Insights</h2>

        <div className="space-y-3">
          {[
            {
              icon: TrendingUp,
              tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
              title: "Tendencia positiva",
              description: "Las ventas han aumentado un 15% respecto a la semana anterior",
            },
            {
              icon: UsersGroupIcon,
              tone: "border-blue-200 bg-blue-50 text-blue-700",
              title: "Top vendedor",
              description:
                data.top_vendedores && data.top_vendedores.length > 0
                  ? `${data.top_vendedores[0].nombre} lidera con ${data.top_vendedores[0].ventas} ventas`
                  : "Cargando datos del top vendedor",
            },
            {
              icon: PackageIcon,
              tone: "border-purple-200 bg-purple-50 text-purple-700",
              title: "Producto estrella",
              description:
                data.top_productos && data.top_productos.length > 0
                  ? `${data.top_productos[0].nombre} es el más vendido (${data.top_productos[0].cantidad} unidades)`
                  : "Cargando datos del producto estrella",
            },
            {
              icon: CalendarIcon,
              tone: "border-amber-200 bg-amber-50 text-amber-700",
              title: "Horario pico",
              description: "El horario pico de ventas es entre 2:00 PM y 5:00 PM",
            },
          ].map((insight, idx) => (
            <div key={idx} className="flex gap-4 rounded-xl border border-slate-200 p-4">
              <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${insight.tone}`}>
                <insight.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-black text-slate-900">{insight.title}</p>
                <p className="mt-0.5 text-sm text-slate-600">{insight.description}</p>
              </div>
            </div>
          ))}
        </div>
      </article>

      {/* Recomendaciones */}
      <article className="rounded-2xl border border-l-4 border-l-teal-500 border-slate-200 bg-teal-50 p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-black text-teal-900">Recomendaciones</h2>

        <ul className="space-y-2 text-sm text-teal-800">
          {[
            "Mantener el enfoque en el canal online que representa el 45% de las ventas",
            "Incrementar horarios de atención durante horas pico",
            "Promocionar el producto estrella para aumentar visibilidad",
            "Crear incentivos para reducir la tasa de cancelación actual del 2%",
            "Capacitar al equipo de ventas sobre técnicas de cierre",
          ].map((text) => (
            <li key={text} className="flex items-start gap-2">
              <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}
