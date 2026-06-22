import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../data/auth_service.dart';
import '../widgets/background_blobs.dart';

class VerifyEmailPage extends StatefulWidget {
  const VerifyEmailPage({super.key});

  @override
  State<VerifyEmailPage> createState() => _VerifyEmailPageState();
}

class _VerifyEmailPageState extends State<VerifyEmailPage> {
  final _uidController = TextEditingController();
  final _tokenController = TextEditingController();
  final _authService = AuthService();

  bool _submitting = false;
  String? _message;
  String? _error;

  @override
  void dispose() {
    _uidController.dispose();
    _tokenController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final uid = _uidController.text.trim();
    final token = _tokenController.text.trim();

    if (uid.isEmpty || token.isEmpty) {
      setState(() => _error = 'Completa UID y token para verificar tu correo.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
      _message = null;
    });

    try {
      final detail = await _authService.verifyEmail(uid: uid, token: token);
      if (!mounted) return;

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
        _error = 'No se pudo verificar el correo.';
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
                            'Verificacion de correo',
                            style: GoogleFonts.manrope(
                              fontSize: 30,
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFF191C1C),
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Confirma tu cuenta ingresando UID y token del enlace recibido por correo.',
                            style: TextStyle(
                              color: Color(0xFF3E4946),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 20),
                          if (_message != null) ...[
                            _StatusCard(
                              title: 'Correo verificado',
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
                              title: 'No se pudo verificar',
                              message: _error!,
                              background: const Color(0xFFFFDAD6),
                              border: const Color(0xFFFFB4AB),
                              titleColor: const Color(0xFF93000A),
                              bodyColor: const Color(0xFF93000A),
                            ),
                            const SizedBox(height: 14),
                          ],
                          TextField(
                            controller: _uidController,
                            decoration: const InputDecoration(
                              labelText: 'UID',
                              hintText: 'Pega aqui el uid',
                              prefixIcon: Icon(Icons.key_outlined),
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _tokenController,
                            decoration: const InputDecoration(
                              labelText: 'Token',
                              hintText: 'Pega aqui el token',
                              prefixIcon: Icon(Icons.vpn_key_outlined),
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
                                    ? 'Verificando...'
                                    : 'Verificar correo',
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          TextButton(
                            onPressed: () => Navigator.of(context).pop(),
                            child: const Text('Volver'),
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
