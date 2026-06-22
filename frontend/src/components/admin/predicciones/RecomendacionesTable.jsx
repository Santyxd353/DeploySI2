import React from 'react';

export default function RecomendacionesTable({ data }) {
  const getUrgenciaColor = (urgencia) => {
    if (urgencia === 'alta') return 'bg-red-100 text-red-800';
    if (urgencia === 'media') return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Producto</th>
            <th className="p-2 border">Stock actual</th>
            <th className="p-2 border">Predicción semana</th>
            <th className="p-2 border">Cantidad recomendada</th>
            <th className="p-2 border">Urgencia</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.producto_id}>
              <td className="p-2 border">{item.nombre_producto}</td>
              <td className="p-2 border text-center">{item.stock_actual}</td>
              <td className="p-2 border text-center">{item.prediccion_semana}</td>
              <td className="p-2 border text-center">{item.cantidad_recomendada}</td>
              <td className="p-2 border text-center">
                <span className={`px-2 py-1 rounded text-xs ${getUrgenciaColor(item.urgencia)}`}>
                  {item.urgencia}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}