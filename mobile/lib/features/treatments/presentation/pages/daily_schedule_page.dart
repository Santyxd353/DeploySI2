import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/auth/auth_session_manager.dart';
import '../../data/models/active_treatment.dart';
import '../../data/models/intake_log.dart';
import '../../data/notification_service.dart';
import '../../data/treatment_repository.dart';

class DailySchedulePage extends StatefulWidget {
  const DailySchedulePage({super.key});

  @override
  State<DailySchedulePage> createState() => _DailySchedulePageState();
}

class _DailySchedulePageState extends State<DailySchedulePage> {
  final TreatmentRepository _repository = TreatmentRepository();
  Timer? _ticker;
  DateTime _now = DateTime.now();

  bool _loading = true;
  String _error = '';
  List<ActiveTreatment> _treatments = <ActiveTreatment>[];

  List<({ActiveTreatment treatment, IntakeLog intake})> get _todayEntries {
    final entries = <({ActiveTreatment treatment, IntakeLog intake})>[];
    for (final treatment in _treatments) {
      for (final intake in treatment.todayIntakes) {
        entries.add((treatment: treatment, intake: intake));
      }
    }
    entries.sort((a, b) => a.intake.scheduledAt.compareTo(b.intake.scheduledAt));
    return entries;
  }

  int get _takenToday =>
      _todayEntries.where((e) => e.intake.status.toLowerCase() == 'tomada').length;

  int get _pendingToday =>
      _todayEntries.where((e) => e.intake.status.toLowerCase() != 'tomada').length;

  int get _overdueToday {
    return _todayEntries
        .where(
          (e) =>
              e.intake.status.toLowerCase() != 'tomada' &&
              !e.intake.scheduledAt.isAfter(_now),
        )
        .length;
  }

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _now = DateTime.now());
    });
    _load();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final token = await AuthSessionManager.getAccessToken();
      if (token == null || token.isEmpty) {
        throw Exception('Sesión no disponible.');
      }
      final data = await _repository.getMyTreatments(accessToken: token);
      if (!mounted) return;
      setState(() {
        _treatments = data;
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

  Future<void> _markTaken(ActiveTreatment treatment, IntakeLog intake) async {
    // Guard: do not allow taking a dose before the scheduled time.
    final untilDue = intake.scheduledAt.difference(_now);
    if (untilDue.isNegative == false && intake.scheduledAt.isAfter(_now)) {
      final minutes = untilDue.inMinutes;
      final seconds = untilDue.inSeconds.remainder(60);
      final timeLabel =
          '${intake.scheduledAt.hour.toString().padLeft(2, '0')}:${intake.scheduledAt.minute.toString().padLeft(2, '0')}';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Aun no corresponde esta toma. Programada para las $timeLabel (faltan ${minutes}m ${seconds}s).',
          ),
          behavior: SnackBarBehavior.floating,
          backgroundColor: const Color(0xFF7A5800),
        ),
      );
      return;
    }

    try {
      final token = await AuthSessionManager.getAccessToken();
      if (token == null || token.isEmpty) {
        throw Exception('Sesión no disponible.');
      }

      final targetDoses = treatment.targetDoses;
      final takenDoses = treatment.takenDoses;
      final mightCompleteByDose =
          targetDoses > 0 && (takenDoses + 1) >= targetDoses;

      await _repository.takeDose(
        activeTreatmentId: treatment.id,
        intakeId: intake.id,
        accessToken: token,
      );

      await _load();

      ActiveTreatment? refreshed;
      for (final t in _treatments) {
        if (t.id == treatment.id) {
          refreshed = t;
          break;
        }
      }

      final completedNow =
          mightCompleteByDose ||
          refreshed == null ||
          refreshed.status.toLowerCase() == 'completado';

      if (completedNow) {
        await TreatmentNotificationService.instance.cancelDoseReminder(
          treatment.id,
        );
        if (!mounted) return;
        await _showCompletionDialog(treatment.base.publicName);
        return;
      }

      if (refreshed.status.toLowerCase() == 'activo') {
        await TreatmentNotificationService.instance.scheduleDoseReminder(
          activeTreatmentId: refreshed.id,
          treatmentName: refreshed.base.publicName,
          doseLabel:
              '${refreshed.base.dosageDisplay} ${refreshed.base.dosageUnit}',
          delay: refreshed.base.intervalDuration,
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<int?> _showPostponeMinutesDialog() async {
    return showDialog<int>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('Posponer toma'),
        children: [
          SimpleDialogOption(
            onPressed: () => Navigator.of(context).pop(10),
            child: const Text('10 minutos'),
          ),
          SimpleDialogOption(
            onPressed: () => Navigator.of(context).pop(15),
            child: const Text('15 minutos'),
          ),
          SimpleDialogOption(
            onPressed: () => Navigator.of(context).pop(30),
            child: const Text('30 minutos'),
          ),
          SimpleDialogOption(
            onPressed: () => Navigator.of(context).pop(60),
            child: const Text('60 minutos'),
          ),
        ],
      ),
    );
  }

  Future<void> _postponeDose(ActiveTreatment treatment, IntakeLog intake) async {
    final minutes = await _showPostponeMinutesDialog();
    if (minutes == null || !mounted) return;

    try {
      final token = await AuthSessionManager.getAccessToken();
      if (token == null || token.isEmpty) {
        throw Exception('Sesión no disponible.');
      }

      await _repository.postponeDose(
        activeTreatmentId: treatment.id,
        intakeId: intake.id,
        minutes: minutes,
        accessToken: token,
      );

      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Toma pospuesta $minutes minutos.'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: const Color(0xFF006A5E),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          behavior: SnackBarBehavior.floating,
          backgroundColor: const Color(0xFFBA1A1A),
        ),
      );
    }
  }

  Future<bool> _confirmOmitDose() async {
    return await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Omitir toma'),
            content: const Text(
              'Esta dosis quedará registrada como omitida. ¿Deseas continuar?',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancelar'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.of(context).pop(true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFBA1A1A),
                  foregroundColor: Colors.white,
                ),
                child: const Text('Omitir'),
              ),
            ],
          ),
        ) ??
        false;
  }

  Future<void> _omitDose(ActiveTreatment treatment, IntakeLog intake) async {
    final confirmed = await _confirmOmitDose();
    if (!confirmed || !mounted) return;

    try {
      final token = await AuthSessionManager.getAccessToken();
      if (token == null || token.isEmpty) {
        throw Exception('Sesión no disponible.');
      }

      await _repository.omitDose(
        activeTreatmentId: treatment.id,
        intakeId: intake.id,
        accessToken: token,
      );

      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Toma marcada como omitida.'),
          behavior: SnackBarBehavior.floating,
          backgroundColor: Color(0xFF7A5800),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          behavior: SnackBarBehavior.floating,
          backgroundColor: const Color(0xFFBA1A1A),
        ),
      );
    }
  }

  Future<void> _showCompletionDialog(String treatmentName) async {
    return showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (context) {
        return Dialog(
          insetPadding: const EdgeInsets.symmetric(horizontal: 24),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
          child: Container(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              gradient: const LinearGradient(
                colors: [Color(0xFFE9FBF5), Color(0xFFF5FFF8)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 74,
                  height: 74,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: Color(0xFF006E2F),
                  ),
                  child: const Icon(
                    Icons.emoji_events_rounded,
                    color: Colors.white,
                    size: 38,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'Felicidades',
                  style: GoogleFonts.manrope(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFF004D2A),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Completaste tu tratamiento de $treatmentName.\nExcelente constancia.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Color(0xFF2E463A),
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.check_circle_rounded),
                    label: const Text('Genial'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF006A5E),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      textStyle: const TextStyle(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  String _formatCountdown(Duration d) {
    if (d.isNegative) return '00:00';
    final h = d.inHours;
    final m = d.inMinutes.remainder(60);
    final s = d.inSeconds.remainder(60);
    String two(int n) => n.toString().padLeft(2, '0');
    return h > 0 ? '${two(h)}:${two(m)}:${two(s)}' : '${two(m)}:${two(s)}';
  }

  @override
  Widget build(BuildContext context) {
    final entries = _todayEntries;
    final progress = entries.isEmpty
      ? 0.0
      : (_takenToday / entries.length).clamp(0.0, 1.0).toDouble();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAF9),
      appBar: AppBar(
        title: Text(
          'Tomas de hoy',
          style: GoogleFonts.manrope(fontWeight: FontWeight.w800),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error.isNotEmpty
          ? Center(child: Text(_error))
          : entries.isEmpty
          ? _buildEmpty()
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: entries.length + 1,
              itemBuilder: (_, index) {
                if (index == 0) {
                  return _ScheduleSummary(
                    now: _now,
                    takenToday: _takenToday,
                    pendingToday: _pendingToday,
                    overdueToday: _overdueToday,
                    progress: progress,
                  );
                }
                final entry = entries[index - 1];
                return _IntakeItem(
                  treatment: entry.treatment,
                  intake: entry.intake,
                  now: _now,
                  formatCountdown: _formatCountdown,
                  onMark: () => _markTaken(entry.treatment, entry.intake),
                  onPostpone: () => _postponeDose(entry.treatment, entry.intake),
                  onOmit: () => _omitDose(entry.treatment, entry.intake),
                );
              },
            ),
    );
  }

  Widget _buildEmpty() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE0E3E1)),
          ),
          child: const Column(
            children: [
              Icon(Icons.event_busy_rounded, size: 40, color: Color(0xFF6F7977)),
              SizedBox(height: 10),
              Text(
                'No hay tomas programadas para hoy.',
                textAlign: TextAlign.center,
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              SizedBox(height: 6),
              Text(
                'Si ya iniciaste un tratamiento, espera la próxima dosis o actualiza la pantalla.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF6F7977)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        ..._treatments.map((t) {
          return Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ListTile(
              title: Text(t.base.publicName),
              subtitle: Text(
                t.nextIntakeAt == null
                    ? 'Sin próxima toma reportada todavía.'
                    : 'Próxima dosis: '
                          '${t.nextIntakeAt!.hour.toString().padLeft(2, '0')}:'
                          '${t.nextIntakeAt!.minute.toString().padLeft(2, '0')}',
              ),
              trailing: Text(
                t.status,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF006A5E),
                ),
              ),
            ),
          );
        }),
      ],
    );
  }
}

/// Individual dose row in the daily schedule.
class _IntakeItem extends StatelessWidget {
  const _IntakeItem({
    required this.treatment,
    required this.intake,
    required this.now,
    required this.formatCountdown,
    required this.onMark,
    required this.onPostpone,
    required this.onOmit,
  });

  final ActiveTreatment treatment;
  final IntakeLog intake;
  final DateTime now;
  final String Function(Duration) formatCountdown;
  final VoidCallback onMark;
  final VoidCallback onPostpone;
  final VoidCallback onOmit;

  bool get _isTaken => intake.status.toLowerCase() == 'tomada';
  bool get _isFuture => intake.scheduledAt.isAfter(now);
  bool get _isOverdue =>
      !_isTaken && !intake.scheduledAt.isAfter(now);

  @override
  Widget build(BuildContext context) {
    final timeLabel =
        '${intake.scheduledAt.hour.toString().padLeft(2, '0')}:${intake.scheduledAt.minute.toString().padLeft(2, '0')}';

    Color borderColor;
    Color bgColor;
    Widget trailing;

    if (_isTaken) {
      borderColor = const Color(0xFF006E2F);
      bgColor = const Color(0xFFEAF8F0);
      trailing = const Icon(Icons.check_circle_rounded, color: Color(0xFF006E2F), size: 26);
    } else if (_isFuture) {
      final countdown = intake.scheduledAt.difference(now);
      borderColor = const Color(0xFFE0E3E1);
      bgColor = Colors.white;
      trailing = Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          const Text('En', style: TextStyle(fontSize: 11, color: Color(0xFF6F7977))),
          Text(
            formatCountdown(countdown),
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: Color(0xFF006A5E),
            ),
          ),
        ],
      );
    } else if (_isOverdue) {
      borderColor = const Color(0xFFFFD78A);
      bgColor = const Color(0xFFFFF8E8);
      trailing = SizedBox(
        height: 32,
        child: ElevatedButton(
          onPressed: onMark,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF7A5800),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
          ),
          child: const Text('Tomar'),
        ),
      );
    } else {
      // Due now
      borderColor = const Color(0xFF006A5E);
      bgColor = const Color(0xFFEAF8F4);
      trailing = SizedBox(
        height: 32,
        child: ElevatedButton(
          onPressed: onMark,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF006A5E),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
          ),
          child: const Text('Tomar'),
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  treatment.base.publicName,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                ),
                const SizedBox(height: 2),
                Text(
                  '$timeLabel  •  ${treatment.base.dosageDisplay} ${treatment.base.dosageUnit}',
                  style: const TextStyle(color: Color(0xFF6F7977), fontSize: 12),
                ),
                if (_isFuture)
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Text(
                      'Disponible en ${formatCountdown(intake.scheduledAt.difference(now))}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF6F7977),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                if (_isOverdue)
                  const Padding(
                    padding: EdgeInsets.only(top: 3),
                    child: Text(
                      'Puedes tomarla ahora',
                      style: TextStyle(fontSize: 11, color: Color(0xFF7A5800), fontWeight: FontWeight.w700),
                    ),
                  ),
                if (!_isTaken && !_isFuture)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        OutlinedButton.icon(
                          onPressed: onPostpone,
                          icon: const Icon(Icons.schedule_rounded, size: 16),
                          label: const Text('Posponer'),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                          ),
                        ),
                        OutlinedButton.icon(
                          onPressed: onOmit,
                          icon: const Icon(Icons.block_rounded, size: 16),
                          label: const Text('Omitir'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF7A5800),
                            side: const BorderSide(color: Color(0xFF7A5800)),
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          trailing,
        ],
      ),
    );
  }
}

class _ScheduleSummary extends StatelessWidget {
  const _ScheduleSummary({
    required this.now,
    required this.takenToday,
    required this.pendingToday,
    required this.overdueToday,
    required this.progress,
  });

  final DateTime now;
  final int takenToday;
  final int pendingToday;
  final int overdueToday;
  final double progress;

  String _clockLabel() {
    final hh = now.hour.toString().padLeft(2, '0');
    final mm = now.minute.toString().padLeft(2, '0');
    final ss = now.second.toString().padLeft(2, '0');
    return '$hh:$mm:$ss';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          colors: [Color(0xFF006A5E), Color(0xFF0B4A68)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.schedule_rounded, color: Colors.white),
              const SizedBox(width: 8),
              Text(
                'Tu horario de hoy',
                style: GoogleFonts.manrope(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const Spacer(),
              Text(
                _clockLabel(),
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              minHeight: 10,
              value: progress,
              color: Colors.white,
              backgroundColor: Colors.white24,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _SummaryMetric(label: 'Tomadas', value: takenToday.toString()),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _SummaryMetric(label: 'Pendientes', value: pendingToday.toString()),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _SummaryMetric(label: 'Vencidas', value: overdueToday.toString()),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SummaryMetric extends StatelessWidget {
  const _SummaryMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white24,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              fontSize: 18,
            ),
          ),
          Text(
            label,
            style: const TextStyle(color: Colors.white, fontSize: 11),
          ),
        ],
      ),
    );
  }
}
