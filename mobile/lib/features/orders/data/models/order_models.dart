class OrderItem {
  const OrderItem({
    required this.producto,
    required this.cantidad,
    required this.precioUnitario,
    required this.subtotal,
  });

  final String producto;
  final int cantidad;
  final String precioUnitario;
  final String subtotal;

  factory OrderItem.fromJson(Map<String, dynamic> j) => OrderItem(
        producto: j['producto'] as String? ?? '',
        cantidad: j['cantidad'] as int? ?? 1,
        precioUnitario: j['precio_unitario'] as String? ?? '0',
        subtotal: j['subtotal'] as String? ?? '0',
      );
}

class HistorialEstado {
  const HistorialEstado({
    required this.estadoAnterior,
    required this.estadoNuevo,
    required this.cambiado,
    required this.notas,
    required this.createdAt,
  });

  final String estadoAnterior;
  final String estadoNuevo;
  final String? cambiado;
  final String notas;
  final DateTime createdAt;

  factory HistorialEstado.fromJson(Map<String, dynamic> j) => HistorialEstado(
        estadoAnterior: j['estado_anterior'] as String? ?? '',
        estadoNuevo: j['estado_nuevo'] as String? ?? '',
        cambiado: j['cambiado_por_nombre'] as String?,
        notas: j['notas'] as String? ?? '',
        createdAt: DateTime.tryParse(j['created_at'] as String? ?? '') ?? DateTime.now(),
      );
}

class Order {
  const Order({
    required this.id,
    required this.estado,
    required this.clienteNombre,
    required this.clienteEmail,
    required this.repartidorNombre,
    required this.total,
    required this.numeroFactura,
    required this.latEntrega,
    required this.lonEntrega,
    required this.direccionTexto,
    required this.latRepartidor,
    required this.lonRepartidor,
    required this.createdAt,
    this.aceptadoEn,
    this.preparandoEn,
    this.listoEn,
    this.enCaminoEn,
    this.entregadoEn,
    this.historial = const [],
    this.items = const [],
  });

  final int id;
  final String estado;
  final String clienteNombre;
  final String clienteEmail;
  final String? repartidorNombre;
  final String total;
  final String? numeroFactura;
  final double? latEntrega;
  final double? lonEntrega;
  final String direccionTexto;
  final double? latRepartidor;
  final double? lonRepartidor;
  final DateTime createdAt;
  final DateTime? aceptadoEn;
  final DateTime? preparandoEn;
  final DateTime? listoEn;
  final DateTime? enCaminoEn;
  final DateTime? entregadoEn;
  final List<HistorialEstado> historial;
  final List<OrderItem> items;

  static double? _parseDouble(dynamic v) {
    if (v == null) return null;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    return double.tryParse(v.toString());
  }

  static DateTime? _parseDate(dynamic v) {
    if (v == null) return null;
    return DateTime.tryParse(v as String);
  }

  factory Order.fromJson(Map<String, dynamic> j) => Order(
        id: j['id'] as int,
        estado: j['estado'] as String? ?? 'pagado',
        clienteNombre: j['cliente_nombre'] as String? ?? '',
        clienteEmail: j['cliente_email'] as String? ?? '',
        repartidorNombre: j['repartidor_nombre'] as String?,
        total: j['total'] as String? ?? '0',
        numeroFactura: j['numero_factura'] as String?,
        latEntrega: _parseDouble(j['lat_entrega']),
        lonEntrega: _parseDouble(j['lon_entrega']),
        direccionTexto: j['direccion_texto'] as String? ?? '',
        latRepartidor: _parseDouble(j['lat_repartidor']),
        lonRepartidor: _parseDouble(j['lon_repartidor']),
        createdAt: _parseDate(j['created_at']) ?? DateTime.now(),
        aceptadoEn: _parseDate(j['aceptado_en']),
        preparandoEn: _parseDate(j['preparando_en']),
        listoEn: _parseDate(j['listo_en']),
        enCaminoEn: _parseDate(j['en_camino_en']),
        entregadoEn: _parseDate(j['entregado_en']),
        historial: (j['historial'] as List<dynamic>? ?? [])
            .map((e) => HistorialEstado.fromJson(e as Map<String, dynamic>))
            .toList(),
        items: (j['items'] as List<dynamic>? ?? [])
            .map((e) => OrderItem.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class OrderNotification {
  const OrderNotification({
    required this.id,
    required this.tipo,
    required this.titulo,
    required this.mensaje,
    required this.pedidoId,
    required this.leida,
    required this.createdAt,
  });

  final int id;
  final String tipo;
  final String titulo;
  final String mensaje;
  final int? pedidoId;
  final bool leida;
  final DateTime createdAt;

  factory OrderNotification.fromJson(Map<String, dynamic> j) => OrderNotification(
        id: j['id'] as int,
        tipo: j['tipo'] as String? ?? '',
        titulo: j['titulo'] as String? ?? '',
        mensaje: j['mensaje'] as String? ?? '',
        pedidoId: j['pedido_id'] as int?,
        leida: j['leida'] as bool? ?? false,
        createdAt: DateTime.tryParse(j['created_at'] as String? ?? '') ?? DateTime.now(),
      );
}

class OrderServiceException implements Exception {
  const OrderServiceException(this.message);
  final String message;
  @override
  String toString() => message;
}
