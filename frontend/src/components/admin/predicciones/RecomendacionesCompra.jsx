import { useState } from 'react';
import { LoaderIcon, AlertTriangleIcon, CheckCircleIcon, InfoIcon, SearchIcon } from '../../ui/Icons';

const URGENCY_COLORS = {
  alta: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: AlertTriangleIcon, badge: 'bg-red-600' },
  media: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', icon: InfoIcon, badge: 'bg-yellow-600' },
  baja: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: CheckCircleIcon, badge: 'bg-green-600' },
};

function StockProgressBar({ stock, minimo }) {
  const nivel = Math.min(100, Math.round((stock / (minimo * 2)) * 100));
  const barColor =
    stock <= minimo ? 'bg-red-500' : stock <= minimo * 1.5 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
      <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${nivel}%` }} />
    </div>
  );
}

export default function RecomendacionesCompra({ data, loading }) {
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [sortConfig, setSortConfig] = useState({ key: 'urgencia', direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');

  const normalizedQuery = searchTerm.trim().toLowerCase();
  const filteredData = data.filter((item) =>
    item.nombre_producto?.toLowerCase().includes(normalizedQuery)
  );

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const priority = { alta: 3, media: 2, baja: 1 };
    const aVal = sortConfig.key === 'urgencia' ? (priority[a.urgencia] ?? 0) : a[sortConfig.key] ?? '';
    const bVal = sortConfig.key === 'urgencia' ? (priority[b.urgencia] ?? 0) : b[sortConfig.key] ?? '';
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="animate-spin h-6 w-6 text-gray-400" />
      </div>
    );
  }

  if (!filteredData.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <CheckCircleIcon className="h-10 w-10 text-green-400 mb-2" />
        <p className="text-sm font-medium">No hay productos que necesiten reabastecimiento.</p>
        <p className="text-xs mt-1">Todo está bajo control.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filtro y toggle de vista */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-500">
            {sortedData.length} producto{sortedData.length !== 1 ? 's' : ''} con alerta
          </span>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar producto..."
              className="pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 bg-white text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${viewMode === 'cards' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
          >
            Tarjetas
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${viewMode === 'table' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
          >
            Tabla
          </button>
        </div>
      </div>

      {viewMode === 'cards' ? (
        /* ─── Vista de tarjetas ─── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedData.map((item, idx) => {
            const colors = URGENCY_COLORS[item.urgencia] || URGENCY_COLORS.baja;
            const IconComponent = colors.icon;
            const deficit = item.cantidad_recomendada > 0 ? item.cantidad_recomendada : 0;
            return (
              <div
                key={idx}
                className={`rounded-2xl border p-4 transition-shadow hover:shadow-md ${colors.bg}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">{item.nombre_producto}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <IconComponent className={`h-4 w-4 ${colors.text}`} />
                      <span className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>
                        {item.urgencia}
                      </span>
                    </div>
                  </div>
                  {deficit > 0 && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white ${colors.badge}`}>
                      +{deficit}
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Stock actual</span>
                    <span className="font-medium text-gray-900">{item.stock_actual ?? '-'}</span>
                  </div>
                  <StockProgressBar stock={item.stock_actual ?? 0} minimo={item.stock_minimo ?? 1} />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Stock mínimo</span>
                    <span className="font-medium text-gray-900">{item.stock_minimo ?? '-'}</span>
                  </div>
                  {deficit > 0 && (
                    <div className="flex justify-between text-sm pt-1 border-t border-gray-200">
                      <span className="text-gray-500">Sugerido</span>
                      <span className="font-bold text-indigo-600">{deficit} uds.</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ─── Vista de tabla ─── */
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {[
                  { label: 'Producto', key: 'nombre_producto' },
                  { label: 'Stock actual', key: 'stock_actual' },
                  { label: 'Stock mínimo', key: 'stock_minimo' },
                  { label: 'Cantidad sugerida', key: 'cantidad_recomendada' },
                  { label: 'Urgencia', key: 'urgencia' },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => setSortConfig(col.key === sortConfig.key ? { ...sortConfig, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' } : { key: col.key, direction: 'asc' })}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  >
                    {col.label} {sortConfig.key === col.key && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {sortedData.map((item, idx) => (
                <tr key={idx} className="hover:bg-amber-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-800">{item.nombre_producto}</td>
                  <td className="px-4 py-3 text-right">{item.stock_actual ?? '-'}</td>
                  <td className="px-4 py-3 text-right">{item.stock_minimo ?? '-'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-indigo-700">{item.cantidad_recomendada ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      item.urgencia === 'alta' ? 'bg-red-100 text-red-700' :
                      item.urgencia === 'media' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {item.urgencia}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}