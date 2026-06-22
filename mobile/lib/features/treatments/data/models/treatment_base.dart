class TreatmentBase {
  final int id;
  final String publicName;
  final String productName;
  final String productSku;
  final String dosageAmount;
  final String dosageUnit;
  final int frequencyHours;
  final int? frequencyMinutes;
  final int durationDays;
  final int? durationMinutes;
  final String instructions;
  final String? imageUrl;

  TreatmentBase({
    required this.id,
    required this.publicName,
    required this.productName,
    required this.productSku,
    required this.dosageAmount,
    required this.dosageUnit,
    required this.frequencyHours,
    this.frequencyMinutes,
    required this.durationDays,
    this.durationMinutes,
    required this.instructions,
    this.imageUrl,
  });

  String get dosageDisplay {
    final raw = dosageAmount.trim();
    if (raw.isEmpty) return '';

    final parsed = num.tryParse(raw);
    if (parsed == null) return raw;

    if (parsed == parsed.roundToDouble()) {
      return parsed.toInt().toString();
    }

    var text = parsed.toStringAsFixed(2);
    text = text.replaceFirst(RegExp(r'0+$'), '');
    text = text.replaceFirst(RegExp(r'\.$'), '');
    return text;
  }

  String get intervalLabel {
    final mins = frequencyMinutes;
    if (mins != null && mins > 0) {
      if (mins % 60 == 0) {
        final hours = mins ~/ 60;
        return 'cada ${hours}h';
      }
      return 'cada ${mins} min';
    }
    return 'cada ${frequencyHours}h';
  }

  Duration get intervalDuration {
    final mins = frequencyMinutes;
    if (mins != null && mins > 0) return Duration(minutes: mins);
    return Duration(hours: frequencyHours > 0 ? frequencyHours : 1);
  }

  factory TreatmentBase.fromJson(Map<String, dynamic> json) {
    return TreatmentBase(
      id: json['id'] ?? 0,
      publicName: (json['nombre_publico'] ?? '').toString(),
      productName: (json['producto_nombre'] ?? '').toString(),
      productSku: (json['producto_sku'] ?? '').toString(),
      dosageAmount: (json['dosis_cantidad'] ?? '').toString(),
      dosageUnit: (json['unidad_dosis'] ?? '').toString(),
      frequencyHours:
          int.tryParse((json['frecuencia_horas'] ?? 0).toString()) ?? 0,
        frequencyMinutes: int.tryParse((json['frecuencia_minutos'] ?? '').toString()),
      durationDays: int.tryParse((json['duracion_dias'] ?? 0).toString()) ?? 0,
        durationMinutes: int.tryParse((json['duracion_minutos'] ?? '').toString()),
      instructions: (json['instrucciones'] ?? '').toString(),
      imageUrl: json['producto_imagen']?.toString(),
    );
  }
}
