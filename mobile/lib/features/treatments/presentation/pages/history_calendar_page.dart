import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/auth/auth_session_manager.dart';
import '../../data/models/treatment_base.dart';
import '../../data/treatment_repository.dart';
import 'treatment_detail_page.dart';
import '../widgets/adherence_chart.dart';

class HistoryCalendarPage extends StatefulWidget {
  const HistoryCalendarPage({super.key});

  @override
  State<HistoryCalendarPage> createState() => _HistoryCalendarPageState();
}

class _HistoryCalendarPageState extends State<HistoryCalendarPage> {
  final TreatmentRepository _repository = TreatmentRepository();

  DateTime _selectedMonth = DateTime(DateTime.now().year, DateTime.now().month, 1);
  DateTime? _selectedDay;

  bool _loading = true;
  String _error = '';
  Map<String, dynamic> _monthly = <String, dynamic>{};
  Map<String, dynamic> _weekly = <String, dynamic>{};
  List<Map<String, dynamic>> _allTreatments = <Map<String, dynamic>>[];
  final Map<String, Map<String, dynamic>> _dailyDetailsByDate =
      <String, Map<String, dynamic>>{};
  bool _dailyDetailsLoading = false;
  String _dailyDetailsError = '';
  int? _selectedDoseTreatmentId;
  _HistoryView _historyView = _HistoryView.dayDetails;

  @override
  void initState() {
    super.initState();
    _load();
  }

  ({String label, Color bg, Color fg}) _dayMarkStyle(String mark) {
    final m = mark.toLowerCase();
    if (m == 'completo') {
      return (
        label: 'Cumplido',
        bg: const Color(0xFFEAF8F4),
        fg: const Color(0xFF006A5E),
      );
    }
    if (m == 'incompleto') {
      return (
        label: 'Incompleto',
        bg: const Color(0xFFFFE8E3),
        fg: const Color(0xFF8A1B00),
      );
    }
    return (
      label: 'Sin datos',
      bg: const Color(0xFFF0F1F1),
      fg: const Color(0xFF5E6563),
    );
  }

  ({String label, Color bg, Color fg}) _treatmentStatusStyle(String status) {
    final s = status.toLowerCase();
    if (s == 'completado') {
      return (
        label: 'Completado',
        bg: const Color(0xFFEAF8F4),
        fg: const Color(0xFF006A5E),
      );
    }
    if (s == 'cancelado') {
      return (
        label: 'Cancelado',
        bg: const Color(0xFFFFE8E3),
        fg: const Color(0xFF8A1B00),
      );
    }
    if (s == 'abandonado') {
      return (
        label: 'Abandonado',
        bg: const Color(0xFFFFE8E3),
        fg: const Color(0xFF8A1B00),
      );
    }
    if (s == 'pausado') {
      return (
        label: 'En pausa',
        bg: const Color(0xFFFFF4D6),
        fg: const Color(0xFF7A5800),
      );
    }
    return (
      label: 'Activo',
      bg: const Color(0xFFE8F1FF),
      fg: const Color(0xFF0B57D0),
    );
  }

  Future<void> _load({DateTime? month}) async {
    final targetMonth = month == null ? _selectedMonth : DateTime(month.year, month.month, 1);

    setState(() {
      _loading = true;
      _error = '';
      _selectedMonth = targetMonth;
    });

    try {
      final token = await AuthSessionManager.getAccessToken();
      if (token == null || token.isEmpty) {
        throw Exception('Sesion no disponible.');
      }

      final monthly = await _repository.getMonthlyHistory(
        month: _monthParam(targetMonth),
        accessToken: token,
      );
      final weekly = await _repository.getWeeklyStats(accessToken: token);
      final allHistory = await _repository.getAllTreatmentsHistory(accessToken: token);

      if (!mounted) {
        return;
      }

      setState(() {
        _monthly = monthly;
        _weekly = weekly;
        _allTreatments = (allHistory['tratamientos'] as List?)
                ?.whereType<Map<String, dynamic>>()
                .toList() ??
            <Map<String, dynamic>>[];
        _selectedDay = _initialSelectedDay(targetMonth, monthly);
        _dailyDetailsError = '';
        _selectedDoseTreatmentId = null;
        _loading = false;
      });

      if (_selectedDay != null) {
        await _loadSelectedDayDetails(_selectedDay!, token: token);
      }
    } catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  String _monthParam(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}';
  }

  DateTime? _initialSelectedDay(DateTime month, Map<String, dynamic> monthly) {
    final days = (monthly['dias'] as List?)?.whereType<Map<String, dynamic>>().toList() ??
        <Map<String, dynamic>>[];

    final today = DateTime.now();
    if (today.year == month.year && today.month == month.month) {
      return DateTime(today.year, today.month, today.day);
    }

    if (days.isNotEmpty) {
      final first = (days.first['fecha'] ?? '').toString();
      return _parseIsoDate(first);
    }

    return DateTime(month.year, month.month, 1);
  }

  DateTime? _parseIsoDate(String raw) {
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) {
      return null;
    }
    return DateTime(parsed.year, parsed.month, parsed.day);
  }

  String _isoDayKey(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }

  String _monthTitle(DateTime month) {
    const names = <int, String>{
      1: 'Enero',
      2: 'Febrero',
      3: 'Marzo',
      4: 'Abril',
      5: 'Mayo',
      6: 'Junio',
      7: 'Julio',
      8: 'Agosto',
      9: 'Septiembre',
      10: 'Octubre',
      11: 'Noviembre',
      12: 'Diciembre',
    };
    return '${names[month.month]} ${month.year}';
  }

  String _friendlyDate(DateTime date) {
    const wd = <int, String>{
      1: 'Lun',
      2: 'Mar',
      3: 'Mie',
      4: 'Jue',
      5: 'Vie',
      6: 'Sab',
      7: 'Dom',
    };
    return '${wd[date.weekday]} ${date.day}/${date.month}/${date.year}';
  }

  void _setHistoryView(_HistoryView view) {
    setState(() => _historyView = view);
  }

  Map<String, dynamic>? _selectedDayStats(Map<String, Map<String, dynamic>> byDate) {
    final selected = _selectedDay;
    if (selected == null) {
      return null;
    }
    return byDate[_isoDayKey(selected)];
  }

  Future<void> _goToPreviousMonth() async {
    await _load(month: DateTime(_selectedMonth.year, _selectedMonth.month - 1, 1));
  }

  Future<void> _goToNextMonth() async {
    await _load(month: DateTime(_selectedMonth.year, _selectedMonth.month + 1, 1));
  }

  Future<void> _loadSelectedDayDetails(
    DateTime day, {
    String? token,
  }) async {
    final key = _isoDayKey(day);
    if (_dailyDetailsByDate.containsKey(key)) {
      return;
    }

    if (!mounted) {
      return;
    }

    setState(() {
      _dailyDetailsLoading = true;
      _dailyDetailsError = '';
    });

    try {
      final accessToken = token ?? await AuthSessionManager.getAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw Exception('Sesion no disponible.');
      }

      final detail = await _repository.getDailyHistory(
        date: key,
        accessToken: accessToken,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _dailyDetailsByDate[key] = detail;
        final rows = (detail['tomas'] as List?)
                ?.whereType<Map<String, dynamic>>()
                .toList() ??
            <Map<String, dynamic>>[];
        final ids = rows
            .map((r) => ((r['tratamiento_base'] as Map?)?['id']))
            .whereType<int>()
            .toSet();
        if (_selectedDoseTreatmentId != null && !ids.contains(_selectedDoseTreatmentId)) {
          _selectedDoseTreatmentId = null;
        }
        _dailyDetailsLoading = false;
      });
    } catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _dailyDetailsLoading = false;
        _dailyDetailsError = e.toString();
      });
    }
  }

  List<Map<String, dynamic>> _weeklyUiRows(List<Map<String, dynamic>> weeks) {
    return weeks.map((row) {
      final raw = (row['semana'] ?? '').toString();
      final match = RegExp(r'^(\d{4})-W(\d{2})$').firstMatch(raw);
      if (match == null) {
        return row;
      }
      final year = match.group(1) ?? '';
      final week = match.group(2) ?? '';
      return <String, dynamic>{
        ...row,
        'semana': 'Semana $week ($year)',
      };
    }).toList();
  }

  Widget _buildTopSummary() {
    final taken = (_weekly['dosis_tomadas'] as num?)?.toInt() ?? 0;
    final omitted = (_weekly['dosis_omitidas'] as num?)?.toInt() ?? 0;
    final adherence = (_weekly['cumplimiento_total'] as num?)?.toDouble() ?? 0.0;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          colors: [Color(0xFF0B4A68), Color(0xFF006A5E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Tu progreso',
            style: GoogleFonts.manrope(
              fontSize: 21,
              fontWeight: FontWeight.w900,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 5),
          const Text(
            'Resumen de las ultimas semanas',
            style: TextStyle(color: Colors.white70),
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              minHeight: 11,
              value: (adherence / 100).clamp(0.0, 1.0),
              backgroundColor: Colors.white.withValues(alpha: 0.15),
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _SummaryMetric(
                  label: 'Cumplimiento',
                  value: '${adherence.toStringAsFixed(0)}%',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _SummaryMetric(label: 'Tomadas', value: '$taken'),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _SummaryMetric(label: 'Omitidas', value: '$omitted'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCalendar(Map<String, Map<String, dynamic>> byDate) {
    final firstDay = DateTime(_selectedMonth.year, _selectedMonth.month, 1);
    final nextMonth = DateTime(_selectedMonth.year, _selectedMonth.month + 1, 1);
    final daysInMonth = nextMonth.subtract(const Duration(days: 1)).day;
    final leading = firstDay.weekday - 1;
    final totalSlots = (((leading + daysInMonth) / 7).ceil()) * 7;

    const weekLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

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
          Row(
            children: [
              Text(
                _monthTitle(_selectedMonth),
                style: GoogleFonts.manrope(fontSize: 17, fontWeight: FontWeight.w800),
              ),
              const Spacer(),
              IconButton(
                onPressed: _goToPreviousMonth,
                icon: const Icon(Icons.chevron_left_rounded),
                tooltip: 'Mes anterior',
              ),
              IconButton(
                onPressed: _goToNextMonth,
                icon: const Icon(Icons.chevron_right_rounded),
                tooltip: 'Mes siguiente',
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: weekLabels
                .map(
                  (d) => Expanded(
                    child: Center(
                      child: Text(
                        d,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF6F7977),
                        ),
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 8),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              mainAxisSpacing: 6,
              crossAxisSpacing: 6,
              childAspectRatio: 1,
            ),
            itemCount: totalSlots,
            itemBuilder: (context, index) {
              if (index < leading || index >= leading + daysInMonth) {
                return const SizedBox.shrink();
              }

              final dayNumber = index - leading + 1;
              final date = DateTime(_selectedMonth.year, _selectedMonth.month, dayNumber);
              final key = _isoDayKey(date);
              final stats = byDate[key];
              final style = _dayMarkStyle((stats?['marca'] ?? 'sin_datos').toString());
              final isSelected = _selectedDay != null &&
                  _selectedDay!.year == date.year &&
                  _selectedDay!.month == date.month &&
                  _selectedDay!.day == date.day;

              return InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () async {
                  setState(() {
                    _selectedDay = date;
                    _dailyDetailsError = '';
                  });
                  await _loadSelectedDayDetails(date);
                },
                child: Container(
                  decoration: BoxDecoration(
                    color: isSelected ? const Color(0xFF006A5E) : style.bg,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSelected ? const Color(0xFF004D45) : const Color(0xFFE0E3E1),
                    ),
                  ),
                  child: Center(
                    child: Text(
                      '$dayNumber',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        color: isSelected ? Colors.white : style.fg,
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: const [
              _LegendChip(
                label: 'Cumplido',
                color: Color(0xFFEAF8F4),
                fg: Color(0xFF006A5E),
              ),
              _LegendChip(
                label: 'Incompleto',
                color: Color(0xFFFFE8E3),
                fg: Color(0xFF8A1B00),
              ),
              _LegendChip(
                label: 'Sin datos',
                color: Color(0xFFF0F1F1),
                fg: Color(0xFF5E6563),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSelectedDayPanel(Map<String, Map<String, dynamic>> byDate) {
    final selected = _selectedDay;
    if (selected == null) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFE0E3E1)),
        ),
        child: const Text(
          'Selecciona un dia del calendario para ver su detalle.',
          style: TextStyle(color: Color(0xFF6F7977)),
        ),
      );
    }

    final stats = _selectedDayStats(byDate);
    final detail = _dailyDetailsByDate[_isoDayKey(selected)] ??
      <String, dynamic>{};
    final doses = (detail['tomas'] as List?)
        ?.whereType<Map<String, dynamic>>()
        .toList() ??
      <Map<String, dynamic>>[];
    final filteredDoses = _filterDosesByTreatment(doses);
    final total = (stats?['total'] as num?)?.toInt() ?? 0;
    final taken = (stats?['tomadas'] as num?)?.toInt() ?? 0;
    final pending = (stats?['pendientes'] as num?)?.toInt() ?? 0;
    final incomplete = (stats?['incompletas'] as num?)?.toInt() ?? 0;

    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE0E3E1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Detalle de ${_friendlyDate(selected)}',
            style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              minHeight: 9,
              value: total == 0 ? 0.0 : (taken / total).clamp(0.0, 1.0),
              backgroundColor: const Color(0xFFE1E3E4),
              color: const Color(0xFF006E2F),
            ),
          ),
          const SizedBox(height: 10),
          if (stats == null)
            const Text(
              'No hay tomas registradas en esta fecha.',
              style: TextStyle(color: Color(0xFF6F7977)),
            )
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _InfoPill(label: 'Programadas', value: '$total'),
                _InfoPill(label: 'Tomadas', value: '$taken'),
                _InfoPill(label: 'Pendientes', value: '$pending'),
                _InfoPill(label: 'Incompletas', value: '$incomplete'),
              ],
            ),
          const SizedBox(height: 10),
          Text(
            'Dosis del dia',
            style: GoogleFonts.manrope(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          if (_dailyDetailsLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            )
          else if (_dailyDetailsError.isNotEmpty)
            Text(
              _dailyDetailsError,
              style: const TextStyle(color: Color(0xFFBA1A1A), fontSize: 12),
            )
          else if (doses.isEmpty)
            const Text(
              'Sin dosis detalladas para este dia.',
              style: TextStyle(color: Color(0xFF6F7977), fontSize: 12),
            )
          else
            ...[
              _buildDoseFilterChips(doses),
              const SizedBox(height: 8),
              if (filteredDoses.isEmpty)
                const Text(
                  'No hay dosis para el tratamiento seleccionado.',
                  style: TextStyle(color: Color(0xFF6F7977), fontSize: 12),
                )
              else
                ...filteredDoses.map(_buildDoseTimelineItem),
            ],
          const SizedBox(height: 8),
          const Text(
            'Toca otro dia del calendario para ver su detalle.',
            style: TextStyle(color: Color(0xFF6F7977), fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryModeToggle() {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: const Color(0xFFF0F3F2),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        children: [
          Expanded(
            child: ChoiceChip(
              selected: _historyView == _HistoryView.dayDetails,
              label: const Text('Detalle del dia'),
              onSelected: (_) => _setHistoryView(_HistoryView.dayDetails),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: ChoiceChip(
              selected: _historyView == _HistoryView.treatments,
              label: const Text('Tratamientos registrados'),
              onSelected: (_) => _setHistoryView(_HistoryView.treatments),
            ),
          ),
        ],
      ),
    );
  }

  List<Map<String, dynamic>> _filterDosesByTreatment(List<Map<String, dynamic>> doses) {
    final treatmentId = _selectedDoseTreatmentId;
    if (treatmentId == null) {
      return doses;
    }
    return doses.where((row) {
      final base = (row['tratamiento_base'] as Map?)?.cast<String, dynamic>() ??
          <String, dynamic>{};
      return (base['id'] as int?) == treatmentId;
    }).toList();
  }

  Widget _buildDoseFilterChips(List<Map<String, dynamic>> doses) {
    final options = <({int id, String name})>[];
    final seen = <int>{};
    for (final row in doses) {
      final base = (row['tratamiento_base'] as Map?)?.cast<String, dynamic>() ??
          <String, dynamic>{};
      final id = base['id'] as int?;
      if (id == null || seen.contains(id)) {
        continue;
      }
      seen.add(id);
      final name = (base['nombre_publico'] ?? 'Tratamiento').toString();
      options.add((id: id, name: name));
    }

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          ChoiceChip(
            selected: _selectedDoseTreatmentId == null,
            label: const Text('Todos'),
            onSelected: (_) {
              setState(() => _selectedDoseTreatmentId = null);
            },
          ),
          const SizedBox(width: 8),
          ...options.map((o) {
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                selected: _selectedDoseTreatmentId == o.id,
                label: Text(o.name),
                onSelected: (_) {
                  setState(() => _selectedDoseTreatmentId = o.id);
                },
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildDoseTimelineItem(Map<String, dynamic> row) {
    final estado = (row['estado'] ?? 'pendiente').toString().toLowerCase();
    final scheduledRaw = (row['fecha_hora_programada'] ?? '').toString();
    final takenRaw = (row['fecha_hora_real'] ?? '').toString();
    final base =
        (row['tratamiento_base'] as Map?)?.cast<String, dynamic>() ??
            <String, dynamic>{};

    final scheduled = DateTime.tryParse(scheduledRaw)?.toLocal();
    final takenAt = DateTime.tryParse(takenRaw)?.toLocal();
    final scheduledLabel = scheduled == null
        ? '--:--'
        : '${scheduled.hour.toString().padLeft(2, '0')}:${scheduled.minute.toString().padLeft(2, '0')}';
    final takenLabel = takenAt == null
        ? ''
        : '${takenAt.hour.toString().padLeft(2, '0')}:${takenAt.minute.toString().padLeft(2, '0')}';

    final name = (base['nombre_publico'] ?? 'Tratamiento').toString();
    final product = (base['producto_nombre'] ?? '').toString();
    final doseAmount = (base['dosis_cantidad'] ?? '').toString();
    final doseUnit = (base['unidad_dosis'] ?? '').toString();

    Color chipBg;
    Color chipFg;
    IconData icon;
    String label;
    if (estado == 'tomada') {
      chipBg = const Color(0xFFEAF8F4);
      chipFg = const Color(0xFF006A5E);
      icon = Icons.check_circle_rounded;
      label = 'Tomada';
    } else if (estado == 'omitida') {
      chipBg = const Color(0xFFFFE8E3);
      chipFg = const Color(0xFF8A1B00);
      icon = Icons.cancel_rounded;
      label = 'Omitida';
    } else if (estado == 'pospuesta') {
      chipBg = const Color(0xFFFFF4D6);
      chipFg = const Color(0xFF7A5800);
      icon = Icons.schedule_rounded;
      label = 'Pospuesta';
    } else {
      chipBg = const Color(0xFFE8F1FF);
      chipFg = const Color(0xFF0B57D0);
      icon = Icons.notifications_active_rounded;
      label = 'Pendiente';
    }

    final baseData = <String, dynamic>{
      ...base,
      if (!base.containsKey('producto_sku')) 'producto_sku': '',
      if (!base.containsKey('frecuencia_horas')) 'frecuencia_horas': 1,
      if (!base.containsKey('duracion_dias')) 'duracion_dias': 1,
      if (!base.containsKey('instrucciones')) 'instrucciones': '',
    };

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          final treatment = TreatmentBase.fromJson(baseData);
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => TreatmentDetailPage(treatment: treatment),
            ),
          );
        },
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAF9),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE0E3E1)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 52,
                alignment: Alignment.center,
                child: Text(
                  scheduledLabel,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF191C1C),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    if (product.isNotEmpty)
                      Text(
                        product,
                        style: const TextStyle(fontSize: 12, color: Color(0xFF6F7977)),
                      ),
                    const SizedBox(height: 2),
                    Text(
                      'Dosis: $doseAmount $doseUnit',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF3E4946)),
                    ),
                    if (takenLabel.isNotEmpty)
                      Text(
                        'Registrada a las $takenLabel',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF006E2F)),
                      ),
                    const SizedBox(height: 2),
                    const Text(
                      'Toca para ver ficha del tratamiento',
                      style: TextStyle(fontSize: 11, color: Color(0xFF6F7977)),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  color: chipBg,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(icon, size: 14, color: chipFg),
                    const SizedBox(width: 4),
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: chipFg,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTreatmentsSection() {
    return Container(
      key: const ValueKey('treatments-section'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE0E3E1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Tratamientos registrados',
            style: GoogleFonts.manrope(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          const Text(
            'Aquí ves el resumen de cada tratamiento, independiente del dia seleccionado.',
            style: TextStyle(color: Color(0xFF6F7977), fontSize: 12),
          ),
          const SizedBox(height: 10),
          if (_allTreatments.isEmpty)
            const Text(
              'Aun no hay tratamientos registrados.',
              style: TextStyle(color: Color(0xFF6F7977)),
            )
          else
            ..._allTreatments.map((row) {
              final base = (row['tratamiento_base'] as Map?)?.cast<String, dynamic>() ??
                  <String, dynamic>{};
              final resumen = (row['resumen'] as Map?)?.cast<String, dynamic>() ??
                  <String, dynamic>{};
              final status = (row['estado'] ?? '').toString();
              final style = _treatmentStatusStyle(status);
              final name = (base['nombre_publico'] ?? 'Tratamiento').toString();
              final product = (base['producto_nombre'] ?? '').toString();
              final taken = (row['dosis_tomadas'] as num?)?.toInt() ?? 0;
              final target = (row['dosis_objetivo'] as num?)?.toInt() ?? 0;
              final omitted = (resumen['omitidas'] as num?)?.toInt() ?? 0;

              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAF9),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE0E3E1)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            name,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: style.bg,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            style.label,
                            style: TextStyle(
                              color: style.fg,
                              fontWeight: FontWeight.w800,
                              fontSize: 11,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (product.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        product,
                        style: const TextStyle(fontSize: 12, color: Color(0xFF6F7977)),
                      ),
                    ],
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        minHeight: 8,
                        value: target <= 0 ? 0.0 : (taken / target).clamp(0.0, 1.0),
                        backgroundColor: const Color(0xFFE1E3E4),
                        color: const Color(0xFF006E2F),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Avance: $taken/$target dosis · Omitidas: $omitted',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF3E4946)),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final weeksRaw = (_weekly['semanas'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .toList() ??
        <Map<String, dynamic>>[];
    final weeks = _weeklyUiRows(weeksRaw);

    final dias = (_monthly['dias'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .toList() ??
        <Map<String, dynamic>>[];

    final byDate = <String, Map<String, dynamic>>{};
    for (final row in dias) {
      final key = (row['fecha'] ?? '').toString();
      if (key.isNotEmpty) {
        byDate[key] = row;
      }
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAF9),
      appBar: AppBar(
        title: Text(
          'Historial y progreso',
          style: GoogleFonts.manrope(fontWeight: FontWeight.w800),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error.isNotEmpty
              ? Center(child: Text(_error))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _buildTopSummary(),
                      const SizedBox(height: 12),
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
                            Text(
                              'Tendencia semanal',
                              style: GoogleFonts.manrope(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              'Cada barra muestra el porcentaje de dosis tomadas por semana.',
                              style: TextStyle(fontSize: 12, color: Color(0xFF6F7977)),
                            ),
                            const SizedBox(height: 12),
                            AdherenceChart(weeks: weeks),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      _buildCalendar(byDate),
                      const SizedBox(height: 12),
                      _buildHistoryModeToggle(),
                      const SizedBox(height: 12),
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 220),
                        switchInCurve: Curves.easeOut,
                        switchOutCurve: Curves.easeIn,
                        child: _historyView == _HistoryView.dayDetails
                            ? KeyedSubtree(
                                key: const ValueKey('day-details-section'),
                                child: _buildSelectedDayPanel(byDate),
                              )
                            : _buildTreatmentsSection(),
                      ),
                    ],
                  ),
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
              fontSize: 18,
              fontWeight: FontWeight.w900,
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

enum _HistoryView { dayDetails, treatments }

class _LegendChip extends StatelessWidget {
  const _LegendChip({
    required this.label,
    required this.color,
    required this.fg,
  });

  final String label;
  final Color color;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAF9),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE0E3E1)),
      ),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(color: Color(0xFF191C1C), fontSize: 12),
          children: [
            TextSpan(
              text: '$value ',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            TextSpan(text: label),
          ],
        ),
      ),
    );
  }
}
