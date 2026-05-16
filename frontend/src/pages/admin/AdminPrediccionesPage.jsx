import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  usePrediccionDemanda,
  useRecomendaciones,
  useTendencias,
  usePatronesEstacionales,
} from '../../hooks/usePredicciones';
import {
  ChartBarIcon,
  PackageIcon,
  SparkIcon,
  CalendarIcon,
  LoaderIcon,
  AlertTriangleIcon,
} from '../../components/ui/Icons';
import { requestJsonWithAuthRetry } from '../../services/apiClient';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const TENDENCIA_CONFIG = {
  creciente:   { label: 'Creciente ↑',   color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  decreciente: { label: 'Decreciente ↓', color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200'     },
  estable:     { label: 'Estable →',     color: 'text-slate-700',   bg: 'bg-slate-50',    border: 'border-slate-200'   },
};

const ESTACIONALIDAD_CONFIG = {
  temporada_alta: { label: 'Temporada alta',  color: 'text-amber-700',   bg: 'bg-amber-50'  },
  temporada_baja: { label: 'Temporada baja',  color: 'text-sky-700',     bg: 'bg-sky-50'    },
  normal:         { label: 'Temporada normal', color: 'text-slate-600',   bg: 'bg-slate-50'  },
};

function KpiCard({ label, value, sub, colorClass = 'text-indigo-700', bgClass = 'bg-indigo-50' }) {
  return (
    <div className={`rounded-2xl border border-slate-200 ${bgClass} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${colorClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function PrediccionResultados({ prediccion }) {
  const items = prediccion?.predicciones ?? [];
  const valores = items.map((p) => p.unidades ?? 0);
  const total = valores.reduce((a, b) => a + b, 0);
  const promedio = valores.length ? total / valores.length : 0;
  const maximo = valores.length ? Math.max(...valores) : 0;
  const minimo = valores.length ? Math.min(...valores) : 0;
  const tendCfg = TENDENCIA_CONFIG[prediccion?.tendencia] ?? TENDENCIA_CONFIG.estable;
  const estCfg  = ESTACIONALIDAD_CONFIG[prediccion?.estacionalidad] ?? ESTACIONALIDAD_CONFIG.normal;

  const chartData = items.map((p) => ({
    fecha: typeof p.fecha === 'string' ? p.fecha.slice(5) : `D${items.indexOf(p) + 1}`,
    unidades: parseFloat((p.unidades ?? 0).toFixed(2)),
  }));

  return (
    <div className="space-y-4 mt-4">
        {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Total estimado"
          value={total.toFixed(1)}
          sub={`en ${items.length} días`}
          colorClass="text-indigo-700"
          bgClass="bg-indigo-50"
        />
        <KpiCard
          label="Promedio diario"
          value={promedio.toFixed(1)}
          sub="unidades/día"
          colorClass="text-violet-700"
          bgClass="bg-violet-50"
        />
        <KpiCard
          label="Pico máximo"
          value={maximo.toFixed(1)}
          sub={`Mín: ${minimo.toFixed(1)}`}
          colorClass="text-sky-700"
          bgClass="bg-sky-50"
        />
        <div className={`rounded-2xl border ${tendCfg.border} ${tendCfg.bg} p-4`}>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Tendencia</p>
          <p className={`mt-1 text-lg font-black ${tendCfg.color}`}>{tendCfg.label}</p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${estCfg.bg} ${estCfg.color}`}>
            {estCfg.label}
          </span>
        </div>
      </div>

      {/* Gráfico de barras */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-700">Demanda estimada por día</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                formatter={(v) => [`${v} uds.`, 'Demanda']}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <ReferenceLine y={promedio} stroke="#a78bfa" strokeDasharray="4 4" label={{ value: 'Prom.', fontSize: 10, fill: '#7c3aed' }} />
              <Bar dataKey="unidades" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla detalle */}
      {items.length > 0 && (
        <details className="group rounded-2xl border border-slate-200 bg-white">
          <summary className="cursor-pointer select-none rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Ver tabla detallada ({items.length} días)
          </summary>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Demanda estimada</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {items.map((p, i) => (
                  <tr key={i} className="hover:bg-indigo-50">
                    <td className="px-4 py-2 text-gray-700">{p.fecha || `Día ${i + 1}`}</td>
                    <td className="px-4 py-2 text-right font-semibold text-indigo-700">
                      {typeof p.unidades === 'number' ? p.unidades.toFixed(1) : '-'}
                    </td>
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

// ─── Buscador de producto con autocompletado ─────────────────────────────────
function ProductoBuscador({ onSelect }) {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setAbierto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const buscar = useCallback(async (texto) => {
    if (texto.trim().length < 2) { setResultados([]); return; }
    setBuscando(true);
    try {
      const data = await requestJsonWithAuthRetry(
        `/api/inventarios/productos/?search=${encodeURIComponent(texto)}&page_size=10`
      );
      const lista = Array.isArray(data) ? data : (data.results ?? []);
      setResultados(lista);
      setAbierto(lista.length > 0);
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setSeleccionado(null);
    onSelect(null);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => buscar(val), 300);
  };

  const handleSelect = (producto) => {
    setSeleccionado(producto);
    setQuery(`${producto.nombre_comercial} — SKU: ${producto.sku}`);
    setAbierto(false);
    onSelect(producto.id);
  };

  return (
    <div className="flex flex-col gap-1 relative min-w-[280px]" ref={wrapperRef}>
      <label className="text-sm font-medium text-gray-700">Buscar producto</label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => resultados.length > 0 && setAbierto(true)}
          placeholder="Nombre o SKU del producto…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          autoComplete="off"
        />
        {buscando && (
          <LoaderIcon className="animate-spin h-4 w-4 text-gray-400 absolute right-2 top-2.5" />
        )}
      </div>
      {abierto && resultados.length > 0 && (
        <ul className="absolute top-full mt-1 z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {resultados.map((p) => (
            <li
              key={p.id}
              onMouseDown={() => handleSelect(p)}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 flex justify-between items-center gap-4"
            >
              <span className="font-medium text-gray-800 truncate">{p.nombre_comercial}</span>
              <span className="text-xs text-gray-400 shrink-0">SKU: {p.sku}</span>
            </li>
          ))}
        </ul>
      )}
      {seleccionado && (
        <p className="text-xs text-indigo-600 font-medium mt-0.5">ID seleccionado: {seleccionado.id}</p>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPrediccionesPage() {
  const [productoId, setProductoId] = useState(null);
  const [dias, setDias] = useState(7);
  const { prediccion, loading: loadingPred, error: errorPred, fetchPrediccion } = usePrediccionDemanda();
  const { recomendaciones, loading: loadingRec, loadRecomendaciones } = useRecomendaciones();
  const { tendencias, loading: loadingTen, loadTendencias } = useTendencias();
  const { patrones, loading: loadingPat, loadPatrones } = usePatronesEstacionales();

  useEffect(() => {
    loadRecomendaciones();
    loadTendencias();
    loadPatrones();
  }, []);

  const handlePredecir = (e) => {
    e.preventDefault();
    if (productoId) {
      fetchPrediccion(productoId, dias);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <SparkIcon className="h-8 w-8 text-indigo-600" />
            Predicciones e Inteligencia
          </h1>
          <p className="text-gray-500 mt-1">
            Análisis predictivo de demanda, recomendaciones de compra y tendencias de consumo
          </p>
        </div>

        {/* Formulario de predicción */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ChartBarIcon className="h-5 w-5 text-indigo-600" />
              Predicción de Demanda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handlePredecir} className="flex flex-wrap gap-4 items-end">
              <ProductoBuscador onSelect={setProductoId} />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Días a predecir</label>
                <input
                  type="number"
                  value={dias}
                  onChange={(e) => setDias(parseInt(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-28"
                  min="1"
                  max="30"
                />
              </div>
              <Button
                type="submit"
                disabled={loadingPred || !productoId}
                className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingPred ? (
                  <>
                    <LoaderIcon className="animate-spin mr-2 h-4 w-4" />
                    Calculando...
                  </>
                ) : (
                  'Predecir demanda'
                )}
              </Button>
            </form>

            {errorPred && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <AlertTriangleIcon className="h-4 w-4 flex-shrink-0" />
                {errorPred}
              </div>
            )}

            {prediccion && <PrediccionResultados prediccion={prediccion} />}
          </CardContent>
        </Card>

        {/* Recomendaciones de compra */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PackageIcon className="h-5 w-5 text-amber-600" />
              Recomendaciones de Compra
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRec ? (
              <div className="flex items-center gap-2 py-8 justify-center text-gray-500">
                <LoaderIcon className="animate-spin h-5 w-5" />
                Cargando recomendaciones...
              </div>
            ) : recomendaciones.length === 0 ? (
              <p className="py-8 text-center text-gray-400">No hay productos que necesiten reabastecimiento por ahora.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock actual</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock mínimo</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cantidad sugerida</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prioridad</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {recomendaciones.map((r, i) => (
                      <tr key={i} className="hover:bg-amber-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{r.nombre_producto || r.producto || r.nombre || '-'}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{r.stock_actual ?? '-'}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{r.stock_minimo ?? '-'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-amber-700">{r.cantidad_recomendada ?? r.cantidad_sugerida ?? '-'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              (r.urgencia || r.prioridad) === 'alta'
                                ? 'bg-red-100 text-red-700'
                                : (r.urgencia || r.prioridad) === 'media'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {r.urgencia || r.prioridad || 'baja'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tendencias de consumo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ChartBarIcon className="h-5 w-5 text-emerald-600" />
              Tendencias de Consumo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTen ? (
              <div className="flex items-center gap-2 py-8 justify-center text-gray-500">
                <LoaderIcon className="animate-spin h-5 w-5" />
                Cargando tendencias...
              </div>
            ) : tendencias.length === 0 ? (
              <p className="py-8 text-center text-gray-400">No hay tendencias significativas para mostrar.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tendencia</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variación</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ventas promedio (30d)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {tendencias.map((t, i) => (
                      <tr key={i} className="hover:bg-emerald-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{t.nombre_producto || t.producto || t.nombre || '-'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              t.tendencia === 'creciente'
                                ? 'bg-green-100 text-green-700'
                                : t.tendencia === 'decreciente'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {t.tendencia || 'estable'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {(t.variacion_porcentual ?? t.variacion) != null ? (
                            <span className={(t.variacion_porcentual ?? t.variacion) >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {(t.variacion_porcentual ?? t.variacion) > 0 ? '+' : ''}{t.variacion_porcentual ?? t.variacion}%
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{t.ventas_promedio_actual ?? t.ventas_recientes ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Patrones estacionales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarIcon className="h-5 w-5 text-blue-600" />
              Patrones Estacionales por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPat ? (
              <div className="flex items-center gap-2 py-8 justify-center text-gray-500">
                <LoaderIcon className="animate-spin h-5 w-5" />
                Cargando patrones...
              </div>
            ) : patrones.length === 0 ? (
              <p className="py-8 text-center text-gray-400">No hay datos suficientes para identificar patrones estacionales.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mes</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% vs promedio anual</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ventas del mes</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {patrones.map((p, i) => (
                      <tr key={i} className="hover:bg-blue-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{p.categoria_nombre || p.categoria || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">{p.mes ? MESES[(p.mes - 1) % 12] : '-'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-blue-700">
                          {p.porcentaje_vs_anual != null ? `${p.porcentaje_vs_anual}%` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{p.promedio_ventas ?? p.promedio_mensual ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}