import 'intake_log.dart';
import 'treatment_base.dart';

class ActiveTreatment {
  final int id;
  final String status;
  final DateTime startDate;
  final DateTime expectedEndDate;
  final bool remindersEnabled;
  final TreatmentBase base;
  final List<IntakeLog> todayIntakes;
  final DateTime? nextIntakeAt;
  final DateTime? scheduledEndAt;
  final DateTime? activatedAt;
  final DateTime? pausedSince;
  final int targetDoses;
  final int takenDoses;

  ActiveTreatment({
    required this.id,
    required this.status,
    required this.startDate,
    required this.expectedEndDate,
    required this.remindersEnabled,
    required this.base,
    required this.todayIntakes,
    this.nextIntakeAt,
    this.scheduledEndAt,
    this.activatedAt,
    this.pausedSince,
    required this.targetDoses,
    required this.takenDoses,
  });

  factory ActiveTreatment.fromJson(Map<String, dynamic> json) {
    final rawIntakes = json['tomas_hoy'];
    final intakes = rawIntakes is List
        ? rawIntakes
              .whereType<Map<String, dynamic>>()
              .map(IntakeLog.fromJson)
              .toList()
        : <IntakeLog>[];

    return ActiveTreatment(
      id: json['id'] ?? 0,
      status: (json['estado'] ?? 'activo').toString(),
      startDate: _parseApiDateTime(json['fecha_inicio']?.toString()),
      expectedEndDate: _parseApiDateTime(
        json['fecha_fin_esperada']?.toString(),
      ),
      remindersEnabled: json['recordatorios_activos'] == true,
      base: TreatmentBase.fromJson(
        (json['tratamiento_base'] as Map<String, dynamic>? ??
            <String, dynamic>{}),
      ),
      todayIntakes: intakes,
      nextIntakeAt: _tryParseApiDateTime(json['proxima_toma']?.toString()),
      scheduledEndAt: _tryParseApiDateTime(
        json['fecha_fin_programada']?.toString(),
      ),
      activatedAt: _tryParseApiDateTime(json['activado_en']?.toString()),
      pausedSince: _tryParseApiDateTime(json['pausa_desde']?.toString()),
      targetDoses: int.tryParse((json['dosis_objetivo'] ?? 0).toString()) ?? 0,
      takenDoses: int.tryParse((json['dosis_tomadas'] ?? 0).toString()) ?? 0,
    );
  }

  static DateTime _parseApiDateTime(String? raw) {
    return _tryParseApiDateTime(raw) ?? DateTime.now();
  }

  static DateTime? _tryParseApiDateTime(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    final parsed = DateTime.tryParse(raw.trim());
    if (parsed == null) return null;
    return parsed.isUtc ? parsed.toLocal() : parsed;
  }
}
