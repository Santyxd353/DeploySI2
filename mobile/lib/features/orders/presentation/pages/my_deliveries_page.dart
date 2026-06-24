import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../../../../core/auth/auth_session_manager.dart';
import '../../data/models/order_models.dart';
import '../../data/orders_service.dart';
import '../../data/route_service.dart';

class MyDeliveriesPage extends StatefulWidget {
  const MyDeliveriesPage({super.key});

  @override
  State<MyDeliveriesPage> createState() => _MyDeliveriesPageState();
}

class _MyDeliveriesPageState extends State<MyDeliveriesPage> {
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAF9),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8FAF9),
        elevation: 0,
        title: Text(
          'Mis Entregas',
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
                : _entregas.isEmpty
                    ? _EmptyView(onRefresh: _cargar)
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _entregas.length,
                        itemBuilder: (context, i) => _DeliveryCard(
                          order: _entregas[i],
                          onTap: () async {
                            await Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => DeliveryDetailPage(order: _entregas[i]),
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

class _DeliveryCard extends StatelessWidget {
  const _DeliveryCard({required this.order, required this.onTap});
  final Order order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
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
                _EstadoBadge(estado: order.estado),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.person_outline, size: 15, color: Color(0xFF6F7977)),
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
                  const Icon(Icons.location_on_outlined, size: 15, color: Color(0xFF6F7977)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      order.direccionTexto,
                      style: const TextStyle(color: Color(0xFF6F7977), fontSize: 12),
                      maxLines: 2,
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 12),
            Row(
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
                Text(
                  'Gestionar →',
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
}

// ── Página de detalle de entrega (pública para delivery_home_page) ────────────

class DeliveryDetailPage extends StatefulWidget {
  const DeliveryDetailPage({super.key, required this.order});
  final Order order;

  @override
  State<DeliveryDetailPage> createState() => _DeliveryDetailPageState();
}

class _DeliveryDetailPageState extends State<DeliveryDetailPage> {
  final _service = OrdersService();
  final _mapController = MapController();
  late Order _order;
  bool _changingState = false;
  // WS de ubicación: el repartidor envía su GPS al backend
  WebSocketChannel? _ws;
  StreamSubscription? _wsSub;
  // WS de tracking: el repartidor recibe cambios de estado hechos por el admin
  WebSocketChannel? _trackingWs;
  StreamSubscription? _trackingWsSub;
  String? _token;
  StreamSubscription<Position>? _geoSub;
  LatLng? _geoPos;
  List<LatLng> _rutaPuntos = [];
  LatLng? _ultimaPosRuta;

  static const _transiciones = {
    'listo': ['en_camino'],
    'en_camino': ['cerca', 'entregado', 'no_entregado'],
    'cerca': ['entregado', 'no_entregado'],
    'no_entregado': ['en_camino', 'cancelado'],
  };

  @override
  void initState() {
    super.initState();
    _order = widget.order;
    _conectarWsYGps();
  }

  Future<void> _conectarWsYGps() async {
    final token = await AuthSessionManager.getAccessToken();
    if (token == null) return;
    _token = token;

    // WS de ubicación: enviar GPS al backend (repartidor → backend)
    try {
      final url = _service.wsUbicacionUrl(token, _order.id);
      _ws = WebSocketChannel.connect(Uri.parse(url));
      _wsSub = _ws!.stream.listen((_) {}, cancelOnError: false, onError: (_) {});
    } catch (_) {}

    // WS de tracking: recibir cambios de estado del admin (backend → repartidor)
    _conectarTrackingWs(token);

    await _pedirPermisoGps();

    _geoSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10,
      ),
    ).listen((pos) {
      _enviarUbicacion(pos.latitude, pos.longitude);
      if (mounted) {
        setState(() => _geoPos = LatLng(pos.latitude, pos.longitude));
        _actualizarRuta();
      }
    });
  }

  void _conectarTrackingWs(String token) {
    final url = _service.wsTrackingUrl(token, _order.id);
    try {
      _trackingWsSub?.cancel();
      _trackingWs?.sink.close();
      _trackingWs = WebSocketChannel.connect(Uri.parse(url));
      _trackingWsSub = _trackingWs!.stream.listen(
        (msg) {
          if (!mounted) return;
          try {
            final data = jsonDecode(msg as String) as Map<String, dynamic>;
            final tipo = data['tipo'] as String?;
            final nuevoEstado = data['estado'] as String?;
            if ((tipo == 'cambio_estado' || tipo == 'estado_inicial') &&
                nuevoEstado != null &&
                nuevoEstado != _order.estado) {
              setState(() {
                _order = Order.fromJson({
                  ..._jsonFromOrder(_order),
                  'estado': nuevoEstado,
                });
              });
              if (!RouteService.estadoRequiereRuta(nuevoEstado)) {
                setState(() => _rutaPuntos = []);
              } else {
                _actualizarRuta();
              }
            }
          } catch (_) {}
        },
        onError: (_) => _reconnectTracking(),
        onDone: () => _reconnectTracking(),
        cancelOnError: false,
      );
    } catch (_) {
      _reconnectTracking();
    }
  }

  void _reconnectTracking() {
    if (!mounted || _token == null) return;
    Future.delayed(const Duration(seconds: 5), () {
      if (mounted && _token != null) _conectarTrackingWs(_token!);
    });
  }

  Future<void> _actualizarRuta() async {
    final gps = _geoPos;
    if (gps == null) return;
    if (!RouteService.estadoRequiereRuta(_order.estado)) return;

    final destLat = _order.latEntrega;
    final destLon = _order.lonEntrega;
    if (destLat == null || destLon == null) return;

    if (!RouteService.debeActualizar(gps, _ultimaPosRuta)) return;
    _ultimaPosRuta = gps;

    final dest = LatLng(destLat, destLon);
    final puntos = await RouteService.fetchRuta(gps, dest);
    if (!mounted) return;
    setState(() => _rutaPuntos = puntos);
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
        'items': o.items.map((i) => {
          'producto': i.producto,
          'cantidad': i.cantidad,
          'precio_unitario': i.precioUnitario,
          'subtotal': i.subtotal,
        }).toList(),
      };

  Future<void> _pedirPermisoGps() async {
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
  }

  void _enviarUbicacion(double lat, double lon) {
    try {
      _ws?.sink.add(jsonEncode({'lat': lat, 'lon': lon}));
    } catch (_) {}
  }

  Future<void> _cambiarEstado(String nuevoEstado) async {
    setState(() => _changingState = true);
    try {
      final token = await AuthSessionManager.getAccessToken();
      if (token == null) throw const OrderServiceException('Sesión expirada.');
      final updated = await _service.cambiarEstado(
        accessToken: token,
        pedidoId: _order.id,
        estado: nuevoEstado,
      );
      if (!mounted) return;
      setState(() {
        _order = updated;
        _changingState = false;
      });

      // Al iniciar viaje, trazar ruta inmediatamente
      if (RouteService.estadoRequiereRuta(nuevoEstado)) {
        _actualizarRuta();
      } else {
        setState(() => _rutaPuntos = []);
      }

      if (nuevoEstado == 'entregado' || nuevoEstado == 'cancelado') {
        if (mounted) Navigator.of(context).pop();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _changingState = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: const Color(0xFFBA1A1A),
        ),
      );
    }
  }

  void _recentrarMapa() {
    final pos = _geoPos;
    final destLat = _order.latEntrega;
    final destLon = _order.lonEntrega;
    if (pos != null) {
      _mapController.move(pos, 15);
    } else if (destLat != null && destLon != null) {
      _mapController.move(LatLng(destLat, destLon), 15);
    }
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    _ws?.sink.close();
    _trackingWsSub?.cancel();
    _trackingWs?.sink.close();
    _geoSub?.cancel();
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final destLat = _order.latEntrega;
    final destLon = _order.lonEntrega;
    final hasMap = destLat != null && destLon != null;
    final destPos = hasMap ? LatLng(destLat, destLon) : null;
    final siguientes = _transiciones[_order.estado] ?? [];
    final esIniciarViaje = siguientes.length == 1 && siguientes.first == 'en_camino';

    double? distKm;
    if (_geoPos != null && destPos != null) {
      distKm = const Distance()(_geoPos!, destPos) / 1000;
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAF9),
      body: CustomScrollView(
        slivers: [
          // AppBar
          SliverAppBar(
            backgroundColor: const Color(0xFFF8FAF9),
            elevation: 0,
            pinned: true,
            title: Text(
              'Entrega #${_order.id}',
              style: GoogleFonts.manrope(
                fontWeight: FontWeight.w800,
                color: const Color(0xFF191C1C),
              ),
            ),
            actions: [
              if (hasMap)
                IconButton(
                  icon: const Icon(Icons.my_location_rounded, color: Color(0xFF006A5E)),
                  onPressed: _recentrarMapa,
                ),
            ],
          ),

          // Mapa
          if (hasMap)
            SliverToBoxAdapter(
              child: Stack(
                children: [
                  SizedBox(
                    height: 260,
                    child: FlutterMap(
                      mapController: _mapController,
                      options: MapOptions(
                        initialCenter: _geoPos ?? destPos!,
                        initialZoom: 14,
                      ),
                      children: [
                        TileLayer(
                          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                          userAgentPackageName: 'com.farmacia.bibosi',
                        ),
                        // Ruta trazada por OSRM
                        if (_geoPos != null && _rutaPuntos.isNotEmpty)
                          PolylineLayer(
                            polylines: [
                              Polyline(
                                points: _rutaPuntos,
                                strokeWidth: 5,
                                color: const Color(0xFF006A5E),
                              ),
                            ],
                          ),
                        MarkerLayer(
                          markers: [
                            // Destino (cliente)
                            Marker(
                              point: destPos!,
                              width: 40,
                              height: 40,
                              child: Column(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: const BoxDecoration(
                                      color: Color(0xFFBA1A1A),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(Icons.home_rounded, color: Colors.white, size: 14),
                                  ),
                                  Container(width: 2, height: 8, color: const Color(0xFFBA1A1A)),
                                ],
                              ),
                            ),
                            // Mi posición (repartidor)
                            if (_geoPos != null)
                              Marker(
                                point: _geoPos!,
                                width: 44,
                                height: 44,
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF006A5E),
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.white, width: 3),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFF006A5E).withOpacity(0.4),
                                        blurRadius: 8,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: const Icon(
                                    Icons.delivery_dining_rounded,
                                    color: Colors.white,
                                    size: 22,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  // Distancia overlay
                  if (distKm != null)
                    Positioned(
                      top: 12,
                      right: 12,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
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
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.straighten_rounded, size: 14, color: Color(0xFF006A5E)),
                            const SizedBox(width: 4),
                            Text(
                              '${distKm.toStringAsFixed(1)} km',
                              style: GoogleFonts.manrope(
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                                color: const Color(0xFF191C1C),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),

          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Estado actual
                  _EstadoActualCard(estado: _order.estado),
                  const SizedBox(height: 12),

                  // BOTÓN INICIAR VIAJE (prominente, solo cuando está listo)
                  if (esIniciarViaje) ...[
                    _IniciarViajeButton(
                      loading: _changingState,
                      onPressed: () => _cambiarEstado('en_camino'),
                    ),
                    const SizedBox(height: 12),
                  ],

                  // Mini timeline de progreso
                  _MiniTimeline(estado: _order.estado),
                  const SizedBox(height: 12),

                  // Info del cliente
                  _ClienteCard(order: _order),
                  const SizedBox(height: 12),

                  // Productos
                  if (_order.items.isNotEmpty) ...[
                    _ProductosCard(items: _order.items),
                    const SizedBox(height: 12),
                  ],

                  // Botones de estado (excepto iniciar viaje que ya está arriba)
                  if (!esIniciarViaje && siguientes.isNotEmpty) ...[
                    Text(
                      'Cambiar estado',
                      style: GoogleFonts.manrope(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                        color: const Color(0xFF191C1C),
                      ),
                    ),
                    const SizedBox(height: 10),
                    ...siguientes.map(
                      (s) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: ElevatedButton.icon(
                            onPressed: _changingState ? null : () => _cambiarEstado(s),
                            icon: Icon(_accionIcon(s), size: 18),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _botonColor(s),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            label: _changingState
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : Text(
                                    _accionLabel(s),
                                    style: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 15),
                                  ),
                          ),
                        ),
                      ),
                    ),
                  ],

                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _botonColor(String estado) => switch (estado) {
        'en_camino' => const Color(0xFF006A5E),
        'cerca' => const Color(0xFFE65100),
        'entregado' => const Color(0xFF2E7D32),
        'no_entregado' => const Color(0xFFBA1A1A),
        'cancelado' => const Color(0xFF757575),
        _ => const Color(0xFF006A5E),
      };

  IconData _accionIcon(String estado) => switch (estado) {
        'en_camino' => Icons.directions_bike_rounded,
        'cerca' => Icons.location_on_rounded,
        'entregado' => Icons.check_circle_rounded,
        'no_entregado' => Icons.cancel_rounded,
        'cancelado' => Icons.block_rounded,
        _ => Icons.arrow_forward_rounded,
      };

  String _accionLabel(String estado) => switch (estado) {
        'cerca' => 'Ya estoy cerca',
        'entregado' => 'Marcar entregado',
        'no_entregado' => 'No entregado',
        'cancelado' => 'Cancelar',
        _ => _estadoLabel(estado),
      };
}

// ── Widgets del detail ────────────────────────────────────────────────────────

class _IniciarViajeButton extends StatelessWidget {
  const _IniciarViajeButton({required this.loading, required this.onPressed});
  final bool loading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 60,
      child: ElevatedButton(
        onPressed: loading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF006A5E),
          foregroundColor: Colors.white,
          elevation: 4,
          shadowColor: const Color(0xFF006A5E).withOpacity(0.4),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        ),
        child: loading
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.navigation_rounded, size: 24),
                  const SizedBox(width: 10),
                  Text(
                    'Iniciar Viaje',
                    style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 18),
                  ),
                ],
              ),
      ),
    );
  }
}

class _EstadoActualCard extends StatelessWidget {
  const _EstadoActualCard({required this.estado});
  final String estado;

  @override
  Widget build(BuildContext context) {
    final colors = _estadoColors(estado);
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: colors.$1,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.$2.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: colors.$2.withOpacity(0.15), shape: BoxShape.circle),
            child: Icon(_estadoIcon(estado), color: colors.$2, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Estado actual',
                  style: TextStyle(color: colors.$2.withOpacity(0.7), fontSize: 11, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  _estadoLabel(estado),
                  style: GoogleFonts.manrope(
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                    color: colors.$2,
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

class _MiniTimeline extends StatelessWidget {
  const _MiniTimeline({required this.estado});
  final String estado;

  static const _pasos = [
    ('aceptado', 'Aceptado'),
    ('preparando', 'Preparando'),
    ('listo', 'Listo'),
    ('en_camino', 'En camino'),
    ('cerca', 'Cerca'),
    ('entregado', 'Entregado'),
  ];

  static const _orden = [
    'pagado', 'aceptado', 'preparando', 'listo', 'en_camino', 'cerca', 'entregado', 'no_entregado', 'cancelado',
  ];

  @override
  Widget build(BuildContext context) {
    final indice = _orden.indexOf(estado);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF0F2F1)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (int i = 0; i < _pasos.length; i++) ...[
              _MiniStep(
                label: _pasos[i].$2,
                completed: _orden.indexOf(_pasos[i].$1) < indice,
                active: _pasos[i].$1 == estado,
              ),
              if (i < _pasos.length - 1)
                Container(
                  width: 20,
                  height: 2,
                  margin: const EdgeInsets.only(bottom: 16),
                  color: _orden.indexOf(_pasos[i].$1) < indice
                      ? const Color(0xFF006A5E)
                      : const Color(0xFFE0E3E1),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _MiniStep extends StatelessWidget {
  const _MiniStep({required this.label, required this.completed, required this.active});
  final String label;
  final bool completed;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            color: (completed || active) ? const Color(0xFF006A5E) : const Color(0xFFF0F2F1),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: completed
                ? const Icon(Icons.check_rounded, color: Colors.white, size: 13)
                : active
                    ? const SizedBox(
                        width: 12,
                        height: 12,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: Color(0xFFBDC9C5),
                          shape: BoxShape.circle,
                        ),
                      ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 9,
            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
            color: (completed || active) ? const Color(0xFF006A5E) : const Color(0xFFBDC9C5),
          ),
        ),
      ],
    );
  }
}

class _ClienteCard extends StatelessWidget {
  const _ClienteCard({required this.order});
  final Order order;

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
            'Cliente',
            style: GoogleFonts.manrope(
              fontWeight: FontWeight.w800,
              fontSize: 14,
              color: const Color(0xFF191C1C),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(Icons.person_outline_rounded, size: 16, color: Color(0xFF6F7977)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(order.clienteNombre, style: const TextStyle(fontSize: 14, color: Color(0xFF3E4946))),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.email_outlined, size: 16, color: Color(0xFF6F7977)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(order.clienteEmail, style: const TextStyle(fontSize: 13, color: Color(0xFF6F7977))),
              ),
            ],
          ),
          if (order.direccionTexto.isNotEmpty) ...[
            const SizedBox(height: 4),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.location_on_outlined, size: 16, color: Color(0xFF006A5E)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    order.direccionTexto,
                    style: const TextStyle(fontSize: 13, color: Color(0xFF3E4946)),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFEAF8F4),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              'Total: ${order.total} Bs.',
              style: GoogleFonts.manrope(
                fontWeight: FontWeight.w800,
                fontSize: 16,
                color: const Color(0xFF006A5E),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductosCard extends StatelessWidget {
  const _ProductosCard({required this.items});
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
            'Productos a entregar',
            style: GoogleFonts.manrope(
              fontWeight: FontWeight.w800,
              fontSize: 14,
              color: const Color(0xFF191C1C),
            ),
          ),
          const SizedBox(height: 10),
          ...items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
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
                      style: const TextStyle(fontSize: 14, color: Color(0xFF3E4946)),
                    ),
                  ),
                  Text(
                    '${item.subtotal} Bs.',
                    style: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 13),
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

// ── Badge de estado ───────────────────────────────────────────────────────────

class _EstadoBadge extends StatelessWidget {
  const _EstadoBadge({required this.estado});
  final String estado;

  @override
  Widget build(BuildContext context) {
    final colors = _estadoColors(estado);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: colors.$1, borderRadius: BorderRadius.circular(20)),
      child: Text(
        _estadoLabel(estado),
        style: TextStyle(color: colors.$2, fontWeight: FontWeight.w700, fontSize: 11),
      ),
    );
  }
}

// ── Views vacíos / error ──────────────────────────────────────────────────────

class _EmptyView extends StatelessWidget {
  const _EmptyView({required this.onRefresh});
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.delivery_dining_rounded, size: 72, color: Color(0xFFBDC9C5)),
          const SizedBox(height: 16),
          Text(
            'Sin entregas pendientes',
            style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 20, color: const Color(0xFF191C1C)),
          ),
          const SizedBox(height: 8),
          const Text(
            'Tus pedidos asignados\naparecerán aquí.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF6F7977), fontSize: 15),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh),
            label: const Text('Actualizar'),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF006A5E),
              side: const BorderSide(color: Color(0xFF006A5E)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
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
