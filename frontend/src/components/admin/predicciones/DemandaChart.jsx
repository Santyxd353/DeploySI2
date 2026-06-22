import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';

// KpiCard local
function KpiCard({ label, value, sub, colorClass = 'text-indigo-700', bgClass = 'bg-indigo-50' }) {
  return (
    <div className={`rounded-2xl border border-slate-200 ${bgClass} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${colorClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

const TENDENCIA_CONFIG = {
  creciente:   { label: 'Creciente',   color: 'text-emerald-600', bg: 'bg-emerald-50' },
  decreciente: { label: 'Decreciente', color: 'text-red-600',     bg: 'bg-red-50' },
  estable:     { label: 'Estable',     color: 'text-slate-600',   bg: 'bg-slate-50' },
};

const ESTACIONALIDAD_CONFIG = {
  temporada_alta: { label: 'Temporada alta', color: 'text-amber-700', bg: 'bg-amber-50' },
  temporada_baja: { label: 'Temporada baja', color: 'text-sky-700',   bg: 'bg-sky-50' },
  normal:         { label: 'Normal',         color: 'text-slate-600', bg: 'bg-slate-50' },
};

export default function PrediccionChart({ prediccion }) {
  const items = prediccion?.predicciones ?? [];
  const valores = items.map(p => p.unidades ?? 0);
  const total = valores.reduce((a, b) => a + b, 0);
  const promedio = valores.length ? total / valores.length : 0;
  const maximo = Math.max(...valores, 0);
  const minimo = Math.min(...valores, Infinity);
  const tendCfg = TENDENCIA_CONFIG[prediccion?.tendencia] ?? TENDENCIA_CONFIG.estable;
  const estCfg  = ESTACIONALIDAD_CONFIG[prediccion?.estacionalidad] ?? ESTACIONALIDAD_CONFIG.normal;

  const chartData = items.map((p, idx) => ({
    fecha: p.fecha ? new Date(p.fecha).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' }) : `Día ${idx + 1}`,
    unidades: p.unidades ?? 0,
    confianza_superior: p.intervalo_confianza?.superior ?? null,
    confianza_inferior: p.intervalo_confianza?.inferior ?? null,
  }));

  const tieneIntervalo = chartData.some(d => d.confianza_superior != null);

  const alerta = prediccion?.alerta_predictiva;

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total estimado" value={total.toFixed(1)} sub={`${items.length} días`} colorClass="text-indigo-700" bgClass="bg-indigo-50" />
        <KpiCard label="Promedio diario" value={promedio.toFixed(1)} sub="unidades" colorClass="text-violet-700" bgClass="bg-violet-50" />
        <KpiCard label="Pico máximo" value={maximo.toFixed(1)} sub={`Mín: ${minimo.toFixed(1)}`} colorClass="text-sky-700" bgClass="bg-sky-50" />
        <div className={`rounded-2xl border ${tendCfg.bg} p-4`}>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Tendencia</p>
          <p className={`mt-1 text-xl font-black ${tendCfg.color}`}>{tendCfg.label}</p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${estCfg.bg} ${estCfg.color}`}>
            {estCfg.label}
          </span>
        </div>
      </div>

      {alerta && (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Alerta predictiva</p>
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${alerta.color === 'rojo' ? 'bg-red-100 text-red-700' : alerta.color === 'amarillo' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {alerta.color === 'rojo' ? '🔴' : alerta.color === 'amarillo' ? '🟡' : '🟢'}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{alerta.nivel}</p>
                  <p className="text-xs text-slate-500">Cobertura estimada: {alerta.cobertura_dias} días</p>
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-medium">Condición</p>
                <p className="mt-1 text-sm text-slate-600">{alerta.condicion}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-medium">Acción sugerida</p>
                <p className="mt-1 text-sm text-slate-600">{alerta.accion}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs text-slate-500">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="font-semibold text-slate-800">Stock actual</p>
                  <p>{alerta.stock_actual ?? '-' } uds.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="font-semibold text-slate-800">Stock mínimo</p>
                  <p>{alerta.stock_minimo ?? '-'} uds.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="font-semibold text-slate-800">Demanda diaria</p>
                  <p>{alerta.prediccion_diaria ?? '-'} uds.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Guía de alertas</p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 uppercase">Nivel de Alerta</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 uppercase">Condición</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 uppercase">Acción sugerida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-3 text-red-700 font-semibold">🔴 Crítica</td>
                    <td className="px-4 py-3 text-slate-600">El stock se agotará antes de que llegue el proveedor.</td>
                    <td className="px-4 py-3 text-slate-600">Desabastecimiento inminente en {alerta.cobertura_dias} días. Crear orden de compra urgente.</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="px-4 py-3 text-amber-700 font-semibold">🟡 Preventiva</td>
                    <td className="px-4 py-3 text-slate-600">El stock está justo en el límite para hacer el pedido a tiempo.</td>
                    <td className="px-4 py-3 text-slate-600">Sugerencia de reabastecimiento. La demanda subirá un {Math.abs(alerta.variacion_demanda)}% la próxima semana.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-emerald-700 font-semibold">🟢 Estable</td>
                    <td className="px-4 py-3 text-slate-600">Stock suficiente para cubrir la demanda proyectada.</td>
                    <td className="px-4 py-3 text-slate-600">Inventario óptimo.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Demanda estimada por día</h3>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorDemanda" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              {tieneIntervalo && (
                <linearGradient id="colorConfianza" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a5b4fc" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#a5b4fc" stopOpacity={0} />
                </linearGradient>
              )}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="fecha" tick={{ fontSize: 12, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'unidades') return [`${value} uds.`, 'Demanda'];
                if (name === 'confianza_superior') return [`${value} uds.`, 'Límite superior'];
                if (name === 'confianza_inferior') return [`${value} uds.`, 'Límite inferior'];
                return [value, name];
              }}
              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: 12 }}
            />
            {tieneIntervalo && (
              <>
                <Area type="monotone" dataKey="confianza_superior" stroke="none" fill="url(#colorConfianza)" activeDot={false} />
                <Area type="monotone" dataKey="confianza_inferior" stroke="none" fill="transparent" activeDot={false} />
              </>
            )}
            <Area type="monotone" dataKey="unidades" stroke="#6366f1" strokeWidth={2} fill="url(#colorDemanda)" activeDot={{ r: 5, stroke: '#4f46e5', strokeWidth: 2, fill: '#fff' }} />
            <ReferenceLine y={promedio} stroke="#a78bfa" strokeDasharray="6 4" label={{ value: `Prom. ${promedio.toFixed(1)}`, fontSize: 11, fill: '#7c3aed', position: 'right' }} />
            <Legend />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {items.length > 0 && (
        <details className="group rounded-2xl border border-slate-200 bg-white">
          <summary className="cursor-pointer select-none rounded-2xl px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Ver tabla detallada ({items.length} días)
          </summary>
          <div className="overflow-x-auto px-5 pb-4">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Demanda estimada</th>
                  {tieneIntervalo && (
                    <>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Lím. inferior</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Lím. superior</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {items.map((p, i) => (
                  <tr key={i} className="hover:bg-indigo-50">
                    <td className="px-4 py-2 text-gray-700">{p.fecha || `Día ${i + 1}`}</td>
                    <td className="px-4 py-2 text-right font-semibold text-indigo-700">{p.unidades?.toFixed(1) ?? '-'}</td>
                    {tieneIntervalo && (
                      <>
                        <td className="px-4 py-2 text-right text-gray-600">{p.intervalo_confianza?.inferior?.toFixed(1) ?? '-'}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{p.intervalo_confianza?.superior?.toFixed(1) ?? '-'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}