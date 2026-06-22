import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/auth/auth_session_manager.dart';
import 'data/payment_service.dart';
import 'payment_invoice_detail_page.dart';

class MyPaymentsPage extends StatefulWidget {
  const MyPaymentsPage({super.key});

  @override
  State<MyPaymentsPage> createState() => _MyPaymentsPageState();
}

class _MyPaymentsPageState extends State<MyPaymentsPage> {
  final PaymentService _paymentService = PaymentService();

  bool _loading = true;
  String _error = '';
  List<Map<String, dynamic>> _facturas = <Map<String, dynamic>>[];

  String _formatFecha(String raw) {
    if (raw.trim().isEmpty) return '-';
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return raw;
    final local = parsed.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(local.day)}/${two(local.month)}/${local.year} ${two(local.hour)}:${two(local.minute)}';
  }

  @override
  void initState() {
    super.initState();
    _cargarFacturas();
  }

  Future<void> _cargarFacturas() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final token = await AuthSessionManager.getAccessToken();
      if (token == null || token.trim().isEmpty) {
        throw const PaymentServiceException('Debes iniciar sesion para ver tus pagos.');
      }

      final facturas = await _paymentService.listarMisPagos(accessToken: token);
      if (!mounted) return;
      setState(() {
        _facturas = facturas;
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
          'Mis Pagos',
          style: GoogleFonts.manrope(
            fontWeight: FontWeight.w800,
            color: const Color(0xFF191C1C),
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _cargarFacturas,
        color: const Color(0xFF006A5E),
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF006A5E)),
      );
    }

    if (_error.isNotEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 80),
          const Icon(Icons.receipt_long_rounded, size: 64, color: Color(0xFFBA1A1A)),
          const SizedBox(height: 14),
          Text(
            'No se pudo cargar tu historial',
            textAlign: TextAlign.center,
            style: GoogleFonts.manrope(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            _error,
            textAlign: TextAlign.center,
            style: GoogleFonts.manrope(color: const Color(0xFF6F7977)),
          ),
          const SizedBox(height: 16),
          Center(
            child: ElevatedButton(
              onPressed: _cargarFacturas,
              child: const Text('Reintentar'),
            ),
          ),
        ],
      );
    }

    if (_facturas.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 80),
          const Icon(Icons.credit_card_off_rounded, size: 68, color: Color(0xFFBDC9C5)),
          const SizedBox(height: 14),
          Text(
            'Aun no tienes pagos registrados',
            textAlign: TextAlign.center,
            style: GoogleFonts.manrope(fontSize: 18, fontWeight: FontWeight.w800, color: const Color(0xFF3E4946)),
          ),
        ],
      );
    }

    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 30),
      itemCount: _facturas.length,
      itemBuilder: (context, index) {
        final factura = _facturas[index];
        final numero = factura['numero_factura']?.toString() ?? 'SIN-NUMERO';
        final total = factura['total']?.toString() ?? '0.00';
        final fecha = _formatFecha(factura['fecha_emision']?.toString() ?? '');
        final estado = factura['estado']?.toString() ?? 'pagada';

        return Container(
          margin: const EdgeInsets.only(bottom: 14),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE0E3E1)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEAF8F4),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      estado.toUpperCase(),
                      style: GoogleFonts.manrope(
                        color: const Color(0xFF006A5E),
                        fontWeight: FontWeight.w800,
                        fontSize: 11,
                      ),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    'Bs $total',
                    style: GoogleFonts.manrope(
                      fontWeight: FontWeight.w800,
                      fontSize: 19,
                      color: const Color(0xFF006A5E),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                numero,
                style: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 15, color: const Color(0xFF191C1C)),
              ),
              const SizedBox(height: 4),
              Text(
                fecha,
                style: GoogleFonts.manrope(color: const Color(0xFF6F7977), fontSize: 12),
              ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: OutlinedButton.icon(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => PaymentInvoiceDetailPage(numeroFactura: numero),
                      ),
                    );
                  },
                  icon: const Icon(Icons.receipt_long_rounded, size: 18),
                  label: Text(
                    'Ver detalles',
                    style: GoogleFonts.manrope(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
