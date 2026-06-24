import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/auth/auth_session_manager.dart';
import '../../../../core/config/tenant_config.dart';
import '../../../auth/data/auth_service.dart';
import '../../../home/presentation/pages/customer_home_page.dart';
import '../../../orders/presentation/pages/delivery_home_page.dart';
import 'forgot_password_page.dart';
import 'register_page.dart';
import 'verify_email_page.dart';
import '../widgets/background_blobs.dart';

class LoginPage extends StatelessWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const BackgroundBlobs(),
          Center(
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
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 24,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: isDesktop
                          ? Row(
                              children: const [
                                Expanded(child: _BrandingPanel()),
                                Expanded(child: _LoginPanel()),
                              ],
                            )
                          : const _LoginPanel(),
                    );
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LoginPanel extends StatefulWidget {
  const _LoginPanel();

  @override
  State<_LoginPanel> createState() => _LoginPanelState();
}

class _LoginPanelState extends State<_LoginPanel> {
  final _subdomainController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _authService = AuthService();

  bool _obscurePassword = true;
  bool _rememberMe = false;
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    // Pre-fill with the currently configured subdomain (dart-define or saved).
    _subdomainController.text = TenantConfig.subdomain;
  }

  @override
  void dispose() {
    _subdomainController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final subdomain = _subdomainController.text.trim();
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (subdomain.isEmpty || email.isEmpty || password.isEmpty) {
      setState(
        () => _errorMessage =
            'Completa el subdominio, correo y contrasena para continuar.',
      );
      return;
    }

    // Persist the subdomain so every API call sends X-Tenant-Subdomain.
    await TenantConfig.save(subdomain);

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final session = await _authService.login(
        email: email,
        password: password,
      );

      if (!session.user.canAccessMobileApp) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = 'Acceso no permitido para este tipo de usuario.';
        });
        return;
      }

      await AuthSessionManager.saveSession(session);

      if (!mounted) return;
      final home = session.user.isRepartidorRole
          ? const DeliveryHomePage()
          : const CustomerHomePage();
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => home),
      );
    } on AuthServiceException catch (error) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _errorMessage = _mapLoginError(error.message);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _errorMessage = 'No se pudo iniciar sesion.';
      });
    }
  }

  String _mapLoginError(String message) {
    final normalized = message.trim().toLowerCase();
    if (normalized == 'credenciales invalidas.') {
      return 'Credenciales invalidas. Si acabas de registrarte, revisa tu correo y activa tu cuenta antes de iniciar sesion.';
    }

    return message;
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.sizeOf(context).width < 980;
    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: isMobile ? 24 : 64,
        vertical: isMobile ? 32 : 56,
      ),
      child: SingleChildScrollView(
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
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF006A5E),
                      ),
                    ),
                  ],
                ),
              ),
            if (isMobile) const SizedBox(height: 24),
            Text(
              'Iniciar sesion',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 8),
            const Text(
              'Bienvenido de nuevo. Introduce tus datos.',
              style: TextStyle(
                color: Color(0xFF3E4946),
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 28),
            const Text(
              'Farmacia (subdominio)',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: Color(0xFF3E4946),
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _subdomainController,
              keyboardType: TextInputType.text,
              autocorrect: false,
              decoration: const InputDecoration(
                hintText: 'ej: farmacia1',
                prefixIcon: Icon(Icons.storefront_outlined),
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'Correo electronico',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: Color(0xFF3E4946),
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(
                hintText: 'ejemplo@salud.es',
                prefixIcon: Icon(Icons.mail_outline),
              ),
            ),
            const SizedBox(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Contrasena',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF3E4946),
                  ),
                ),
                TextButton(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const ForgotPasswordPage(),
                      ),
                    );
                  },
                  child: const Text('Olvidaste tu contrasena?'),
                ),
              ],
            ),
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
            const SizedBox(height: 4),
            Row(
              children: [
                Checkbox(
                  value: _rememberMe,
                  activeColor: const Color(0xFF006A5E),
                  onChanged: (value) =>
                      setState(() => _rememberMe = value ?? false),
                ),
                const Text(
                  'Mantener sesion iniciada',
                  style: TextStyle(
                    color: Color(0xFF3E4946),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            if (_errorMessage != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFDAD6),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFFFB4AB)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'No se pudo iniciar sesion',
                      style: GoogleFonts.manrope(
                        color: const Color(0xFF93000A),
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _errorMessage!,
                      style: const TextStyle(
                        color: Color(0xFF93000A),
                        fontWeight: FontWeight.w600,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
            ],
            DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: const LinearGradient(
                  colors: [Color(0xFF006A5E), Color(0xFF008577)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton.icon(
                  key: const ValueKey('go-home'),
                  onPressed: _isSubmitting ? null : _submit,
                  icon: const Icon(Icons.arrow_forward),
                  label: Text(
                    _isSubmitting ? 'Ingresando...' : 'Iniciar sesion',
                    style: GoogleFonts.manrope(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    elevation: 0,
                    shadowColor: Colors.transparent,
                    backgroundColor: Colors.transparent,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Center(
              child: Wrap(
                alignment: WrapAlignment.center,
                spacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  const Text(
                    'Aun no tienes cuenta?',
                    style: TextStyle(
                      color: Color(0xFF3E4946),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  TextButton(
                    key: const ValueKey('go-register'),
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const RegisterPage()),
                      );
                    },
                    child: const Text('Crear cuenta'),
                  ),
                ],
              ),
            ),
            const Divider(height: 24, color: Color(0xFFBDC9C5)),
            Center(
              child: Wrap(
                spacing: 12,
                children: [
                  TextButton.icon(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const VerifyEmailPage(),
                        ),
                      );
                    },
                    icon: const Icon(Icons.verified_outlined, size: 18),
                    label: const Text('Verificar correo'),
                  ),
                  TextButton.icon(
                    onPressed: () {},
                    icon: const Icon(Icons.help_outline, size: 18),
                    label: const Text('Centro de ayuda'),
                  ),
                  TextButton.icon(
                    onPressed: () {},
                    icon: const Icon(Icons.language, size: 18),
                    label: const Text('Espana (ES)'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BrandingPanel extends StatelessWidget {
  const _BrandingPanel();

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
      padding: const EdgeInsets.all(40),
      child: Stack(
        children: [
          Positioned(
            right: -40,
            bottom: -30,
            child: Container(
              width: 280,
              height: 280,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0x3390F4E3),
              ),
            ),
          ),
          Positioned(
            right: 32,
            top: 90,
            child: Container(
              width: 140,
              height: 140,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0x338BF1E6),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Image.asset('assets/app/icon.png', width: 40, height: 40),
                  const SizedBox(width: 8),
                  Text(
                    'Farmacia Bibosi',
                    style: GoogleFonts.manrope(
                      color: const Color(0xFF006A5E),
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.8,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 60),
              Text(
                'Tu bienestar,\nnuestra prioridad.',
                style: GoogleFonts.manrope(
                  fontSize: 48,
                  height: 1.05,
                  letterSpacing: -1.0,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF191C1C),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Accede a tu historial medico, recetas electronicas y gestion de medicamentos con seguridad y rapidez.',
                style: TextStyle(
                  fontSize: 18,
                  height: 1.5,
                  color: Color(0xFF3E4946),
                  fontWeight: FontWeight.w500,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.8),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0x1F6D7A76)),
                ),
                child: Row(
                  children: [
                    const CircleAvatar(
                      backgroundColor: Color(0xFFE1E3E2),
                      radius: 22,
                      child: Icon(
                        Icons.local_hospital_outlined,
                        color: Color(0xFF006A5E),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Atencion 24/7',
                            style: GoogleFonts.inter(
                              color: const Color(0xFF006A5E),
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.8,
                              fontSize: 11,
                            ),
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            'Farmaceuticos colegiados a tu disposicion.',
                            style: TextStyle(
                              fontSize: 13,
                              color: Color(0xFF191C1C),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
