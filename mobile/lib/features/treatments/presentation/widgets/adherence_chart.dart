import 'package:flutter/material.dart';

class AdherenceChart extends StatelessWidget {
  const AdherenceChart({super.key, required this.weeks});

  final List<Map<String, dynamic>> weeks;

  @override
  Widget build(BuildContext context) {
    if (weeks.isEmpty) {
      return const Text(
        'Sin datos de tendencia.',
        style: TextStyle(color: Color(0xFF6F7977)),
      );
    }

    return Column(
      children: weeks.map((week) {
        final label = (week['semana'] ?? '').toString();
        final value = (week['cumplimiento'] as num?)?.toDouble() ?? 0;

        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            children: [
              SizedBox(
                width: 88,
                child: Text(
                  label,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    minHeight: 10,
                    value: (value / 100).clamp(0, 1),
                    color: const Color(0xFF006E2F),
                    backgroundColor: const Color(0xFFE1E3E4),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text('${value.toStringAsFixed(0)}%'),
            ],
          ),
        );
      }).toList(),
    );
  }
}
