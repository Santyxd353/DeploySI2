export default function TendenciasTable({ data }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Producto</th>
            <th className="p-2 border">Promedio anterior</th>
            <th className="p-2 border">Promedio actual</th>
            <th className="p-2 border">Variación (%)</th>
            <th className="p-2 border">Tendencia</th>
           </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.producto_id}>
              <td className="p-2 border">{item.nombre_producto}</td>
              <td className="p-2 border text-center">{item.ventas_promedio_anterior}</td>
              <td className="p-2 border text-center">{item.ventas_promedio_actual}</td>
              <td className={`p-2 border text-center ${item.variacion_porcentual > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {item.variacion_porcentual}%
              </td>
              <td className="p-2 border text-center">{item.tendencia}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}