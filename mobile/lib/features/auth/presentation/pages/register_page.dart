import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../auth/data/auth_service.dart';
import '../widgets/background_blobs.dart';

class RegisterPage extends StatelessWidget {
  const RegisterPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const BackgroundBlobs(),
          SafeArea(
            child: Column(
              children: [
                Expanded(
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 1200),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: LayoutBuilder(
                          builder: (context, constraints) {
                            final isDesktop = constraints.maxWidth >= 980;
                            return DecoratedBox(
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(32),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.06),
                                    blurRadius: 28,
                                    offset: const Offset(0, 10),
                                  ),
                                ],
                                border: Border.all(
                                  color: const Color(0x1ABDC9C5),
                                ),
                              ),
                              child: isDesktop
                                  ? Row(
                                      children: const [
                                        Expanded(
                                          flex: 5,
                                          child: _RegisterEditorialPanel(),
                                        ),
                                        Expanded(
                                          flex: 7,
                                          child: _RegisterFormPanel(),
                                        ),
                                      ],
                                    )
                                  : const _RegisterFormPanel(),
                            );
                          },
                        ),
                      ),
                    ),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.fromLTRB(24, 0, 24, 20),
                  child: Text(
                    '© 2024 Farmacia Bibosi S.A. Todos los derechos reservados. | Registro Sanitario N° 45-202/B',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: Color(0xFF6D7A76)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RegisterEditorialPanel extends StatelessWidget {
  const _RegisterEditorialPanel();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFF2F4F3),
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(32),
          bottomLeft: Radius.circular(32),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(36, 40, 36, 36),
      child: Stack(
        children: [
          Positioned(
            right: -52,
            bottom: -52,
            child: Container(
              width: 180,
              height: 180,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0x3390F4E3),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Image.asset('assets/app/icon.png', width: 36, height: 36),
                  const SizedBox(width: 8),
                  Text(
                    'Farmacia Bibosi',
                    style: GoogleFonts.manrope(
                      color: const Color(0xFF006A5E),
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.4,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 40),
              Text(
                'Comience su camino\nhacia el bienestar.',
                style: GoogleFonts.manrope(
                  fontWeight: FontWeight.w800,
                  fontSize: 44,
                  height: 1.06,
                  letterSpacing: -0.8,
                  color: const Color(0xFF191C1C),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Unase a nuestra comunidad farmaceutica digital y acceda a un nivel superior de precision en el cuidado de su salud.',
                style: TextStyle(
                  color: Color(0xFF3E4946),
                  fontSize: 17,
                  height: 1.45,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 30),
              const _FeatureRow(
                icon: Icons.verified_user_outlined,
                bubbleColor: Color(0xFF90F4E3),
                iconColor: Color(0xFF005047),
                label: 'Datos cifrados y seguros',
              ),
              const SizedBox(height: 18),
              const _FeatureRow(
                icon: Icons.receipt_long_outlined,
                bubbleColor: Color(0xFF8EF4E9),
                iconColor: Color(0xFF00504A),
                label: 'Seguimiento de recetas',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({
    required this.icon,
    required this.bubbleColor,
    required this.iconColor,
    required this.label,
  });

  final IconData icon;
  final Color bubbleColor;
  final Color iconColor;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(color: bubbleColor, shape: BoxShape.circle),
          child: Icon(icon, size: 18, color: iconColor),
        ),
        const SizedBox(width: 14),
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFF191C1C),
            fontWeight: FontWeight.w600,
            fontSize: 13,
          ),
        ),
      ],
    );
  }
}

class _RegisterFormPanel extends StatefulWidget {
  const _RegisterFormPanel();

  @override
  State<_RegisterFormPanel> createState() => _RegisterFormPanelState();
}

class _RegisterFormPanelState extends State<_RegisterFormPanel> {
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _authService = AuthService();

  bool _obscurePassword = true;
  bool _isSubmitting = false;
  String? _errorMessage;
  String? _successMessage;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (firstName.isEmpty ||
        lastName.isEmpty ||
        email.isEmpty ||
        password.isEmpty) {
      setState(() => _errorMessage = 'Completa todos los campos obligatorios.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      await _authService.register(
        firstName: firstName,
        lastName: lastName,
        email: email,
        password: password,
      );

      _firstNameController.clear();
      _lastNameController.clear();
      _emailController.clear();
      _passwordController.clear();

      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _successMessage =
            'Registro completado. Revisa tu correo para activar tu cuenta.';
      });
    } on AuthServiceException catch (error) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _errorMessage = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _errorMessage = 'No se pudo completar el registro.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.sizeOf(context).width < 980;
    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: isMobile ? 24 : 52,
        vertical: isMobile ? 30 : 40,
      ),
      child: SingleChildScrollView(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (isMobile)
                Center(
                  child: Column(
                    children: [
                      Image.asset('assets/app/icon.png', width: 64, height: 64),
                      const SizedBox(height: 8),
                      Text(
                        'Farmacia Bibosi',
                        style: GoogleFonts.manrope(
                          color: const Color(0xFF006A5E),
                          fontWeight: FontWeight.w800,
                          fontSize: 22,
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              Text(
                'Crear cuenta',
                style: GoogleFonts.manrope(
                  fontSize: 32,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF191C1C),
                  letterSpacing: -0.4,
                ),
              ),
              const SizedBox(height: 6),
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 6,
                children: [
                  const Text(
                    'Ya es miembro?',
                    style: TextStyle(color: Color(0xFF3E4946), fontSize: 13),
                  ),
                  TextButton(
                    key: const ValueKey('go-login-from-register'),
                    onPressed: () => Navigator.of(context).pop(),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                    ),
                    child: const Text('Inicie sesion'),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (_successMessage != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0x1A8BF1E6),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0x338BF1E6)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Registro completado',
                        style: GoogleFonts.manrope(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF006A5E),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _successMessage!,
                        style: const TextStyle(
                          color: Color(0xFF3E4946),
                          height: 1.4,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],
              const _RegisterInputLabel('NOMBRE'),
              const SizedBox(height: 8),
              TextField(
                controller: _firstNameController,
                decoration: const InputDecoration(
                  hintText: 'Ej. Ana',
                  prefixIcon: Icon(Icons.person_outline),
                ),
              ),
              const SizedBox(height: 16),
              const _RegisterInputLabel('APELLIDO'),
              const SizedBox(height: 8),
              TextField(
                controller: _lastNameController,
                decoration: const InputDecoration(
                  hintText: 'Ej. Garcia Lopez',
                  prefixIcon: Icon(Icons.badge_outlined),
                ),
              ),
              const SizedBox(height: 16),
              const _RegisterInputLabel('CORREO ELECTRONICO'),
              const SizedBox(height: 8),
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  hintText: 'nombre@ejemplo.com',
                  prefixIcon: Icon(Icons.mail_outline),
                ),
              ),
              const SizedBox(height: 16),
              const _RegisterInputLabel('CONTRASENA'),
              const SizedBox(height: 8),
              TextField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                decoration: InputDecoration(
                  hintText: '••••••••',
                  prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(
                    onPressed: () =>
                        setState(() => _obscurePassword = !_obscurePassword),
                    icon: Icon(
                      _obscurePassword
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              if (_errorMessage != null) ...[
                Text(
                  _errorMessage!,
                  style: const TextStyle(
                    color: Color(0xFFBA1A1A),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
              ],
              DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  gradient: const LinearGradient(
                    colors: [Color(0xFF006A5E), Color(0xFF008577)],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF006A5E).withValues(alpha: 0.24),
                      blurRadius: 14,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton.icon(
                    onPressed: _isSubmitting ? null : _submit,
                    icon: const Icon(Icons.arrow_forward),
                    label: Text(
                      _isSubmitting ? 'Procesando...' : 'Registrarse',
                      style: GoogleFonts.manrope(
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      foregroundColor: Colors.white,
                      backgroundColor: Colors.transparent,
                      disabledBackgroundColor: Colors.transparent,
                      disabledForegroundColor: Colors.white70,
                      shadowColor: Colors.transparent,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Divider(height: 24, color: Color(0x4DBDC9C5)),
              const Center(
                child: Text(
                  'GARANTIA DE PRIVACIDAD DE DATOS',
                  style: TextStyle(
                    color: Color(0xFF6D7A76),
                    fontSize: 10,
                    letterSpacing: 1.2,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RegisterInputLabel extends StatelessWidget {
  const _RegisterInputLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 11,
          letterSpacing: 1.2,
          color: Color(0xFF3E4946),
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
