export default function PatronesEstacionalesTable({ data }) {
  // Agrupar por categoría
  const grouped = data.reduce((acc, item) => {
    if (!acc[item.categoria_nombre]) acc[item.categoria_nombre] = [];
    acc[item.categoria_nombre].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([categoria, items]) => (
        <div key={categoria}>
          <h3 className="font-bold text-lg mt-4">{categoria}</h3>
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border">Mes</th>
                <th className="p-2 border">Ventas promedio</th>
                <th className="p-2 border">% vs anual</th>
              </tr>
            </thead>
            <tbody>
              {items.sort((a,b) => a.mes - b.mes).map((item, idx) => (
                <tr key={idx}>
                  <td className="p-2 border text-center">{item.mes}</td>
                  <td className="p-2 border text-center">{item.promedio_ventas}</td>
                  <td className="p-2 border text-center">{item.porcentaje_vs_anual}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}