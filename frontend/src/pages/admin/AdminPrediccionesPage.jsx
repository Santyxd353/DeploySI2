import { useState, useEffect, useRef, useCallback } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  usePrediccionDemanda,
  useRecomendaciones,
  useTendencias,
  usePatronesEstacionales,
} from '../../hooks/usePredicciones';
import {
  SparkIcon,
  ChartBarIcon,
  PackageIcon,
  CalendarIcon,
  LoaderIcon,
  AlertTriangleIcon,
  DownloadIcon,
} from '../../components/ui/Icons';
import { requestJsonWithAuthRetry } from '../../services/apiClient';
import PrediccionChart from '../../components/admin/predicciones/DemandaChart';
import RecomendacionesCompra from '../../components/admin/predicciones/RecomendacionesCompra';
import TendenciasConsumo from '../../components/admin/predicciones/TendenciasConsumo';
import PatronesEstacionales from '../../components/admin/predicciones/PatronesEstacionales';

const TENDENCIA_CONFIG = {
  creciente: { label: 'Creciente ↑', icon: '↑', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  decreciente: { label: 'Decreciente ↓', icon: '↓', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  estable: { label: 'Estable →', icon: '→', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
};

const ESTACIONALIDAD_CONFIG = {
  temporada_alta: { label: 'Temporada alta', color: 'text-amber-700', bg: 'bg-amber-50' },
  temporada_baja: { label: 'Temporada baja', color: 'text-sky-700', bg: 'bg-sky-50' },
  normal: { label: 'Normal', color: 'text-slate-600', bg: 'bg-slate-50' },
};

// ─── Buscador de producto con autocompletado mejorado ────────────────────────
function ProductoBuscador({ onSelect }) {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const buscar = useCallback(async (texto) => {
    if (texto.trim().length < 2) { setResultados([]); setAbierto(false); return; }
    setBuscando(true);
    try {
      const data = await requestJsonWithAuthRetry(
        `/api/inventarios/productos/?search=${encodeURIComponent(texto)}&page_size=8`
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
    setQuery(producto.nombre_comercial);
    setAbierto(false);
    onSelect(producto.id);
  };

  return (
    <div className="flex flex-col gap-1 relative min-w-[280px]" ref={wrapperRef}>
      <label className="text-sm font-medium text-gray-700">Producto</label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => resultados.length > 0 && setAbierto(true)}
          placeholder="Buscar por nombre o SKU..."
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          autoComplete="off"
        />
        {buscando ? (
          <LoaderIcon className="animate-spin h-4 w-4 text-gray-400 absolute right-3 top-3" />
        ) : seleccionado ? (
          <span className="absolute right-3 top-2.5 text-xs text-green-600 font-medium">✓</span>
        ) : null}
      </div>

      {abierto && resultados.length > 0 && (
        <ul className="absolute top-full mt-1 z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto py-1">
          {resultados.map((p) => (
            <li
              key={p.id}
              onMouseDown={() => handleSelect(p)}
              className="px-4 py-2.5 cursor-pointer hover:bg-indigo-50 flex items-center gap-3 transition"
            >
              {p.imagen ? (
                <img src={p.imagen} alt="" className="w-8 h-8 rounded-lg object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                  {p.nombre_comercial?.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{p.nombre_comercial}</p>
                <p className="text-xs text-gray-400">SKU: {p.sku}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, colorClass, bgClass }) {
  return (
    <div className={`rounded-2xl border border-slate-200 ${bgClass} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${colorClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function AdminPrediccionesPage() {
  const [productoId, setProductoId] = useState(null);
  const [dias, setDias] = useState(7);
  const [activeTab, setActiveTab] = useState('demanda');
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
    if (productoId) fetchPrediccion(productoId, dias);
  };

  const exportToCSV = (data, filename) => {
    if (!data || !data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => row[h]).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <SparkIcon className="h-8 w-8 text-indigo-600" />
              Predicciones Inteligentes
            </h1>
            <p className="text-gray-500 mt-1">
              Previsión de demanda, recomendaciones de compra y análisis de tendencias
            </p>
          </div>
        </div>

        {/* Navegación por tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-6 -mb-px">
            {['demanda', 'recomendaciones', 'tendencias', 'estacionalidad'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition ${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'demanda' && 'Predicción de demanda'}
                {tab === 'recomendaciones' && 'Recomendaciones de compra'}
                {tab === 'tendencias' && 'Tendencias de consumo'}
                {tab === 'estacionalidad' && 'Patrones estacionales'}
              </button>
            ))}
          </nav>
        </div>

        {/* Contenido según tab activa */}
        <div className="mt-6">
          {activeTab === 'demanda' && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ChartBarIcon className="h-5 w-5 text-indigo-600" />
                  Predicción de Demanda
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handlePredecir} className="flex flex-wrap gap-4 items-end">
                  <ProductoBuscador onSelect={setProductoId} />
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Días a predecir</label>
                    <input
                      type="number"
                      value={dias}
                      onChange={(e) => setDias(parseInt(e.target.value))}
                      className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      min="1"
                      max="90"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loadingPred || !productoId}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl disabled:opacity-50"
                  >
                    {loadingPred ? (
                      <>
                        <LoaderIcon className="animate-spin mr-2 h-4 w-4" />
                        Calculando...
                      </>
                    ) : (
                      'Predecir'
                    )}
                  </Button>
                </form>

                {errorPred && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertTriangleIcon className="h-4 w-4 flex-shrink-0" />
                    {errorPred}
                  </div>
                )}

                {prediccion && <PrediccionChart prediccion={prediccion} />}

                {prediccion?.predicciones?.length > 0 && (
                  <div className="flex justify-end">
                    <Button
                      onClick={() => exportToCSV(prediccion.predicciones, 'prediccion_demanda.csv')}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <DownloadIcon className="h-4 w-4" />
                      Exportar CSV
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'recomendaciones' && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PackageIcon className="h-5 w-5 text-amber-600" />
                  Recomendaciones de Compra
                </CardTitle>
                {recomendaciones.length > 0 && (
                  <Button
                    onClick={() => exportToCSV(recomendaciones, 'recomendaciones.csv')}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <DownloadIcon className="h-4 w-4" />
                    Exportar
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <RecomendacionesCompra data={recomendaciones} loading={loadingRec} />
              </CardContent>
            </Card>
          )}

          {activeTab === 'tendencias' && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ChartBarIcon className="h-5 w-5 text-emerald-600" />
                  Tendencias de Consumo
                </CardTitle>
                {tendencias.length > 0 && (
                  <Button
                    onClick={() => exportToCSV(tendencias, 'tendencias.csv')}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <DownloadIcon className="h-4 w-4" />
                    Exportar
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <TendenciasConsumo data={tendencias} loading={loadingTen} />
              </CardContent>
            </Card>
          )}

          {activeTab === 'estacionalidad' && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarIcon className="h-5 w-5 text-blue-600" />
                  Patrones Estacionales
                </CardTitle>
                {patrones.length > 0 && (
                  <Button
                    onClick={() => exportToCSV(patrones, 'patrones.csv')}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <DownloadIcon className="h-4 w-4" />
                    Exportar
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <PatronesEstacionales data={patrones} loading={loadingPat} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}