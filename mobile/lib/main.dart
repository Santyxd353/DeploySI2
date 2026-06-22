import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';

import 'app.dart';
import 'core/config/app_config.dart';
import 'core/config/tenant_config.dart';
import 'features/treatments/data/notification_service.dart';

export 'app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await TenantConfig.load();
  await TreatmentNotificationService.instance.initialize();
  await TreatmentNotificationService.instance.initializePush();

  if (AppConfig.stripePublishableKey.trim().isNotEmpty) {
    Stripe.publishableKey = AppConfig.stripePublishableKey.trim();
  }

  runApp(const PharmacyClientApp());
}
