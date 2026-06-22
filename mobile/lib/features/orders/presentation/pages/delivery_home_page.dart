import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/auth/auth_session_manager.dart';
import '../../../auth/data/models/auth_user.dart';
import '../../../auth/presentation/pages/login_page.dart';
import '../../../opinions/presentation/widgets/opinion_cliente_sheet.dart';
import '../../data/models/order_models.dart';
import '../../data/orders_service.dart';
import 'my_deliveries_page.dart';

class DeliveryHomePage extends StatefulWidget {
  const DeliveryHomePage({super.key});

  @override
  State<DeliveryHomePage> createState() => _DeliveryHomePageState();
}

class _DeliveryHomePageState extends State<DeliveryHomePage> {
  int _selectedIndex = 0;
  AuthUser? _user;

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    final user = await AuthSessionManager.getStoredUser();
    if (mounted) setState(() => _user = user);
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      _EntregasTab(user: _user),
      _DeliveryProfileTab(user: _user),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAF9),
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 280),
        transitionBuilder: (child, animation) =>
            FadeTransition(opacity: animation, child: child),
        child: pages[_selectedIndex],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (i) => setState(() => _selectedIndex = i),
        backgroundColor: Colors.white,
        elevation: 10,
        shadowColor: Colors.black.withOpacity(0.1),
        indicatorColor: const Color(0xFFEAF8F4),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.delivery_dining_outlined, color: Color(0xFF3E4946)),
            selectedIcon: Icon(Icons.delivery_dining_rounded, color: Color(0xFF006A5E)),
            label: 'Mis Entregas',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline, color: Color(0xFF3E4946)),
            selectedIcon: Icon(Icons.person_rounded, color: Color(0xFF006A5E)),
            label: 'Perfil',
          ),
        ],
      ),
    );
  }
}

// ── Tab: Lista de entregas ────────────────────────────────────────────────────

class _EntregasTab extends StatefulWidget {
  const _EntregasTab({this.user});
  final AuthUser? user;

  @override
  State<_EntregasTab> createState() => _EntregasTabState();
}

class _EntregasTabState extends State<_EntregasTab> {
  final _service = OrdersService();
  bool _loading = true;
  String _error = '';
  List<Order> _entregas = [];

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final token = await AuthSessionManager.getAccessToken();
      if (token == null) throw const OrderServiceException('Sesión expirada.');
      final entregas = await _service.misEntregas(accessToken: token);
      if (!mounted) return;
      setState(() {
        _entregas = entregas;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  List<Order> get _activas => _entregas
      .where((e) => !['entregado', 'no_entregado', 'cancelado'].contains(e.estado))
      .toList();

  List<Order> get _finalizadas => _entregas
      .where((e) => ['entregado', 'no_entregado', 'cancelado'].contains(e.estado))
      .toList();

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: const Color(0xFF006A5E),
      onRefresh: _cargar,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // Header
          SliverToBoxAdapter(
            child: _Header(user: widget.user),
          ),

          // Stats
          if (!_loading && _error.isEmpty)
            SliverToBoxAdapter(
              child: _StatsRow(activas: _activas.length, finalizadas: _finalizadas.length),
            ),

          // Loading / error
          if (_loading)
            const SliverFillRemaining(
              child: Center(
                child: CircularProgressIndicator(color: Color(0xFF006A5E)),
              ),
            )
          else if (_error.isNotEmpty)
            SliverFillRemaining(
              child: _ErrorBody(error: _error, onRetry: _cargar),
            )
          else if (_activas.isEmpty && _finalizadas.isEmpty)
            const SliverFillRemaining(child: _EmptyBody())
          else ...[
            // Activas
            if (_activas.isNotEmpty) ...[
              SliverToBoxAdapter(
                child: _SectionHeader(
                  title: 'Asignadas',
                  count: _activas.length,
                  color: const Color(0xFF006A5E),
                ),
              ),
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) => _EntregaCard(
                    order: _activas[i],
                    onTap: () async {
                      await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => DeliveryDetailPage(order: _activas[i]),
                        ),
                      );
                      _cargar();
                    },
                  ),
                  childCount: _activas.length,
                ),
              ),
            ],

            // Finalizadas
            if (_finalizadas.isNotEmpty) ...[
              SliverToBoxAdapter(
                child: _SectionHeader(
                  title: 'Completadas',
                  count: _finalizadas.length,
                  color: const Color(0xFF6F7977),
                ),
              ),
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) => _EntregaCard(
                    order: _finalizadas[i],
                    onTap: () async {
                      await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => DeliveryDetailPage(order: _finalizadas[i]),
                        ),
                      );
                      _cargar();
                    },
                    muted: true,
                  ),
                  childCount: _finalizadas.length,
                ),
              ),
            ],

            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({this.user});
  final AuthUser? user;

  @override
  Widget build(BuildContext context) {
    final nombre = user?.firstName.isNotEmpty == true ? user!.firstName : 'Repartidor';
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      padding: const EdgeInsets.all(24),
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
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.delivery_dining_rounded, color: Colors.white, size: 28),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Hola, $nombre',
                  style: GoogleFonts.manrope(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 22,
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'REPARTIDOR',
                    style: GoogleFonts.inter(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 11,
                      letterSpacing: 0.8,
                    ),
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

class _StatsRow extends StatelessWidget {
  const _StatsRow({required this.activas, required this.finalizadas});
  final int activas;
  final int finalizadas;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      child: Row(
        children: [
          Expanded(
            child: _StatCard(
              icon: Icons.pending_actions_rounded,
              label: 'Pendientes',
              value: '$activas',
              color: const Color(0xFF006A5E),
              bg: const Color(0xFFEAF8F4),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _StatCard(
              icon: Icons.check_circle_rounded,
              label: 'Completadas',
              value: '$finalizadas',
              color: const Color(0xFF2E7D32),
              bg: const Color(0xFFE8F5E9),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
    required this.bg,
  });
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final Color bg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF0F2F1)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: GoogleFonts.manrope(
                    fontWeight: FontWeight.w800,
                    fontSize: 22,
                    color: const Color(0xFF191C1C),
                  ),
                ),
                Text(
                  label,
                  style: const TextStyle(
                    color: Color(0xFF6F7977),
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
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

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.count, required this.color});
  final String title;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: [
          Text(
            title,
            style: GoogleFonts.manrope(
              fontWeight: FontWeight.w800,
              fontSize: 16,
              color: const Color(0xFF191C1C),
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: color.withOpacity(0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '$count',
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EntregaCard extends StatelessWidget {
  const _EntregaCard({required this.order, required this.onTap, this.muted = false});
  final Order order;
  final VoidCallback onTap;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final colors = _estadoColors(order.estado);
    final isActive = !['entregado', 'no_entregado', 'cancelado'].contains(order.estado);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isActive ? const Color(0xFFD0E8E4) : const Color(0xFFF0F2F1),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(isActive ? 0.05 : 0.02),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Pedido #${order.id}',
                        style: GoogleFonts.manrope(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                          color: const Color(0xFF191C1C),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: colors.$1,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          _estadoLabel(order.estado),
                          style: TextStyle(
                            color: colors.$2,
                            fontWeight: FontWeight.w700,
                            fontSize: 11,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      const Icon(Icons.person_outline_rounded, size: 14, color: Color(0xFF6F7977)),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          order.clienteNombre,
                          style: const TextStyle(color: Color(0xFF3E4946), fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                  if (order.direccionTexto.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.location_on_outlined, size: 14, color: Color(0xFF6F7977)),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            order.direccionTexto,
                            style: const TextStyle(color: Color(0xFF6F7977), fontSize: 12),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            Container(
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: Color(0xFFF0F2F1))),
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${order.total} Bs.',
                    style: GoogleFonts.manrope(
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                      color: const Color(0xFF006A5E),
                    ),
                  ),
                  if (isActive)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                      decoration: BoxDecoration(
                        color: const Color(0xFF006A5E),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.navigation_rounded, color: Colors.white, size: 14),
                          const SizedBox(width: 6),
                          Text(
                            'Gestionar',
                            style: GoogleFonts.manrope(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    Text(
                      'Ver detalle →',
                      style: GoogleFonts.manrope(
                        color: const Color(0xFF6F7977),
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
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

// ── Tab: Perfil del repartidor ────────────────────────────────────────────────

class _DeliveryProfileTab extends StatefulWidget {
  const _DeliveryProfileTab({this.user});
  final AuthUser? user;

  @override
  State<_DeliveryProfileTab> createState() => _DeliveryProfileTabState();
}

class _DeliveryProfileTabState extends State<_DeliveryProfileTab> {
  bool _loggingOut = false;

  Future<void> _logout() async {
    setState(() => _loggingOut = true);
    await AuthSessionManager.logoutAndClear();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginPage()),
      (_) => false,
    );
  }

  Future<void> _openOpiniones() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const OpinionClienteSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.user;
    return SafeArea(
      child: Center(
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
                    child: Icon(Icons.delivery_dining_rounded, size: 45, color: Color(0xFF006A5E)),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  user?.fullName ?? 'Repartidor',
                  style: GoogleFonts.manrope(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF191C1C),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  user?.email ?? '',
                  style: const TextStyle(
                    color: Color(0xFF6F7977),
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEAF8F4),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text(
                    'REPARTIDOR',
                    style: TextStyle(
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
                    icon: const Icon(Icons.rate_review_rounded, size: 20),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF006A5E),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    label: Text(
                      'Dejar una opinión',
                      style: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 15),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: OutlinedButton.icon(
                    onPressed: _loggingOut ? null : _logout,
                    icon: const Icon(Icons.logout_rounded, color: Color(0xFFBA1A1A)),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFFF0F2F1)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      foregroundColor: const Color(0xFFBA1A1A),
                    ),
                    label: Text(
                      _loggingOut ? 'Cerrando sesión...' : 'Cerrar sesión',
                      style: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 15),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Utilidades ────────────────────────────────────────────────────────────────

class _EmptyBody extends StatelessWidget {
  const _EmptyBody();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.delivery_dining_rounded, size: 72, color: Color(0xFFBDC9C5)),
          const SizedBox(height: 16),
          Text(
            'Sin entregas asignadas',
            style: GoogleFonts.manrope(
              fontWeight: FontWeight.w800,
              fontSize: 20,
              color: const Color(0xFF191C1C),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Cuando te asignen un pedido\naparecerá aquí.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF6F7977), fontSize: 15),
          ),
        ],
      ),
    );
  }
}

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.error, required this.onRetry});
  final String error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded, size: 56, color: Color(0xFFBA1A1A)),
            const SizedBox(height: 16),
            Text(error, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF6F7977))),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: onRetry,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF006A5E),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: const Text('Reintentar'),
            ),
          ],
        ),
      ),
    );
  }
}

(Color, Color) _estadoColors(String estado) => switch (estado) {
      'pagado' => (const Color(0xFFE3F2FD), const Color(0xFF1565C0)),
      'aceptado' => (const Color(0xFFE0F7FA), const Color(0xFF00838F)),
      'preparando' => (const Color(0xFFFFF8E1), const Color(0xFFF57F17)),
      'listo' => (const Color(0xFFF3E5F5), const Color(0xFF6A1B9A)),
      'en_camino' => (const Color(0xFFFFF3E0), const Color(0xFFE65100)),
      'cerca' => (const Color(0xFFFFF3E0), const Color(0xFFBF360C)),
      'entregado' => (const Color(0xFFE8F5E9), const Color(0xFF2E7D32)),
      'no_entregado' => (const Color(0xFFFFEBEE), const Color(0xFFC62828)),
      'cancelado' => (const Color(0xFFF5F5F5), const Color(0xFF757575)),
      _ => (const Color(0xFFF5F5F5), const Color(0xFF757575)),
    };

String _estadoLabel(String estado) => switch (estado) {
      'pagado' => 'Pagado',
      'aceptado' => 'Aceptado',
      'preparando' => 'Preparando',
      'listo' => 'Listo',
      'en_camino' => 'En camino',
      'cerca' => 'Cerca',
      'entregado' => 'Entregado',
      'no_entregado' => 'No entregado',
      'cancelado' => 'Cancelado',
      _ => estado,
    };
