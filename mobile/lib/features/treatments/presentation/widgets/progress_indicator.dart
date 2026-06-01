import 'package:flutter/material.dart';

class TreatmentsProgressIndicator extends StatelessWidget {
  const TreatmentsProgressIndicator({
    super.key,
    required this.label,
    required this.value,
    this.color = const Color(0xFF006A5E),
  });

  final String label;
  final double value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final normalized = value.clamp(0, 1).toDouble();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontWeight: FontWeight.w700,
            color: Color(0xFF3E4946),
          ),
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            minHeight: 10,
            value: normalized,
            color: color,
            backgroundColor: const Color(0xFFE1E3E4),
          ),
        ),
      ],
    );
  }
}
