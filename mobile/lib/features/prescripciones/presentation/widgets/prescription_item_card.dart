import 'package:flutter/material.dart';

import '../../data/models/prescription_models.dart';

class PrescriptionItemCard extends StatelessWidget {
  const PrescriptionItemCard({super.key, required this.item});

  final PrescriptionCaptureItem item;

  @override
  Widget build(BuildContext context) {
    final subtitleParts = <String>[
      if (item.detectedQuantity.isNotEmpty)
        'Cantidad: ${item.detectedQuantity}',
      if (item.detectedInstructions.isNotEmpty)
        'Dosis diaria: ${item.detectedInstructions}',
      if (item.detectedDuration.isNotEmpty) 'Días: ${item.detectedDuration}',
    ];

    return Card(
      child: ListTile(
        title: Text(
          item.resolvedName.isNotEmpty ? item.resolvedName : item.detectedName,
        ),
        subtitle: Text(subtitleParts.join(' • ')),
        trailing: Text(item.customerDecision),
      ),
    );
  }
}
