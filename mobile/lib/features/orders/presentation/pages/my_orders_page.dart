import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/auth/auth_session_manager.dart';
import '../../data/models/order_models.dart';
import '../../data/orders_service.dart';
import 'order_tracking_page.dart';

class MyOrdersPage extends StatefulWidget {
  const MyOrdersPage({super.key});

  @override
  State<MyOrdersPage> createState() => _MyOrdersPageState();
}

class _MyOrdersPageState extends State<MyOrdersPage> {
  final _service = OrdersService();
  bool _loading = true;
  String _error = '';
  List<Order> _pedidos = [];

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    setState(() { _loading = true; _error = ''; });
    try {
      final token = await AuthSessionManager.getAccessToken();
      if (token == null) throw const OrderServiceException('Sesión expirada.');
      final pedidos = await _service.misPedidos(accessToken: token);
      if (!mounted) return;
      setState(() { _pedidos = pedidos; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAF9),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8FAF9),
        elevation: 0,
        title: Text(
          'Mis Pedidos',
          style: GoogleFonts.manrope(
            fontWeight: FontWeight.w800,
            color: const Color(0xFF191C1C),
          ),
        ),
      ),
      body: RefreshIndicator(
        color: const Color(0xFF006A5E),
        onRefresh: _cargar,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: Color(0xFF006A5E)))
            : _error.isNotEmpty
                ? _ErrorView(error: _error, onRetry: _cargar)
                : _pedidos.isEmpty
                    ? const _EmptyView()
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _pedidos.length,
                        itemBuilder: (context, i) => _OrderCard(
                          order: _pedidos[i],
                          onTap: () async {
                            await Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => OrderTrackingPage(pedidoId: _pedidos[i].id),
                              ),
                            );
                            _cargar();
                          },
                        ),
                      ),
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order, required this.onTap});
  final Order order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = _estadoColors(order.estado);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFF0F2F1)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
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
                    fontSize: 16,
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
            const SizedBox(height: 8),
            Text(
              '${order.total} Bs.',
              style: GoogleFonts.manrope(
                fontWeight: FontWeight.w800,
                fontSize: 22,
                color: const Color(0xFF006A5E),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              _fmt(order.createdAt),
              style: const TextStyle(color: Color(0xFF6F7977), fontSize: 13),
            ),
            if (order.repartidorNombre != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.delivery_dining, color: Color(0xFF006A5E), size: 16),
                  const SizedBox(width: 6),
                  Text(
                    order.repartidorNombre!,
                    style: const TextStyle(color: Color(0xFF3E4946), fontSize: 13),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                const Spacer(),
                Text(
                  'Ver detalle →',
                  style: GoogleFonts.manrope(
                    color: const Color(0xFF006A5E),
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _fmt(DateTime d) {
    final l = d.toLocal();
    String p(int n) => n.toString().padLeft(2, '0');
    return '${p(l.day)}/${p(l.month)}/${l.year}  ${p(l.hour)}:${p(l.minute)}';
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

class _EmptyView extends StatelessWidget {
  const _EmptyView();
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.delivery_dining_rounded, size: 72, color: Color(0xFFBDC9C5)),
          const SizedBox(height: 16),
          Text(
            'Sin pedidos aún',
            style: GoogleFonts.manrope(
              fontWeight: FontWeight.w800,
              fontSize: 20,
              color: const Color(0xFF191C1C),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Tus pedidos de entrega a domicilio\naparecerán aquí.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF6F7977), fontSize: 15),
          ),
        ],
      ),
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
