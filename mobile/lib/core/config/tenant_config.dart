import 'package:shared_preferences/shared_preferences.dart';

import 'app_config.dart';

/// Stores and retrieves the current tenant subdomain.
///
/// Priority:
///   1. `--dart-define=TENANT_SUBDOMAIN=farmacia1` (compile-time, immutable)
///   2. Value saved via [save] (persisted in SharedPreferences)
class TenantConfig {
  TenantConfig._();

  static const _keySubdomain = 'tenant_subdomain';

  // In-memory cache so ApiClient can read synchronously.
  static String _subdomain = AppConfig.tenantSubdomainFromEnv;

  /// Current tenant subdomain (empty string = no tenant / public schema).
  static String get subdomain => _subdomain;

  /// Loads the persisted subdomain into the in-memory cache.
  /// Call once at app startup (before [runApp]).
  /// If a compile-time value was provided via dart-define it takes precedence.
  static Future<void> load() async {
    if (AppConfig.tenantSubdomainFromEnv.isNotEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    _subdomain = prefs.getString(_keySubdomain) ?? '';
  }

  /// Persists [subdomain] and updates the in-memory cache.
  static Future<void> save(String subdomain) async {
    _subdomain = subdomain.trim();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keySubdomain, _subdomain);
  }

  /// Clears the persisted subdomain (not applicable when using dart-define).
  static Future<void> clear() async {
    _subdomain = AppConfig.tenantSubdomainFromEnv;
    if (AppConfig.tenantSubdomainFromEnv.isEmpty) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_keySubdomain);
    }
  }
}
