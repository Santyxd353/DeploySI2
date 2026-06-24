import 'package:flutter/material.dart';

import '../../data/models/prescription_models.dart';

class SavedPrescriptionPage extends StatelessWidget {
  const SavedPrescriptionPage({
    super.key,
    required this.recipe,
  });

  final SavedPrescription recipe;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Receta guardada')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Código: ${recipe.codigo}', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                Text('Estado: ${recipe.estado}'),
                const SizedBox(height: 8),
                Text('Observación: ${recipe.observacion.isEmpty ? "Sin observación" : recipe.observacion}'),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
