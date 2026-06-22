class Producto {
  final int id;
  final String sku;
  final String nombreComercial;
  final String nombreGenerico;
  final String descripcion;
  final String? imagen;
  final String categoriaNombre;
  final String laboratorioNombre;
  final String presentacion;
  final String unidadMedida;
  final String precioVenta; 
  final int stockDisponible;
  final bool requiereReceta;

  Producto({
    required this.id,
    required this.sku,
    required this.nombreComercial,
    required this.nombreGenerico,
    required this.descripcion,
    this.imagen,
    required this.categoriaNombre,
    required this.laboratorioNombre,
    required this.presentacion,
    required this.unidadMedida,
    required this.precioVenta,
    required this.stockDisponible,
    required this.requiereReceta,
  });

  factory Producto.fromJson(Map<String, dynamic> json) {
    return Producto(
      id: json['id'] ?? 0,
      sku: json['sku'] ?? '',
      nombreComercial: json['nombre_comercial'] ?? '',
      nombreGenerico: json['nombre_generico'] ?? '',
      descripcion: json['descripcion'] ?? '',
      imagen: json['imagen'], 
      categoriaNombre: json['categoria_nombre'] ?? 'Sin categoría',
      laboratorioNombre: json['laboratorio_nombre'] ?? 'Genérico',
      presentacion: json['presentacion'] ?? '',
      unidadMedida: json['unidad_medida'] ?? 'unidad',
      precioVenta: json['precio_venta'].toString(),
      stockDisponible: json['inventario']?['stock_disponible'] ?? 0,
      requiereReceta: json['requiere_receta'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'nombre_comercial': nombreComercial,
      'precio_venta': precioVenta,
      'imagen': imagen,
    };
  }
}