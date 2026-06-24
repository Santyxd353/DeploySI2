import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../features/auth/data/auth_service.dart';
import '../../features/auth/data/models/auth_user.dart';
import '../../features/treatments/data/notification_service.dart';

class AuthSessionManager {
  AuthSessionManager._();

  static const _keyAccess = 'auth_access_token';
  static const _keyRefresh = 'auth_refresh_token';
  static const _keyUser = 'auth_user_json';

  static final AuthService _authService = AuthService();

  static Future<void> saveSession(AuthSession session) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyAccess, session.accessToken);
    await prefs.setString(_keyRefresh, session.refreshToken);
    await prefs.setString(_keyUser, jsonEncode(session.user.toJson()));

    await TreatmentNotificationService.instance.syncPushToken(
      accessToken: session.accessToken,
    );
  }

  static Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyAccess);
    await prefs.remove(_keyRefresh);
    await prefs.remove(_keyUser);
  }

  static Future<AuthSession?> restoreClientSession() async {
    final prefs = await SharedPreferences.getInstance();
    var access = (prefs.getString(_keyAccess) ?? '').trim();
    final refresh = (prefs.getString(_keyRefresh) ?? '').trim();

    if (access.isEmpty || refresh.isEmpty) {
      return null;
    }

    try {
      var user = await _authService.getProfile(access);

      if (!user.canAccessMobileApp) {
        await clearSession();
        return null;
      }

      await TreatmentNotificationService.instance.syncPushToken(
        accessToken: access,
      );

      return AuthSession(
        accessToken: access,
        refreshToken: refresh,
        user: user,
      );
    } catch (_) {
      try {
        access = await _authService.refreshToken(refresh);
        final user = await _authService.getProfile(access);

        if (!user.canAccessMobileApp) {
          await clearSession();
          return null;
        }

        final session = AuthSession(
          accessToken: access,
          refreshToken: refresh,
          user: user,
        );
        await saveSession(session);
        return session;
      } catch (_) {
        await clearSession();
        return null;
      }
    }
  }

  static Future<AuthUser?> getStoredUser() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_keyUser);
    if (raw == null || raw.isEmpty) {
      return null;
    }

    try {
      final json = jsonDecode(raw);
      if (json is! Map<String, dynamic>) {
        return null;
      }

      return AuthUser.fromJson(json);
    } catch (_) {
      return null;
    }
  }

  static Future<String?> getAccessToken() async {
    final prefs = await SharedPreferences.getInstance();
    final value = prefs.getString(_keyAccess);
    if (value == null || value.trim().isEmpty) {
      return null;
    }

    return value.trim();
  }

  static Future<void> logoutAndClear() async {
    final access = await getAccessToken();
    if (access != null) {
      try {
        await TreatmentNotificationService.instance.deactivatePushTokens(
          accessToken: access,
        );
        await _authService.logout(accessToken: access);
      } catch (_) {
        // Session cleanup must continue even if backend logout fails.
      }
    }

    await clearSession();
  }
}
