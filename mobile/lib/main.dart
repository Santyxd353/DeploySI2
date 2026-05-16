import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';

import 'app.dart';
import 'core/config/app_config.dart';
import 'core/config/tenant_config.dart';

export 'app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load persisted tenant subdomain before the first frame.
  await TenantConfig.load();

  if (AppConfig.stripePublishableKey.trim().isNotEmpty) {
    Stripe.publishableKey = AppConfig.stripePublishableKey.trim();
  }

  runApp(const PharmacyClientApp());
}
