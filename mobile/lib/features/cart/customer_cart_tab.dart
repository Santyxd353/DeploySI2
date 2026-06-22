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
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 55,
              child: ElevatedButton(
                onPressed: _cartItems.isEmpty || _processing ? null : _pagarConStripe,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF006A5E),
                  disabledBackgroundColor: const Color(0xFFE0E3E1),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                  elevation: 0,
                ),
                child: _processing
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text('Pagar con Stripe', style: GoogleFonts.manrope(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white)),
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
