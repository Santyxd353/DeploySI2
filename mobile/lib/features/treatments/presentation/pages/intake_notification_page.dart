import 'package:flutter/material.dart';

import '../../../../core/auth/auth_session_manager.dart';
import '../../data/treatment_repository.dart';

class IntakeNotificationPage extends StatefulWidget {
  const IntakeNotificationPage({
    super.key,
    required this.activeTreatmentId,
    required this.intakeId,
    required this.treatmentName,
    required this.doseLabel,
    required this.scheduledLabel,
    this.instructions = '',
  });

  final int activeTreatmentId;
  final int intakeId;
  final String treatmentName;
  final String doseLabel;
  final String scheduledLabel;
  final String instructions;

  @override
  State<IntakeNotificationPage> createState() => _IntakeNotificationPageState();
}

class _IntakeNotificationPageState extends State<IntakeNotificationPage> {
  final TreatmentRepository _repository = TreatmentRepository();
  bool _processing = false;
  String _error = '';

  Future<void> _runAction(Future<void> Function(String token) action) async {
    setState(() {
      _processing = true;
      _error = '';
    });

    try {
      final token = await AuthSessionManager.getAccessToken();
      if (token == null || token.isEmpty)
        throw Exception('Sesión no disponible.');
      await action(token);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _processing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAF9),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 20),
              const Icon(
                Icons.notifications_active_rounded,
                size: 56,
                color: Color(0xFF006A5E),
              ),
              const SizedBox(height: 16),
              Text(
                widget.treatmentName,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                widget.doseLabel,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16, color: Color(0xFF3E4946)),
              ),
              const SizedBox(height: 4),
              Text(
                'Hora programada: ${widget.scheduledLabel}',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFF6F7977)),
              ),
              if (widget.instructions.trim().isNotEmpty) ...[
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Text(widget.instructions),
                ),
              ],
              const Spacer(),
              if (_error.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(
                    _error,
                    style: const TextStyle(color: Color(0xFFBA1A1A)),
                  ),
                ),
              SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: _processing
                      ? null
                      : () => _runAction(
                          (token) => _repository.takeDose(
                            activeTreatmentId: widget.activeTreatmentId,
                            intakeId: widget.intakeId,
                            accessToken: token,
                          ),
                        ),
                  child: const Text('Tomar ahora'),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                height: 52,
                child: OutlinedButton(
                  onPressed: _processing
                      ? null
                      : () => _runAction(
                          (token) => _repository.postponeDose(
                            activeTreatmentId: widget.activeTreatmentId,
                            intakeId: widget.intakeId,
                            minutes: 10,
                            accessToken: token,
                          ),
                        ),
                  child: const Text('Posponer 10 min'),
                ),
              ),
              TextButton(
                onPressed: _processing
                    ? null
                    : () => _runAction(
                        (token) => _repository.omitDose(
                          activeTreatmentId: widget.activeTreatmentId,
                          intakeId: widget.intakeId,
                          accessToken: token,
                        ),
                      ),
                child: const Text('Omitir'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
