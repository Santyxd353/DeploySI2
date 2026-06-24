import 'package:flutter/material.dart';

class PrescriptionSummaryCard extends StatelessWidget {
  const PrescriptionSummaryCard({
    super.key,
    required this.title,
    required this.content,
  });

  final String title;
  final String content;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(content.isEmpty ? 'Sin contenido aún.' : content),
          ],
        ),
      ),
    );
  }
}
