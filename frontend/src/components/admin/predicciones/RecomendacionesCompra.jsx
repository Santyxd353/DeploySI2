import { useState } from 'react';
import { LoaderIcon } from '../../ui/Icons';

export default function RecomendacionesCompra({ data, loading }) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key] ?? '';
    const bVal = b[sortConfig.key] ?? '';
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="animate-spin h-6 w-6 text-gray-400" />
      </div>
    );
  }

  if (!data.length) {
    return <p className="py-8 text-center text-gray-400">No hay productos que necesiten reabastecimiento.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {[
              { label: 'Producto', key: 'nombre_producto' },
              { label: 'Stock actual', key: 'stock_actual' },
              { label: 'Stock mínimo', key: 'stock_minimo' },
              { label: 'Cantidad sugerida', key: 'cantidad_recomendada' },
              { label: 'Prioridad', key: 'urgencia' },
            ].map((col) => (
              <th
                key={col.key}
                onClick={() => requestSort(col.key)}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                {col.label} {sortConfig.key === col.key && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {sortedData.map((item, idx) => (
            <tr key={idx} className="hover:bg-amber-50 transition">
              <td className="px-4 py-3 font-medium text-gray-800">{item.nombre_producto || item.producto || '-'}</td>
              <td className="px-4 py-3 text-right">{item.stock_actual ?? '-'}</td>
              <td className="px-4 py-3 text-right">{item.stock_minimo ?? '-'}</td>
              <td className="px-4 py-3 text-right font-semibold text-amber-700">{item.cantidad_recomendada ?? item.cantidad_sugerida ?? '-'}</td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    (item.urgencia || item.prioridad) === 'alta'
                      ? 'bg-red-100 text-red-700'
                      : (item.urgencia || item.prioridad) === 'media'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  {item.urgencia || item.prioridad || 'baja'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}