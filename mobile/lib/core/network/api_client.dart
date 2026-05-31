import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import '../config/tenant_config.dart';

class ApiClient {
  ApiClient({http.Client? httpClient})
      : _httpClient = httpClient ?? http.Client();

  final http.Client _httpClient;

  Uri _buildUri(String path) {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return Uri.parse(path);
    }

    final normalizedPath = path.startsWith('/') ? path : '/$path';
    return Uri.parse('${AppConfig.apiBaseUrl}$normalizedPath');
  }

  /// Injects `X-Tenant-Subdomain` header when a tenant is configured.
  Map<String, String> _tenantHeaders() {
    final sub = TenantConfig.subdomain;
    if (sub.isEmpty) return {};
    return {'X-Tenant-Subdomain': sub};
  }

  Future<http.Response> get(String path, {Map<String, String>? headers}) {
    return _httpClient.get(
      _buildUri(path),
      headers: {..._tenantHeaders(), ...?headers},
    );
  }

  Future<http.Response> post(
    String path, {
    Map<String, String>? headers,
    Map<String, dynamic>? body,
  }) {
    return _httpClient.post(
      _buildUri(path),
      headers: {
        'Content-Type': 'application/json',
        ..._tenantHeaders(),
        ...?headers,
      },
      body: jsonEncode(body ?? <String, dynamic>{}),
    );
  }

  Future<http.Response> patch(
    String path, {
    Map<String, String>? headers,
    Map<String, dynamic>? body,
  }) {
    return _httpClient.patch(
      _buildUri(path),
      headers: {
        'Content-Type': 'application/json',
        ..._tenantHeaders(),
        ...?headers,
      },
      body: jsonEncode(body ?? <String, dynamic>{}),
    );
  }

  Future<http.Response> delete(
    String path, {Map<String, String>? headers}) {
    return _httpClient.delete(
      _buildUri(path),
      headers: {..._tenantHeaders(), ...?headers},
    );
  }

  Future<http.Response> postMultipartBytes(
    String path, {
    required String fieldName,
    required Uint8List bytes,
    required String filename,
    Map<String, String>? headers,
    Map<String, String>? fields,
  }) async {
    final request = http.MultipartRequest('POST', _buildUri(path));
    request.headers.addAll({..._tenantHeaders(), ...?headers});
    if (fields != null) {
      request.fields.addAll(fields);
    }
    request.files.add(http.MultipartFile.fromBytes(fieldName, bytes, filename: filename));

    final streamed = await request.send();
    return http.Response.fromStream(streamed);
  }

  Map<String, dynamic> parseJsonMap(http.Response response) {
    if (response.body.isEmpty) {
      return <String, dynamic>{};
    }

    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    if (decoded is Map<String, dynamic>) {
      return decoded;
    }

    return <String, dynamic>{};
  }
}
