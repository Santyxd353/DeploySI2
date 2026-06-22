import 'dart:convert';

import '../../../core/config/app_config.dart';
import '../../../core/config/tenant_config.dart';
import '../../../core/network/api_client.dart';
import 'models/order_models.dart';

class OrdersService {
  OrdersService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Map<String, String> _authHeaders(String token) => {
        'Authorization': 'Bearer $token',
        'X-Tenant-Subdomain': TenantConfig.subdomain,
      };

  Future<List<Order>> misPedidos({required String accessToken}) async {
    final resp = await _apiClient.get(
      '/api/pedidos/mis-pedidos/',
      headers: _authHeaders(accessToken),
    );
    final data = _apiClient.parseJsonMap(resp);
    if (resp.statusCode >= 400) {
      throw OrderServiceException(
        _extract(data, 'No se pudieron cargar tus pedidos.'),
      );
    }
    final results = (data['results'] as List<dynamic>? ?? []);
    return results.map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Order> detallePedido({
    required String accessToken,
    required int pedidoId,
  }) async {
    final resp = await _apiClient.get(
      '/api/pedidos/$pedidoId/tracking/',
      headers: _authHeaders(accessToken),
    );
    final data = _apiClient.parseJsonMap(resp);
    if (resp.statusCode >= 400) {
      throw OrderServiceException(_extract(data, 'No se pudo cargar el pedido.'));
    }
    return Order.fromJson(data);
  }

  Future<List<Order>> misEntregas({required String accessToken}) async {
    final resp = await _apiClient.get(
      '/api/pedidos/mis-entregas/',
      headers: _authHeaders(accessToken),
    );
    final data = _apiClient.parseJsonMap(resp);
    if (resp.statusCode >= 400) {
      throw OrderServiceException(_extract(data, 'No se pudieron cargar tus entregas.'));
    }
    return (data['results'] as List<dynamic>? ?? [])
        .map((e) => Order.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Order> cambiarEstado({
    required String accessToken,
    required int pedidoId,
    required String estado,
    String notas = '',
  }) async {
    final resp = await _apiClient.patch(
      '/api/pedidos/$pedidoId/estado/',
      headers: _authHeaders(accessToken),
      body: {'estado': estado, 'notas': notas},
    );
    final data = _apiClient.parseJsonMap(resp);
    if (resp.statusCode >= 400) {
      throw OrderServiceException(_extract(data, 'No se pudo cambiar el estado.'));
    }
    return Order.fromJson(data);
  }

  Future<List<OrderNotification>> notificaciones({required String accessToken}) async {
    final resp = await _apiClient.get(
      '/api/pedidos/notificaciones/?no_leidas=true&page_size=20',
      headers: _authHeaders(accessToken),
    );
    final data = _apiClient.parseJsonMap(resp);
    if (resp.statusCode >= 400) return [];
    return (data['results'] as List<dynamic>? ?? [])
        .map((e) => OrderNotification.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<int> contadorNoLeidas({required String accessToken}) async {
    final resp = await _apiClient.get(
      '/api/pedidos/notificaciones/no-leidas/',
      headers: _authHeaders(accessToken),
    );
    if (resp.statusCode >= 400) return 0;
    final data = _apiClient.parseJsonMap(resp);
    return data['no_leidas'] as int? ?? 0;
  }

  Future<void> marcarLeida({required String accessToken, required int id}) async {
    await _apiClient.patch(
      '/api/pedidos/notificaciones/$id/leida/',
      headers: _authHeaders(accessToken),
    );
  }

  /// Construye la URL WebSocket para el tracking de un pedido (cliente/admin).
  String wsTrackingUrl(String token, int pedidoId) {
    final base = AppConfig.apiBaseUrl.replaceFirst(RegExp(r'^http'), 'ws');
    final subdomain = TenantConfig.subdomain;
    return '$base/ws/pedidos/$pedidoId/tracking/?token=$token&subdomain=$subdomain';
  }

  /// Construye la URL WebSocket para enviar ubicación (repartidor).
  String wsUbicacionUrl(String token, int pedidoId) {
    final base = AppConfig.apiBaseUrl.replaceFirst(RegExp(r'^http'), 'ws');
    final subdomain = TenantConfig.subdomain;
    return '$base/ws/pedidos/$pedidoId/ubicacion/?token=$token&subdomain=$subdomain';
  }

  String _extract(Map<String, dynamic> data, String fallback) {
    return (data['detail'] as String?) ??
        (data['non_field_errors'] is List ? (data['non_field_errors'] as List).first.toString() : null) ??
        fallback;
  }
}
