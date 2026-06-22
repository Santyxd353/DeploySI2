import 'package:flutter/material.dart';

import '../../data/models/treatment_base.dart';
import 'progress_indicator.dart';

class TreatmentCard extends StatelessWidget {
  const TreatmentCard({
    super.key,
    required this.treatment,
    required this.remainingLabel,
    required this.remainingProgress,
    this.onTap,
    this.onDetails,
    this.actionLabel,
    this.onAction,
    this.actionLoading = false,
  });

  final TreatmentBase treatment;
  final String remainingLabel;
  final double remainingProgress;
  final VoidCallback? onTap;
  final VoidCallback? onDetails;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool actionLoading;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE0E3E1)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                treatment.publicName,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '${treatment.dosageDisplay} ${treatment.dosageUnit} • ${treatment.intervalLabel}',
                style: const TextStyle(color: Color(0xFF6F7977)),
              ),
              const SizedBox(height: 2),
              Text(
                treatment.productName,
                style: const TextStyle(color: Color(0xFF3E4946), fontSize: 12),
              ),
              const SizedBox(height: 12),
              TreatmentsProgressIndicator(
                label: remainingLabel,
                value: remainingProgress,
                color: const Color(0xFF006E2F),
              ),
              if (actionLabel != null || onDetails != null) ...[
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    if (onDetails != null) ...[
                      OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF006A5E),
                          side: const BorderSide(color: Color(0xFF006A5E)),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        onPressed: onDetails,
                        child: const Text('Ver detalles'),
                      ),
                      const SizedBox(width: 8),
                    ],
                    if (actionLabel != null)
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF006A5E),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        onPressed: actionLoading ? null : onAction,
                        child: Text(actionLabel!),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
