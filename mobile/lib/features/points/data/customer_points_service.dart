import 'dart:convert';

import '../../../core/network/api_client.dart';
import 'models/customer_points_models.dart';

class CustomerPointsService {
  CustomerPointsService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<CustomerPointsDashboard> loadDashboard({
    required String accessToken,
  }) async {
    final headers = _authHeaders(accessToken);

    final responses = await Future.wait([
      _apiClient.get('/api/puntos/mi-cuenta/', headers: headers),
      _apiClient.get('/api/puntos/catalogo-publico/', headers: headers),
      _apiClient.get('/api/puntos/mi-cuenta/historial/', headers: headers),
    ]);

    final accountResponse = responses[0];
    final catalogResponse = responses[1];
    final historyResponse = responses[2];

    final accountData = _apiClient.parseJsonMap(accountResponse);
    if (accountResponse.statusCode < 200 || accountResponse.statusCode >= 300) {
      throw CustomerPointsServiceException(
        _extractDetail(accountData, fallback: 'No se pudo cargar tu cuenta de puntos.'),
      );
    }

    final catalogJson = _parseListResponse(catalogResponse);
    final historyJson = _parseListResponse(historyResponse);

    return CustomerPointsDashboard(
      account: CustomerPointsAccount.fromJson(
        _asMap(accountData['cuenta']),
      ),
      configuration: CustomerPointsConfiguration.fromJson(
        _asMap(accountData['configuracion']),
      ),
      catalog: catalogJson.map(CustomerRewardItem.fromJson).toList(),
      history: historyJson.map(CustomerPointsTransaction.fromJson).toList(),
    );
  }

  Future<CustomerRedeemResult> redeemReward({
    required String accessToken,
    required int rewardId,
  }) async {
    final response = await _apiClient.post(
      '/api/puntos/canjear/',
      headers: _authHeaders(accessToken),
      body: {'catalogo_id': rewardId},
    );

    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw CustomerPointsServiceException(
        _extractDetail(data, fallback: 'No se pudo realizar el canje.'),
      );
    }

    return CustomerRedeemResult.fromJson(data);
  }

  Map<String, String> _authHeaders(String accessToken) {
    return {'Authorization': 'Bearer ${accessToken.trim()}'};
  }

  List<Map<String, dynamic>> _parseListResponse(response) {
    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw CustomerPointsServiceException(
        _extractDetail(data, fallback: 'No se pudo cargar la informacion de puntos.'),
      );
    }

    final directList = _decodeDirectList(response.bodyBytes);
    if (directList != null) {
      return directList;
    }

    final results = data['results'];
    if (results is List) {
      return results.whereType<Map<String, dynamic>>().toList();
    }

    return const <Map<String, dynamic>>[];
  }

  List<Map<String, dynamic>>? _decodeDirectList(List<int> bodyBytes) {
    if (bodyBytes.isEmpty) return null;

    final decoded = _tryDecodeJson(bodyBytes);
    if (decoded is List) {
      return decoded.whereType<Map<String, dynamic>>().toList();
    }

    return null;
  }

  dynamic _tryDecodeJson(List<int> bodyBytes) {
    try {
      final text = String.fromCharCodes(bodyBytes);
      return _jsonDecode(text);
    } catch (_) {
      return null;
    }
  }

  Map<String, dynamic> _asMap(dynamic raw) {
    if (raw is Map<String, dynamic>) {
      return raw;
    }
    return const <String, dynamic>{};
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

dynamic _jsonDecode(String source) {
  return source.isEmpty ? null : jsonDecode(source);
}

class CustomerPointsServiceException implements Exception {
  const CustomerPointsServiceException(this.message);

  final String message;

  @override
  String toString() => message;
}