import { LoaderIcon } from '../../ui/Icons';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function PatronesEstacionales({ data, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="animate-spin h-6 w-6 text-gray-400" />
      </div>
    );
  }

  if (!data.length) {
    return <p className="py-8 text-center text-gray-400">No hay datos suficientes.</p>;
  }

  const categorias = {};
  data.forEach(item => {
    const cat = item.categoria_nombre || item.categoria || 'General';
    if (!categorias[cat]) categorias[cat] = new Array(12).fill(null);
    const mesIdx = (item.mes || 1) - 1;
    if (mesIdx >= 0 && mesIdx < 12) {
      categorias[cat][mesIdx] = item.porcentaje_vs_anual ?? item.valor ?? 0;
    }
  });

  const cats = Object.keys(categorias);

  const getColor = (value) => {
    if (value == null) return 'bg-gray-100';
    if (value > 120) return 'bg-red-400';
    if (value > 105) return 'bg-amber-300';
    if (value > 95) return 'bg-blue-200';
    if (value > 80) return 'bg-blue-100';
    return 'bg-slate-200';
  };

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 bg-gray-50 px-2 py-2 text-left font-medium text-gray-500">Categoría</th>
              {MESES.map((m, i) => (
                <th key={i} className="px-1 py-2 text-center font-medium text-gray-500 w-8">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cats.map(cat => (
              <tr key={cat} className="hover:bg-blue-50/50">
                <td className="sticky left-0 bg-white px-2 py-2 font-medium text-gray-700 border-r">{cat}</td>
                {Array.from({ length: 12 }).map((_, i) => {
                  const val = categorias[cat][i];
                  return (
                    <td key={i} className="px-1 py-2 text-center border-r last:border-r-0">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-7 rounded-md text-xs font-semibold ${getColor(val)} ${
                          val != null ? 'text-gray-800' : 'text-gray-300'
                        }`}
                        title={val != null ? `${val}%` : 'Sin datos'}
                      >
                        {val != null ? val : '—'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>Menor demanda</span>
        <span className="inline-block w-6 h-4 bg-slate-200 rounded" />
        <span className="inline-block w-6 h-4 bg-blue-100 rounded" />
        <span className="inline-block w-6 h-4 bg-blue-200 rounded" />
        <span className="inline-block w-6 h-4 bg-amber-300 rounded" />
        <span className="inline-block w-6 h-4 bg-red-400 rounded" />
        <span>Mayor demanda</span>
      </div>
    </div>
  );
}