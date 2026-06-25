class PrescriptionCapture {
  const PrescriptionCapture({
    required this.id,
    required this.status,
    required this.textoExtraido,
    required this.requiresManualReview,
    required this.items,
    required this.header,
    this.errorDetail = '',
    this.imageUrl,
    this.cartSent = false,
    this.cartSentAt,
    this.rawResponse = const <String, dynamic>{},
    this.extractedData = const <String, dynamic>{},
    this.resolvedData = const <String, dynamic>{},
  });

  final int id;
  final String status;
  final String textoExtraido;
  final bool requiresManualReview;
  final String errorDetail;
  final String? imageUrl;
  final bool cartSent;
  final DateTime? cartSentAt;
  final PrescriptionHeader header;
  final List<PrescriptionCaptureItem> items;
  final Map<String, dynamic> rawResponse;
  final Map<String, dynamic> extractedData;
  final Map<String, dynamic> resolvedData;

  factory PrescriptionCapture.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    final items = rawItems is List
        ? rawItems
              .whereType<Map<String, dynamic>>()
              .map(PrescriptionCaptureItem.fromJson)
              .toList()
        : const <PrescriptionCaptureItem>[];

    final extractedData = _asMap(json['datos_extraidos']);

    return PrescriptionCapture(
      id: (json['id'] as num?)?.toInt() ?? 0,
      status: (json['estado'] as String? ?? 'pendiente').trim(),
      textoExtraido: (json['texto_extraido'] as String? ?? '').trim(),
      requiresManualReview: json['requiere_revision_manual'] != false,
      errorDetail: (json['error_detalle'] as String? ?? '').trim(),
      imageUrl: (json['archivo_imagen_url'] as String?)?.trim(),
      cartSent: json['carrito_enviado'] == true,
      cartSentAt: DateTime.tryParse(
        json['carrito_enviado_at']?.toString() ?? '',
      ),
      header: PrescriptionHeader.fromJson(_asMap(extractedData['encabezado'])),
      items: items,
      rawResponse: _asMap(json['respuesta_ia']),
      extractedData: extractedData,
      resolvedData: _asMap(json['datos_resueltos']),
    );
  }
}

class PrescriptionHeader {
  const PrescriptionHeader({
    required this.medico,
    required this.paciente,
    required this.fecha,
  });

  final String medico;
  final String paciente;
  final String fecha;

  factory PrescriptionHeader.fromJson(Map<String, dynamic> json) {
    return PrescriptionHeader(
      medico: (json['medico'] as String? ?? '').trim(),
      paciente: (json['paciente'] as String? ?? '').trim(),
      fecha: (json['fecha'] as String? ?? '').trim(),
    );
  }
}

class PrescriptionCaptureItem {
  const PrescriptionCaptureItem({
    required this.id,
    required this.order,
    required this.detectedName,
    required this.detectedPresentation,
    required this.detectedQuantity,
    required this.detectedInstructions,
    required this.detectedDuration,
    required this.customerDecision,
    required this.resolvedName,
    required this.resolvedInstructions,
    required this.resolvedDuration,
    this.productId,
    this.treatmentBaseId,
  });

  final int id;
  final int order;
  final String detectedName;
  final String detectedPresentation;
  final String detectedQuantity;
  final String detectedInstructions;
  final String detectedDuration;
  final String customerDecision;
  final String resolvedName;
  final String resolvedInstructions;
  final String resolvedDuration;
  final int? productId;
  final int? treatmentBaseId;

  factory PrescriptionCaptureItem.fromJson(Map<String, dynamic> json) {
    return PrescriptionCaptureItem(
      id: (json['id'] as num?)?.toInt() ?? 0,
      order: (json['orden'] as num?)?.toInt() ?? 0,
      detectedName: (json['nombre_detectado'] as String? ?? '').trim(),
      detectedPresentation: (json['presentacion_detectada'] as String? ?? '')
          .trim(),
      detectedQuantity: (json['cantidad_detectada'] as String? ?? '').trim(),
      detectedInstructions: (json['indicaciones_detectadas'] as String? ?? '')
          .trim(),
      detectedDuration: (json['duracion_detectada'] as String? ?? '').trim(),
      customerDecision: (json['decision_cliente'] as String? ?? 'pendiente')
          .trim(),
      resolvedName: (json['nombre_resuelto'] as String? ?? '').trim(),
      resolvedInstructions: (json['indicaciones_resueltas'] as String? ?? '')
          .trim(),
      resolvedDuration: (json['duracion_resuelta'] as String? ?? '').trim(),
      productId: (json['producto'] as num?)?.toInt(),
      treatmentBaseId: (json['tratamiento_base'] as num?)?.toInt(),
    );
  }
}

class SavedPrescription {
  const SavedPrescription({
    required this.id,
    required this.codigo,
    required this.estado,
    required this.observacion,
    this.fechaEmision,
    this.fechaVencimiento,
    this.fechaValidez,
  });

  final int id;
  final String codigo;
  final String estado;
  final String observacion;
  final DateTime? fechaEmision;
  final DateTime? fechaVencimiento;
  final DateTime? fechaValidez;

  factory SavedPrescription.fromJson(Map<String, dynamic> json) {
    return SavedPrescription(
      id: (json['id'] as num?)?.toInt() ?? 0,
      codigo: (json['codigo'] as String? ?? '').trim(),
      estado: (json['estado'] as String? ?? '').trim(),
      observacion: (json['observacion'] as String? ?? '').trim(),
      fechaEmision: DateTime.tryParse(json['fecha_emision']?.toString() ?? ''),
      fechaVencimiento: DateTime.tryParse(
        json['fecha_vencimiento']?.toString() ?? '',
      ),
      fechaValidez: DateTime.tryParse(json['fecha_validez']?.toString() ?? ''),
    );
  }
}

Map<String, dynamic> _asMap(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  return const <String, dynamic>{};
}
