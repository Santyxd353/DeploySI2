class IntakeLog {
  final int id;
  final DateTime scheduledAt;
  final DateTime? takenAt;
  final String status;
  final String? doseTaken;

  IntakeLog({
    required this.id,
    required this.scheduledAt,
    required this.status,
    this.takenAt,
    this.doseTaken,
  });

  factory IntakeLog.fromJson(Map<String, dynamic> json) {
    return IntakeLog(
      id: json['id'] ?? 0,
      scheduledAt: _parseApiDateTime(
        json['fecha_hora_programada']?.toString(),
      ),
      takenAt: _tryParseApiDateTime(json['fecha_hora_real']?.toString()),
      status: (json['estado'] ?? 'pendiente').toString(),
      doseTaken: json['dosis_tomada']?.toString(),
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
