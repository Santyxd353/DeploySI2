class CartItem {
  final int? itemId;      // Para el error de 'itemId'
  final int productoId;
  final String nombre;    // Para el error de 'nombre'
  final String? imagen;   // Para el error de 'imagen'
  final double precioUnitario; // Para el error de 'precioUnitario'
  int cantidad;           // Sin 'final' para que deje cambiar el número

  CartItem({
    this.itemId,
    required this.productoId,
    required this.nombre,
    this.imagen,
    required this.precioUnitario,
    required this.cantidad,
  });

  // Este es el "traductor" que convierte lo de Django a Flutter
  factory CartItem.fromJson(Map<String, dynamic> json) {
    // Django anida el producto dentro del item, hay que buscarlo ahí
    final producto = json['producto'] ?? {}; 
    
    return CartItem(
      itemId: json['id'],
      productoId: producto['id'] ?? 0,
      nombre: producto['nombre'] ?? 'Medicamento',
      imagen: producto['imagen'], 
      precioUnitario: double.tryParse(json['precio_unitario']?.toString() ?? '0') ?? 0.0,
      cantidad: json['cantidad'] ?? 1,
    );
  }

  Map<String, dynamic> toJson() => {
    'producto_id': productoId,
    'cantidad': cantidad,
  };
}