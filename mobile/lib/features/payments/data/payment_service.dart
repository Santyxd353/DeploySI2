import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';

import '../../../core/config/app_config.dart';
import '../../../core/network/api_client.dart';

class PaymentService {
  PaymentService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<Map<String, dynamic>> crearIntentPago({
    required double total,
    String? accessToken,
    Map<String, String>? metadata,
  }) async {
    final response = await _apiClient.post(
      '/api/ventas/intent-pago/',
      headers: _buildHeaders(accessToken: accessToken),
      body: {
        'total': total,
        if (metadata != null && metadata.isNotEmpty) 'metadata': metadata,
      },
    );

    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw PaymentServiceException(
        _extractDetail(data, fallback: 'No se pudo crear el intent de pago.'),
      );
    }

    return data;
  }

  Future<void> abrirPaymentSheet({required String clientSecret}) async {
    if (AppConfig.stripePublishableKey.trim().isEmpty) {
      throw const PaymentServiceException(
        'Stripe no esta configurado en mobile. Define STRIPE_PUBLISHABLE_KEY.',
      );
    }

    await Stripe.instance.initPaymentSheet(
      paymentSheetParameters: SetupPaymentSheetParameters(
        merchantDisplayName: AppConfig.stripeMerchantDisplayName,
        paymentIntentClientSecret: clientSecret,
        style: ThemeMode.light,
      ),
    );

    await Stripe.instance.presentPaymentSheet();
  }

  Future<Map<String, dynamic>> confirmarPagoVenta({
    required String paymentIntentId,
    required Map<String, dynamic> datosFactura,
    String? carritoToken,
    String? accessToken,
  }) async {
    final response = await _apiClient.post(
      '/api/ventas/confirmar-pago/',
      headers: _buildHeaders(accessToken: accessToken),
      body: {
        'payment_intent_id': paymentIntentId,
        if (carritoToken != null && carritoToken.trim().isNotEmpty)
          'carrito_token': carritoToken.trim(),
        'datos_factura': datosFactura,
      },
    );

    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw PaymentServiceException(
        _extractDetail(
          data,
          fallback: 'No se pudo confirmar el pago con el backend.',
        ),
      );
    }

    return data;
  }

  Future<List<Map<String, dynamic>>> listarMisPagos({
    required String accessToken,
  }) async {
    final response = await _apiClient.get(
      '/api/ventas/mis-facturas/',
      headers: _buildHeaders(accessToken: accessToken),
    );

    dynamic decoded;
    if (response.body.isNotEmpty) {
      decoded = jsonDecode(utf8.decode(response.bodyBytes));
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final data = decoded is Map<String, dynamic>
          ? decoded
          : <String, dynamic>{};
      throw PaymentServiceException(
        _extractDetail(
          data,
          fallback: 'No se pudo cargar el historial de pagos.',
        ),
      );
    }

    if (decoded is Map<String, dynamic>) {
      final results = decoded['results'];
      if (results is List) {
        return results.whereType<Map<String, dynamic>>().toList();
      }
      return <Map<String, dynamic>>[];
    }

    if (decoded is List) {
      return decoded.whereType<Map<String, dynamic>>().toList();
    }

    return <Map<String, dynamic>>[];
  }

  Future<Map<String, dynamic>> obtenerDetalleFactura({
    required String numeroFactura,
    required String accessToken,
  }) async {
    final response = await _apiClient.get(
      '/api/ventas/factura/$numeroFactura/',
      headers: _buildHeaders(accessToken: accessToken),
    );

    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw PaymentServiceException(
        _extractDetail(
          data,
          fallback: 'No se pudo cargar el detalle de la factura.',
        ),
      );
    }

    return data;
  }

  Map<String, String> _buildHeaders({String? accessToken}) {
    if (accessToken == null || accessToken.trim().isEmpty) {
      return <String, String>{};
    }
    return {'Authorization': 'Bearer ${accessToken.trim()}'};
  }

  String _extractDetail(Map<String, dynamic> data, {required String fallback}) {
    final detail = data['detail'];
    if (detail is String && detail.trim().isNotEmpty) {
      return detail.trim();
    }

    final code = data['code'];
    if (code is String && code.trim().isNotEmpty) {
      return code.trim();
    }

    return fallback;
  }
}

class PaymentServiceException implements Exception {
  const PaymentServiceException(this.message);

  final String message;

  @override
  String toString() => message;
}
