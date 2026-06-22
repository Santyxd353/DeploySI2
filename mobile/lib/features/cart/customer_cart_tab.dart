import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/config/app_config.dart';
import '../../core/auth/auth_session_manager.dart';
import 'data/cart_service.dart';
import 'ubicacion_selection_page.dart';
import '../payments/data/payment_service.dart';

class CartTab extends StatefulWidget {
  const CartTab({super.key});

  @override
  State<CartTab> createState() => _CartTabState();
}

class _CartTabState extends State<CartTab> {
  final CartService _cartService = CartService();
  final PaymentService _paymentService = PaymentService();

  List<Map<String, dynamic>> _cartItems = [];
  bool _loading = true;
  bool _processing = false;
  String _paymentMethod = 'qr';
  String _error = '';
  double _subtotal = 0;
  double _total = 0;

  @override
  void initState() {
    super.initState();
    _loadCartItems();
  }

  Future<String?> _getAccessToken() async {
    return AuthSessionManager.getAccessToken();
  }

  Future<void> _loadCartItems() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final token = await _getAccessToken();
      final data = await _cartService.listar(accessToken: token);
      _applyCartData(data);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _applyCartData(Map<String, dynamic> data) {
    final rawItems = data['items'];
    final items = rawItems is List ? rawItems.whereType<Map<String, dynamic>>().toList() : <Map<String, dynamic>>[];

    setState(() {
      _cartItems = items;
      _subtotal = double.tryParse(data['subtotal']?.toString() ?? '0') ?? 0;
      _total = double.tryParse(data['total']?.toString() ?? '0') ?? _subtotal;
      _loading = false;
      _error = '';
    });
  }

  Future<void> _actualizarCantidad(Map<String, dynamic> item, int nuevaCantidad) async {
    if (nuevaCantidad <= 0) return;

    final itemId = item['id'];
    if (itemId is! int) return;

    setState(() => _processing = true);
    try {
      final token = await _getAccessToken();
      final data = await _cartService.actualizarItem(
        itemId: itemId,
        cantidad: nuevaCantidad,
        accessToken: token,
      );
      _applyCartData(data);
    } catch (e) {
      _showError('No se pudo actualizar: $e');
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  Future<void> _eliminarProducto(Map<String, dynamic> item) async {
    final itemId = item['id'];
    if (itemId is! int) return;

    setState(() => _processing = true);
    try {
      final token = await _getAccessToken();
      final data = await _cartService.eliminarItem(itemId: itemId, accessToken: token);
      _applyCartData(data);
    } catch (e) {
      _showError('No se pudo eliminar: $e');
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  // ignore: unused_element
  Future<void> _pagarConStripe() async {
    if (AppConfig.stripePublishableKey.trim().isEmpty) {
      _showError('Stripe no esta configurado. Define STRIPE_PUBLISHABLE_KEY para mobile.');
      return;
    }

    // Paso 1: datos de facturación
    final datosFactura = await _solicitarDatosFactura();
    if (datosFactura == null) return;

    // Paso 2: selección de punto de entrega en el mapa
    if (!mounted) return;
    final ubicacion = await Navigator.push<Map<String, dynamic>>(
      context,
      MaterialPageRoute(builder: (_) => const UbicacionSelectionPage()),
    );
    if (ubicacion == null) return; // usuario canceló

    setState(() => _processing = true);

    try {
      final accessToken = await _getAccessToken();
      final carritoToken = await _cartService.getGuestCartToken();

      final intentData = await _paymentService.crearIntentPago(
        total: _total,
        accessToken: accessToken,
        metadata: {
          if (carritoToken != null && carritoToken.isNotEmpty) 'carrito_token': carritoToken,
          'nombre_cliente': datosFactura['nombre_cliente']?.toString() ?? '',
          'email_cliente': datosFactura['email_cliente']?.toString() ?? '',
          'telefono': datosFactura['telefono']?.toString() ?? '',
          'nit_ci': datosFactura['nit_ci']?.toString() ?? '',
        },
      );

      final clientSecret = intentData['client_secret']?.toString() ?? '';
      final paymentIntentId = intentData['payment_intent_id']?.toString() ?? '';
      if (clientSecret.isEmpty || paymentIntentId.isEmpty) {
        throw const PaymentServiceException('Respuesta incompleta al crear el intent de pago.');
      }

      await _paymentService.abrirPaymentSheet(clientSecret: clientSecret);

      final data = await _paymentService.confirmarPagoVenta(
        paymentIntentId: paymentIntentId,
        carritoToken: carritoToken,
        accessToken: accessToken,
        datosFactura: datosFactura,
        latEntrega: ubicacion['lat'] as double?,
        lonEntrega: ubicacion['lon'] as double?,
        direccionTexto: ubicacion['direccion'] as String?,
      );

      await _cartService.clearGuestCartToken();

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Pago confirmado. Factura ${data['factura']?['numero'] ?? ''} ✅'),
          backgroundColor: const Color(0xFF006A5E),
          behavior: SnackBarBehavior.floating,
        ),
      );
      await _loadCartItems();
    } on StripeException catch (e) {
      final msg = e.error.localizedMessage ?? 'Pago cancelado por el usuario.';
      _showError(msg);
    } catch (e) {
      _showError('No se pudo completar el pago: $e');
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  Future<void> _pagarConQrSimulado() async {
    final datosFactura = await _solicitarDatosFactura();
    if (datosFactura == null) return;

    final operationCode = 'MOBQR-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';
    final confirmed = await _showQrPaymentDialog(
      operationCode: operationCode,
      total: _total,
      payload: 'MOBILE_QR_SIMULADO|$operationCode|$_total|${datosFactura['nit_ci'] ?? ''}',
    );
    if (confirmed != true) return;

    setState(() => _processing = true);
    try {
      final token = await _getAccessToken();
      final data = await _cartService.confirmar(
        accessToken: token,
        estado: 'pagada',
        observacion: 'Pago QR simulado mobile $operationCode',
        datosFactura: datosFactura,
      );

      if (!mounted) return;
      await _showSaleNote(data);
      await _loadCartItems();
    } catch (e) {
      _showError('No se pudo completar el pago QR: $e');
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  Future<void> _pagarEnEfectivo() async {
    final datosFactura = await _solicitarDatosFactura();
    if (datosFactura == null) return;

    setState(() => _processing = true);
    try {
      final token = await _getAccessToken();
      final data = await _cartService.confirmar(
        accessToken: token,
        estado: 'pagada',
        observacion: 'Pago efectivo mobile',
        datosFactura: datosFactura,
      );

      if (!mounted) return;
      await _showSaleNote(data);
      await _loadCartItems();
    } catch (e) {
      _showError('No se pudo completar el pago en efectivo: $e');
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  Future<void> _continuarPago() async {
    if (_paymentMethod == 'efectivo') {
      await _pagarEnEfectivo();
      return;
    }
    await _pagarConQrSimulado();
  }

  Future<bool?> _showQrPaymentDialog({
    required String operationCode,
    required double total,
    required String payload,
  }) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: Text(
            'Pago QR simulado',
            style: GoogleFonts.manrope(fontWeight: FontWeight.w800),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0xFFE0E3E1)),
                  ),
                  child: CustomPaint(
                    size: const Size(210, 210),
                    painter: _SimulatedQrPainter(payload),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Bs ${total.toStringAsFixed(2)}',
                  style: GoogleFonts.manrope(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFF006A5E),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  operationCode,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.robotoMono(
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF1D1B20),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'QR de demostracion. La compra solo se confirma al tocar Realizar pago.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.manrope(fontSize: 12, color: const Color(0xFF6F7977)),
                ),
              ],
            ),
          ),
          actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          actions: [
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(false),
                    child: const Text('Cancelar pago'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(context).pop(true),
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF006A5E)),
                    child: const Text('Realizar pago', style: TextStyle(color: Colors.white)),
                  ),
                ),
              ],
            ),
          ],
        );
      },
    );
  }

  Future<void> _showSaleNote(Map<String, dynamic> data) {
    final venta = data['venta'] is Map<String, dynamic> ? data['venta'] as Map<String, dynamic> : <String, dynamic>{};
    final factura = data['factura'] is Map<String, dynamic> ? data['factura'] as Map<String, dynamic> : <String, dynamic>{};
    final facturaDetalle = venta['factura_detalle'] is Map<String, dynamic> ? venta['factura_detalle'] as Map<String, dynamic> : <String, dynamic>{};
    final cliente = venta['cliente_detalle'] is Map<String, dynamic> ? venta['cliente_detalle'] as Map<String, dynamic> : <String, dynamic>{};
    final detalles = venta['detalles'] is List ? (venta['detalles'] as List).whereType<Map<String, dynamic>>().toList() : <Map<String, dynamic>>[];
    final clienteNombre = (factura['nombre_cliente']?.toString().trim().isNotEmpty ?? false)
        ? factura['nombre_cliente'].toString()
        : '${cliente['nombres'] ?? 'Cliente'} ${cliente['apellidos'] ?? ''}'.trim();

    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return SafeArea(
          top: false,
          child: DraggableScrollableSheet(
            expand: false,
            initialChildSize: 0.78,
            minChildSize: 0.45,
            maxChildSize: 0.95,
            builder: (context, controller) {
              return ListView(
                controller: controller,
                padding: const EdgeInsets.all(20),
                children: [
                  Text('Nota de venta', style: GoogleFonts.manrope(fontSize: 22, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 4),
                  Text('Venta #${venta['id'] ?? '-'}', style: GoogleFonts.manrope(color: const Color(0xFF6F7977), fontWeight: FontWeight.w700)),
                  const SizedBox(height: 14),
                  _noteInfoTile('Comprobante', factura['numero']?.toString() ?? facturaDetalle['numero']?.toString() ?? 'Pendiente'),
                  _noteInfoTile('Cliente', clienteNombre.isEmpty ? 'Cliente mostrador' : clienteNombre),
                  _noteInfoTile('CI/NIT', facturaDetalle['nit_ci']?.toString() ?? cliente['ci_nit']?.toString() ?? 'No registrado'),
                  const SizedBox(height: 14),
                  Text('Detalle comprado', style: GoogleFonts.manrope(fontWeight: FontWeight.w900, fontSize: 16)),
                  const SizedBox(height: 8),
                  ...detalles.map((item) {
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAF9),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE0E3E1)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item['producto_nombre']?.toString() ?? 'Producto', style: GoogleFonts.manrope(fontWeight: FontWeight.w800)),
                                Text('SKU: ${item['producto_sku'] ?? '-'}', style: GoogleFonts.manrope(fontSize: 12, color: const Color(0xFF6F7977))),
                                Text('${item['cantidad']} x Bs ${item['precio_unitario']}', style: GoogleFonts.manrope(fontSize: 12, color: const Color(0xFF6F7977))),
                              ],
                            ),
                          ),
                          Text('Bs ${item['subtotal']}', style: GoogleFonts.manrope(fontWeight: FontWeight.w900, color: const Color(0xFF006A5E))),
                        ],
                      ),
                    );
                  }),
                  const Divider(height: 28),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Total', style: GoogleFonts.manrope(fontSize: 18, fontWeight: FontWeight.w900)),
                      Text('Bs ${venta['total'] ?? _total.toStringAsFixed(2)}', style: GoogleFonts.manrope(fontSize: 20, fontWeight: FontWeight.w900, color: const Color(0xFF006A5E))),
                    ],
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    height: 52,
                    child: ElevatedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF006A5E), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                      child: Text('Cerrar nota', style: GoogleFonts.manrope(color: Colors.white, fontWeight: FontWeight.w800)),
                    ),
                  ),
                ],
              );
            },
          ),
        );
      },
    );
  }

  Widget _noteInfoTile(String label, String value) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFFF8FAF9), borderRadius: BorderRadius.circular(14)),
      child: Row(
        children: [
          Text(label, style: GoogleFonts.manrope(fontWeight: FontWeight.w800, color: const Color(0xFF6F7977))),
          const Spacer(),
          Flexible(
            child: Text(value, textAlign: TextAlign.right, style: GoogleFonts.manrope(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }

  Future<Map<String, dynamic>?> _solicitarDatosFactura() async {
    return showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (context) => const _DatosFacturaBottomSheet(),
    );
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: const Color(0xFFBA1A1A),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: Color(0xFFF8FAF9),
        body: Center(child: CircularProgressIndicator(color: Color(0xFF006A5E))),
      );
    }

    if (_error.isNotEmpty) {
      return Scaffold(
        backgroundColor: const Color(0xFFF8FAF9),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.shopping_cart_checkout_rounded, color: Color(0xFFBA1A1A), size: 56),
                const SizedBox(height: 12),
                Text('No se pudo cargar el carrito', style: GoogleFonts.manrope(fontSize: 18, fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                Text(_error, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF6F7977))),
                const SizedBox(height: 16),
                ElevatedButton(onPressed: _loadCartItems, child: const Text('Reintentar')),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAF9),
      body: RefreshIndicator(
        color: const Color(0xFF006A5E),
        onRefresh: _loadCartItems,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
              child: Row(
                children: [
                  Text('Mi Carrito', style: GoogleFonts.manrope(fontSize: 24, fontWeight: FontWeight.w800, color: const Color(0xFF191C1C))),
                  const Spacer(),
                  Text('${_cartItems.length} ítems', style: GoogleFonts.manrope(color: const Color(0xFF6F7977), fontWeight: FontWeight.w600)),
                ],
              ),
            ),
            if (_processing) const LinearProgressIndicator(color: Color(0xFF006A5E), minHeight: 2),
            Expanded(
              child: _cartItems.isEmpty
                  ? _buildEmptyCart()
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      itemCount: _cartItems.length,
                      itemBuilder: (context, index) => _buildCartItem(_cartItems[index]),
                    ),
            ),
            _buildOrderSummary(),
          ],
        ),
      ),
    );
  }

  Widget _buildCartItem(Map<String, dynamic> item) {
    final cantidad = int.tryParse(item['cantidad']?.toString() ?? '1') ?? 1;
    final precio = double.tryParse(item['precio_unitario']?.toString() ?? '0') ?? 0;
    final nombre = item['producto_nombre']?.toString() ?? 'Medicamento';
    final sku = item['producto_sku']?.toString() ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE0E3E1)),
      ),
      child: Row(
        children: [
          Container(
            width: 70,
            height: 70,
            decoration: BoxDecoration(color: const Color(0xFFF0F2F1), borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.medication_liquid_rounded, color: Color(0xFF006A5E), size: 34),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(nombre, style: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 15), maxLines: 1, overflow: TextOverflow.ellipsis),
                if (sku.isNotEmpty) Text('SKU: $sku', style: GoogleFonts.manrope(fontSize: 12, color: const Color(0xFF6F7977))),
                const SizedBox(height: 8),
                Text('Bs ${precio.toStringAsFixed(2)}', style: GoogleFonts.manrope(fontWeight: FontWeight.w800, color: const Color(0xFF006A5E), fontSize: 16)),
              ],
            ),
          ),
          Column(
            children: [
              IconButton(
                icon: const Icon(Icons.delete_outline, color: Color(0xFFBA1A1A)),
                onPressed: _processing ? null : () => _eliminarProducto(item),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.remove_circle_outline, size: 22),
                    color: const Color(0xFF006A5E),
                    onPressed: _processing || cantidad <= 1 ? null : () => _actualizarCantidad(item, cantidad - 1),
                  ),
                  Text('x$cantidad', style: GoogleFonts.manrope(fontWeight: FontWeight.w700)),
                  IconButton(
                    icon: const Icon(Icons.add_circle_outline, size: 22),
                    color: const Color(0xFF006A5E),
                    onPressed: _processing ? null : () => _actualizarCantidad(item, cantidad + 1),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildOrderSummary() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 20, offset: const Offset(0, -5))],
      ),
      child: SafeArea(
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Subtotal', style: GoogleFonts.manrope(fontSize: 15, color: const Color(0xFF6F7977))),
                Text('Bs ${_subtotal.toStringAsFixed(2)}', style: GoogleFonts.manrope(fontSize: 16, fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Total estimado', style: GoogleFonts.manrope(fontSize: 16, color: const Color(0xFF6F7977))),
                Text('Bs ${_total.toStringAsFixed(2)}', style: GoogleFonts.manrope(fontSize: 22, fontWeight: FontWeight.w800, color: const Color(0xFF006A5E))),
              ],
            ),
            const SizedBox(height: 18),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Elegir metodo de pago',
                style: GoogleFonts.manrope(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF53605D),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: _buildPaymentOption('qr', Icons.qr_code_2_rounded, 'QR simulado')),
                const SizedBox(width: 10),
                Expanded(child: _buildPaymentOption('efectivo', Icons.payments_rounded, 'Efectivo')),
              ],
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 55,
              child: ElevatedButton(
                onPressed: _cartItems.isEmpty || _processing ? null : _continuarPago,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF006A5E),
                  disabledBackgroundColor: const Color(0xFFE0E3E1),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                  elevation: 0,
                ),
                child: _processing
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(
                        _paymentMethod == 'qr' ? 'Pagar con QR simulado' : 'Confirmar efectivo',
                        style: GoogleFonts.manrope(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentOption(String value, IconData icon, String label) {
    final selected = _paymentMethod == value;
    return InkWell(
      onTap: _processing ? null : () => setState(() => _paymentMethod = value),
      borderRadius: BorderRadius.circular(16),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFE7F7F2) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: selected ? const Color(0xFF006A5E) : const Color(0xFFE0E3E1), width: selected ? 1.5 : 1),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 19, color: selected ? const Color(0xFF006A5E) : const Color(0xFF6F7977)),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.manrope(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  color: selected ? const Color(0xFF006A5E) : const Color(0xFF394946),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyCart() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 160),
        Icon(Icons.shopping_cart_outlined, size: 80, color: Colors.grey[300]),
        const SizedBox(height: 16),
        Center(child: Text('Tu carrito está vacío', style: GoogleFonts.manrope(fontSize: 18, color: Colors.grey))),
      ],
    );
  }
}

class _DatosFacturaBottomSheet extends StatefulWidget {
  const _DatosFacturaBottomSheet();

  @override
  State<_DatosFacturaBottomSheet> createState() => _DatosFacturaBottomSheetState();
}

class _DatosFacturaBottomSheetState extends State<_DatosFacturaBottomSheet> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _nombreController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _telefonoController = TextEditingController();
  final TextEditingController _nitCiController = TextEditingController();

  @override
  void dispose() {
    _nombreController.dispose();
    _emailController.dispose();
    _telefonoController.dispose();
    _nitCiController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: AnimatedPadding(
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOut,
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Datos de facturacion',
                  style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 20),
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _nombreController,
                  decoration: const InputDecoration(labelText: 'Nombre completo *'),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Nombre requerido';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Email *'),
                  validator: (value) {
                    final text = value?.trim() ?? '';
                    if (text.isEmpty) return 'Email requerido';
                    if (!text.contains('@')) return 'Email invalido';
                    return null;
                  },
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _telefonoController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Telefono'),
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _nitCiController,
                  decoration: const InputDecoration(labelText: 'NIT/CI (opcional)'),
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: () {
                      if (!_formKey.currentState!.validate()) return;
                      Navigator.of(context).pop({
                        'nombre_cliente': _nombreController.text.trim(),
                        'email_cliente': _emailController.text.trim(),
                        'telefono': _telefonoController.text.trim(),
                        'nit_ci': _nitCiController.text.trim(),
                      });
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF006A5E),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: Text(
                      'Continuar al pago',
                      style: GoogleFonts.manrope(color: Colors.white, fontWeight: FontWeight.w700),
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

class _SimulatedQrPainter extends CustomPainter {
  _SimulatedQrPainter(this.payload);

  final String payload;

  int _hash(String text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.codeUnitAt(i);
      hash = (hash * 16777619) & 0xFFFFFFFF;
    }
    return hash;
  }

  @override
  void paint(Canvas canvas, Size size) {
    const cells = 25;
    final gap = size.width / cells * 0.18;
    final cell = (size.width - gap * (cells - 1)) / cells;
    final dark = Paint()..color = const Color(0xFF111827);
    final light = Paint()..color = Colors.white;
    canvas.drawRect(Offset.zero & size, light);

    var seed = _hash(payload);
    bool nextBit() {
      seed = ((seed ^ (seed >> 13)) * 1103515245 + 12345) & 0x7FFFFFFF;
      return seed % 100 < 42;
    }

    void finder(int row, int col) {
      for (var y = 0; y < 7; y += 1) {
        for (var x = 0; x < 7; x += 1) {
          final border = x == 0 || y == 0 || x == 6 || y == 6;
          final center = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          if (border || center) {
            final dx = (col + x) * (cell + gap);
            final dy = (row + y) * (cell + gap);
            canvas.drawRRect(
              RRect.fromRectAndRadius(Rect.fromLTWH(dx, dy, cell, cell), const Radius.circular(1.5)),
              dark,
            );
          }
        }
      }
    }

    finder(0, 0);
    finder(0, cells - 7);
    finder(cells - 7, 0);

    for (var row = 0; row < cells; row += 1) {
      for (var col = 0; col < cells; col += 1) {
        final inFinder = (row < 7 && col < 7) || (row < 7 && col >= cells - 7) || (row >= cells - 7 && col < 7);
        if (inFinder || !nextBit()) continue;
        final dx = col * (cell + gap);
        final dy = row * (cell + gap);
        canvas.drawRRect(
          RRect.fromRectAndRadius(Rect.fromLTWH(dx, dy, cell, cell), const Radius.circular(1.5)),
          dark,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _SimulatedQrPainter oldDelegate) => oldDelegate.payload != payload;
}
