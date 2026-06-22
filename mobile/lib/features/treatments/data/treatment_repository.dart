import 'dart:convert';

import '../../../core/network/api_client.dart';
import 'models/active_treatment.dart';
import 'models/treatment_base.dart';

class TreatmentRepository {
  TreatmentRepository({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Map<String, String> _authHeaders(String? accessToken) {
    if (accessToken == null || accessToken.trim().isEmpty) {
      return <String, String>{};
    }
    return {'Authorization': 'Bearer ${accessToken.trim()}'};
  }

  Future<List<TreatmentBase>> getAvailableTreatments({
    required String accessToken,
  }) async {
    final response = await _apiClient.get(
      '/api/tratamientos/disponibles/',
      headers: _authHeaders(accessToken),
    );
    final decoded = jsonDecode(utf8.decode(response.bodyBytes));

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _extractDetail(
          decoded,
          fallback: 'No se pudo cargar tratamientos disponibles.',
        ),
      );
    }

    if (decoded is! List) return <TreatmentBase>[];
    return decoded
        .whereType<Map<String, dynamic>>()
        .map(TreatmentBase.fromJson)
        .toList();
  }

  Future<List<ActiveTreatment>> getMyTreatments({
    required String accessToken,
  }) async {
    final response = await _apiClient.get(
      '/api/tratamientos/mis-tratamientos/',
      headers: _authHeaders(accessToken),
    );
    final decoded = jsonDecode(utf8.decode(response.bodyBytes));

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _extractDetail(
          decoded,
          fallback: 'No se pudo cargar tus tratamientos.',
        ),
      );
    }

    if (decoded is! List) return <ActiveTreatment>[];
    return decoded
        .whereType<Map<String, dynamic>>()
        .map(ActiveTreatment.fromJson)
        .toList();
  }

  Future<ActiveTreatment> startTreatment({
    required int baseId,
    required String accessToken,
  }) async {
    final response = await _apiClient.post(
      '/api/tratamientos/iniciar/',
      headers: _authHeaders(accessToken),
      body: {'tratamiento_base_id': baseId},
    );
    final decoded = _apiClient.parseJsonMap(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _extractDetail(decoded, fallback: 'No se pudo iniciar el tratamiento.'),
      );
    }

    return ActiveTreatment.fromJson(decoded);
  }

  Future<void> takeDose({
    required int activeTreatmentId,
    required int intakeId,
    required String accessToken,
  }) async {
    final response = await _apiClient.post(
      '/api/tratamientos/$activeTreatmentId/tomar/',
      headers: _authHeaders(accessToken),
      body: {'toma_id': intakeId},
    );
    final decoded = _apiClient.parseJsonMap(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _extractDetail(decoded, fallback: 'No se pudo marcar la toma.'),
      );
    }
  }

  Future<void> postponeDose({
    required int activeTreatmentId,
    required int intakeId,
    required int minutes,
    required String accessToken,
  }) async {
    final response = await _apiClient.post(
      '/api/tratamientos/$activeTreatmentId/posponer/',
      headers: _authHeaders(accessToken),
      body: {'toma_id': intakeId, 'minutos': minutes},
    );
    final decoded = _apiClient.parseJsonMap(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _extractDetail(decoded, fallback: 'No se pudo posponer la toma.'),
      );
    }
  }

  Future<void> omitDose({
    required int activeTreatmentId,
    required int intakeId,
    required String accessToken,
  }) async {
    final response = await _apiClient.post(
      '/api/tratamientos/$activeTreatmentId/omitir/',
      headers: _authHeaders(accessToken),
      body: {'toma_id': intakeId},
    );
    final decoded = _apiClient.parseJsonMap(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _extractDetail(decoded, fallback: 'No se pudo omitir la toma.'),
      );
    }
  }

  Future<void> cancelTreatment({
    required int activeTreatmentId,
    required String accessToken,
  }) async {
    final response = await _apiClient.post(
      '/api/tratamientos/$activeTreatmentId/cancelar/',
      headers: _authHeaders(accessToken),
    );
    final decoded = _apiClient.parseJsonMap(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _extractDetail(decoded, fallback: 'No se pudo cancelar el tratamiento.'),
      );
    }
  }

  Future<Map<String, dynamic>> getMonthlyHistory({
    required String month,
    required String accessToken,
  }) async {
    final response = await _apiClient.get(
      '/api/tratamientos/historial/mensual/?mes=$month',
      headers: _authHeaders(accessToken),
    );

    final decoded = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _extractDetail(
          decoded,
          fallback: 'No se pudo cargar el historial mensual.',
        ),
      );
    }

    return decoded;
  }

  Future<Map<String, dynamic>> getWeeklyStats({
    required String accessToken,
  }) async {
    final response = await _apiClient.get(
      '/api/tratamientos/historial/semanal/',
      headers: _authHeaders(accessToken),
    );
    final decoded = _apiClient.parseJsonMap(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _extractDetail(
          decoded,
          fallback: 'No se pudo cargar estadísticas semanales.',
        ),
      );
    }

    return decoded;
  }

  Future<Map<String, dynamic>> getDailyHistory({
    required String date,
    required String accessToken,
  }) async {
    final response = await _apiClient.get(
      '/api/tratamientos/historial/dia/?fecha=$date',
      headers: _authHeaders(accessToken),
    );
    final decoded = _apiClient.parseJsonMap(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _extractDetail(
          decoded,
          fallback: 'No se pudo cargar el detalle diario.',
        ),
      );
    }

    return decoded;
  }

  Future<Map<String, dynamic>> getAllTreatmentsHistory({
    required String accessToken,
  }) async {
    final response = await _apiClient.get(
      '/api/tratamientos/historial/todos/',
      headers: _authHeaders(accessToken),
    );
    final decoded = _apiClient.parseJsonMap(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _extractDetail(
          decoded,
          fallback: 'No se pudo cargar el historial de tratamientos.',
        ),
      );
    }

    return decoded;
  }

  String _extractDetail(dynamic data, {required String fallback}) {
    if (data is Map<String, dynamic>) {
      final detail = data['detail'];
      if (detail is String && detail.trim().isNotEmpty) return detail.trim();
    }
    return fallback;
  }
}
