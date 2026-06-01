import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/auth/auth_session_manager.dart';
import '../../data/models/treatment_base.dart';
import '../../data/treatment_repository.dart';

class TreatmentDetailPage extends StatefulWidget {
  const TreatmentDetailPage({super.key, required this.treatment});

  final TreatmentBase treatment;

  @override
  State<TreatmentDetailPage> createState() => _TreatmentDetailPageState();
}

class _TreatmentDetailPageState extends State<TreatmentDetailPage> {
  final TreatmentRepository _repository = TreatmentRepository();
  bool _starting = false;
  String _error = '';

  Future<bool> _showConfirmDialog() async {
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
            title: Row(
              children: [
                const Icon(Icons.medication_rounded, color: Color(0xFF006A5E)),
                const SizedBox(width: 8),
                const Text('¿Iniciar tratamiento?'),
              ],
            ),
            content: Text(
              '¿Estás seguro de que quieres iniciar tu tratamiento\n\n'
              '${widget.treatment.publicName}?\n\n'
              'El tratamiento quedará en espera hasta que marques tu primera toma.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: const Text('Cancelar'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF006A5E),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: () => Navigator.of(ctx).pop(true),
                child: const Text('Iniciar tratamiento'),
              ),
            ],
          ),
        ) ??
        false;
  }

  Future<void> _startTreatment() async {
    final confirmed = await _showConfirmDialog();
    if (!confirmed || !mounted) return;

    setState(() {
      _starting = true;
      _error = '';
    });

    try {
      final token = await AuthSessionManager.getAccessToken();
      if (token == null || token.isEmpty)
        throw Exception('Sesión no disponible.');

      await _repository.startTreatment(
        baseId: widget.treatment.id,
        accessToken: token,
      );

      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _starting = false;
      });
    }
  }

  Widget _infoRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(0xFF006A5E)),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 15))),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.treatment;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAF9),
      appBar: AppBar(
        title: Text(
          'Detalle del tratamiento',
          style: GoogleFonts.manrope(fontWeight: FontWeight.w800),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF006A5E), Color(0xFF004D40)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.medication_liquid_rounded,
                    color: Colors.white,
                    size: 40,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    t.publicName,
                    style: GoogleFonts.manrope(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    t.productName,
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.85),
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Details card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFFE0E3E1)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Información del tratamiento',
                    style: GoogleFonts.manrope(
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 14),
                  _infoRow(
                    Icons.medical_information_rounded,
                    'Dosis: ${t.dosageDisplay} ${t.dosageUnit}',
                  ),
                  _infoRow(Icons.schedule_rounded, 'Frecuencia: ${t.intervalLabel}'),
                  _infoRow(Icons.calendar_today_rounded, 'Duración: ${t.durationDays} días'),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Instructions card
            if (t.instructions.trim().isNotEmpty) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFFE0E3E1)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Instrucciones',
                      style: GoogleFonts.manrope(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(t.instructions),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            if (_error.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Text(
                  _error,
                  style: const TextStyle(color: Color(0xFFBA1A1A)),
                ),
              ),

            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF006A5E),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  textStyle: GoogleFonts.manrope(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                onPressed: _starting ? null : _startTreatment,
                icon: _starting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.play_circle_rounded),
                label: Text(_starting ? 'Iniciando...' : 'Iniciar tratamiento'),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
