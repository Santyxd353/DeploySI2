import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../cart/customer_cart_tab.dart';
import '../../../catalog/customer_catalog_tab.dart';
import '../../../payments/my_payments_page.dart';
import '../../../points/presentation/pages/customer_points_page.dart';
import '../../../points/data/customer_points_service.dart';
import '../../../points/data/models/customer_points_models.dart';
import '../../../opinions/presentation/widgets/opinion_cliente_sheet.dart';
import '../../../treatments/presentation/pages/treatments_catalog_page.dart';
import '../../../orders/presentation/pages/my_orders_page.dart';
import '../../../orders/presentation/pages/notificaciones_page.dart';
import '../../../orders/data/orders_service.dart';
import '../../../../core/auth/auth_session_manager.dart';
import '../../../auth/data/models/auth_user.dart';
import '../../../auth/presentation/pages/login_page.dart';

class CustomerHomePage extends StatefulWidget {
  const CustomerHomePage({super.key});

  @override
  State<CustomerHomePage> createState() => _CustomerHomePageState();
}

class _CustomerHomePageState extends State<CustomerHomePage> {
  int _selectedIndex = 0;
  bool _isSyncing = true;
  int _noLeidas = 0;
  final _ordersService = OrdersService();

  @override
  void initState() {
    super.initState();
    _autoDiscoverCliente();
  }

  Future<void> _autoDiscoverCliente() async {
    try {
      final session = await AuthSessionManager.restoreClientSession();

      if (session == null) {
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const LoginPage()),
          (_) => false,
        );
        return;
      }
      _cargarContadorNoLeidas();
    } catch (_) {} finally {
      if (mounted) setState(() => _isSyncing = false);
    }
  }

  Future<void> _cargarContadorNoLeidas() async {
    try {
      final token = await AuthSessionManager.getAccessToken();
      if (token == null) return;
      final count = await _ordersService.contadorNoLeidas(accessToken: token);
      if (mounted) setState(() => _noLeidas = count);
    } catch (_) {}
  }

  Future<void> _abrirNotificaciones() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const NotificacionesPage()),
    );
    // Al volver, resetear badge
    if (mounted) setState(() => _noLeidas = 0);
  }

  @override
  Widget build(BuildContext context) {
    if (_isSyncing) {
      return const Scaffold(
        backgroundColor: Color(0xFFF8FAF9),
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFF006A5E)),
        ),
      );
    }

    final pages = [
      _HomeOverviewTab(
        onOpenPoints: () {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const CustomerPointsPage()),
          );
        },
        onOpenPayments: () {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const MyPaymentsPage()),
          );
        },
        onOpenOrders: () {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const MyOrdersPage()),
          );
        },
      ),
      const CustomerCatalogTab(),
      const CartTab(),
      const _ProfileTab(),
    ];

    final safeIndex = _selectedIndex.clamp(0, pages.length - 1);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAF9),
      appBar: AppBar(
        title: Text(
          'Farmacia Bibosi',
          style: GoogleFonts.manrope(
            fontWeight: FontWeight.w800,
            fontSize: 22,
            color: const Color(0xFF191C1C),
          ),
        ),
        centerTitle: false,
        backgroundColor: const Color(0xFFF8FAF9),
        elevation: 0,
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFFE0E3E1)),
                  ),
                  child: IconButton(
                    icon: const Icon(
                      Icons.notifications_outlined,
                      color: Color(0xFF191C1C),
                      size: 22,
                    ),
                    onPressed: _abrirNotificaciones,
                  ),
                ),
                if (_noLeidas > 0)
                  Positioned(
                    top: -2,
                    right: -2,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: Color(0xFFBA1A1A),
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                      child: Text(
                        _noLeidas > 99 ? '99+' : '$_noLeidas',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 300),
        transitionBuilder: (Widget child, Animation<double> animation) {
          return FadeTransition(opacity: animation, child: child);
        },
        child: pages[safeIndex],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: safeIndex,
        onDestinationSelected: (index) =>
            setState(() => _selectedIndex = index),
        backgroundColor: Colors.white,
        elevation: 10,
        shadowColor: Colors.black.withOpacity(0.1),
        indicatorColor: const Color(0xFFEAF8F4),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.space_dashboard_outlined, color: Color(0xFF3E4946)),
            selectedIcon: const Icon(Icons.space_dashboard_rounded, color: Color(0xFF006A5E)),
            label: 'Inicio',
          ),
          NavigationDestination(
            icon: const Icon(Icons.medical_services_outlined, color: Color(0xFF3E4946)),
            selectedIcon: const Icon(Icons.medical_services_rounded, color: Color(0xFF006A5E)),
            label: 'Catalogo',
          ),
          NavigationDestination(
            icon: const Icon(Icons.shopping_bag_outlined, color: Color(0xFF3E4946)),
            selectedIcon: const Icon(Icons.shopping_bag_rounded, color: Color(0xFF006A5E)),
            label: 'Carrito',
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline, color: Color(0xFF3E4946)),
            selectedIcon: const Icon(Icons.person_rounded, color: Color(0xFF006A5E)),
            label: 'Perfil',
          ),
        ],
      ),
    );
  }
}

class _ProfileTab extends StatefulWidget {
  const _ProfileTab();

  @override
  State<_ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<_ProfileTab> {
  AuthUser? _user;
  bool _loading = true;
  bool _loggingOut = false;

  Future<void> _openOpiniones() async {
    if (!mounted) return;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const OpinionClienteSheet(),
    );
  }

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    final storedUser = await AuthSessionManager.getStoredUser();
    if (!mounted) return;
    setState(() {
      _user = storedUser;
      _loading = false;
    });
  }

  Future<void> _logout() async {
    setState(() => _loggingOut = true);
    await AuthSessionManager.logoutAndClear();

    if (!mounted) return;

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginPage()),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF006A5E)),
      );
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Container(
          width: 460,
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.04),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
            border: Border.all(color: const Color(0xFFF0F2F1)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFFEAF8F4), width: 4),
                ),
                child: const CircleAvatar(
                  radius: 40,
                  backgroundColor: Color(0xFFF0F2F1),
                  child: Icon(
                    Icons.person_rounded,
                    size: 45,
                    color: Color(0xFF006A5E),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                _user?.fullName ?? 'Cliente',
                style: GoogleFonts.manrope(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF191C1C),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _user?.email ?? 'correo@ejemplo.com',
                style: const TextStyle(
                  color: Color(0xFF6F7977),
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFEAF8F4),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  'Rol: ${_user?.role.isNotEmpty == true ? _user!.role.toUpperCase() : 'CLIENTE'}',
                  style: const TextStyle(
                    color: Color(0xFF006A5E),
                    fontWeight: FontWeight.w800,
                    fontSize: 11,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: _openOpiniones,
                  icon: const Icon(
                    Icons.rate_review_rounded,
                    size: 20,
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF006A5E),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  label: Text(
                    'Dejar una opinion',
                    style: GoogleFonts.manrope(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: OutlinedButton.icon(
                  onPressed: _loggingOut ? null : _logout,
                  icon: const Icon(
                    Icons.logout_rounded,
                    color: Color(0xFFBA1A1A),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFF0F2F1)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    foregroundColor: const Color(0xFFBA1A1A),
                  ),
                  label: Text(
                    _loggingOut ? 'Cerrando sesión...' : 'Cerrar sesión',
                    style: GoogleFonts.manrope(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
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

class _HomeOverviewTab extends StatefulWidget {
  const _HomeOverviewTab({
    required this.onOpenPayments,
    required this.onOpenPoints,
    required this.onOpenOrders,
  });

  final VoidCallback onOpenPayments;
  final VoidCallback onOpenPoints;
  final VoidCallback onOpenOrders;

  @override
  State<_HomeOverviewTab> createState() => _HomeOverviewTabState();
}

class _HomeOverviewTabState extends State<_HomeOverviewTab> {
  final CustomerPointsService _pointsService = CustomerPointsService();

  bool _loadingPoints = true;
  String? _pointsError;
  CustomerPointsDashboard? _dashboard;

  @override
  void initState() {
    super.initState();
    _loadPointsSummary();
  }

  Future<void> _loadPointsSummary() async {
    try {
      final token = await AuthSessionManager.getAccessToken();
      if (token == null || token.trim().isEmpty) {
        if (!mounted) return;
        setState(() {
          _loadingPoints = false;
          _pointsError = null;
        });
        return;
      }

      final dashboard = await _pointsService.loadDashboard(accessToken: token);
      if (!mounted) return;
      setState(() {
        _dashboard = dashboard;
        _loadingPoints = false;
        _pointsError = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingPoints = false;
        _pointsError = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      key: const ValueKey('customer-home'),
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 30),
      children: [
        Container(
          padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            gradient: const LinearGradient(
              colors: [Color(0xFF006A5E), Color(0xFF004D40)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF006A5E).withOpacity(0.3),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.verified_rounded,
                      color: Colors.white,
                      size: 16,
                    ),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        'Cuenta Verificada',
                        style: GoogleFonts.inter(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 11,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Tu salud,\nen un solo lugar',
                style: GoogleFonts.manrope(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 28,
                  height: 1.15,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Consulta catálogo, recetas, puntos y pagos desde nuestra app móvil.',
                style: TextStyle(
                  color: Colors.white.withOpacity(0.9),
                  fontSize: 15,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 32),

        _buildPointsSummaryCard(context),

        const SizedBox(height: 24),

        Text(
          'Accesos rápidos',
          style: GoogleFonts.manrope(
            fontWeight: FontWeight.w800,
            fontSize: 20,
            color: const Color(0xFF191C1C),
          ),
        ),
        const SizedBox(height: 16),

        Row(
          children: [
            Expanded(
              child: _QuickActionCard(
                icon: Icons.medical_services_rounded,
                label: 'Catálogo',
                toneColor: const Color(0xFF006A5E),
                backgroundTint: const Color(0xFFEAF8F4),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: _QuickActionCard(
                icon: Icons.description_rounded,
                label: 'Recetas',
                toneColor: const Color(0xFF1565C0),
                backgroundTint: const Color(0xFFEAF2FF),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: _QuickActionCard(
                icon: Icons.stars_rounded,
                label: 'Mis Puntos',
                toneColor: const Color(0xFFB76E00),
                backgroundTint: const Color(0xFFFFF3E0),
                onTap: widget.onOpenPoints,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: _QuickActionCard(
                icon: Icons.credit_card_rounded,
                label: 'Mis Pagos',
                toneColor: const Color(0xFF6A1B9A),
                backgroundTint: const Color(0xFFF6ECFF),
                onTap: widget.onOpenPayments,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: _QuickActionCard(
                icon: Icons.medication_liquid_rounded,
                label: 'Tratamientos',
                toneColor: const Color(0xFF006A5E),
                backgroundTint: const Color(0xFFEAF8F4),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const TreatmentsCatalogPage(),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: _QuickActionCard(
                icon: Icons.local_shipping_rounded,
                label: 'Mis Pedidos',
                toneColor: const Color(0xFF00695C),
                backgroundTint: const Color(0xFFE0F2F1),
                onTap: widget.onOpenOrders,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildPointsSummaryCard(BuildContext context) {
    if (_loadingPoints) {
      return Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: const Color(0xFFE0E3E1)),
        ),
        child: const Row(
          children: [
            SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Color(0xFFB76E00),
              ),
            ),
            SizedBox(width: 14),
            Expanded(
              child: Text(
                'Cargando tu resumen de puntos...',
                style: TextStyle(color: Color(0xFF5A6562), fontSize: 13),
              ),
            ),
          ],
        ),
      );
    }

    final dashboard = _dashboard;
    if (dashboard == null) {
      return const SizedBox.shrink();
    }

    final available = dashboard.account.availablePoints;
    final minRedeem = dashboard.configuration.minimumRedeemPoints;
    final pointsToRedeem = available >= minRedeem ? 0 : minRedeem - available;
    final canRedeem = available >= minRedeem;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE0E3E1)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF3E0),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.stars_rounded,
                  color: Color(0xFFB76E00),
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Tus puntos',
                      style: GoogleFonts.manrope(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                        color: const Color(0xFF191C1C),
                      ),
                    ),
                    Text(
                      canRedeem
                          ? 'Ya puedes canjear recompensas del catálogo'
                          : 'Te faltan $pointsToRedeem puntos para el primer canje',
                      style: GoogleFonts.manrope(
                        color: const Color(0xFF6F7977),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '$available',
                style: GoogleFonts.manrope(
                  fontWeight: FontWeight.w800,
                  fontSize: 28,
                  color: const Color(0xFFB76E00),
                ),
              ),
            ],
          ),
          if (_pointsError != null) ...[
            const SizedBox(height: 10),
            Text(
              'No pudimos cargar todos los detalles, pero puedes abrir el módulo de puntos igual.',
              style: GoogleFonts.manrope(
                color: const Color(0xFF6F7977),
                fontSize: 12,
              ),
            ),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _MiniPointsStat(
                  label: 'Ganados',
                  value: '${dashboard.account.accumulatedPoints}',
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MiniPointsStat(
                  label: 'Canjeados',
                  value: '${dashboard.account.redeemedPoints}',
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MiniPointsStat(
                  label: 'Nivel',
                  value: dashboard.account.level.toUpperCase(),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: widget.onOpenPoints,
              icon: const Icon(Icons.arrow_forward_rounded),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0xFFE4E7E5)),
                foregroundColor: const Color(0xFF006A5E),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              label: Text(
                'Abrir mis puntos',
                style: GoogleFonts.manrope(fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniPointsStat extends StatelessWidget {
  const _MiniPointsStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAF9),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: GoogleFonts.manrope(
              fontWeight: FontWeight.w800,
              fontSize: 14,
              color: const Color(0xFF191C1C),
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: GoogleFonts.manrope(
              color: const Color(0xFF6F7977),
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickActionCard extends StatelessWidget {
  const _QuickActionCard({
    required this.icon,
    required this.label,
    required this.toneColor,
    required this.backgroundTint,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final Color toneColor;
  final Color backgroundTint;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: Ink(
        height: 110, // Altura fija para que sean casi cuadradas
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: const Color(0xFFF0F2F1)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 15,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: backgroundTint,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: toneColor, size: 26),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  label,
                  style: GoogleFonts.manrope(
                    color: const Color(0xFF191C1C),
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  color: const Color(0xFFBDC9C5),
                  size: 20,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

