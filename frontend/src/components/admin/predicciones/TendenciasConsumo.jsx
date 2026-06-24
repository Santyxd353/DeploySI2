import { useState } from 'react';
import { LoaderIcon, TrendingUp, TrendingDown, Minus, SearchIcon } from '../../ui/Icons';

const TendenciaIcon = ({ tendencia, className }) => {
  if (tendencia === 'creciente') return <TrendingUp className={className || 'h-5 w-5 text-emerald-600'} />;
  if (tendencia === 'decreciente') return <TrendingDown className={className || 'h-5 w-5 text-red-600'} />;
  return <Minus className={className || 'h-5 w-5 text-gray-400'} />;
};

export default function TendenciasConsumo({ data, loading }) {
  const [viewMode, setViewMode] = useState('cards');
  const [sortConfig, setSortConfig] = useState({ key: 'variacion_porcentual', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');

  const normalizedQuery = searchTerm.trim().toLowerCase();
  const filteredData = data.filter((item) =>
    item.nombre_producto?.toLowerCase().includes(normalizedQuery) ||
    item.tendencia?.toLowerCase().includes(normalizedQuery)
  );

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key] ?? 0;
    const bVal = b[sortConfig.key] ?? 0;
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
        <Minus className="h-10 w-10 text-gray-300 mb-2" />
        <p className="text-sm font-medium">No hay tendencias significativas detectadas.</p>
        <p className="text-xs mt-1">Las ventas se mantienen estables en todos los productos.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filtro y toggle de vista */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-500">
            {sortedData.length} producto{sortedData.length !== 1 ? 's' : ''} con cambio significativo
          </span>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar producto o tendencia..."
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
            const variacion = item.variacion_porcentual ?? 0;
            const isPositive = variacion > 0;
            const colorClass = isPositive ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50';
            const textColor = isPositive ? 'text-emerald-700' : 'text-red-700';
            const badgeColor = isPositive ? 'bg-emerald-600' : 'bg-red-600';
            return (
              <div
                key={idx}
                className={`rounded-2xl border p-4 transition-shadow hover:shadow-md ${colorClass}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">{item.nombre_producto}</h4>
                    <div className="flex items-center gap-1 mt-1">
                      <TendenciaIcon tendencia={item.tendencia} className="h-4 w-4" />
                      <span className={`text-xs font-bold uppercase tracking-wider ${textColor}`}>
                        {item.tendencia}
                      </span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white ${badgeColor}`}>
                    {isPositive ? '+' : ''}{variacion}%
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="bg-white rounded-xl p-2">
                    <p className="text-xs text-gray-500">Anterior (30d)</p>
                    <p className="text-lg font-bold text-gray-800">{item.ventas_promedio_anterior ?? '-'}</p>
                  </div>
                  <div className="bg-white rounded-xl p-2">
                    <p className="text-xs text-gray-500">Actual (30d)</p>
                    <p className="text-lg font-bold text-gray-800">{item.ventas_promedio_actual ?? '-'}</p>
                  </div>
                </div>

                {/* Mini barra de progreso para visualizar la diferencia */}
                <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                  <span>0</span>
                  <div className="flex-1 h-2 bg-white rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{
                        width: `${Math.min(100, Math.abs(variacion) * 2)}%`,
                        marginLeft: isPositive ? 'auto' : '0',
                        marginRight: isPositive ? '0' : 'auto',
                      }}
                    />
                  </div>
                  <span>{isPositive ? '+' : ''}{variacion}%</span>
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
                  { label: 'Promedio anterior', key: 'ventas_promedio_anterior' },
                  { label: 'Promedio actual', key: 'ventas_promedio_actual' },
                  { label: 'Variación (%)', key: 'variacion_porcentual' },
                  { label: 'Tendencia', key: 'tendencia' },
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
                <tr key={idx} className="hover:bg-emerald-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-800">{item.nombre_producto}</td>
                  <td className="px-4 py-3 text-right">{item.ventas_promedio_anterior ?? '-'}</td>
                  <td className="px-4 py-3 text-right">{item.ventas_promedio_actual ?? '-'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${item.variacion_porcentual > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {item.variacion_porcentual > 0 ? '+' : ''}{item.variacion_porcentual}%
                  </td>
                  <td className="px-4 py-3 flex items-center gap-1.5">
                    <TendenciaIcon tendencia={item.tendencia} className="h-4 w-4" />
                    <span className="capitalize">{item.tendencia || 'estable'}</span>
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