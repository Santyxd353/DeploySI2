import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../../core/auth/auth_session_manager.dart';
import 'data/payment_service.dart';

class PaymentInvoiceDetailPage extends StatefulWidget {
  const PaymentInvoiceDetailPage({
    super.key,
    required this.numeroFactura,
  });

  final String numeroFactura;

  @override
  State<PaymentInvoiceDetailPage> createState() => _PaymentInvoiceDetailPageState();
}

class _PaymentInvoiceDetailPageState extends State<PaymentInvoiceDetailPage> {
  final PaymentService _paymentService = PaymentService();

  bool _loading = true;
  bool _pdfBusy = false;
  String _error = '';
  Map<String, dynamic>? _factura;

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
    _cargarDetalle();
  }

  Future<void> _cargarDetalle() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final token = await AuthSessionManager.getAccessToken();
      if (token == null || token.trim().isEmpty) {
        throw const PaymentServiceException('Debes iniciar sesion para ver esta factura.');
      }

      final data = await _paymentService.obtenerDetalleFactura(
        numeroFactura: widget.numeroFactura,
        accessToken: token,
      );

      if (!mounted) return;
      setState(() {
        _factura = data;
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

  Future<pw.Document> _buildPdfDocument() async {
    final factura = _factura ?? <String, dynamic>{};
    final venta = (factura['venta'] is Map<String, dynamic>)
        ? factura['venta'] as Map<String, dynamic>
        : <String, dynamic>{};
    final itemsRaw = factura['items'];
    final items = itemsRaw is List ? itemsRaw.whereType<Map<String, dynamic>>().toList() : <Map<String, dynamic>>[];

    final doc = pw.Document();
    doc.addPage(
      pw.MultiPage(
        build: (context) => [
          pw.Text('Factura ${factura['numero_factura'] ?? ''}', style: pw.TextStyle(fontSize: 22, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 10),
          pw.Text('Fecha: ${_formatFecha((factura['fecha_emision'] ?? '').toString())}'),
          pw.Text('Cliente: ${factura['nombre_cliente'] ?? ''}'),
          pw.Text('Email: ${factura['email_cliente'] ?? ''}'),
          pw.Text('NIT/CI: ${factura['nit_ci'] ?? ''}'),
          pw.SizedBox(height: 18),
          pw.Text('Detalle de compra', style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 8),
          pw.Table.fromTextArray(
            headers: const ['Producto', 'Cantidad', 'P. Unitario', 'Subtotal'],
            data: items
                .map(
                  (item) => [
                    (item['producto'] ?? '').toString(),
                    (item['cantidad'] ?? '').toString(),
                    (item['precio_unitario'] ?? '').toString(),
                    (item['subtotal'] ?? '').toString(),
                  ],
                )
                .toList(),
          ),
          pw.SizedBox(height: 16),
          pw.Align(
            alignment: pw.Alignment.centerRight,
            child: pw.Text(
              'Total: Bs ${(venta['total'] ?? '0.00').toString()}',
              style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold),
            ),
          ),
        ],
      ),
    );

    return doc;
  }

  Future<void> _descargarPdf() async {
    if (_factura == null) return;
    setState(() => _pdfBusy = true);

    try {
      final doc = await _buildPdfDocument();
      final bytes = await doc.save();
      final dir = await getApplicationDocumentsDirectory();
      final numero = (_factura?['numero_factura'] ?? widget.numeroFactura).toString().replaceAll('/', '_');
      final path = '${dir.path}/factura_$numero.pdf';
      final file = File(path);
      await file.writeAsBytes(bytes, flush: true);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('PDF guardado en: $path'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('No se pudo guardar el PDF: $e'),
          backgroundColor: const Color(0xFFBA1A1A),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _pdfBusy = false);
    }
  }

  Future<void> _imprimirPdf() async {
    if (_factura == null) return;
    setState(() => _pdfBusy = true);

    try {
      final doc = await _buildPdfDocument();
      final bytes = await doc.save();
      await Printing.layoutPdf(onLayout: (_) async => bytes);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('No se pudo abrir la impresion: $e'),
          backgroundColor: const Color(0xFFBA1A1A),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _pdfBusy = false);
    }
  }

  String _value(Object? value, {String fallback = '-'}) {
    final text = value?.toString().trim() ?? '';
    return text.isEmpty ? fallback : text;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAF9),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8FAF9),
        elevation: 0,
        title: Text(
          'Detalle de factura',
          style: GoogleFonts.manrope(fontWeight: FontWeight.w800, color: const Color(0xFF191C1C)),
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF006A5E)));
    }

    if (_error.isNotEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.receipt_long_rounded, color: Color(0xFFBA1A1A), size: 64),
              const SizedBox(height: 10),
              Text('No se pudo cargar la factura', style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 18)),
              const SizedBox(height: 8),
              Text(_error, textAlign: TextAlign.center, style: GoogleFonts.manrope(color: const Color(0xFF6F7977))),
              const SizedBox(height: 14),
              ElevatedButton(onPressed: _cargarDetalle, child: const Text('Reintentar')),
            ],
          ),
        ),
      );
    }

    final factura = _factura ?? <String, dynamic>{};
    final venta = (factura['venta'] is Map<String, dynamic>)
        ? factura['venta'] as Map<String, dynamic>
        : <String, dynamic>{};
    final itemsRaw = factura['items'];
    final items = itemsRaw is List ? itemsRaw.whereType<Map<String, dynamic>>().toList() : <Map<String, dynamic>>[];

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE0E3E1)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_value(factura['numero_factura']), style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 18)),
              const SizedBox(height: 6),
              Text('Fecha: ${_formatFecha(_value(factura['fecha_emision'], fallback: ''))}', style: GoogleFonts.manrope(color: const Color(0xFF6F7977))),
              const SizedBox(height: 10),
              Text('Cliente', style: GoogleFonts.manrope(fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text(_value(factura['nombre_cliente']), style: GoogleFonts.manrope()),
              Text(_value(factura['email_cliente']), style: GoogleFonts.manrope(color: const Color(0xFF6F7977))),
              Text('NIT/CI: ${_value(factura['nit_ci'], fallback: 'No registrado')}', style: GoogleFonts.manrope(color: const Color(0xFF6F7977))),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE0E3E1)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Detalle de compra', style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 12),
              if (items.isEmpty)
                Text('No hay items registrados.', style: GoogleFonts.manrope(color: const Color(0xFF6F7977)))
              else
                ...items.map(
                  (item) => Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAF9),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(_value(item['producto']), style: GoogleFonts.manrope(fontWeight: FontWeight.w700)),
                              const SizedBox(height: 2),
                              Text(
                                '${_value(item['cantidad'])} x Bs ${_value(item['precio_unitario'])}',
                                style: GoogleFonts.manrope(color: const Color(0xFF6F7977), fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          'Bs ${_value(item['subtotal'])}',
                          style: GoogleFonts.manrope(fontWeight: FontWeight.w800, color: const Color(0xFF006A5E)),
                        ),
                      ],
                    ),
                  ),
                ),
              const Divider(height: 24),
              Row(
                children: [
                  Text('Total cobrado', style: GoogleFonts.manrope(fontWeight: FontWeight.w700)),
                  const Spacer(),
                  Text(
                    'Bs ${_value(venta['total'], fallback: '0.00')}',
                    style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 18, color: const Color(0xFF006A5E)),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _pdfBusy ? null : _imprimirPdf,
                icon: const Icon(Icons.print_rounded),
                label: Text(_pdfBusy ? 'Procesando...' : 'Imprimir', style: GoogleFonts.manrope(fontWeight: FontWeight.w700)),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: _pdfBusy ? null : _descargarPdf,
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF006A5E)),
                icon: const Icon(Icons.download_rounded, color: Colors.white),
                label: Text(_pdfBusy ? 'Procesando...' : 'Descargar PDF', style: GoogleFonts.manrope(fontWeight: FontWeight.w700, color: Colors.white)),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
