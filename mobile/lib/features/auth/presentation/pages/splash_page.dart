import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/auth/auth_session_manager.dart';
import '../../../auth/data/models/auth_user.dart';
import '../../../home/presentation/pages/customer_home_page.dart';
import '../../../orders/presentation/pages/delivery_home_page.dart';
import 'login_page.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> with TickerProviderStateMixin {
  static const _splashDuration = Duration(milliseconds: 1800);

  late final AnimationController _controller;
  late final AnimationController _logoFadeController;
  late final Animation<double> _slide;
  late final Animation<double> _logoFade;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat();
    _slide = Tween<double>(
      begin: -1.0,
      end: 4.0,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));

    // Logo fade-in animation: 600ms
    _logoFadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _logoFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _logoFadeController, curve: Curves.easeIn),
    );

    _logoFadeController.forward();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final result = await Future.wait<dynamic>([
      Future<void>.delayed(_splashDuration),
      AuthSessionManager.restoreClientSession(),
    ]);

    if (!mounted) return;

    final session = result[1] as AuthSession?;
    Widget nextPage;
    if (session == null) {
      nextPage = const LoginPage();
    } else if (session.user.isRepartidorRole) {
      nextPage = const DeliveryHomePage();
    } else {
      nextPage = const CustomerHomePage();
    }

    Navigator.of(
      context,
    ).pushReplacement(MaterialPageRoute(builder: (_) => nextPage));
  }

  @override
  void dispose() {
    _controller.dispose();
    _logoFadeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const ValueKey('splash-page'),
      backgroundColor: const Color(0xFFF8FAF9),
      body: Stack(
        children: [
          const _SplashBackground(),
          SafeArea(
            child: Column(
              children: [
                const Spacer(),
                _CenterBranding(slide: _slide, logoFade: _logoFade),
                const Spacer(),
                _BottomArea(slide: _slide),
                const SizedBox(height: 48),
              ],
            ),
          ),
          const _CornerDecoration(),
        ],
      ),
    );
  }
}

class _SplashBackground extends StatelessWidget {
  const _SplashBackground();

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned(
          top: -90,
          right: -90,
          child: Container(
            width: 360,
            height: 360,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: Color(0x14006A5E),
            ),
          ),
        ),
        Positioned(
          bottom: -70,
          left: -70,
          child: Container(
            width: 280,
            height: 280,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: Color(0x148BF1E6),
            ),
          ),
        ),
      ],
    );
  }
}

class _CenterBranding extends StatelessWidget {
  const _CenterBranding({required this.slide, required this.logoFade});

  final Animation<double> slide;
  final Animation<double> logoFade;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          AnimatedBuilder(
            animation: logoFade,
            builder: (context, _) {
              return Opacity(
                opacity: logoFade.value,
                child: Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFFFF),
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.06),
                        blurRadius: 24,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Stack(
                    children: [
                      const Positioned.fill(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [Color(0x12006A5E), Colors.transparent],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                          ),
                        ),
                      ),
                      Center(
                        child: Image.asset(
                          'assets/app/icon.png',
                          width: 80,
                          height: 80,
                          fit: BoxFit.contain,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 28),
          Text(
            'Farmacia Bibosi',
            style: GoogleFonts.manrope(
              color: const Color(0xFF006A5E),
              fontSize: 38,
              fontWeight: FontWeight.w800,
              letterSpacing: -1,
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFF2F4F3),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              'TU SALUD, NUESTRA PRIORIDAD',
              style: GoogleFonts.inter(
                color: const Color(0xFF3E4946),
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.8,
              ),
            ),
          ),
          const SizedBox(height: 18),
          const SizedBox(
            width: 280,
            child: Text(
              'Farmacia digital especializada en medicina de precision y cuidado integral.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Color(0xAA3E4946),
                fontSize: 14,
                height: 1.5,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BottomArea extends StatelessWidget {
  const _BottomArea({required this.slide});

  final Animation<double> slide;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          SizedBox(
            width: 192,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: Container(
                height: 4,
                color: const Color(0xFFE6E9E8),
                child: AnimatedBuilder(
                  animation: slide,
                  builder: (context, _) {
                    return Align(
                      alignment: Alignment(slide.value, 0),
                      child: Container(
                        width: 58,
                        height: 4,
                        decoration: BoxDecoration(
                          color: const Color(0xFF006A5E),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
          const SizedBox(height: 26),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.verified, size: 18, color: Color(0xFF006A5E)),
              const SizedBox(width: 6),
              Text(
                'ENTORNO SEGURO',
                style: GoogleFonts.inter(
                  color: const Color(0xFF006A5E),
                  fontSize: 11,
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Tecnologia y cuidado farmaceutico certificado',
            style: TextStyle(
              color: Color(0xFF6D7A76),
              fontSize: 10,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _CornerDecoration extends StatelessWidget {
  const _CornerDecoration();

  @override
  Widget build(BuildContext context) {
    final show = MediaQuery.sizeOf(context).width >= 768;
    if (!show) return const SizedBox.shrink();
    return IgnorePointer(
      child: Stack(
        children: const [
          Positioned(
            top: 52,
            left: 52,
            child: SizedBox(
              width: 90,
              child: Divider(color: Color(0x4DBDC9C5), thickness: 1, height: 1),
            ),
          ),
          Positioned(
            top: 56,
            left: 52,
            child: SizedBox(
              height: 90,
              child: VerticalDivider(
                color: Color(0x4DBDC9C5),
                thickness: 1,
                width: 1,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
