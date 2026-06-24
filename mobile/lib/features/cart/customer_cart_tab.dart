import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/auth/auth_session_manager.dart';

import '../../core/config/app_config.dart';

import 'data/cart_service.dart';
import 'ubicacion_selection_page.dart';

import '../payments/data/payment_service.dart';
import 'data/cart_service.dart';

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
    final items = rawItems is List
        ? rawItems.whereType<Map<String, dynamic>>().toList()
        : <Map<String, dynamic>>[];

    setState(() {
      _cartItems = items;
      _subtotal = double.tryParse(data['subtotal']?.toString() ?? '0') ?? 0;
      _total = double.tryParse(data['total']?.toString() ?? '0') ?? _subtotal;
      _loading = false;
      _error = '';
    });
  }

  Future<void> _actualizarCantidad(
    Map<String, dynamic> item,
    int nuevaCantidad,
  ) async {
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
      final data = await _cartService.eliminarItem(
        itemId: itemId,
        accessToken: token,
      );
      _applyCartData(data);
    } catch (e) {
      _showError('No se pudo eliminar: $e');
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  Future<void> _pagarConStripe() async {
    if (AppConfig.stripePublishableKey.trim().isEmpty) {
      _showError(
        'Stripe no está configurado. Define STRIPE_PUBLISHABLE_KEY para mobile.',
      );
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
          if (carritoToken != null && carritoToken.isNotEmpty)
            'carrito_token': carritoToken,
          'nombre_cliente': datosFactura['nombre_cliente']?.toString() ?? '',
          'email_cliente': datosFactura['email_cliente']?.toString() ?? '',
          'telefono': datosFactura['telefono']?.toString() ?? '',
          'nit_ci': datosFactura['nit_ci']?.toString() ?? '',
        },
      );

      final clientSecret = intentData['client_secret']?.toString() ?? '';
      final paymentIntentId = intentData['payment_intent_id']?.toString() ?? '';
      if (clientSecret.isEmpty || paymentIntentId.isEmpty) {
        throw const PaymentServiceException(
          'Respuesta incompleta al crear el intent de pago.',
        );
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
          content: Text(
            'Pago confirmado. Factura ${data['factura']?['numero'] ?? ''} ✅',
          ),
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
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
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
        backgroundColor: Color(0xFFF4F7F6),
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFF006A5E)),
        ),
      );
    }

    if (_error.isNotEmpty) {
      return Scaffold(
        backgroundColor: const Color(0xFFF4F7F6),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.shopping_cart_checkout_rounded,
                  color: Color(0xFFBA1A1A),
                  size: 58,
                ),
                const SizedBox(height: 12),
                Text(
                  'No se pudo cargar el carrito',
                  style: GoogleFonts.manrope(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF101820),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _error,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.manrope(color: const Color(0xFF6F7977)),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _loadCartItems,
                  child: const Text('Reintentar'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF4F7F6),
      body: RefreshIndicator(
        color: const Color(0xFF006A5E),
        onRefresh: _loadCartItems,
        child: Column(
          children: [
            SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                child: _CartHeader(
                  itemCount: _cartItems.length,
                  subtotal: _subtotal,
                  total: _total,
                ),
              ),
            ),
            if (_processing)
              const LinearProgressIndicator(
                color: Color(0xFF006A5E),
                minHeight: 2,
              ),
            Expanded(
              child: _cartItems.isEmpty
                  ? _buildEmptyCart()
                  : ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                      itemCount: _cartItems.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (context, index) =>
                          _buildCartItem(_cartItems[index]),
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
    final precio =
        double.tryParse(item['precio_unitario']?.toString() ?? '0') ?? 0;
    final nombre = item['producto_nombre']?.toString() ?? 'Medicamento';
    final sku = item['producto_sku']?.toString() ?? '';
    final imagenUrl = item['producto_imagen']?.toString() ?? '';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE2EAE7)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _ProductThumbnail(imageUrl: imagenUrl),
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
                    color: const Color(0xFF101820),
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (sku.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    'SKU: $sku',
                    style: GoogleFonts.manrope(
                      fontSize: 12.2,
                      color: const Color(0xFF6F7977),
                    ),
                  ),
                ],
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _StatusPill(
                      label: 'x$cantidad',
                      backgroundColor: const Color(0xFFEAF6F0),
                      textColor: const Color(0xFF006A5E),
                    ),
                    _StatusPill(
                      label: 'Bs ${precio.toStringAsFixed(2)}',
                      backgroundColor: const Color(0xFFE9EEF8),
                      textColor: const Color(0xFF355C98),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            children: [
              IconButton(
                icon: const Icon(Icons.delete_outline),
                color: const Color(0xFFBA1A1A),
                onPressed: _processing ? null : () => _eliminarProducto(item),
              ),
              const SizedBox(height: 6),
              _QuantityStepper(
                quantity: cantidad,
                onDecrease: _processing || cantidad <= 1
                    ? null
                    : () => _actualizarCantidad(item, cantidad - 1),
                onIncrease: _processing
                    ? null
                    : () => _actualizarCantidad(item, cantidad + 1),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildOrderSummary() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 20,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text(
                  'Resumen de compra',
                  style: GoogleFonts.manrope(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF101820),
                  ),
                ),
                const Spacer(),
                Text(
                  '${_cartItems.length} ítems',
                  style: GoogleFonts.manrope(
                    fontSize: 12.5,
                    color: const Color(0xFF6F7977),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _SummaryRow(
              label: 'Subtotal',
              value: 'Bs ${_subtotal.toStringAsFixed(2)}',
            ),
            const SizedBox(height: 8),
            _SummaryRow(
              label: 'Total estimado',
              value: 'Bs ${_total.toStringAsFixed(2)}',
              emphasis: true,
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 54,
              child: FilledButton.icon(
                onPressed: _cartItems.isEmpty || _processing
                    ? null
                    : _pagarConStripe,
                icon: _processing
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.lock_outline),
                label: Text(
                  _cartItems.isEmpty ? 'Carrito vacío' : 'Pagar con Stripe',
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF006A5E),
                  disabledBackgroundColor: const Color(0xFFE0E3E1),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  textStyle: GoogleFonts.manrope(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
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
      padding: const EdgeInsets.fromLTRB(24, 56, 24, 24),
      children: [
        Container(
          padding: const EdgeInsets.all(26),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: const Color(0xFFE2EAE7)),
          ),
          child: Column(
            children: [
              Container(
                width: 84,
                height: 84,
                decoration: const BoxDecoration(
                  color: Color(0xFFEAF6F0),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.shopping_cart_outlined,
                  size: 42,
                  color: Color(0xFF006A5E),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'Tu carrito está vacío',
                style: GoogleFonts.manrope(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF101820),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Cuando agregues medicamentos desde una receta o el catálogo, aparecerán aquí listos para pagar.',
                textAlign: TextAlign.center,
                style: GoogleFonts.manrope(
                  fontSize: 13,
                  color: const Color(0xFF6F7977),
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CartHeader extends StatelessWidget {
  const _CartHeader({
    required this.itemCount,
    required this.subtotal,
    required this.total,
  });

  final int itemCount;
  final double subtotal;
  final double total;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF006A5E), Color(0xFF0F8C7C)],
        ),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF006A5E).withValues(alpha: 0.18),
            blurRadius: 26,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Mi carrito',
            style: GoogleFonts.manrope(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Revisa, ajusta cantidades y continúa al pago.',
            style: GoogleFonts.manrope(
              fontSize: 13.5,
              color: Colors.white.withValues(alpha: 0.92),
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _StatusPill(
                label: '$itemCount ítems',
                backgroundColor: Colors.white.withValues(alpha: 0.16),
                textColor: Colors.white,
              ),
              _StatusPill(
                label: 'Subtotal Bs ${subtotal.toStringAsFixed(2)}',
                backgroundColor: Colors.white.withValues(alpha: 0.16),
                textColor: Colors.white,
              ),
              _StatusPill(
                label: 'Total Bs ${total.toStringAsFixed(2)}',
                backgroundColor: Colors.white.withValues(alpha: 0.16),
                textColor: Colors.white,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProductThumbnail extends StatelessWidget {
  const _ProductThumbnail({required this.imageUrl});

  final String imageUrl;

  @override
  Widget build(BuildContext context) {
    final hasImage = imageUrl.trim().isNotEmpty;

    return Container(
      width: 74,
      height: 74,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: const Color(0xFFF0F2F1),
      ),
      clipBehavior: Clip.antiAlias,
      child: hasImage
          ? Image.network(
              imageUrl,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const _ProductPlaceholder(),
            )
          : const _ProductPlaceholder(),
    );
  }
}

class _ProductPlaceholder extends StatelessWidget {
  const _ProductPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: Color(0xFFF0F2F1),
      child: Center(
        child: Icon(
          Icons.medication_liquid_rounded,
          color: Color(0xFF006A5E),
          size: 34,
        ),
      ),
    );
  }
}

class _QuantityStepper extends StatelessWidget {
  const _QuantityStepper({
    required this.quantity,
    required this.onDecrease,
    required this.onIncrease,
  });

  final int quantity;
  final VoidCallback? onDecrease;
  final VoidCallback? onIncrease;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFF7FBFA),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFE2EAE7)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          InkWell(
            onTap: onDecrease,
            borderRadius: BorderRadius.circular(999),
            child: Padding(
              padding: const EdgeInsets.all(3),
              child: Icon(
                Icons.remove_circle_outline,
                size: 20,
                color: onDecrease == null
                    ? const Color(0xFFB8C3BF)
                    : const Color(0xFF006A5E),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6),
            child: Text(
              '$quantity',
              style: GoogleFonts.manrope(
                fontWeight: FontWeight.w800,
                color: const Color(0xFF101820),
              ),
            ),
          ),
          InkWell(
            onTap: onIncrease,
            borderRadius: BorderRadius.circular(999),
            child: Padding(
              padding: const EdgeInsets.all(3),
              child: Icon(
                Icons.add_circle_outline,
                size: 20,
                color: onIncrease == null
                    ? const Color(0xFFB8C3BF)
                    : const Color(0xFF006A5E),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({
    required this.label,
    required this.backgroundColor,
    required this.textColor,
  });

  final String label;
  final Color backgroundColor;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: GoogleFonts.manrope(
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
          color: textColor,
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.emphasis = false,
  });

  final String label;
  final String value;
  final bool emphasis;

  @override
  Widget build(BuildContext context) {
    final color = emphasis ? const Color(0xFF006A5E) : const Color(0xFF101820);
    return Row(
      children: [
        Text(
          label,
          style: GoogleFonts.manrope(
            fontSize: emphasis ? 15.5 : 14,
            fontWeight: emphasis ? FontWeight.w800 : FontWeight.w600,
            color: const Color(0xFF5A6562),
          ),
        ),
        const Spacer(),
        Text(
          value,
          style: GoogleFonts.manrope(
            fontSize: emphasis ? 20 : 15.5,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
      ],
    );
  }
}

class _DatosFacturaBottomSheet extends StatefulWidget {
  const _DatosFacturaBottomSheet();

  @override
  State<_DatosFacturaBottomSheet> createState() =>
      _DatosFacturaBottomSheetState();
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
          left: 18,
          right: 18,
          top: 18,
          bottom: MediaQuery.of(context).viewInsets.bottom + 18,
        ),
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 42,
                    height: 5,
                    decoration: BoxDecoration(
                      color: const Color(0xFFD7DFDC),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  'Datos de facturación',
                  style: GoogleFonts.manrope(
                    fontWeight: FontWeight.w800,
                    fontSize: 20,
                    color: const Color(0xFF101820),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Necesitamos estos datos para continuar con el pago.',
                  style: GoogleFonts.manrope(
                    fontSize: 12.8,
                    color: const Color(0xFF5A6562),
                  ),
                ),
                const SizedBox(height: 18),
                TextFormField(
                  controller: _nombreController,
                  decoration: const InputDecoration(
                    labelText: 'Nombre completo *',
                  ),
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
                    if (!text.contains('@')) return 'Email inválido';
                    return null;
                  },
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _telefonoController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Teléfono'),
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _nitCiController,
                  decoration: const InputDecoration(
                    labelText: 'NIT/CI (opcional)',
                  ),
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: FilledButton(
                    onPressed: () {
                      if (!_formKey.currentState!.validate()) return;
                      Navigator.of(context).pop({
                        'nombre_cliente': _nombreController.text.trim(),
                        'email_cliente': _emailController.text.trim(),
                        'telefono': _telefonoController.text.trim(),
                        'nit_ci': _nitCiController.text.trim(),
                      });
                    },
                    child: Text(
                      'Continuar al pago',
                      style: GoogleFonts.manrope(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
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
