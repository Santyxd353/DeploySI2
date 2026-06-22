import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/auth/auth_session_manager.dart';
import '../../data/models/order_models.dart';
import '../../data/orders_service.dart';
import 'order_tracking_page.dart';

class NotificacionesPage extends StatefulWidget {
  const NotificacionesPage({super.key});

  @override
  State<NotificacionesPage> createState() => _NotificacionesPageState();
}

class _NotificacionesPageState extends State<NotificacionesPage> {
  final _service = OrdersService();
  bool _loading = true;
  String _error = '';
  List<OrderNotification> _notifs = [];

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    setState(() { _loading = true; _error = ''; });
    try {
      final token = await AuthSessionManager.getAccessToken();
      if (token == null) throw Exception('Sesión expirada.');
      final notifs = await _service.notificaciones(accessToken: token);
      if (!mounted) return;
      setState(() { _notifs = notifs; _loading = false; });
      // Marcar todas como leídas al abrir
      _marcarTodasLeidas(token);
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _marcarTodasLeidas(String token) async {
    try {
      for (final n in _notifs.where((n) => !n.leida)) {
        await _service.marcarLeida(accessToken: token, id: n.id);
      }
      if (!mounted) return;
      setState(() {
        _notifs = _notifs.map((n) => OrderNotification(
          id: n.id, tipo: n.tipo, titulo: n.titulo,
          mensaje: n.mensaje, pedidoId: n.pedidoId,
          leida: true, createdAt: n.createdAt,
        )).toList();
      });
    } catch (_) {}
  }

  void _abrirPedido(int pedidoId) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => OrderTrackingPage(pedidoId: pedidoId)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAF9),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8FAF9),
        elevation: 0,
        title: Text(
          'Notificaciones',
          style: GoogleFonts.manrope(
            fontWeight: FontWeight.w800,
            color: const Color(0xFF191C1C),
          ),
        ),
        actions: [
          if (_notifs.isNotEmpty)
            TextButton(
              onPressed: () async {
                final token = await AuthSessionManager.getAccessToken();
                if (token != null) _marcarTodasLeidas(token);
              },
              child: Text(
                'Marcar leídas',
                style: GoogleFonts.manrope(
                  color: const Color(0xFF006A5E),
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
        ],
      ),
      body: RefreshIndicator(
        color: const Color(0xFF006A5E),
        onRefresh: _cargar,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: Color(0xFF006A5E)))
            : _error.isNotEmpty
                ? _ErrorView(error: _error, onRetry: _cargar)
                : _notifs.isEmpty
                    ? _EmptyView()
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        itemCount: _notifs.length,
                        itemBuilder: (_, i) => _NotifCard(
                          notif: _notifs[i],
                          onTap: _notifs[i].pedidoId != null
                              ? () => _abrirPedido(_notifs[i].pedidoId!)
                              : null,
                        ),
                      ),
      ),
    );
  }
}

// ── Tarjeta de notificación ───────────────────────────────────────────────────

class _NotifCard extends StatelessWidget {
  const _NotifCard({required this.notif, this.onTap});
  final OrderNotification notif;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final icon = _iconForTipo(notif.tipo);
    final colors = _colorsForTipo(notif.tipo);
    final noLeida = !notif.leida;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: noLeida ? const Color(0xFFF0FBF8) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: noLeida ? const Color(0xFFB2DDD6) : const Color(0xFFF0F2F1),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icono tipo
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: colors.$1,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: colors.$2, size: 22),
            ),
            const SizedBox(width: 14),

            // Contenido
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          notif.titulo,
                          style: GoogleFonts.manrope(
                            fontWeight: noLeida ? FontWeight.w800 : FontWeight.w700,
                            fontSize: 14,
                            color: const Color(0xFF191C1C),
                          ),
                        ),
                      ),
                      if (noLeida)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Color(0xFF006A5E),
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    notif.mensaje,
                    style: const TextStyle(
                      color: Color(0xFF6F7977),
                      fontSize: 13,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _fmt(notif.createdAt),
                        style: const TextStyle(
                          color: Color(0xFFBDC9C5),
                          fontSize: 11,
                        ),
                      ),
                      if (onTap != null)
                        Text(
                          'Ver pedido →',
                          style: GoogleFonts.manrope(
                            color: const Color(0xFF006A5E),
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _fmt(DateTime d) {
    final l = d.toLocal();
    final now = DateTime.now();
    final diff = now.difference(l);
    if (diff.inMinutes < 1) return 'Ahora mismo';
    if (diff.inMinutes < 60) return 'Hace ${diff.inMinutes} min';
    if (diff.inHours < 24) return 'Hace ${diff.inHours} h';
    if (diff.inDays == 1) return 'Ayer';
    if (diff.inDays < 7) return 'Hace ${diff.inDays} días';
    String p(int n) => n.toString().padLeft(2, '0');
    return '${p(l.day)}/${p(l.month)}/${l.year}';
  }
}

// ── Utilidades ────────────────────────────────────────────────────────────────

(Color, Color) _colorsForTipo(String tipo) => switch (tipo) {
      'pedido_nuevo' => (const Color(0xFFE3F2FD), const Color(0xFF1565C0)),
      'pedido_aceptado' => (const Color(0xFFE0F7FA), const Color(0xFF00838F)),
      'pedido_preparando' => (const Color(0xFFFFF8E1), const Color(0xFFF57F17)),
      'pedido_listo' => (const Color(0xFFF3E5F5), const Color(0xFF6A1B9A)),
      'pedido_en_camino' => (const Color(0xFFEAF8F4), const Color(0xFF006A5E)),
      'pedido_cerca' => (const Color(0xFFFFF3E0), const Color(0xFFBF360C)),
      'pedido_entregado' => (const Color(0xFFE8F5E9), const Color(0xFF2E7D32)),
      'pedido_no_entregado' => (const Color(0xFFFFEBEE), const Color(0xFFC62828)),
      'pedido_cancelado' => (const Color(0xFFF5F5F5), const Color(0xFF757575)),
      'repartidor_asignado' => (const Color(0xFFEAF8F4), const Color(0xFF006A5E)),
      _ => (const Color(0xFFF5F5F5), const Color(0xFF757575)),
    };

IconData _iconForTipo(String tipo) => switch (tipo) {
      'pedido_nuevo' => Icons.receipt_long_rounded,
      'pedido_aceptado' => Icons.check_circle_outline_rounded,
      'pedido_preparando' => Icons.inventory_2_rounded,
      'pedido_listo' => Icons.done_all_rounded,
      'pedido_en_camino' => Icons.delivery_dining_rounded,
      'pedido_cerca' => Icons.location_on_rounded,
      'pedido_entregado' => Icons.home_rounded,
      'pedido_no_entregado' => Icons.cancel_rounded,
      'pedido_cancelado' => Icons.block_rounded,
      'repartidor_asignado' => Icons.directions_bike_rounded,
      _ => Icons.notifications_rounded,
    };

class _EmptyView extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 120),
        const Icon(Icons.notifications_none_rounded, size: 72, color: Color(0xFFBDC9C5)),
        const SizedBox(height: 16),
        Center(
          child: Text(
            'Sin notificaciones',
            style: GoogleFonts.manrope(
              fontWeight: FontWeight.w800,
              fontSize: 20,
              color: const Color(0xFF191C1C),
            ),
          ),
        ),
        const SizedBox(height: 8),
        const Center(
          child: Text(
            'Aquí aparecerán los cambios\nen el estado de tus pedidos.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF6F7977), fontSize: 15),
          ),
        ),
      ],
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.error, required this.onRetry});
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
