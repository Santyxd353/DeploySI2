import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/foundation.dart';

import '../../../core/network/api_client.dart';

class CartService {
  CartService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  static const String _guestCartTokenKey = 'guest_cart_token';

  Future<Map<String, String>> _buildHeaders({String? accessToken}) async {
    final headers = <String, String>{};

    if (accessToken != null && accessToken.trim().isNotEmpty) {
      headers['Authorization'] = 'Bearer ${accessToken.trim()}';
      return headers;
    }

    final guestToken = await getGuestCartToken();
    if (guestToken != null && guestToken.isNotEmpty) {
      headers['X-Carrito-Token'] = guestToken;
    }

    return headers;
  }

  Future<String?> getGuestCartToken() async {
    final prefs = await SharedPreferences.getInstance();
    final value = prefs.getString(_guestCartTokenKey);
    if (value == null || value.trim().isEmpty) return null;
    return value.trim();
  }

  Future<void> _persistGuestTokenIfPresent(Map<String, dynamic> data) async {
    final token = (data['invitado_token'] as String? ?? '').trim();
    if (token.isEmpty) return;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_guestCartTokenKey, token);
  }

  Future<void> clearGuestCartToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_guestCartTokenKey);
  }

  Future<Map<String, dynamic>> agregarItem({
    required int productoId,
    required int cantidad,
    String? accessToken,
  }) async {
    final response = await _apiClient.post(
      '/api/carrito/agregar/',
      headers: await _buildHeaders(accessToken: accessToken),
      body: {
        'producto_id': productoId,
        'cantidad': cantidad,
      },
    );

    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw CartServiceException(
        _extractDetail(data, fallback: 'No se pudo agregar al carrito.'),
      );
    }

    await _persistGuestTokenIfPresent(data);
    return data;
  }

  Future<Map<String, dynamic>> listar({String? accessToken}) async {
    final response = await _apiClient.get(
      '/api/carrito/',
      headers: await _buildHeaders(accessToken: accessToken),
    );

    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw CartServiceException(
        _extractDetail(data, fallback: 'No se pudo cargar el carrito.'),
      );
    }

    await _persistGuestTokenIfPresent(data);
    return data;
  }

  Future<Map<String, dynamic>> actualizarItem({
    required int itemId,
    required int cantidad,
    String? accessToken,
  }) async {
    final response = await _apiClient.patch(
      '/api/carrito/items/$itemId/',
      headers: await _buildHeaders(accessToken: accessToken),
      body: {'cantidad': cantidad},
    );

    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw CartServiceException(
        _extractDetail(data, fallback: 'No se pudo actualizar el item.'),
      );
    }

    await _persistGuestTokenIfPresent(data);
    return data;
  }

  Future<Map<String, dynamic>> eliminarItem({
    required int itemId,
    String? accessToken,
  }) async {
    final response = await _apiClient.delete(
      '/api/carrito/items/$itemId/',
      headers: await _buildHeaders(accessToken: accessToken),
    );

    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw CartServiceException(
        _extractDetail(data, fallback: 'No se pudo eliminar el item.'),
      );
    }

    await _persistGuestTokenIfPresent(data);
    return data;
  }

  Future<Map<String, dynamic>> confirmar({
    String? accessToken,
    String observacion = '',
    String estado = 'pendiente',
  }) async {
    final response = await _apiClient.post(
      '/api/carrito/confirmar/',
      headers: await _buildHeaders(accessToken: accessToken),
      body: {
        'estado': estado,
        'observacion': observacion,
      },
    );

    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw CartServiceException(
        _extractDetail(data, fallback: 'No se pudo confirmar la compra.'),
      );
    }

    await clearGuestCartToken();
    return data;
  }

  Future<Map<String, dynamic>> buscarPorAudio({
    required Uint8List audioBytes,
    required String filename,
    String? accessToken,
  }) async {
    final response = await _apiClient.postMultipartBytes(
      '/api/carrito/buscar-audio/',
      fieldName: 'audio',
      bytes: audioBytes,
      filename: filename,
      headers: await _buildHeaders(accessToken: accessToken),
    );

    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw CartServiceException(
        _extractDetail(data, fallback: 'No se pudo procesar la busqueda por voz.'),
      );
    }
    return data;
  }

  String _extractDetail(Map<String, dynamic> data, {required String fallback}) {
    final detail = data['detail'];
    if (detail is String && detail.trim().isNotEmpty) {
      return detail.trim();
    }

    final errors = data.entries.where((entry) => entry.value is List).toList();
    if (errors.isNotEmpty) {
      final first = errors.first.value as List<dynamic>;
      if (first.isNotEmpty) {
        return first.first.toString();
      }
    }

    return fallback;
  }
}

class CartServiceException implements Exception {
  const CartServiceException(this.message);

  final String message;

  @override
  String toString() => message;
}
