import 'dart:typed_data';

import '../../../core/network/api_client.dart';
import 'models/prescription_models.dart';

class PrescriptionService {
  PrescriptionService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<PrescriptionCapture> createCapture({
    required Uint8List imageBytes,
    required String filename,
    String mimeType = 'image/jpeg',
    int? clienteId,
    String? accessToken,
  }) async {
    final response = await _apiClient.postMultipartBytes(
      '/api/prescripciones/capturas/',
      fieldName: 'archivo_imagen',
      bytes: imageBytes,
      filename: filename,
      headers: _buildHeaders(accessToken: accessToken),
      fields: {
        'mime_type': mimeType,
        if (clienteId != null) 'cliente': '$clienteId',
        'nombre_archivo_original': filename,
      },
    );

    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw PrescriptionServiceException(
        _extractDetail(data, fallback: 'No se pudo procesar la receta.'),
      );
    }

    return PrescriptionCapture.fromJson(data);
  }

  Future<PrescriptionCapture> getCapture(int captureId, {String? accessToken}) async {
    final response = await _apiClient.get(
      '/api/prescripciones/capturas/$captureId/',
      headers: _buildHeaders(accessToken: accessToken),
    );
    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw PrescriptionServiceException(
        _extractDetail(data, fallback: 'No se pudo cargar la captura.'),
      );
    }
    return PrescriptionCapture.fromJson(data);
  }

  Future<PrescriptionCapture> updateCapture({
    required int captureId,
    Map<String, dynamic>? extractedData,
    Map<String, dynamic>? resolvedData,
    String? extractedText,
    bool? requiresManualReview,
    String? accessToken,
  }) async {
    final response = await _apiClient.patch(
      '/api/prescripciones/capturas/$captureId/',
      headers: _buildHeaders(accessToken: accessToken),
      body: {
        if (extractedData != null) 'datos_extraidos': extractedData,
        if (resolvedData != null) 'datos_resueltos': resolvedData,
        if (extractedText != null) 'texto_extraido': extractedText,
        if (requiresManualReview != null) 'requiere_revision_manual': requiresManualReview,
      },
    );
    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw PrescriptionServiceException(
        _extractDetail(data, fallback: 'No se pudo actualizar la captura.'),
      );
    }
    return PrescriptionCapture.fromJson(data);
  }

  Future<Map<String, dynamic>> updateCaptureItem({
    required int captureId,
    required int itemId,
    required Map<String, dynamic> payload,
    String? accessToken,
  }) async {
    final response = await _apiClient.patch(
      '/api/prescripciones/capturas/$captureId/items/$itemId/',
      headers: _buildHeaders(accessToken: accessToken),
      body: payload,
    );
    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw PrescriptionServiceException(
        _extractDetail(data, fallback: 'No se pudo actualizar el item de receta.'),
      );
    }
    return data;
  }

  Future<PrescriptionCapture> confirmCapture({
    required int captureId,
    Map<String, dynamic>? recipeSummary,
    List<Map<String, dynamic>>? recipeItems,
    String? accessToken,
  }) async {
    final response = await _apiClient.post(
      '/api/prescripciones/capturas/$captureId/confirmar/',
      headers: _buildHeaders(accessToken: accessToken),
      body: {
        if (recipeSummary != null) 'resumen_receta': recipeSummary,
        if (recipeItems != null) 'items_receta': recipeItems,
      },
    );
    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw PrescriptionServiceException(
        _extractDetail(data, fallback: 'No se pudo confirmar la captura.'),
      );
    }
    return PrescriptionCapture.fromJson(data);
  }

  Future<Map<String, dynamic>> applyCapture({
    required int captureId,
    List<int>? confirmedItemIds,
    bool createTreatments = false,
    bool addToCart = false,
    String? accessToken,
  }) async {
    final response = await _apiClient.post(
      '/api/prescripciones/capturas/$captureId/aplicar/',
      headers: _buildHeaders(accessToken: accessToken),
      body: {
        if (confirmedItemIds != null) 'item_ids_confirmados': confirmedItemIds,
        'crear_tratamientos': createTreatments,
        'agregar_a_carrito': addToCart,
      },
    );
    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw PrescriptionServiceException(
        _extractDetail(data, fallback: 'No se pudo aplicar la receta.'),
      );
    }
    return data;
  }

  Future<SavedPrescription> getSavedRecipe(int recipeId, {String? accessToken}) async {
    final response = await _apiClient.get(
      '/api/prescripciones/recetas/$recipeId/',
      headers: _buildHeaders(accessToken: accessToken),
    );
    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw PrescriptionServiceException(
        _extractDetail(data, fallback: 'No se pudo cargar la receta guardada.'),
      );
    }
    return SavedPrescription.fromJson(data);
  }

  Future<SavedPrescription> updateSavedRecipe({
    required int recipeId,
    String? observation,
    String? expirationDate,
    String? validityDate,
    String? accessToken,
  }) async {
    final response = await _apiClient.patch(
      '/api/prescripciones/recetas/$recipeId/',
      headers: _buildHeaders(accessToken: accessToken),
      body: {
        if (observation != null) 'observacion': observation,
        if (expirationDate != null) 'fecha_vencimiento': expirationDate,
        if (validityDate != null) 'fecha_validez': validityDate,
      },
    );
    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw PrescriptionServiceException(
        _extractDetail(data, fallback: 'No se pudo actualizar la receta guardada.'),
      );
    }
    return SavedPrescription.fromJson(data);
  }

  Map<String, String> _buildHeaders({String? accessToken}) {
    if (accessToken == null || accessToken.trim().isEmpty) {
      return {};
    }
    return {'Authorization': 'Bearer ${accessToken.trim()}'};
  }

  String _extractDetail(Map<String, dynamic> data, {required String fallback}) {
    final detail = data['detail'];
    if (detail is String && detail.trim().isNotEmpty) {
      return detail.trim();
    }
    return fallback;
  }
}

class PrescriptionServiceException implements Exception {
  const PrescriptionServiceException(this.message);

  final String message;

  @override
  String toString() => message;
}
