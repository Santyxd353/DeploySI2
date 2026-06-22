import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/auth/auth_session_manager.dart';
import '../../data/models/active_treatment.dart';
import '../../data/models/treatment_base.dart';
import '../../data/notification_service.dart';
import '../../data/treatment_repository.dart';
import '../widgets/treatment_card.dart';
import 'daily_schedule_page.dart';
import 'history_calendar_page.dart';
import 'treatment_detail_page.dart';

class TreatmentsCatalogPage extends StatefulWidget {
  const TreatmentsCatalogPage({super.key});

  @override
  State<TreatmentsCatalogPage> createState() => _TreatmentsCatalogPageState();
}

class _TreatmentsCatalogPageState extends State<TreatmentsCatalogPage> {
  final TreatmentRepository _repository = TreatmentRepository();
  final TextEditingController _searchController = TextEditingController();
  Timer? _ticker;
  DateTime _now = DateTime.now();

  bool _loading = true;
  String _error = '';
  bool _showActive = false;
  int? _cancellingTreatmentId;
  List<TreatmentBase> _available = <TreatmentBase>[];
  List<ActiveTreatment> _active = <ActiveTreatment>[];

  @override
  void dispose() {
    _ticker?.cancel();
    _searchController.dispose();
    super.dispose();
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
      final available = await _repository.getAvailableTreatments(accessToken: token);
      final active = await _repository.getMyTreatments(accessToken: token);
      if (!mounted) return;
      setState(() {
        _available = available;
        _active = active;
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

  Future<bool> _showCancelTreatmentDialog(ActiveTreatment treatment) async {
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
            title: Row(
              children: [
                const Icon(Icons.warning_amber_rounded, color: Color(0xFFBA1A1A)),
                const SizedBox(width: 8),
                const Expanded(child: Text('¿Cancelar tratamiento?')),
              ],
            ),
            content: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Vas a detener de forma definitiva el tratamiento ${treatment.base.publicName}.',
                  ),
                  const SizedBox(height: 14),
                  const Text('Esto implica que:'),
                  const SizedBox(height: 10),
                  const Text('1. Se cancelarán los recordatorios pendientes.'),
                  const SizedBox(height: 6),
                  const Text('2. Las próximas dosis ya no se programarán.'),
                  const SizedBox(height: 6),
                  const Text('3. El avance actual quedará guardado en tu historial.'),
                  const SizedBox(height: 6),
                  const Text(
                    '4. Si decides retomarlo después, tendrás que iniciarlo nuevamente desde cero.',
                  ),
                  const SizedBox(height: 14),
                  const Text('¿Estás seguro de que deseas cancelar este tratamiento?'),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: const Text('Volver'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFBA1A1A),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: () => Navigator.of(ctx).pop(true),
                child: const Text('Sí, cancelar tratamiento'),
              ),
            ],
          ),
        ) ??
        false;
  }

  Future<void> _cancelTreatment(ActiveTreatment treatment) async {
    final confirmed = await _showCancelTreatmentDialog(treatment);
    if (!confirmed || !mounted) return;

    setState(() => _cancellingTreatmentId = treatment.id);

    try {
      final token = await AuthSessionManager.getAccessToken();
      if (token == null || token.isEmpty) throw Exception('Sesión no disponible.');

      await _repository.cancelTreatment(
        activeTreatmentId: treatment.id,
        accessToken: token,
      );
      await TreatmentNotificationService.instance.cancelDoseReminder(treatment.id);
      await _load();

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Tratamiento cancelado correctamente.'),
          backgroundColor: Color(0xFF006A5E),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: const Color(0xFFBA1A1A),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _cancellingTreatmentId = null);
    }
  }

  int get _todayTotal => _active.fold<int>(0, (acc, t) => acc + t.todayIntakes.length);

  int get _todayTaken {
    return _active.fold<int>(
      0,
      (acc, t) =>
          acc + t.todayIntakes.where((i) => i.status.toLowerCase() == 'tomada').length,
    );
  }

  int get _todayPending {
    return _active.fold<int>(
      0,
      (acc, t) =>
          acc + t.todayIntakes.where((i) => i.status.toLowerCase() != 'tomada').length,
    );
  }

  List<TreatmentBase> get _filteredAvailable {
    final query = _searchController.text.trim().toLowerCase();
    if (query.isEmpty) return _available;
    return _available.where((t) {
      return t.publicName.toLowerCase().contains(query) ||
          t.productName.toLowerCase().contains(query) ||
          t.productSku.toLowerCase().contains(query);
    }).toList();
  }

  Widget _buildHero() {
    final percentage = _todayTotal == 0 ? 0.0 : (_todayTaken / _todayTotal);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          colors: [Color(0xFF006A5E), Color(0xFF004D40)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Control de tratamientos',
            style: GoogleFonts.manrope(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Hoy tomaste $_todayTaken de $_todayTotal dosis programadas',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 14),
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              minHeight: 10,
              value: percentage.clamp(0, 1),
              backgroundColor: Colors.white.withValues(alpha: 0.25),
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _MetricTile(label: 'Activos', value: _active.length.toString()),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MetricTile(label: 'Pendientes', value: _todayPending.toString()),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActions() {
    return Row(
      children: [
        Expanded(
          child: _ActionCard(
            icon: Icons.schedule_rounded,
            label: 'Tomas de hoy',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const DailySchedulePage()),
              );
            },
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _ActionCard(
            icon: Icons.insights_rounded,
            label: 'Historial',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const HistoryCalendarPage()),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildSearchAndSwitch() {
    return Column(
      children: [
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE0E3E1)),
          ),
          child: TextField(
            controller: _searchController,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              hintText: 'Busca medicamento con tratamiento',
              prefixIcon: Icon(Icons.search_rounded),
              border: InputBorder.none,
              contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: ChoiceChip(
                selected: !_showActive,
                label: const Text('Disponibles'),
                onSelected: (_) => setState(() => _showActive = false),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: ChoiceChip(
                selected: _showActive,
                label: Text('En curso (${_active.length})'),
                onSelected: (_) => setState(() => _showActive = true),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildAvailableList() {
    final items = _filteredAvailable;
    if (items.isEmpty) {
      return const Padding(
        padding: EdgeInsets.only(top: 34),
        child: Center(child: Text('No hay tratamientos para esa búsqueda.')),
      );
    }

    return ListView.separated(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      itemBuilder: (_, index) {
        final item = items[index];
        return TreatmentCard(
          treatment: item,
          remainingLabel: '${item.durationDays} días planificados',
          remainingProgress: 0,
          onDetails: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => TreatmentDetailPage(treatment: item),
              ),
            );
          },
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => TreatmentDetailPage(treatment: item)),
            );
          },
        );
      },
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemCount: items.length,
    );
  }

  Widget _buildActiveList() {
    if (_active.isEmpty) {
      return const Padding(
        padding: EdgeInsets.only(top: 34),
        child: Center(child: Text('Aún no tienes tratamientos iniciados.')),
      );
    }

    return ListView.separated(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      itemBuilder: (_, index) => _ActiveTreatmentCard(
        treatment: _active[index],
        now: _now,
        cancelling: _cancellingTreatmentId == _active[index].id,
        onCancel: () => _cancelTreatment(_active[index]),
        onMarkDose: () async {
          await Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const DailySchedulePage()),
          );
          if (!mounted) return;
          await _load();
        },
      ),
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemCount: _active.length,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAF9),
      appBar: AppBar(
        title: Text(
          'Tratamientos',
          style: GoogleFonts.manrope(fontWeight: FontWeight.w800),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error.isNotEmpty
            ? ListView(
                children: [
                  const SizedBox(height: 100),
                  Center(child: Text(_error, textAlign: TextAlign.center)),
                ],
              )
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _buildHero(),
                  const SizedBox(height: 12),
                  _buildQuickActions(),
                  const SizedBox(height: 14),
                  _buildSearchAndSwitch(),
                  const SizedBox(height: 14),
                  _showActive ? _buildActiveList() : _buildAvailableList(),
                ],
              ),
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: GoogleFonts.manrope(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 12)),
        ],
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Ink(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE0E3E1)),
        ),
        child: Row(
          children: [
            Icon(icon, color: const Color(0xFF006A5E)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: GoogleFonts.manrope(fontWeight: FontWeight.w700, color: const Color(0xFF191C1C)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActiveTreatmentCard extends StatelessWidget {
  const _ActiveTreatmentCard({
    required this.treatment,
    required this.now,
    required this.cancelling,
    required this.onCancel,
    required this.onMarkDose,
  });

  final ActiveTreatment treatment;
  final DateTime now;
  final bool cancelling;
  final VoidCallback onCancel;
  final VoidCallback onMarkDose;

  bool get _isPaused => treatment.status.toLowerCase() == 'pausado';
  bool get _isWaitingFirstDose => _isPaused && treatment.activatedAt == null;

  ({String label, Color bg, Color fg}) _statusStyle() {
    if (_isWaitingFirstDose) {
      return (
        label: 'En espera primera toma',
        bg: const Color(0xFFFFF4D6),
        fg: const Color(0xFF7A5800),
      );
    }
    if (_isPaused) {
      return (
        label: 'En pausa',
        bg: const Color(0xFFFFE6E0),
        fg: const Color(0xFF8A1B00),
      );
    }
    return (
      label: 'Activo',
      bg: const Color(0xFFEAF8F4),
      fg: const Color(0xFF006A5E),
    );
  }

  String _formatCountdown(Duration duration) {
    final totalSeconds = duration.inSeconds;
    if (totalSeconds <= 0) return '00:00:00';

    final days = duration.inDays;
    final hours = duration.inHours.remainder(24);
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);

    String two(int n) => n.toString().padLeft(2, '0');
    if (days > 0) {
      return '${days}d ${two(hours)}h ${two(minutes)}m';
    }
    return '${two(hours)}:${two(minutes)}:${two(seconds)}';
  }

  DateTime? _nextIntakeDateTime() {
    if (treatment.nextIntakeAt != null) {
      return treatment.nextIntakeAt;
    }

    final sorted = [...treatment.todayIntakes]
      ..sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));

    for (final intake in sorted) {
      final isTaken = intake.status.toLowerCase() == 'tomada';
      if (!isTaken && intake.scheduledAt.isAfter(now)) {
        return intake.scheduledAt;
      }
    }

    for (final intake in sorted) {
      final isTaken = intake.status.toLowerCase() == 'tomada';
      if (!isTaken) {
        return intake.scheduledAt;
      }
    }

    // Fallback so the UI always shows a running countdown even if API doesn't
    // provide pending intakes in the current payload.
    return now.add(treatment.base.intervalDuration);
  }

  bool _hasPendingDoseDue() {
    final pending = treatment.todayIntakes
        .where((i) => i.status.toLowerCase() != 'tomada')
        .toList();
    if (pending.isEmpty) return false;
    pending.sort((a, b) => a.scheduledAt.compareTo(b.scheduledAt));
    final nextPending = pending.first;
    return !nextPending.scheduledAt.isAfter(now);
  }

  @override
  Widget build(BuildContext context) {
    final total = treatment.todayIntakes.length;
    final taken = treatment.todayIntakes.where((i) => i.status.toLowerCase() == 'tomada').length;
    final totalTarget = treatment.targetDoses > 0 ? treatment.targetDoses : total;
    final totalTaken = treatment.takenDoses > 0 ? treatment.takenDoses : taken;
    final progress = totalTarget == 0 ? 0.0 : (totalTaken / totalTarget);
    final nextIntake = _nextIntakeDateTime();
    final nextIntakeCountdown = nextIntake?.difference(now);
    final freezeFinishCountdown = !_isWaitingFirstDose && _hasPendingDoseDue();
    final finishAt =
        treatment.scheduledEndAt ??
        DateTime(
          treatment.expectedEndDate.year,
          treatment.expectedEndDate.month,
          treatment.expectedEndDate.day,
          23,
          59,
          59,
        );
    final finishCountdown = finishAt.difference(now);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE0E3E1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title + dosage
          Text(
            treatment.base.publicName,
            style: GoogleFonts.manrope(fontSize: 17, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Builder(
            builder: (context) {
              final style = _statusStyle();
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: style.bg,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  style.label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: style.fg,
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 2),
          Text(
            '${treatment.base.dosageDisplay} ${treatment.base.dosageUnit} • ${treatment.base.intervalLabel}',
            style: const TextStyle(color: Color(0xFF6F7977), fontSize: 13),
          ),
          const SizedBox(height: 12),

          // ── MAIN HERO: frequency countdown ──
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF006A5E), Color(0xFF00897B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.timer_rounded, color: Colors.white, size: 20),
                    const SizedBox(width: 6),
                    Text(
                      'Próxima dosis en',
                      style: GoogleFonts.manrope(
                        color: Colors.white.withValues(alpha: 0.9),
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  _isWaitingFirstDose
                      ? 'LISTO'
                      : nextIntakeCountdown == null
                      ? '00:00:00'
                      : nextIntakeCountdown.isNegative
                      ? '¡Ahora!'
                      : _formatCountdown(nextIntakeCountdown),
                  style: GoogleFonts.manrope(
                    color: Colors.white,
                    fontSize: 38,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 2,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Progress + today count
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              minHeight: 9,
              value: progress.clamp(0, 1),
              backgroundColor: const Color(0xFFE1E3E4),
              color: const Color(0xFF006E2F),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                totalTarget > 0
                    ? 'Avance: $totalTaken/$totalTarget dosis'
                    : 'Hoy: $taken/$total dosis',
                style: const TextStyle(fontSize: 12, color: Color(0xFF3E4946)),
              ),
              if (_isWaitingFirstDose)
                const Text(
                  'El conteo inicia con la primera dosis',
                  style: TextStyle(fontSize: 11, color: Color(0xFF7A5800), fontWeight: FontWeight.w600),
                )
              else if (freezeFinishCountdown)
                const Text(
                  'Pausado: toma pendiente por registrar',
                  style: TextStyle(
                    fontSize: 11,
                    color: Color(0xFF7A5800),
                    fontWeight: FontWeight.w700,
                  ),
                )
              else
                Text(
                  finishCountdown.isNegative
                      ? 'Finalizado'
                      : 'Finaliza en ${_formatCountdown(finishCountdown)}',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF6F7977)),
                ),
            ],
          ),
          const SizedBox(height: 10),

          if (_isWaitingFirstDose)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF8E8),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFFD78A)),
              ),
              child: const Text(
                'Esperando primera toma. Marca tu dosis para iniciar el conteo del tratamiento y recordatorios.',
                style: TextStyle(
                  fontSize: 12,
                  color: Color(0xFF7A5800),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: cancelling ? null : onMarkDose,
              icon: const Icon(Icons.check_circle_rounded),
              label: Text(_isWaitingFirstDose ? 'Marcar primera toma' : 'Marcar dosis tomada'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF006A5E),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: cancelling ? null : onCancel,
              icon: cancelling
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.cancel_outlined),
              label: const Text('Cancelar tratamiento'),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFBA1A1A),
                side: const BorderSide(color: Color(0xFFBA1A1A)),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
