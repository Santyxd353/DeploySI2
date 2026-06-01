import 'dart:convert';

import '../../../core/network/api_client.dart';

class CustomerOpinion {
  const CustomerOpinion({
    required this.id,
    required this.tipo,
    required this.puntuacion,
    required this.comentario,
    required this.estado,
    required this.respuestaStaff,
    required this.createdAt,
  });

  final int id;
  final String tipo;
  final int puntuacion;
  final String comentario;
  final String estado;
  final String respuestaStaff;
  final DateTime? createdAt;

  factory CustomerOpinion.fromJson(Map<String, dynamic> json) {
    return CustomerOpinion(
      id: (json['id'] as num?)?.toInt() ?? 0,
      tipo: (json['tipo'] as String? ?? 'general').trim(),
      puntuacion: (json['puntuacion'] as num?)?.toInt() ?? 0,
      comentario: (json['comentario'] as String? ?? '').trim(),
      estado: (json['estado'] as String? ?? 'pendiente').trim(),
      respuestaStaff: (json['respuesta_staff'] as String? ?? '').trim(),
      createdAt: DateTime.tryParse((json['created_at'] as String? ?? '').trim()),
    );
  }
}

class OpinionsService {
  OpinionsService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<void> crearOpinion({
    required String accessToken,
    required String tipo,
    required int puntuacion,
    required String comentario,
  }) async {
    final response = await _apiClient.post(
      '/api/opiniones/',
      headers: _authHeaders(accessToken),
      body: {
        'tipo': tipo,
        'puntuacion': puntuacion,
        'comentario': comentario,
      },
    );

    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw OpinionsServiceException(
        _extractDetail(data, fallback: 'No se pudo enviar la opinion.'),
      );
    }
  }

  Future<List<CustomerOpinion>> listarMisOpiniones({
    required String accessToken,
  }) async {
    final response = await _apiClient.get(
      '/api/opiniones/mias/',
      headers: _authHeaders(accessToken),
    );

    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw OpinionsServiceException(
        _extractDetail(data, fallback: 'No se pudieron cargar tus opiniones.'),
      );
    }

    final raw = _decodeJson(response.bodyBytes);
    if (raw is List) {
      return raw
          .whereType<Map<String, dynamic>>()
          .map(CustomerOpinion.fromJson)
          .toList();
    }

    final results = data['results'];
    if (results is List) {
      return results
          .whereType<Map<String, dynamic>>()
          .map(CustomerOpinion.fromJson)
          .toList();
    }

    return const <CustomerOpinion>[];
  }

  Map<String, String> _authHeaders(String accessToken) {
    return {'Authorization': 'Bearer ${accessToken.trim()}'};
  }

  dynamic _decodeJson(List<int> bodyBytes) {
    if (bodyBytes.isEmpty) return null;
    try {
      return jsonDecode(utf8.decode(bodyBytes));
    } catch (_) {
      return null;
    }
  }

  String _extractDetail(Map<String, dynamic> data, {required String fallback}) {
    final detail = data['detail'];
    if (detail is String && detail.trim().isNotEmpty) {
      return detail.trim();
    }

    for (final entry in data.entries) {
      final value = entry.value;
      if (value is List && value.isNotEmpty) {
        return value.first.toString();
      }
    }

    return fallback;
  }
}

class OpinionsServiceException implements Exception {
  const OpinionsServiceException(this.message);

  final String message;

  @override
  String toString() => message;
}
