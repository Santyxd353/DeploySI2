import 'dart:convert';

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
