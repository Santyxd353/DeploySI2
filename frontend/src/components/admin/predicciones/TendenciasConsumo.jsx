import { LoaderIcon, TrendingUp, TrendingDown, Minus } from '../../ui/Icons';

const TendenciaIcon = ({ tendencia }) => {
  if (tendencia === 'creciente') return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (tendencia === 'decreciente') return <TrendingDown className="h-4 w-4 text-red-600" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
};

export default function TendenciasConsumo({ data, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="animate-spin h-6 w-6 text-gray-400" />
      </div>
    );
  }

  if (!data.length) {
    return <p className="py-8 text-center text-gray-400">No hay tendencias significativas.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tendencia</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variación (%)</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Promedio 30d</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {data.map((item, idx) => (
            <tr key={idx} className="hover:bg-emerald-50 transition">
              <td className="px-4 py-3 font-medium text-gray-800">{item.nombre_producto || item.producto || '-'}</td>
              <td className="px-4 py-3 flex items-center gap-1.5">
                <TendenciaIcon tendencia={item.tendencia} />
                <span className="capitalize">{item.tendencia || 'estable'}</span>
              </td>
              <td className="px-4 py-3 text-right font-semibold">
                {(item.variacion_porcentual ?? item.variacion) != null ? (
                  <span className={(item.variacion_porcentual ?? item.variacion) >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {(item.variacion_porcentual ?? item.variacion) > 0 ? '+' : ''}{item.variacion_porcentual ?? item.variacion}%
                  </span>
                ) : '-'}
              </td>
              <td className="px-4 py-3 text-right">{item.ventas_promedio_actual ?? item.ventas_recientes ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}