import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../data/auth_service.dart';
import '../widgets/background_blobs.dart';
import 'reset_password_page.dart';

class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final _emailController = TextEditingController();
  final _authService = AuthService();

  bool _submitting = false;
  String? _message;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      setState(() => _error = 'Ingresa un correo electronico valido.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
      _message = null;
    });

    try {
      final detail = await _authService.requestPasswordReset(email);
      if (!mounted) return;

      _emailController.clear();
      setState(() {
        _submitting = false;
        _message = detail;
      });
    } on AuthServiceException catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'No se pudo procesar la solicitud de recuperacion.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const BackgroundBlobs(),
          SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(28),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.06),
                          blurRadius: 24,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Recuperar acceso',
                            style: GoogleFonts.manrope(
                              fontSize: 30,
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFF191C1C),
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Solicita el enlace para restablecer la contrasena.',
                            style: TextStyle(
                              color: Color(0xFF3E4946),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 20),
                          if (_message != null) ...[
                            _StatusCard(
                              title: 'Solicitud enviada',
                              message: _message!,
                              background: const Color(0x1A8BF1E6),
                              border: const Color(0x338BF1E6),
                              titleColor: const Color(0xFF006A5E),
                              bodyColor: const Color(0xFF3E4946),
                            ),
                            const SizedBox(height: 14),
                          ],
                          if (_error != null) ...[
                            _StatusCard(
                              title: 'No se pudo completar la solicitud',
                              message: _error!,
                              background: const Color(0xFFFFDAD6),
                              border: const Color(0xFFFFB4AB),
                              titleColor: const Color(0xFF93000A),
                              bodyColor: const Color(0xFF93000A),
                            ),
                            const SizedBox(height: 14),
                          ],
                          TextField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            decoration: const InputDecoration(
                              labelText: 'Correo electronico',
                              hintText: 'tu@correo.com',
                              prefixIcon: Icon(Icons.mail_outline),
                            ),
                          ),
                          const SizedBox(height: 16),
                          SizedBox(
                            width: double.infinity,
                            height: 52,
                            child: ElevatedButton(
                              onPressed: _submitting ? null : _submit,
                              child: Text(
                                _submitting
                                    ? 'Enviando enlace...'
                                    : 'Enviar enlace de recuperacion',
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              TextButton(
                                onPressed: () => Navigator.of(context).pop(),
                                child: const Text('Volver a iniciar sesion'),
                              ),
                              TextButton(
                                onPressed: () {
                                  Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) => const ResetPasswordPage(),
                                    ),
                                  );
                                },
                                child: const Text(
                                  'Ya tengo enlace de recuperacion',
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.title,
    required this.message,
    required this.background,
    required this.border,
    required this.titleColor,
    required this.bodyColor,
  });

  final String title;
  final String message;
  final Color background;
  final Color border;
  final Color titleColor;
  final Color bodyColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.manrope(
              color: titleColor,
              fontWeight: FontWeight.w800,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            message,
            style: TextStyle(
              color: bodyColor,
              fontWeight: FontWeight.w600,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}
