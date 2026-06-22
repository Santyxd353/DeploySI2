import 'dart:async';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:timezone/data/latest_all.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

import '../../../core/network/api_client.dart';
import '../../../firebase_options.dart';

/// Service for scheduling and cancelling local dose-reminder notifications.
class TreatmentNotificationService {
  TreatmentNotificationService._();

  static final TreatmentNotificationService instance =
      TreatmentNotificationService._();

  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  final ApiClient _apiClient = ApiClient();
  StreamSubscription<String>? _tokenRefreshSubscription;
  String? _tokenRefreshAccessToken;
  bool _initialized = false;
  bool _pushInitialized = false;

  Future<void> initialize() async {
    if (_initialized) return;

    tz_data.initializeTimeZones();

    const AndroidInitializationSettings androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    await _plugin.initialize(
      const InitializationSettings(android: androidSettings),
    );

    // Request permission on Android 13+
    await _plugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.requestNotificationsPermission();

    _initialized = true;
  }

  Future<void> initializePush() async {
    if (_pushInitialized) return;

    try {
      final apps = Firebase.apps;
      if (apps.isEmpty) {
        await Firebase.initializeApp(
          options: DefaultFirebaseOptions.currentPlatform,
        );
      }

      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(alert: true, badge: true, sound: true);

      FirebaseMessaging.onMessage.listen((_) {
        // Local in-app handling can be added here when needed.
      });

      _pushInitialized = true;
    } catch (e) {
      // Firebase may be intentionally not configured in local/dev environments.
      debugPrint('Push FCM no disponible en este entorno: $e');
      _pushInitialized = false;
    }
  }

  Future<void> syncPushToken({required String accessToken}) async {
    if (accessToken.trim().isEmpty) return;

    await initializePush();
    if (!_pushInitialized) return;

    try {
      final messaging = FirebaseMessaging.instance;
      final token = await messaging.getToken();
      if (token == null || token.trim().isEmpty) return;

      await _apiClient.post(
        '/api/tratamientos/notificaciones/token/',
        headers: {'Authorization': 'Bearer ${accessToken.trim()}'},
        body: {
          'token': token.trim(),
          'plataforma': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
        },
      );

      await _attachTokenRefreshListener(
        messaging: messaging,
        accessToken: accessToken.trim(),
      );
    } catch (e) {
      debugPrint('No se pudo sincronizar token FCM: $e');
    }
  }

  Future<void> _attachTokenRefreshListener({
    required FirebaseMessaging messaging,
    required String accessToken,
  }) async {
    if (_tokenRefreshAccessToken == accessToken && _tokenRefreshSubscription != null) {
      return;
    }

    await _tokenRefreshSubscription?.cancel();
    _tokenRefreshAccessToken = accessToken;
    _tokenRefreshSubscription = messaging.onTokenRefresh.listen((newToken) async {
      final trimmed = newToken.trim();
      if (trimmed.isEmpty) return;

      try {
        await _apiClient.post(
          '/api/tratamientos/notificaciones/token/',
          headers: {'Authorization': 'Bearer $accessToken'},
          body: {
            'token': trimmed,
            'plataforma': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
          },
        );
      } catch (e) {
        debugPrint('No se pudo actualizar el token FCM renovado: $e');
      }
    });
  }

  Future<void> deactivatePushTokens({required String accessToken}) async {
    if (accessToken.trim().isEmpty) return;
    try {
      await _apiClient.post(
        '/api/tratamientos/notificaciones/token/desactivar/',
        headers: {'Authorization': 'Bearer ${accessToken.trim()}'},
      );
    } catch (_) {
      // Logout flow should continue even if token cleanup fails.
    }
  }

  static const AndroidNotificationDetails _androidDetails =
      AndroidNotificationDetails(
        'dose_reminders',
        'Recordatorios de dosis',
        channelDescription:
            'Te avisa cuándo tomar tu siguiente medicamento',
        importance: Importance.high,
        priority: Priority.high,
        icon: '@mipmap/ic_launcher',
        playSound: true,
      );

  static const NotificationDetails _notifDetails =
      NotificationDetails(android: _androidDetails);

  /// Schedules a local notification [delay] from now for the given treatment.
  /// Uses [activeTreatmentId] as notification id so repeated calls replace
  /// the previous reminder for the same treatment.
  Future<void> scheduleDoseReminder({
    required int activeTreatmentId,
    required String treatmentName,
    required String doseLabel,
    required Duration delay,
  }) async {
    if (!_initialized) await initialize();
    if (delay <= Duration.zero) return;

    await _plugin.cancel(activeTreatmentId);

    final scheduledDate = tz.TZDateTime.now(tz.local).add(delay);

    await _plugin.zonedSchedule(
      activeTreatmentId,
      '💊 Hora de tu medicamento',
      '$treatmentName — $doseLabel',
      scheduledDate,
      _notifDetails,
      androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
    );
  }

  /// Cancels any pending reminder for the given active treatment id.
  Future<void> cancelDoseReminder(int activeTreatmentId) async {
    await _plugin.cancel(activeTreatmentId);
  }
}
