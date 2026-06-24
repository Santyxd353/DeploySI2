import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/auth/auth_session_manager.dart';
import '../../../cart/customer_cart_tab.dart';
import '../../data/models/prescription_models.dart';
import '../../data/prescription_service.dart';

class ReviewPrescriptionPage extends StatefulWidget {
  const ReviewPrescriptionPage({
    super.key,
    required this.imageBytes,
    required this.imageName,
  });

  final Uint8List imageBytes;
  final String imageName;

  @override
  State<ReviewPrescriptionPage> createState() => _ReviewPrescriptionPageState();
}

class _ReviewPrescriptionPageState extends State<ReviewPrescriptionPage> {
  final PrescriptionService _service = PrescriptionService();

  PrescriptionCapture? _capture;
  _EditableHeader? _editedHeader;
  List<_EditableItem> _editedItems = [];
  bool _loading = false;
  bool _saving = false;
  bool _postConfirmActionsVisible = false;
  bool _addingToCart = false;
  bool _cartAlreadySent = false;
  String _error = '';
  String _actionFeedback = '';
  _CartActionSummary? _cartActionSummary;

  Future<void> _runAnalysis() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final session = await AuthSessionManager.restoreClientSession();
      final accessToken = session?.accessToken.trim();
      if (accessToken == null || accessToken.isEmpty) {
        setState(
          () => _error = 'Debes iniciar sesión para analizar la receta.',
        );
        return;
      }

      final capture = await _service.createCapture(
        imageBytes: widget.imageBytes,
        filename: widget.imageName,
        accessToken: accessToken,
      );

      if (!mounted) return;
      setState(() {
        _capture = capture;
        _editedHeader = _EditableHeader.fromCapture(capture);
        _editedItems = capture.items
            .map(_EditableItem.fromCaptureItem)
            .toList();
        _postConfirmActionsVisible = false;
        _cartAlreadySent = capture.cartSent;
        _actionFeedback = '';
        _cartActionSummary = null;
      });
    } on PrescriptionServiceException catch (exc) {
      if (!mounted) return;
      setState(() => _error = exc.message);
    } catch (exc) {
      if (!mounted) return;
      setState(() => _error = 'No se pudo ejecutar la revisión. Detalle: $exc');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _editHeader() async {
    final current = _editedHeader;
    if (current == null) return;

    final medicoController = TextEditingController(text: current.medico);
    final pacienteController = TextEditingController(text: current.paciente);
    final fechaController = TextEditingController(text: current.fecha);

    final result = await showModalBottomSheet<_EditableHeader>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (sheetContext) {
        return SafeArea(
          top: false,
          child: AnimatedPadding(
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOut,
            padding: EdgeInsets.only(
              left: 18,
              right: 18,
              top: 18,
              bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 18,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
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
                    'Corregir encabezado',
                    style: GoogleFonts.manrope(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF101820),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Ajusta los datos que la IA pudo interpretar con error.',
                    style: GoogleFonts.manrope(
                      fontSize: 12.8,
                      color: const Color(0xFF5A6562),
                    ),
                  ),
                  const SizedBox(height: 18),
                  TextField(
                    controller: medicoController,
                    decoration: const InputDecoration(labelText: 'MÃ©dico'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: pacienteController,
                    decoration: const InputDecoration(labelText: 'Paciente'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: fechaController,
                    decoration: const InputDecoration(labelText: 'Fecha'),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () {
                        Navigator.of(sheetContext).pop(
                          _EditableHeader(
                            medico: medicoController.text.trim(),
                            paciente: pacienteController.text.trim(),
                            fecha: fechaController.text.trim(),
                          ),
                        );
                      },
                      child: const Text('Guardar cambios'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );

    if (result == null || !mounted) return;
    setState(() => _editedHeader = result);
  }

  Future<void> _editItem(int index) async {
    final current = _editedItems[index];
    final productoController = TextEditingController(text: current.producto);
    final cantidadController = TextEditingController(text: current.cantidad);
    final dosisController = TextEditingController(text: current.dosisDiaria);
    final diasController = TextEditingController(text: current.tratamientoDias);

    final result = await showModalBottomSheet<_EditableItem>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (sheetContext) {
        return SafeArea(
          top: false,
          child: AnimatedPadding(
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOut,
            padding: EdgeInsets.only(
              left: 18,
              right: 18,
              top: 18,
              bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 18,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
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
                    'Corregir Ã­tem',
                    style: GoogleFonts.manrope(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF101820),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Puedes adaptar el texto para que coincida mejor con el producto real.',
                    style: GoogleFonts.manrope(
                      fontSize: 12.8,
                      color: const Color(0xFF5A6562),
                    ),
                  ),
                  const SizedBox(height: 18),
                  TextField(
                    controller: productoController,
                    decoration: const InputDecoration(labelText: 'Producto'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: cantidadController,
                    decoration: const InputDecoration(labelText: 'Cantidad'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: dosisController,
                    decoration: const InputDecoration(
                      labelText: 'Dosis diaria',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: diasController,
                    decoration: const InputDecoration(
                      labelText: 'Dí­as de tratamiento',
                    ),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () {
                        Navigator.of(sheetContext).pop(
                          current.copyWith(
                            producto: productoController.text.trim(),
                            cantidad: cantidadController.text.trim(),
                            dosisDiaria: dosisController.text.trim(),
                            tratamientoDias: diasController.text.trim(),
                            estadoRevision: 'corregido',
                          ),
                        );
                      },
                      child: const Text('Guardar cambios'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );

    if (result == null || !mounted) return;
    setState(() {
      _editedItems[index] = result;
    });
  }

  Future<void> _confirmCapture() async {
    final capture = _capture;
    final header = _editedHeader;
    if (capture == null || header == null) return;

    setState(() {
      _saving = true;
      _error = '';
    });

    try {
      final session = await AuthSessionManager.restoreClientSession();
      final accessToken = session?.accessToken.trim();
      if (accessToken == null || accessToken.isEmpty) {
        setState(
          () => _error = 'Debes iniciar sesión para confirmar la receta.',
        );
        return;
      }

      final confirmed = await _service.confirmCapture(
        captureId: capture.id,
        recipeSummary: header.toJson(),
        recipeItems: _editedItems.map((item) => item.toJson()).toList(),
        accessToken: accessToken,
      );

      if (!mounted) return;
      setState(() {
        _capture = confirmed;
        _editedHeader = _EditableHeader.fromCapture(confirmed);
        _editedItems = confirmed.items
            .map(_EditableItem.fromCaptureItem)
            .toList();
        _postConfirmActionsVisible = true;
        _cartAlreadySent = confirmed.cartSent;
        _actionFeedback = '';
        _cartActionSummary = null;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Captura confirmada y guardada.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on PrescriptionServiceException catch (exc) {
      if (!mounted) return;
      setState(() => _error = exc.message);
    } catch (exc) {
      if (!mounted) return;
      setState(() => _error = 'No se pudo confirmar la captura. Detalle: $exc');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _addToCart() async {
    final capture = _capture;
    if (capture == null) return;

    setState(() {
      _addingToCart = true;
      _error = '';
      _actionFeedback = '';
    });

    try {
      final session = await AuthSessionManager.restoreClientSession();
      final accessToken = session?.accessToken.trim();
      if (accessToken == null || accessToken.isEmpty) {
        setState(
          () =>
              _error = 'Debes iniciar sesión para enviar la receta al carrito.',
        );
        return;
      }

      final result = await _service.applyCapture(
        captureId: capture.id,
        addToCart: true,
        accessToken: accessToken,
      );

      final agregados = (result['items_agregados'] as List?)?.length ?? 0;
      final omitidos = (result['items_omitidos'] as List?)?.length ?? 0;
      final carritoId = result['carrito_id'];
      final itemsAgregados = ((result['items_agregados'] as List?) ?? const [])
          .whereType<Map>()
          .map(
            (entry) => _CartActionEntry(
              title:
                  (entry['producto_nombre'] as String? ??
                          entry['nombre_detectado'] as String? ??
                          '')
                      .trim(),
              subtitle: (entry['cantidad']?.toString() ?? '').trim(),
            ),
          )
          .where((entry) => entry.title.isNotEmpty)
          .toList();
      final itemsOmitidos = ((result['items_omitidos'] as List?) ?? const [])
          .whereType<Map>()
          .map(
            (entry) => _CartActionEntry(
              title:
                  (entry['producto_nombre'] as String? ??
                          entry['nombre_detectado'] as String? ??
                          'Item omitido')
                      .trim(),
              subtitle: (entry['motivo']?.toString() ?? '').trim(),
            ),
          )
          .toList();

      if (!mounted) return;
      setState(() {
        _actionFeedback = agregados > 0
            ? 'Se agregaron $agregados medicamento(s) al carrito${carritoId != null ? ' #$carritoId' : ''}.'
            : 'No se pudo agregar ningún medicamento al carrito.';
        _cartAlreadySent = agregados > 0;
        _cartActionSummary = _CartActionSummary(
          carritoId: carritoId?.toString() ?? '',
          agregados: itemsAgregados,
          omitidos: itemsOmitidos,
        );
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          content: Text(
            omitidos > 0
                ? 'Se agregaron $agregados medicamento(s) y se omitieron $omitidos.'
                : 'Se agregaron $agregados medicamento(s) al carrito.',
          ),
        ),
      );
    } catch (exc) {
      if (!mounted) return;
      setState(() => _error = 'No se pudo enviar al carrito. Detalle: $exc');
    } finally {
      if (mounted) setState(() => _addingToCart = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final capture = _capture;
    final header = _editedHeader;

    return Scaffold(
      backgroundColor: const Color(0xFFF4F7F6),
      appBar: AppBar(
        title: const Text('Revisar receta'),
        centerTitle: false,
        elevation: 0,
        backgroundColor: const Color(0xFFF4F7F6),
        foregroundColor: const Color(0xFF101820),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
        children: [
          _PrescriptionHeroCard(
            imageWidget: _buildImagePreview(context),
            loading: _loading,
            onRetake: () => Navigator.of(context).pop(),
            onAnalyze: _loading ? null : _runAnalysis,
            captureReady: capture != null,
          ),
          const SizedBox(height: 12),
          if (_error.isNotEmpty) ...[
            _InlineNoticeCard(
              icon: Icons.error_outline_rounded,
              title: 'Necesitamos revisar esto',
              message: _error,
              backgroundColor: const Color(0xFFFFF4F4),
              iconColor: const Color(0xFFBA1A1A),
            ),
            const SizedBox(height: 12),
          ],
          if (capture == null) ...[
            _StepHintCard(
              title: 'Paso 1. Imagen clara',
              message:
                  'Asegúrate de que la receta esté completa y nítida antes de ejecutar la IA.',
            ),
          ] else if (header != null)
            ..._buildReviewedContent(capture, header),
        ],
      ),
    );
  }

  Widget _buildImagePreview(BuildContext context) {
    return GestureDetector(
      onTap: () => _openImageFullscreen(context, widget.imageBytes),
      child: Container(
        width: double.infinity,
        constraints: BoxConstraints(
          minHeight: 200,
          maxHeight: MediaQuery.of(context).size.height * 0.38 < 200
              ? 200
              : MediaQuery.of(context).size.height * 0.38,
        ),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFF7FBFA), Color(0xFFEAF3F0)],
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 22,
              offset: const Offset(0, 10),
            ),
          ],
          border: Border.all(color: const Color(0xFFDCE7E4)),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Stack(
            children: [
              Positioned.fill(
                child: InteractiveViewer(
                  minScale: 1,
                  maxScale: 4,
                  child: Image.memory(
                    widget.imageBytes,
                    width: double.infinity,
                    fit: BoxFit.contain,
                  ),
                ),
              ),
              Positioned(
                top: 14,
                right: 14,
                child: _TinyBadge(
                  icon: Icons.open_in_full_rounded,
                  label: 'Ampliar',
                ),
              ),
              Positioned(
                left: 14,
                bottom: 14,
                child: _TinyBadge(
                  icon: Icons.photo_camera_outlined,
                  label: 'Vista mediana',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _openImageFullscreen(BuildContext context, Uint8List imageBytes) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => _FullscreenPrescriptionImage(imageBytes: imageBytes),
      ),
    );
  }

  void _goToCart() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const CartTab()),
    );
  }

  List<Widget> _buildReviewedContent(
    PrescriptionCapture capture,
    _EditableHeader header,
  ) {
    final hasDetectedContent = _hasDetectedContent(capture);
    return [
      _SectionCard(
        title: 'Encabezado',
        subtitle: 'Corrige los datos que la IA pueda haber interpretado mal.',
        actionLabel: 'Corregir',
        actionIcon: Icons.edit_outlined,
        onAction: _editHeader,
        child: Column(
          children: [
            _FieldLine(
              label: 'Médico',
              value: header.medico,
              originalValue: capture.header.medico,
            ),
            const SizedBox(height: 12),
            _FieldLine(
              label: 'Paciente',
              value: header.paciente,
              originalValue: capture.header.paciente,
            ),
            const SizedBox(height: 12),
            _FieldLine(
              label: 'Fecha',
              value: header.fecha,
              originalValue: capture.header.fecha,
            ),
          ],
        ),
      ),
      const SizedBox(height: 12),
      _SectionCard(
        title: 'Texto detectado',
        subtitle: 'Resumen leído desde la receta.',
        child: _ContentCardText(
          content: capture.textoExtraido.isEmpty
              ? 'Sin contenido detectado por ahora.'
              : capture.textoExtraido,
        ),
      ),
      const SizedBox(height: 12),
      _SectionCard(
        title: 'Revisión manual',
        subtitle: capture.requiresManualReview
            ? 'La receta requiere revisión manual antes de confirmar.'
            : 'La receta quedó lista para confirmar.',
        child: _ContentCardText(
          content: capture.requiresManualReview
              ? 'La receta requiere revisión manual antes de confirmar.'
              : 'La receta quedó lista para confirmación.',
        ),
      ),
      const SizedBox(height: 12),
      for (var index = 0; index < _editedItems.length; index++) ...[
        _EditableItemCard(
          item: _editedItems[index],
          index: index,
          onEdit: () => _editItem(index),
        ),
        const SizedBox(height: 10),
      ],
      const SizedBox(height: 18),
      if (!_postConfirmActionsVisible)
        _PrimaryActionButton(
          label: _saving ? 'Guardando...' : 'Confirmar captura',
          onPressed: _saving || !hasDetectedContent ? null : _confirmCapture,
          icon: _saving
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Icon(Icons.save_outlined),
        )
      else
        _SuccessActionCard(
          addingToCart: _addingToCart,
          cartAlreadySent: _cartAlreadySent,
          onAddToCart: _addToCart,
          onGoToCart: _goToCart,
          actionFeedback: _actionFeedback,
          cartActionSummary: _cartActionSummary,
        ),
      if (!hasDetectedContent) ...[
        const SizedBox(height: 12),
        _InlineNoticeCard(
          icon: Icons.search_off_outlined,
          title: 'Sin resultados detectados',
          message:
              'No hay texto ni ítems reconocidos aún. Revisa la imagen o vuelve a capturar antes de confirmar.',
          backgroundColor: const Color(0xFFFFFBED),
          iconColor: const Color(0xFF8A6D00),
        ),
      ],
    ];
  }

  bool _hasDetectedContent(PrescriptionCapture capture) {
    if (capture.textoExtraido.trim().isNotEmpty) return true;
    return capture.items.any(
      (item) =>
          item.detectedName.trim().isNotEmpty ||
          item.detectedQuantity.trim().isNotEmpty ||
          item.detectedInstructions.trim().isNotEmpty ||
          item.detectedDuration.trim().isNotEmpty,
    );
  }
}

class _FieldLine extends StatelessWidget {
  const _FieldLine({
    required this.label,
    required this.value,
    required this.originalValue,
  });

  final String label;
  final String value;
  final String originalValue;

  @override
  Widget build(BuildContext context) {
    final trimmedValue = value.trim();
    final trimmedOriginal = originalValue.trim();
    final changed = trimmedValue.isNotEmpty && trimmedValue != trimmedOriginal;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF7FBFA),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                label,
                style: GoogleFonts.manrope(
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF22302D),
                ),
              ),
              const Spacer(),
              if (changed)
                const _StatusPill(
                  label: 'Corregido',
                  backgroundColor: Color(0xFFEAF6F0),
                  textColor: Color(0xFF006A5E),
                )
              else if (trimmedValue.isNotEmpty)
                const _StatusPill(
                  label: 'IA',
                  backgroundColor: Color(0xFFE9EEF8),
                  textColor: Color(0xFF355C98),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            trimmedValue.isEmpty ? 'No detectado' : trimmedValue,
            style: GoogleFonts.manrope(
              fontSize: 14.5,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF101820),
            ),
          ),
          if (changed && trimmedOriginal.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'IA: $trimmedOriginal',
              style: GoogleFonts.manrope(
                fontSize: 11.5,
                color: const Color(0xFF6F7977),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _EditableItemCard extends StatelessWidget {
  const _EditableItemCard({
    required this.item,
    required this.index,
    required this.onEdit,
  });

  final _EditableItem item;
  final int index;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2EAE7)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFEAF6F0),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  'Item ${index + 1}',
                  style: GoogleFonts.manrope(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF006A5E),
                  ),
                ),
              ),
              const Spacer(),
              TextButton.icon(
                onPressed: onEdit,
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Corregir'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _ItemFieldLine(
            label: 'Producto',
            value: item.producto,
            originalValue: item.originalProducto,
          ),
          const SizedBox(height: 10),
          _ItemFieldLine(
            label: 'Cantidad',
            value: item.cantidad,
            originalValue: item.originalCantidad,
          ),
          const SizedBox(height: 10),
          _ItemFieldLine(
            label: 'Dosis',
            value: item.dosisDiaria,
            originalValue: item.originalDosisDiaria,
          ),
          const SizedBox(height: 10),
          _ItemFieldLine(
            label: 'Dí­as',
            value: item.tratamientoDias,
            originalValue: item.originalTratamientoDias,
          ),
        ],
      ),
    );
  }
}

class _ItemFieldLine extends StatelessWidget {
  const _ItemFieldLine({
    required this.label,
    required this.value,
    required this.originalValue,
  });

  final String label;
  final String value;
  final String originalValue;

  @override
  Widget build(BuildContext context) {
    final trimmedValue = value.trim();
    final trimmedOriginal = originalValue.trim();
    final changed = trimmedValue.isNotEmpty && trimmedValue != trimmedOriginal;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FBFA),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                label,
                style: GoogleFonts.manrope(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF5A6562),
                ),
              ),
              const Spacer(),
              if (changed)
                const _StatusPill(
                  label: 'Corregido',
                  backgroundColor: Color(0xFFEAF6F0),
                  textColor: Color(0xFF006A5E),
                )
              else if (trimmedValue.isNotEmpty)
                const _StatusPill(
                  label: 'IA',
                  backgroundColor: Color(0xFFE9EEF8),
                  textColor: Color(0xFF355C98),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            trimmedValue.isEmpty ? 'No detectado' : trimmedValue,
            style: GoogleFonts.manrope(
              fontSize: 14.5,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF101820),
            ),
          ),
          if (changed && trimmedOriginal.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'IA: $trimmedOriginal',
              style: GoogleFonts.manrope(
                fontSize: 11.5,
                color: const Color(0xFF6F7977),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ContentCardText extends StatelessWidget {
  const _ContentCardText({required this.content});

  final String content;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF7FBFA),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        content,
        style: GoogleFonts.manrope(
          fontSize: 13.8,
          height: 1.35,
          color: const Color(0xFF3E4946),
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.child,
    this.subtitle,
    this.actionLabel,
    this.actionIcon,
    this.onAction,
  });

  final String title;
  final String? subtitle;
  final String? actionLabel;
  final IconData? actionIcon;
  final VoidCallback? onAction;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE2EAE7)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.manrope(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF101820),
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        subtitle!,
                        style: GoogleFonts.manrope(
                          fontSize: 12.5,
                          color: const Color(0xFF5A6562),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (actionLabel != null && onAction != null) ...[
                const SizedBox(width: 8),
                TextButton.icon(
                  onPressed: onAction,
                  icon: Icon(actionIcon ?? Icons.edit_outlined),
                  label: Text(actionLabel!),
                ),
              ],
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}

class _PrescriptionHeroCard extends StatelessWidget {
  const _PrescriptionHeroCard({
    required this.imageWidget,
    required this.loading,
    required this.onRetake,
    required this.onAnalyze,
    required this.captureReady,
  });

  final Widget imageWidget;
  final bool loading;
  final VoidCallback onRetake;
  final VoidCallback? onAnalyze;
  final bool captureReady;

  @override
  Widget build(BuildContext context) {
    return Container(
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
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Lectura de receta',
                      style: GoogleFonts.manrope(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Revisa la foto, corrige lo necesario y luego confirma.',
                      style: GoogleFonts.manrope(
                        fontSize: 13.5,
                        color: Colors.white.withValues(alpha: 0.9),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              const _StatusPill(
                label: 'IA + edición',
                backgroundColor: Color(0x26FFFFFF),
                textColor: Colors.white,
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: const [
              _StatusPill(
                label: '1. Imagen',
                backgroundColor: Color(0x26FFFFFF),
                textColor: Colors.white,
              ),
              _StatusPill(
                label: '2. Revisión',
                backgroundColor: Color(0x26FFFFFF),
                textColor: Colors.white,
              ),
              _StatusPill(
                label: '3. Confirmación',
                backgroundColor: Color(0x26FFFFFF),
                textColor: Colors.white,
              ),
            ],
          ),
          const SizedBox(height: 16),
          imageWidget,
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onRetake,
                  icon: const Icon(Icons.camera_alt_outlined),
                  label: const Text('Volver a capturar'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Color(0x66FFFFFF)),
                    minimumSize: const Size.fromHeight(50),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: onAnalyze,
                  icon: loading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Icon(
                          captureReady
                              ? Icons.fact_check_outlined
                              : Icons.auto_awesome_rounded,
                        ),
                  label: Text(loading ? 'Analizando...' : 'Revisar receta'),
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: const Color(0xFF006A5E),
                    minimumSize: const Size.fromHeight(50),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TinyBadge extends StatelessWidget {
  const _TinyBadge({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 14),
          const SizedBox(width: 6),
          Text(
            label,
            style: GoogleFonts.manrope(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w700,
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

class _InlineNoticeCard extends StatelessWidget {
  const _InlineNoticeCard({
    required this.icon,
    required this.title,
    required this.message,
    required this.backgroundColor,
    required this.iconColor,
  });

  final IconData icon;
  final String title;
  final String message;
  final Color backgroundColor;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: iconColor.withValues(alpha: 0.14)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: iconColor),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.manrope(
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF101820),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  message,
                  style: GoogleFonts.manrope(
                    color: const Color(0xFF5A6562),
                    fontSize: 12.5,
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

class _StepHintCard extends StatelessWidget {
  const _StepHintCard({required this.title, required this.message});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE2EAE7)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.manrope(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF006A5E),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            message,
            style: GoogleFonts.manrope(
              color: const Color(0xFF5A6562),
              fontSize: 12.8,
            ),
          ),
        ],
      ),
    );
  }
}

class _PrimaryActionButton extends StatelessWidget {
  const _PrimaryActionButton({
    required this.label,
    required this.onPressed,
    required this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final Widget icon;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: onPressed,
        icon: icon,
        label: Text(label),
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFF006A5E),
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(54),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
          textStyle: GoogleFonts.manrope(
            fontSize: 16,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

class _SuccessActionCard extends StatelessWidget {
  const _SuccessActionCard({
    required this.addingToCart,
    required this.cartAlreadySent,
    required this.onAddToCart,
    required this.onGoToCart,
    required this.actionFeedback,
    required this.cartActionSummary,
  });

  final bool addingToCart;
  final bool cartAlreadySent;
  final VoidCallback onAddToCart;
  final VoidCallback onGoToCart;
  final String actionFeedback;
  final _CartActionSummary? cartActionSummary;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFF2FBF7), Color(0xFFE7F7EF)],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFD8EDE2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: const BoxDecoration(
                  color: Color(0xFF006A5E),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_rounded, color: Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Captura confirmada',
                      style: GoogleFonts.manrope(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF101820),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Ya puedes enviar los medicamentos reconocidos al carrito.',
                      style: GoogleFonts.manrope(
                        fontSize: 12.5,
                        color: const Color(0xFF5A6562),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _PrimaryActionButton(
            label: addingToCart ? 'Agregando...' : 'Añadir al carrito',
            onPressed: addingToCart || cartAlreadySent ? null : onAddToCart,
            icon: addingToCart
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.shopping_cart_outlined),
          ),
          if (cartAlreadySent) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFEAF6F0),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  const Icon(Icons.lock_outline, color: Color(0xFF006A5E)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Esta receta ya fue enviada al carrito.',
                      style: GoogleFonts.manrope(
                        color: const Color(0xFF006A5E),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (cartActionSummary != null) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: onGoToCart,
              icon: const Icon(Icons.shopping_cart_checkout_outlined),
              label: const Text('Ir al carrito'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                foregroundColor: const Color(0xFF006A5E),
                side: const BorderSide(color: Color(0xFFBFDCD3)),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                textStyle: GoogleFonts.manrope(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
          if (actionFeedback.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              actionFeedback,
              style: GoogleFonts.manrope(
                color: const Color(0xFF3E4946),
                fontSize: 12.8,
              ),
            ),
          ],
          if (cartActionSummary != null) ...[
            const SizedBox(height: 12),
            _CartActionSummaryCard(summary: cartActionSummary!),
          ],
        ],
      ),
    );
  }
}

class _FullscreenPrescriptionImage extends StatelessWidget {
  const _FullscreenPrescriptionImage({required this.imageBytes});

  final Uint8List imageBytes;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text('Imagen completa'),
      ),
      body: SafeArea(
        child: Center(
          child: InteractiveViewer(
            minScale: 1,
            maxScale: 5,
            child: Image.memory(imageBytes, fit: BoxFit.contain),
          ),
        ),
      ),
    );
  }
}

class _CartActionSummary {
  const _CartActionSummary({
    required this.carritoId,
    required this.agregados,
    required this.omitidos,
  });

  final String carritoId;
  final List<_CartActionEntry> agregados;
  final List<_CartActionEntry> omitidos;
}

class _CartActionEntry {
  const _CartActionEntry({required this.title, required this.subtitle});

  final String title;
  final String subtitle;
}

class _CartActionSummaryCard extends StatelessWidget {
  const _CartActionSummaryCard({required this.summary});

  final _CartActionSummary summary;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.65),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFD8EDE2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Resumen del carrito',
            style: GoogleFonts.manrope(
              fontWeight: FontWeight.w800,
              color: const Color(0xFF101820),
            ),
          ),
          if (summary.carritoId.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Carrito: #${summary.carritoId}',
              style: GoogleFonts.manrope(
                fontSize: 12.5,
                color: const Color(0xFF5A6562),
              ),
            ),
          ],
          const SizedBox(height: 10),
          _SummaryStatRow(
            label: 'Agregados',
            value: summary.agregados.length.toString(),
            icon: Icons.check_circle_outline,
            color: const Color(0xFF006A5E),
          ),
          for (final item in summary.agregados)
            Padding(
              padding: const EdgeInsets.only(left: 8, top: 4),
              child: Text(
                'â€¢ ${item.title}${item.subtitle.isNotEmpty ? ' (${item.subtitle})' : ''}',
                style: GoogleFonts.manrope(
                  color: const Color(0xFF3E4946),
                  fontSize: 12.5,
                ),
              ),
            ),
          const SizedBox(height: 10),
          _SummaryStatRow(
            label: 'Omitidos',
            value: summary.omitidos.length.toString(),
            icon: Icons.do_not_disturb_on_outlined,
            color: const Color(0xFFBA1A1A),
          ),
          for (final item in summary.omitidos)
            Padding(
              padding: const EdgeInsets.only(left: 8, top: 4),
              child: Text(
                'â€¢ ${item.title}${item.subtitle.isNotEmpty ? ' Â· ${item.subtitle}' : ''}',
                style: GoogleFonts.manrope(
                  color: const Color(0xFF8E1B1B),
                  fontSize: 12.5,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _SummaryStatRow extends StatelessWidget {
  const _SummaryStatRow({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 6),
        Text(
          label,
          style: GoogleFonts.manrope(
            fontWeight: FontWeight.w700,
            color: const Color(0xFF22302D),
          ),
        ),
        const Spacer(),
        Text(
          value,
          style: GoogleFonts.manrope(fontWeight: FontWeight.w800, color: color),
        ),
      ],
    );
  }
}

class _EditableHeader {
  const _EditableHeader({
    required this.medico,
    required this.paciente,
    required this.fecha,
  });

  final String medico;
  final String paciente;
  final String fecha;

  factory _EditableHeader.fromCapture(PrescriptionCapture capture) {
    return _EditableHeader(
      medico: capture.header.medico,
      paciente: capture.header.paciente,
      fecha: capture.header.fecha,
    );
  }

  Map<String, dynamic> toJson() {
    return {'medico': medico, 'paciente': paciente, 'fecha': fecha};
  }
}

class _EditableItem {
  const _EditableItem({
    required this.itemId,
    required this.originalProducto,
    required this.originalCantidad,
    required this.originalDosisDiaria,
    required this.originalTratamientoDias,
    required this.producto,
    required this.cantidad,
    required this.dosisDiaria,
    required this.tratamientoDias,
    required this.estadoRevision,
  });

  final int itemId;
  final String originalProducto;
  final String originalCantidad;
  final String originalDosisDiaria;
  final String originalTratamientoDias;
  final String producto;
  final String cantidad;
  final String dosisDiaria;
  final String tratamientoDias;
  final String estadoRevision;

  factory _EditableItem.fromCaptureItem(PrescriptionCaptureItem item) {
    return _EditableItem(
      itemId: item.id,
      originalProducto: item.detectedName,
      originalCantidad: item.detectedQuantity,
      originalDosisDiaria: item.detectedInstructions,
      originalTratamientoDias: item.detectedDuration,
      producto: item.resolvedName.isNotEmpty
          ? item.resolvedName
          : item.detectedName,
      cantidad: item.detectedQuantity,
      dosisDiaria: item.detectedInstructions,
      tratamientoDias: item.detectedDuration,
      estadoRevision: 'ia',
    );
  }

  _EditableItem copyWith({
    String? producto,
    String? cantidad,
    String? dosisDiaria,
    String? tratamientoDias,
    String? estadoRevision,
  }) {
    return _EditableItem(
      itemId: itemId,
      originalProducto: originalProducto,
      originalCantidad: originalCantidad,
      originalDosisDiaria: originalDosisDiaria,
      originalTratamientoDias: originalTratamientoDias,
      producto: producto ?? this.producto,
      cantidad: cantidad ?? this.cantidad,
      dosisDiaria: dosisDiaria ?? this.dosisDiaria,
      tratamientoDias: tratamientoDias ?? this.tratamientoDias,
      estadoRevision: estadoRevision ?? this.estadoRevision,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'item_id': itemId,
      'producto': producto,
      'cantidad': cantidad,
      'dosis_diaria': dosisDiaria,
      'tratamiento_dias': tratamientoDias,
      'estado_revision': estadoRevision,
    };
  }
}
