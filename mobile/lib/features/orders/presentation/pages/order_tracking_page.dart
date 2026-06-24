import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../../../../core/auth/auth_session_manager.dart';
import '../../data/models/order_models.dart';
import '../../data/orders_service.dart';
import '../../data/route_service.dart';

class OrderTrackingPage extends StatefulWidget {
  const OrderTrackingPage({super.key, required this.pedidoId});
  final int pedidoId;

  @override
  State<OrderTrackingPage> createState() => _OrderTrackingPageState();
}

class _OrderTrackingPageState extends State<OrderTrackingPage> {
  final _service = OrdersService();
  final _mapController = MapController();

  Order? _order;
  bool _loading = true;
  String _error = '';
  LatLng? _repartidorPos;
  WebSocketChannel? _ws;
  StreamSubscription? _wsSub;
  String? _token;
  List<LatLng> _rutaPuntos = [];
  LatLng? _ultimaPosRuta; // último punto donde se calculó la ruta (para debounce)

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      final token = await AuthSessionManager.getAccessToken();
      if (token == null) throw const OrderServiceException('Sesión expirada.');
      _token = token;

      final order = await _service.detallePedido(
        accessToken: token,
        pedidoId: widget.pedidoId,
      );

      if (!mounted) return;
      setState(() {
        _order = order;
        _loading = false;
        if (order.latRepartidor != null && order.lonRepartidor != null) {
          _repartidorPos = LatLng(order.latRepartidor!, order.lonRepartidor!);
        }
      });

      _conectarWs(token);
      _actualizarRuta();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _conectarWs(String token) {
    final url = _service.wsTrackingUrl(token, widget.pedidoId);
    try {
      _wsSub?.cancel();
      _ws?.sink.close();
      _ws = WebSocketChannel.connect(Uri.parse(url));
      _wsSub = _ws!.stream.listen(
        (msg) {
          final data = jsonDecode(msg as String) as Map<String, dynamic>;
          _handleWsMessage(data);
        },
        onError: (_) => _reconnect(),
        onDone: () => _reconnect(),
        cancelOnError: false,
      );
    } catch (_) {
      _reconnect();
    }
  }

  void _reconnect() {
    if (!mounted || _token == null) return;
    Future.delayed(const Duration(seconds: 4), () {
      if (mounted && _token != null) _conectarWs(_token!);
    });
  }

  Future<void> _actualizarRuta() async {
    final order = _order;
    final repPos = _repartidorPos;
    if (order == null || repPos == null) return;
    if (!RouteService.estadoRequiereRuta(order.estado)) return;

    final destLat = order.latEntrega;
    final destLon = order.lonEntrega;
    if (destLat == null || destLon == null) return;

    if (!RouteService.debeActualizar(repPos, _ultimaPosRuta)) return;
    _ultimaPosRuta = repPos;

    final dest = LatLng(destLat, destLon);
    final puntos = await RouteService.fetchRuta(repPos, dest);
    if (!mounted) return;
    setState(() => _rutaPuntos = puntos);
  }

  void _handleWsMessage(Map<String, dynamic> data) {
    if (!mounted) return;
    final tipo = data['tipo'] as String?;

    if (tipo == 'ubicacion_repartidor') {
      final lat = double.tryParse(data['lat'].toString());
      final lon = double.tryParse(data['lon'].toString());
      if (lat != null && lon != null) {
        setState(() => _repartidorPos = LatLng(lat, lon));
        try {
          _mapController.move(_repartidorPos!, 15);
        } catch (_) {}
        _actualizarRuta();
      }
    } else if (tipo == 'cambio_estado') {
      final nuevoEstado = data['estado'] as String?;
      if (nuevoEstado != null && _order != null) {
        setState(() {
          _order = Order.fromJson({
            ..._jsonFromOrder(_order!),
            'estado': nuevoEstado,
          });
        });
        // Si el estado ya no requiere ruta, limpiarla
        if (!RouteService.estadoRequiereRuta(nuevoEstado)) {
          setState(() => _rutaPuntos = []);
        } else {
          _actualizarRuta();
        }
      }
    } else if (tipo == 'estado_inicial') {
      // El backend envía el estado inicial plano: {tipo, estado, lat_repartidor, lon_repartidor, ...}
      final estado = data['estado'] as String?;
      final latR = double.tryParse((data['lat_repartidor'] ?? '').toString());
      final lonR = double.tryParse((data['lon_repartidor'] ?? '').toString());
      final nombreR = data['repartidor_nombre'] as String?;
      if (_order != null) {
        setState(() {
          _order = Order.fromJson({
            ..._jsonFromOrder(_order!),
            if (estado != null) 'estado': estado,
            if (nombreR != null) 'repartidor_nombre': nombreR,
          });
          if (latR != null && lonR != null) _repartidorPos = LatLng(latR, lonR);
        });
      }
    }
  }

  Map<String, dynamic> _jsonFromOrder(Order o) => {
        'id': o.id,
        'estado': o.estado,
        'cliente_nombre': o.clienteNombre,
        'cliente_email': o.clienteEmail,
        'repartidor_nombre': o.repartidorNombre,
        'total': o.total,
        'numero_factura': o.numeroFactura,
        'lat_entrega': o.latEntrega,
        'lon_entrega': o.lonEntrega,
        'direccion_texto': o.direccionTexto,
        'lat_repartidor': o.latRepartidor,
        'lon_repartidor': o.lonRepartidor,
        'created_at': o.createdAt.toIso8601String(),
        'aceptado_en': o.aceptadoEn?.toIso8601String(),
        'preparando_en': o.preparandoEn?.toIso8601String(),
        'listo_en': o.listoEn?.toIso8601String(),
        'en_camino_en': o.enCaminoEn?.toIso8601String(),
        'entregado_en': o.entregadoEn?.toIso8601String(),
        'historial': [],
        'items': [],
      };

  @override
  void dispose() {
    _wsSub?.cancel();
    _ws?.sink.close();
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAF9),
      body: SafeArea(
        bottom: false,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: Color(0xFF006A5E)))
            : _error.isNotEmpty
                ? _ErrorBody(error: _error, onRetry: _init)
                : _TrackingBody(
                    order: _order!,
                    repartidorPos: _repartidorPos,
                    mapController: _mapController,
                    rutaPuntos: _rutaPuntos,
                  ),
      ),
    );
  }
}

// ── Cuerpo principal del tracking ─────────────────────────────────────────────

class _TrackingBody extends StatelessWidget {
  const _TrackingBody({
    required this.order,
    required this.repartidorPos,
    required this.mapController,
    required this.rutaPuntos,
  });

  final Order order;
  final LatLng? repartidorPos;
  final MapController mapController;
  final List<LatLng> rutaPuntos;

  @override
  Widget build(BuildContext context) {
    final latDest = order.latEntrega;
    final lonDest = order.lonEntrega;
    final hasMap = latDest != null && lonDest != null;
    final destPos = hasMap ? LatLng(latDest, lonDest) : null;

    double? distKm;
    int? etaMin;
    if (repartidorPos != null && destPos != null) {
      distKm = const Distance()(repartidorPos!, destPos) / 1000;
      etaMin = (distKm / 30 * 60).ceil(); // ~30km/h promedio
    }

    return Column(
      children: [
        // ── Mapa grande con overlays ──────────────────────────────────────────
        Stack(
          children: [
            SizedBox(
              height: hasMap ? 300 : 0,
              child: hasMap
                  ? FlutterMap(
                      mapController: mapController,
                      options: MapOptions(
                        initialCenter: repartidorPos ?? destPos!,
                        initialZoom: 15,
                      ),
                      children: [
                        TileLayer(
                          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                          userAgentPackageName: 'com.farmacia.bibosi',
                        ),
                        // Ruta trazada por OSRM (solo cuando repartidor está en camino)
                        if (repartidorPos != null && rutaPuntos.isNotEmpty)
                          PolylineLayer(
                            polylines: [
                              Polyline(
                                points: rutaPuntos,
                                strokeWidth: 5,
                                color: const Color(0xFF006A5E),
                              ),
                            ],
                          ),
                        MarkerLayer(
                          markers: [
                            // Destino
                            Marker(
                              point: destPos!,
                              width: 44,
                              height: 50,
                              child: Column(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: const BoxDecoration(
                                      color: Color(0xFFBA1A1A),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(Icons.home_rounded, color: Colors.white, size: 16),
                                  ),
                                  Container(
                                    width: 2,
                                    height: 10,
                                    color: const Color(0xFFBA1A1A),
                                  ),
                                ],
                              ),
                            ),
                            // Repartidor
                            if (repartidorPos != null)
                              Marker(
                                point: repartidorPos!,
                                width: 48,
                                height: 48,
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF006A5E),
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.white, width: 3),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFF006A5E).withOpacity(0.4),
                                        blurRadius: 10,
                                        offset: const Offset(0, 3),
                                      ),
                                    ],
                                  ),
                                  child: const Icon(
                                    Icons.delivery_dining_rounded,
                                    color: Colors.white,
                                    size: 24,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    )
                  : const SizedBox.shrink(),
            ),

            // Overlay superior: botón atrás + título
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                child: Row(
                  children: [
                    _MapOverlayButton(
                      icon: Icons.arrow_back_rounded,
                      onTap: () => Navigator.of(context).pop(),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.1),
                              blurRadius: 8,
                            ),
                          ],
                        ),
                        child: Text(
                          'Seguimiento del pedido',
                          style: GoogleFonts.manrope(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: const Color(0xFF191C1C),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Overlay inferior: distancia y ETA
            if (distKm != null)
              Positioned(
                bottom: 12,
                left: 16,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.12),
                        blurRadius: 10,
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.directions_rounded, size: 16, color: Color(0xFF006A5E)),
                      const SizedBox(width: 6),
                      Text(
                        '${distKm.toStringAsFixed(1)} km',
                        style: GoogleFonts.manrope(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          color: const Color(0xFF191C1C),
                        ),
                      ),
                      if (etaMin != null) ...[
                        const SizedBox(width: 10),
                        const Icon(Icons.access_time_rounded, size: 16, color: Color(0xFF6F7977)),
                        const SizedBox(width: 4),
                        Text(
                          '~$etaMin min',
                          style: GoogleFonts.manrope(
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                            color: const Color(0xFF6F7977),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
          ],
        ),

        // ── Stepper horizontal de estados ─────────────────────────────────────
        _EstadoStepperRow(estadoActual: order.estado),

        // ── Contenido scrollable ──────────────────────────────────────────────
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              // Card de estado actual
              _EstadoActualCard(estado: order.estado),
              const SizedBox(height: 12),

              // Card del repartidor
              if (order.repartidorNombre != null) ...[
                _RepartidorCard(
                  nombre: order.repartidorNombre!,
                  distKm: distKm,
                  etaMin: etaMin,
                ),
                const SizedBox(height: 12),
              ],

              // Dirección de entrega
              if (order.direccionTexto.isNotEmpty) ...[
                _DireccionCard(direccion: order.direccionTexto),
                const SizedBox(height: 12),
              ],

              // Productos
              if (order.items.isNotEmpty) _ItemsCard(items: order.items),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Stepper horizontal de estados ─────────────────────────────────────────────

class _EstadoStepperRow extends StatelessWidget {
  const _EstadoStepperRow({required this.estadoActual});
  final String estadoActual;

  static const _pasos = [
    ('pagado', 'Pagado', Icons.receipt_long_rounded),
    ('aceptado', 'Aceptado', Icons.check_circle_outline_rounded),
    ('preparando', 'Preparando', Icons.inventory_2_rounded),
    ('listo', 'Listo', Icons.done_all_rounded),
    ('en_camino', 'En camino', Icons.delivery_dining_rounded),
    ('cerca', 'Cerca', Icons.location_on_rounded),
    ('entregado', 'Entregado', Icons.home_rounded),
  ];

  static const _orden = [
    'pagado', 'aceptado', 'preparando', 'listo', 'en_camino', 'cerca', 'entregado', 'no_entregado', 'cancelado',
  ];

  @override
  Widget build(BuildContext context) {
    final indice = _orden.indexOf(estadoActual);

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            for (int i = 0; i < _pasos.length; i++) ...[
              _StepDot(
                icon: _pasos[i].$3,
                label: _pasos[i].$2,
                completed: _orden.indexOf(_pasos[i].$1) < indice,
                active: _pasos[i].$1 == estadoActual,
              ),
              if (i < _pasos.length - 1)
                Container(
                  width: 28,
                  height: 2,
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: _orden.indexOf(_pasos[i].$1) < indice
                        ? const Color(0xFF006A5E)
                        : const Color(0xFFE0E3E1),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StepDot extends StatelessWidget {
  const _StepDot({
    required this.icon,
    required this.label,
    required this.completed,
    required this.active,
  });
  final IconData icon;
  final String label;
  final bool completed;
  final bool active;

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    if (completed) {
      bg = const Color(0xFF006A5E);
      fg = Colors.white;
    } else if (active) {
      bg = const Color(0xFF006A5E);
      fg = Colors.white;
    } else {
      bg = const Color(0xFFF0F2F1);
      fg = const Color(0xFFBDC9C5);
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: bg,
            shape: BoxShape.circle,
            boxShadow: active
                ? [BoxShadow(color: const Color(0xFF006A5E).withOpacity(0.4), blurRadius: 8)]
                : null,
          ),
          child: Center(
            child: completed
                ? const Icon(Icons.check_rounded, color: Colors.white, size: 16)
                : active
                    ? Icon(icon, color: fg, size: 16)
                    : Icon(icon, color: fg, size: 16),
          ),
        ),
        const SizedBox(height: 5),
        Text(
          label,
          style: TextStyle(
            fontSize: 9,
            fontWeight: active ? FontWeight.w800 : FontWeight.w500,
            color: (completed || active) ? const Color(0xFF006A5E) : const Color(0xFFBDC9C5),
          ),
        ),
      ],
    );
  }
}

// ── Cards del contenido ───────────────────────────────────────────────────────

class _EstadoActualCard extends StatelessWidget {
  const _EstadoActualCard({required this.estado});
  final String estado;

  @override
  Widget build(BuildContext context) {
    final colors = _estadoColors(estado);
    return Container(
      padding: const EdgeInsets.all(18),
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
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: colors.$1, shape: BoxShape.circle),
            child: Icon(_estadoIcon(estado), color: colors.$2, size: 26),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Estado actual',
                  style: GoogleFonts.manrope(
                    color: const Color(0xFF6F7977),
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _estadoLabel(estado),
                  style: GoogleFonts.manrope(
                    fontWeight: FontWeight.w800,
                    fontSize: 20,
                    color: const Color(0xFF191C1C),
                  ),
                ),
                Text(
                  _estadoDescripcion(estado),
                  style: const TextStyle(color: Color(0xFF6F7977), fontSize: 13),
                ),
              ],
            ),
          ),
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: colors.$2,
              shape: BoxShape.circle,
            ),
          ),
        ],
      ),
    );
  }
}

class _RepartidorCard extends StatelessWidget {
  const _RepartidorCard({required this.nombre, this.distKm, this.etaMin});
  final String nombre;
  final double? distKm;
  final int? etaMin;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF0F2F1)),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: const Color(0xFFEAF8F4),
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFFB2DDD6), width: 2),
            ),
            child: const Icon(Icons.delivery_dining_rounded, color: Color(0xFF006A5E), size: 26),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  nombre,
                  style: GoogleFonts.manrope(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                    color: const Color(0xFF191C1C),
                  ),
                ),
                const Text(
                  'Tu repartidor',
                  style: TextStyle(color: Color(0xFF6F7977), fontSize: 12),
                ),
              ],
            ),
          ),
          if (distKm != null)
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${distKm!.toStringAsFixed(1)} km',
                  style: GoogleFonts.manrope(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                    color: const Color(0xFF006A5E),
                  ),
                ),
                if (etaMin != null)
                  Text(
                    '~$etaMin min',
                    style: const TextStyle(color: Color(0xFF6F7977), fontSize: 12),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}

class _DireccionCard extends StatelessWidget {
  const _DireccionCard({required this.direccion});
  final String direccion;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF0F2F1)),
      ),
      child: Row(
        children: [
          const Icon(Icons.location_on_rounded, color: Color(0xFFBA1A1A), size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Dirección de entrega',
                  style: GoogleFonts.manrope(
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                    color: const Color(0xFF6F7977),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  direccion,
                  style: const TextStyle(color: Color(0xFF3E4946), fontSize: 14),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ItemsCard extends StatelessWidget {
  const _ItemsCard({required this.items});
  final List<OrderItem> items;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF0F2F1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Productos',
            style: GoogleFonts.manrope(
              fontWeight: FontWeight.w800,
              fontSize: 15,
              color: const Color(0xFF191C1C),
            ),
          ),
          const SizedBox(height: 12),
          ...items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEAF8F4),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '×${item.cantidad}',
                      style: const TextStyle(
                        color: Color(0xFF006A5E),
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      item.producto,
                      style: const TextStyle(color: Color(0xFF3E4946), fontSize: 14),
                    ),
                  ),
                  Text(
                    '${item.subtotal} Bs.',
                    style: GoogleFonts.manrope(
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF191C1C),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Botón overlay para el mapa ────────────────────────────────────────────────

class _MapOverlayButton extends StatelessWidget {
  const _MapOverlayButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.12),
              blurRadius: 8,
            ),
          ],
        ),
        child: Icon(icon, color: const Color(0xFF191C1C), size: 22),
      ),
    );
  }
}

// ── Error ─────────────────────────────────────────────────────────────────────

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
            const Icon(Icons.error_outline, size: 56, color: Color(0xFFBA1A1A)),
            const SizedBox(height: 16),
            Text(error, textAlign: TextAlign.center),
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

// ── Utilidades ────────────────────────────────────────────────────────────────

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
      'pagado' => 'Pedido recibido',
      'aceptado' => 'Aceptado',
      'preparando' => 'En preparación',
      'listo' => 'Listo para envío',
      'en_camino' => 'En camino',
      'cerca' => 'Cerca del destino',
      'entregado' => 'Entregado',
      'no_entregado' => 'No entregado',
      'cancelado' => 'Cancelado',
      _ => estado,
    };

String _estadoDescripcion(String estado) => switch (estado) {
      'pagado' => 'Tu pedido fue registrado correctamente.',
      'aceptado' => 'La farmacia confirmó tu pedido.',
      'preparando' => 'Estamos preparando tus medicamentos.',
      'listo' => 'Tu pedido está listo para el repartidor.',
      'en_camino' => 'El repartidor va hacia tu dirección.',
      'cerca' => 'El repartidor está muy cerca de ti.',
      'entregado' => '¡Tu pedido fue entregado con éxito!',
      'no_entregado' => 'No se pudo completar la entrega.',
      'cancelado' => 'El pedido fue cancelado.',
      _ => '',
    };

IconData _estadoIcon(String estado) => switch (estado) {
      'pagado' => Icons.receipt_long_rounded,
      'aceptado' => Icons.check_circle_outline_rounded,
      'preparando' => Icons.inventory_2_rounded,
      'listo' => Icons.done_all_rounded,
      'en_camino' => Icons.delivery_dining_rounded,
      'cerca' => Icons.location_on_rounded,
      'entregado' => Icons.home_rounded,
      'no_entregado' => Icons.cancel_rounded,
      'cancelado' => Icons.block_rounded,
      _ => Icons.help_outline_rounded,
    };
