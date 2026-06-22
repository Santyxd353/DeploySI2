import 'package:flutter/material.dart';

import '../../../../core/auth/auth_session_manager.dart';
import '../../data/opinions_service.dart';

class OpinionClienteSheet extends StatefulWidget {
  const OpinionClienteSheet({super.key});

  @override
  State<OpinionClienteSheet> createState() => _OpinionClienteSheetState();
}

class _OpinionClienteSheetState extends State<OpinionClienteSheet> {
  final OpinionsService _opinionsService = OpinionsService();

  String _tab = 'nueva';
  int _rating = 0;
  String _tipo = 'general';
  String _comentario = '';

  bool _submitting = false;
  bool _submitted = false;
  String? _error;

  bool _loadingMine = false;
  String? _mineError;
  List<CustomerOpinion> _mine = const <CustomerOpinion>[];

  @override
  void initState() {
    super.initState();
    _loadMine();
  }

  Future<void> _loadMine() async {
    if (_loadingMine) return;

    setState(() {
      _loadingMine = true;
      _mineError = null;
    });

    try {
      final accessToken = await AuthSessionManager.getAccessToken();
      if (accessToken == null || accessToken.trim().isEmpty) {
        throw const OpinionsServiceException('Tu sesion expiro. Inicia sesion nuevamente.');
      }

      final opinions = await _opinionsService.listarMisOpiniones(
        accessToken: accessToken,
      );

      if (!mounted) return;
      setState(() {
        _mine = opinions;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _mineError = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loadingMine = false;
        });
      }
    }
  }

  Future<void> _submit() async {
    if (_rating == 0) {
      setState(() => _error = 'Selecciona una puntuacion.');
      return;
    }
    if (_comentario.trim().length < 10) {
      setState(() => _error = 'El comentario debe tener al menos 10 caracteres.');
      return;
    }

    setState(() {
      _error = null;
      _submitting = true;
    });

    try {
      final accessToken = await AuthSessionManager.getAccessToken();
      if (accessToken == null || accessToken.trim().isEmpty) {
        throw const OpinionsServiceException('Tu sesion expiro. Inicia sesion nuevamente.');
      }

      await _opinionsService.crearOpinion(
        accessToken: accessToken,
        tipo: _tipo,
        puntuacion: _rating,
        comentario: _comentario.trim(),
      );

      if (!mounted) return;
      setState(() {
        _submitted = true;
      });

      await _loadMine();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  void _resetFormAndOpenMine() {
    setState(() {
      _submitted = false;
      _rating = 0;
      _tipo = 'general';
      _comentario = '';
      _tab = 'mias';
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return SafeArea(
      top: false,
      child: Container(
        height: size.height * 0.86,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 46,
              height: 5,
              decoration: BoxDecoration(
                color: const Color(0xFFCFD8D5),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 14, 8, 8),
              child: Row(
                children: [
                  const Icon(Icons.rate_review_rounded, color: Color(0xFF006A5E)),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Tus opiniones',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF191C1C),
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Row(
                children: [
                  Expanded(
                    child: _TabButton(
                      label: 'Nueva opinion',
                      selected: _tab == 'nueva',
                      onTap: () => setState(() => _tab = 'nueva'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _TabButton(
                      label: 'Mis opiniones',
                      selected: _tab == 'mias',
                      onTap: () {
                        setState(() => _tab = 'mias');
                        _loadMine();
                      },
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 180),
                child: _tab == 'nueva' ? _buildNewOpinion() : _buildMine(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNewOpinion() {
    if (_submitted) {
      return Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          key: const ValueKey('submitted-state'),
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: Color(0xFFE6F6F1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_rounded, color: Color(0xFF006A5E), size: 36),
            ),
            const SizedBox(height: 14),
            const Text(
              'Gracias por tu opinion',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
            ),
            const SizedBox(height: 6),
            const Text(
              'Tu comentario fue recibido y lo revisaremos pronto.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF5A6361)),
            ),
            const SizedBox(height: 18),
            ElevatedButton(
              onPressed: _resetFormAndOpenMine,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF006A5E),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              ),
              child: const Text('Ver mis opiniones'),
            ),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      key: const ValueKey('new-form'),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Que quieres valorar?',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _PillOption(
                  label: 'Experiencia general',
                  selected: _tipo == 'general',
                  onTap: () => setState(() => _tipo = 'general'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _PillOption(
                  label: 'Atencion y servicio',
                  selected: _tipo == 'servicio',
                  onTap: () => setState(() => _tipo = 'servicio'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text(
            'Tu puntuacion',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          ),
          const SizedBox(height: 6),
          _StarRating(
            value: _rating,
            onChanged: (value) => setState(() => _rating = value),
          ),
          const SizedBox(height: 6),
          Text(
            _rating == 0
                ? 'Selecciona de 1 a 5 estrellas'
                : const ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'][_rating],
            style: const TextStyle(fontSize: 12, color: Color(0xFF6F7977)),
          ),
          const SizedBox(height: 16),
          const Text(
            'Tu comentario',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          ),
          const SizedBox(height: 8),
          TextField(
            minLines: 4,
            maxLines: 6,
            maxLength: 500,
            onChanged: (value) => setState(() => _comentario = value),
            decoration: InputDecoration(
              hintText: 'Cuentanos tu experiencia...',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFFD5DDDB)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFF006A5E), width: 1.4),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFDEBEC),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                _error!,
                style: const TextStyle(color: Color(0xFFB3261E), fontSize: 12),
              ),
            ),
          ],
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _submitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF006A5E),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Text(_submitting ? 'Enviando...' : 'Enviar opinion'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMine() {
    if (_loadingMine) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF006A5E)),
      );
    }

    if (_mineError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _mineError!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFFB3261E), fontSize: 12),
              ),
              const SizedBox(height: 10),
              TextButton.icon(
                onPressed: _loadMine,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Reintentar'),
              ),
            ],
          ),
        ),
      );
    }

    if (_mine.isEmpty) {
      return const Center(
        child: Text(
          'Aun no has dejado ninguna opinion.',
          style: TextStyle(color: Color(0xFF6F7977)),
        ),
      );
    }

    return RefreshIndicator(
      color: const Color(0xFF006A5E),
      onRefresh: _loadMine,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 24),
        itemCount: _mine.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, index) {
          final item = _mine[index];
          return _OpinionTile(item: item);
        },
      ),
    );
  }
}

class _OpinionTile extends StatelessWidget {
  const _OpinionTile({required this.item});

  final CustomerOpinion item;

  static const Map<String, String> _estadoLabel = {
    'pendiente': 'Pendiente',
    'respondida': 'Respondida',
    'escalada': 'Escalada',
    'archivada': 'Archivada',
  };

  static const Map<String, String> _tipoLabel = {
    'general': 'General',
    'servicio': 'Servicio',
    'venta': 'Venta',
    'producto': 'Producto',
  };

  @override
  Widget build(BuildContext context) {
    final estado = _estadoLabel[item.estado] ?? item.estado;
    final tipo = _tipoLabel[item.tipo] ?? item.tipo;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAF9),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5ECEA)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _StarRating(value: item.puntuacion, readonly: true),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFEAF8F4),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  tipo,
                  style: const TextStyle(
                    color: Color(0xFF006A5E),
                    fontWeight: FontWeight.w700,
                    fontSize: 10,
                  ),
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: _estadoColor(item.estado).withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  estado,
                  style: TextStyle(
                    color: _estadoColor(item.estado),
                    fontWeight: FontWeight.w700,
                    fontSize: 10,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            item.comentario,
            style: const TextStyle(fontSize: 12, color: Color(0xFF1D2423)),
          ),
          if (item.respuestaStaff.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFEAF8F4),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Respuesta de la farmacia',
                    style: TextStyle(
                      color: Color(0xFF006A5E),
                      fontWeight: FontWeight.w800,
                      fontSize: 10,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.respuestaStaff,
                    style: const TextStyle(color: Color(0xFF1C4D46), fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: Text(
              _formatDate(item.createdAt),
              style: const TextStyle(fontSize: 10, color: Color(0xFF6F7977)),
            ),
          ),
        ],
      ),
    );
  }

  static Color _estadoColor(String estado) {
    switch (estado) {
      case 'respondida':
        return const Color(0xFF157347);
      case 'escalada':
        return const Color(0xFFB26A00);
      default:
        return const Color(0xFF5F6B68);
    }
  }

  static String _formatDate(DateTime? date) {
    if (date == null) return '';

    const meses = <String>[
      'ene',
      'feb',
      'mar',
      'abr',
      'may',
      'jun',
      'jul',
      'ago',
      'sep',
      'oct',
      'nov',
      'dic',
    ];

    final mes = meses[date.month - 1];
    return '${date.day} $mes ${date.year}';
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: selected ? const Color(0xFFEAF8F4) : const Color(0xFFF2F5F4),
          border: Border.all(
            color: selected ? const Color(0xFF75C9B8) : const Color(0xFFE3EAE8),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: selected ? const Color(0xFF006A5E) : const Color(0xFF4D5754),
          ),
        ),
      ),
    );
  }
}

class _PillOption extends StatelessWidget {
  const _PillOption({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? const Color(0xFF75C9B8) : const Color(0xFFD5DDDB),
          ),
          color: selected ? const Color(0xFFEAF8F4) : Colors.white,
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: selected ? const Color(0xFF006A5E) : const Color(0xFF4D5754),
          ),
        ),
      ),
    );
  }
}

class _StarRating extends StatelessWidget {
  const _StarRating({
    required this.value,
    this.onChanged,
    this.readonly = false,
  });

  final int value;
  final ValueChanged<int>? onChanged;
  final bool readonly;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        final star = index + 1;
        final filled = star <= value;

        return IconButton(
          onPressed: readonly ? null : () => onChanged?.call(star),
          visualDensity: VisualDensity.compact,
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
          icon: Icon(
            filled ? Icons.star_rounded : Icons.star_outline_rounded,
            color: filled ? const Color(0xFFF7B500) : const Color(0xFFCCD3D1),
            size: 28,
          ),
        );
      }),
    );
  }
}
