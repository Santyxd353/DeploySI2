import '../../../core/network/api_client.dart';
import 'models/auth_user.dart';

class AuthService {
  AuthService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _apiClient.post(
        '/api/auth/login/',
        body: {'email': email.trim(), 'password': password},
      );

      final data = _apiClient.parseJsonMap(response);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AuthServiceException(
          _extractDetail(data, fallback: 'No se pudo iniciar sesion.'),
        );
      }

      final access = (data['access'] as String? ?? '').trim();
      final refresh = (data['refresh'] as String? ?? '').trim();
      final userJson = data['user'];

      if (access.isEmpty ||
          refresh.isEmpty ||
          userJson is! Map<String, dynamic>) {
        throw const AuthServiceException('Respuesta invalida del servidor.');
      }

      return AuthSession(
        accessToken: access,
        refreshToken: refresh,
        user: AuthUser.fromJson(userJson),
      );
    } on AuthServiceException {
      rethrow;
    } catch (error) {
      throw AuthServiceException(_mapNetworkOrUnexpectedError(error));
    }
  }

  Future<void> register({
    required String firstName,
    required String lastName,
    required String email,
    required String password,
  }) async {
    final response = await _apiClient.post(
      '/api/auth/register/',
      body: {
        'first_name': firstName.trim(),
        'last_name': lastName.trim(),
        'email': email.trim(),
        'password': password,
      },
    );

    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthServiceException(
        _extractDetail(data, fallback: 'No se pudo completar el registro.'),
      );
    }
  }

  Future<String> requestPasswordReset(String email) async {
    final response = await _apiClient.post(
      '/api/auth/password-reset/request/',
      body: {'email': email.trim()},
    );

    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthServiceException(
        _extractDetail(
          data,
          fallback: 'No se pudo procesar la solicitud de recuperacion.',
        ),
      );
    }

    final detail = data['detail'];
    if (detail is String && detail.trim().isNotEmpty) {
      return detail.trim();
    }

    return 'Si el correo existe, te enviaremos un enlace de recuperacion.';
  }

  Future<String> confirmPasswordReset({
    required String uid,
    required String token,
    required String password,
    required String passwordConfirm,
  }) async {
    final response = await _apiClient.post(
      '/api/auth/password-reset/confirm/',
      body: {
        'uid': uid.trim(),
        'token': token.trim(),
        'password': password,
        'password_confirm': passwordConfirm,
      },
    );

    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthServiceException(
        _extractDetail(data, fallback: 'No se pudo actualizar la contrasena.'),
      );
    }

    final detail = data['detail'];
    if (detail is String && detail.trim().isNotEmpty) {
      return detail.trim();
    }

    return 'Contrasena actualizada correctamente.';
  }

  Future<String> verifyEmail({
    required String uid,
    required String token,
  }) async {
    final response = await _apiClient.post(
      '/api/auth/verify-email/',
      body: {'uid': uid.trim(), 'token': token.trim()},
    );

    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthServiceException(
        _extractDetail(data, fallback: 'No se pudo verificar el correo.'),
      );
    }

    final detail = data['detail'];
    if (detail is String && detail.trim().isNotEmpty) {
      return detail.trim();
    }

    return 'Correo verificado correctamente. Ya puedes iniciar sesion.';
  }

  Future<AuthUser> getProfile(String accessToken) async {
    final response = await _apiClient.get(
      '/api/auth/me/',
      headers: {'Authorization': 'Bearer $accessToken'},
    );

    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthServiceException(
        _extractDetail(data, fallback: 'No se pudo recuperar el perfil.'),
      );
    }

    return AuthUser.fromJson(data);
  }

  Future<String> refreshToken(String refreshToken) async {
    final response = await _apiClient.post(
      '/api/auth/refresh/',
      body: {'refresh': refreshToken},
    );

    final data = _apiClient.parseJsonMap(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthServiceException(
        _extractDetail(data, fallback: 'No se pudo renovar la sesion.'),
      );
    }

    final access = (data['access'] as String? ?? '').trim();
    if (access.isEmpty) {
      throw const AuthServiceException(
        'No se recibio access token al renovar sesion.',
      );
    }

    return access;
  }

  Future<void> logout({required String accessToken}) async {
    await _apiClient.post(
      '/api/auth/logout/',
      headers: {'Authorization': 'Bearer $accessToken'},
    );
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

  String _mapNetworkOrUnexpectedError(Object error) {
    final text = error.toString().toLowerCase();

    if (text.contains('failed host lookup') ||
        text.contains('connection refused') ||
        text.contains('socketexception') ||
        text.contains('timed out')) {
      return 'No hay conexion con el servidor. Verifica API_BASE_URL, que el backend este encendido y que el telefono este en la misma red.';
    }

    if (text.contains('xmlhttprequest error') || text.contains('clientexception')) {
      return 'No se pudo conectar al backend. Revisa la URL de API y la red del dispositivo.';
    }

    return 'No se pudo iniciar sesion. Intenta nuevamente.';
  }
}

class AuthServiceException implements Exception {
  const AuthServiceException(this.message);

  final String message;

  @override
  String toString() => message;
}
