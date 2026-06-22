import 'package:flutter/foundation.dart';

class AppConfig {
  AppConfig._();

  static const _apiBaseUrlFromEnv = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  static const tenantSubdomainFromEnv = String.fromEnvironment(
    'TENANT_SUBDOMAIN',
    defaultValue: '',
  );

  static String get apiBaseUrl {
    if (_apiBaseUrlFromEnv.isNotEmpty) {
      return _apiBaseUrlFromEnv;
    }

    if (kIsWeb) {
      return 'http://localhost:8000';
    }

    return 'http://10.0.2.2:8000';
  }

  static const stripePublishableKey = String.fromEnvironment(
    'STRIPE_PUBLISHABLE_KEY',
    defaultValue: '',
  );

  static const stripeMerchantDisplayName = String.fromEnvironment(
    'STRIPE_MERCHANT_DISPLAY_NAME',
    defaultValue: 'Farmacia Bibosi',
  );
}
