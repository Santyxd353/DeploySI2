// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mobile/main.dart';

void main() {
  testWidgets('Login and register flow smoke test', (
    WidgetTester tester,
  ) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const PharmacyClientApp());

    expect(find.byKey(const ValueKey('splash-page')), findsOneWidget);
    expect(find.text('Farmacia Bibosi'), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 1900));
    await tester.pumpAndSettle();

    expect(find.text('Iniciar sesion'), findsWidgets);
    expect(
      find.text('Bienvenido de nuevo. Introduce tus datos.'),
      findsOneWidget,
    );
    expect(find.text('Correo electronico'), findsOneWidget);
    expect(find.text('Contrasena'), findsOneWidget);

    final goRegister = find.byKey(const ValueKey('go-register'));
    await tester.ensureVisible(goRegister);
    await tester.tap(goRegister);
    await tester.pumpAndSettle();

    expect(find.text('Crear cuenta'), findsWidgets);
    expect(find.text('NOMBRE'), findsOneWidget);
    expect(find.text('APELLIDO'), findsOneWidget);
    expect(find.text('CORREO ELECTRONICO'), findsOneWidget);
    expect(find.text('CONTRASENA'), findsOneWidget);
    expect(find.text('GARANTIA DE PRIVACIDAD DE DATOS'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('go-login-from-register')));
    await tester.pumpAndSettle();

    expect(find.text('Iniciar sesion'), findsWidgets);
  });
}
