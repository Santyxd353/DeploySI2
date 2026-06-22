import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/auth/auth_session_manager.dart';
import '../../data/customer_points_service.dart';
import '../../data/models/customer_points_models.dart';

class CustomerPointsPage extends StatefulWidget {
  const CustomerPointsPage({super.key});

  @override
  State<CustomerPointsPage> createState() => _CustomerPointsPageState();
}

class _CustomerPointsPageState extends State<CustomerPointsPage> {
  final CustomerPointsService _pointsService = CustomerPointsService();

  bool _loading = true;
  bool _redeeming = false;
  String _error = '';
  CustomerPointsDashboard? _dashboard;
  _PointsPageTab _activeTab = _PointsPageTab.catalogo;
  String _catalogSearchQuery = '';
  _CatalogFilterType _catalogFilterType = _CatalogFilterType.all;

  @override
  void initState() {
    super.initState();
    _loadPointsDashboard();
  }

  Future<void> _loadPointsDashboard() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final token = await AuthSessionManager.getAccessToken();
      if (token == null || token.trim().isEmpty) {
        throw const CustomerPointsServiceException(
          'Debes iniciar sesion para revisar tus puntos.',
        );
      }

      final dashboard = await _pointsService.loadDashboard(accessToken: token);
      if (!mounted) return;
      setState(() {
        _dashboard = dashboard;
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

  Future<void> _redeemReward(CustomerRewardItem reward) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: Text(
            'Confirmar canje',
            style: GoogleFonts.manrope(fontWeight: FontWeight.w800),
          ),
          content: Text(
            'Vas a canjear ${reward.name} por ${reward.pointsRequired} puntos. ¿Deseas continuar?',
            style: GoogleFonts.manrope(height: 1.5),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Canjear'),
            ),
          ],
        );
      },
    );

    if (confirmed != true) return;

    setState(() => _redeeming = true);

    try {
      final token = await AuthSessionManager.getAccessToken();
      if (token == null || token.trim().isEmpty) {
        throw const CustomerPointsServiceException(
          'Debes iniciar sesion para canjear recompensas.',
        );
      }

      final result = await _pointsService.redeemReward(
        accessToken: token,
        rewardId: reward.id,
      );
      await _loadPointsDashboard();
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (context) {
          return AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
            title: Text(
              'Canje realizado',
              style: GoogleFonts.manrope(fontWeight: FontWeight.w800),
            ),
            content: Text(
              'Tu recompensa ${result.rewardName} fue registrada correctamente. Codigo: ${result.voucherCode.isEmpty ? 'pendiente' : result.voucherCode}.',
              style: GoogleFonts.manrope(height: 1.5),
            ),
            actions: [
              ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Entendido'),
              ),
            ],
          );
        },
      );
    } catch (e) {
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (context) {
          return AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
            title: Text(
              'No se pudo completar el canje',
              style: GoogleFonts.manrope(fontWeight: FontWeight.w800),
            ),
            content: Text(
              e.toString(),
              style: GoogleFonts.manrope(height: 1.5),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Cerrar'),
              ),
            ],
          );
        },
      );
    } finally {
      if (mounted) {
        setState(() => _redeeming = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAF9),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8FAF9),
        elevation: 0,
        title: Text(
          'Mis Puntos',
          style: GoogleFonts.manrope(
            fontWeight: FontWeight.w800,
            color: const Color(0xFF191C1C),
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _loadPointsDashboard,
        color: const Color(0xFF006A5E),
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF006A5E)),
      );
    }

    if (_error.isNotEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 80),
          const Icon(Icons.stars_rounded, size: 64, color: Color(0xFFBA1A1A)),
          const SizedBox(height: 14),
          Text(
            'No se pudo cargar tu modulo de puntos',
            textAlign: TextAlign.center,
            style: GoogleFonts.manrope(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            _error,
            textAlign: TextAlign.center,
            style: GoogleFonts.manrope(color: const Color(0xFF6F7977)),
          ),
          const SizedBox(height: 16),
          Center(
            child: ElevatedButton(
              onPressed: _loadPointsDashboard,
              child: const Text('Reintentar'),
            ),
          ),
        ],
      );
    }

    final dashboard = _dashboard;
    if (dashboard == null) {
      return const SizedBox.shrink();
    }

    final canjeProofs = dashboard.history
        .where((item) => item.redeemDetail != null || item.type == 'canjeado')
        .toList();
    final filteredCatalog = dashboard.catalog.where((reward) {
      final byType = _catalogFilterType == _CatalogFilterType.all
          ? true
          : _catalogFilterType == _CatalogFilterType.productos
              ? reward.type == 'producto_farmacia'
              : reward.type == 'cupon_externo';

      final q = _catalogSearchQuery.trim().toLowerCase();
      if (q.isEmpty) return byType;

      final haystack = '${reward.name} ${reward.description} ${reward.type}'.toLowerCase();
      return byType && haystack.contains(q);
    }).toList();

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 30),
      children: [
        _PointsHeroCard(dashboard: dashboard),
        const SizedBox(height: 18),
        _RuleSummaryCard(configuration: dashboard.configuration),
        const SizedBox(height: 20),
        _PointsSegmentedControl(
          activeTab: _activeTab,
          onChanged: (tab) => setState(() => _activeTab = tab),
        ),
        const SizedBox(height: 18),
        if (_activeTab == _PointsPageTab.catalogo) ...[
          _SectionTitle(
            title: 'Catalogo de canje',
            subtitle: 'Canjea recompensas o revisa cuántos puntos te faltan.',
          ),
          const SizedBox(height: 12),
          _CatalogFilterBar(
            searchQuery: _catalogSearchQuery,
            selectedType: _catalogFilterType,
            onSearchChanged: (value) => setState(() => _catalogSearchQuery = value),
            onTypeChanged: (value) => setState(() => _catalogFilterType = value),
          ),
          const SizedBox(height: 12),
          if (filteredCatalog.isEmpty)
            const _EmptyStateCard(
              icon: Icons.card_giftcard_rounded,
              title: 'No hay resultados en el catálogo',
              subtitle: 'Prueba con otro filtro o cambia la búsqueda.',
            )
          else
            ...filteredCatalog.map(
              (reward) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _RewardCard(
                  reward: reward,
                  availablePoints: dashboard.account.availablePoints,
                  redeeming: _redeeming,
                  onRedeem: () => _redeemReward(reward),
                ),
              ),
            ),
        ] else if (_activeTab == _PointsPageTab.canjes) ...[
          _SectionTitle(
            title: 'Mis canjes',
            subtitle: 'Muestra este comprobante en farmacia para recoger tu premio.',
          ),
          const SizedBox(height: 12),
          if (canjeProofs.isEmpty)
            const _EmptyStateCard(
              icon: Icons.qr_code_2_rounded,
              title: 'Todavia no hiciste canjes',
              subtitle: 'Cuando canjees una recompensa, aqui veras el codigo y estado.',
            )
          else
            ...canjeProofs.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _RedeemProofCard(item: item),
              ),
            ),
        ] else ...[
          _SectionTitle(
            title: 'Historial',
            subtitle: 'Consulta todos tus movimientos de puntos.',
          ),
          const SizedBox(height: 12),
          if (dashboard.history.isEmpty)
            const _EmptyStateCard(
              icon: Icons.history_toggle_off_rounded,
              title: 'Todavia no tienes movimientos',
              subtitle: 'Cuando compres o canjees recompensas, apareceran aqui.',
            )
          else
            ...dashboard.history.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _HistoryMovementCard(item: item),
              ),
            ),
        ],
      ],
    );
  }
}

enum _PointsPageTab { catalogo, canjes, historial }

enum _CatalogFilterType { all, productos, cupones }

class _CatalogFilterBar extends StatelessWidget {
  const _CatalogFilterBar({
    required this.searchQuery,
    required this.selectedType,
    required this.onSearchChanged,
    required this.onTypeChanged,
  });

  final String searchQuery;
  final _CatalogFilterType selectedType;
  final ValueChanged<String> onSearchChanged;
  final ValueChanged<_CatalogFilterType> onTypeChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TextField(
          onChanged: onSearchChanged,
          decoration: InputDecoration(
            hintText: 'Buscar recompensa...',
            prefixIcon: const Icon(Icons.search_rounded),
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFE0E3E1)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFE0E3E1)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFF006A5E)),
            ),
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _FilterChipButton(
                label: 'Todos',
                active: selectedType == _CatalogFilterType.all,
                onTap: () => onTypeChanged(_CatalogFilterType.all),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _FilterChipButton(
                label: 'Productos',
                active: selectedType == _CatalogFilterType.productos,
                onTap: () => onTypeChanged(_CatalogFilterType.productos),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _FilterChipButton(
                label: 'Cupones',
                active: selectedType == _CatalogFilterType.cupones,
                onTap: () => onTypeChanged(_CatalogFilterType.cupones),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _FilterChipButton extends StatelessWidget {
  const _FilterChipButton({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? const Color(0xFF006A5E) : Colors.white,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Center(
            child: Text(
              label,
              style: GoogleFonts.manrope(
                fontWeight: FontWeight.w700,
                fontSize: 12,
                color: active ? Colors.white : const Color(0xFF3E4946),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PointsSegmentedControl extends StatelessWidget {
  const _PointsSegmentedControl({
    required this.activeTab,
    required this.onChanged,
  });

  final _PointsPageTab activeTab;
  final ValueChanged<_PointsPageTab> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFFF0F2F1),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Expanded(
            child: _SegmentButton(
              label: 'Catalogo',
              active: activeTab == _PointsPageTab.catalogo,
              onTap: () => onChanged(_PointsPageTab.catalogo),
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: _SegmentButton(
              label: 'Mis canjes',
              active: activeTab == _PointsPageTab.canjes,
              onTap: () => onChanged(_PointsPageTab.canjes),
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: _SegmentButton(
              label: 'Historial',
              active: activeTab == _PointsPageTab.historial,
              onTap: () => onChanged(_PointsPageTab.historial),
            ),
          ),
        ],
      ),
    );
  }
}

class _SegmentButton extends StatelessWidget {
  const _SegmentButton({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? Colors.white : Colors.transparent,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Center(
            child: Text(
              label,
              style: GoogleFonts.manrope(
                fontWeight: FontWeight.w700,
                fontSize: 13,
                color: active ? const Color(0xFF191C1C) : const Color(0xFF6F7977),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PointsHeroCard extends StatelessWidget {
  const _PointsHeroCard({required this.dashboard});

  final CustomerPointsDashboard dashboard;

  @override
  Widget build(BuildContext context) {
    final account = dashboard.account;
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          colors: [Color(0xFFB76E00), Color(0xFFE49A1D)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFB76E00).withOpacity(0.24),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.18),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              'Nivel ${account.level.toUpperCase()}',
              style: GoogleFonts.manrope(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 11,
                letterSpacing: 0.5,
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            '${account.availablePoints}',
            style: GoogleFonts.manrope(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 40,
            ),
          ),
          Text(
            'puntos disponibles',
            style: GoogleFonts.manrope(
              color: Colors.white.withOpacity(0.92),
              fontWeight: FontWeight.w600,
              fontSize: 15,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: _HeroStat(label: 'Ganados', value: '${account.accumulatedPoints}'),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _HeroStat(label: 'Canjeados', value: '${account.redeemedPoints}'),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _HeroStat(label: 'Expirados', value: '${account.expiredPoints}'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.14),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: GoogleFonts.manrope(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: GoogleFonts.manrope(
              color: Colors.white.withOpacity(0.92),
              fontWeight: FontWeight.w600,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}

class _RuleSummaryCard extends StatelessWidget {
  const _RuleSummaryCard({required this.configuration});

  final CustomerPointsConfiguration configuration;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE0E3E1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Como funciona',
            style: GoogleFonts.manrope(
              fontWeight: FontWeight.w800,
              fontSize: 17,
              color: const Color(0xFF191C1C),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            configuration.active
                ? 'Acumulas 1 punto por cada Bs ${configuration.bolivianosPerPoint.toStringAsFixed(2)}. Puedes canjear desde ${configuration.minimumRedeemPoints} puntos.'
                : 'El programa de puntos esta temporalmente desactivado para este tenant.',
            style: GoogleFonts.manrope(
              color: const Color(0xFF5A6562),
              height: 1.5,
            ),
          ),
          if (configuration.expirationDays > 0) ...[
            const SizedBox(height: 8),
            Text(
              'Tus puntos vencen despues de ${configuration.expirationDays} dias sin uso.',
              style: GoogleFonts.manrope(
                color: const Color(0xFF6F7977),
                fontSize: 13,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: GoogleFonts.manrope(
            fontWeight: FontWeight.w800,
            fontSize: 20,
            color: const Color(0xFF191C1C),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: GoogleFonts.manrope(
            color: const Color(0xFF6F7977),
            fontSize: 13,
          ),
        ),
      ],
    );
  }
}

class _RewardCard extends StatelessWidget {
  const _RewardCard({
    required this.reward,
    required this.availablePoints,
    required this.redeeming,
    required this.onRedeem,
  });

  final CustomerRewardItem reward;
  final int availablePoints;
  final bool redeeming;
  final VoidCallback onRedeem;

  String _typeLabel() {
    switch (reward.type) {
      case 'descuento_compra':
        return 'Descuento';
      case 'producto_farmacia':
        return 'Producto';
      case 'cupon_externo':
        return 'Cupon';
      default:
        return reward.type;
    }
  }

  String _stockLabel() {
    if (reward.unlimitedStock) return 'Stock ilimitado';
    if (reward.stockAvailable <= 0) return 'Sin stock';
    return 'Stock ${reward.stockAvailable}';
  }

  String _pointsStatus() {
    final missing = reward.pointsRequired - availablePoints;
    if (missing <= 0) return 'Disponible para canje';
    return 'Te faltan $missing puntos';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE0E3E1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF3E0),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  _typeLabel(),
                  style: GoogleFonts.manrope(
                    color: const Color(0xFFB76E00),
                    fontWeight: FontWeight.w800,
                    fontSize: 11,
                  ),
                ),
              ),
              const Spacer(),
              Text(
                '${reward.pointsRequired} pts',
                style: GoogleFonts.manrope(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                  color: const Color(0xFF006A5E),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            reward.name,
            style: GoogleFonts.manrope(
              fontWeight: FontWeight.w800,
              fontSize: 16,
              color: const Color(0xFF191C1C),
            ),
          ),
          if (reward.description.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              reward.description,
              style: GoogleFonts.manrope(
                color: const Color(0xFF5A6562),
                height: 1.45,
              ),
            ),
          ],
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _ChipLabel(label: _stockLabel()),
              _ChipLabel(label: _pointsStatus()),
              if (reward.discountBs > 0)
                _ChipLabel(label: 'Bs ${reward.discountBs.toStringAsFixed(2)} de descuento'),
              if (reward.validUntil != null)
                _ChipLabel(label: 'Vence ${_formatDate(reward.validUntil!)}'),
            ],
          ),
          if (reward.instructions.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              reward.instructions,
              style: GoogleFonts.manrope(
                color: const Color(0xFF6F7977),
                fontSize: 12,
                height: 1.45,
              ),
            ),
          ],
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: redeeming || reward.stockAvailable == 0 || availablePoints < reward.pointsRequired ? null : onRedeem,
              icon: redeeming
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.redeem_rounded),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF006A5E),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              label: Text(
                reward.stockAvailable == 0
                    ? 'Sin stock para canje'
                    : availablePoints < reward.pointsRequired
                        ? 'Necesitas mas puntos'
                        : 'Canjear recompensa',
                style: GoogleFonts.manrope(fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }

  static String _formatDate(DateTime value) {
    String two(int number) => number.toString().padLeft(2, '0');
    return '${two(value.day)}/${two(value.month)}/${value.year}';
  }
}

class _ChipLabel extends StatelessWidget {
  const _ChipLabel({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFF3F5F4),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: GoogleFonts.manrope(
          color: const Color(0xFF5A6562),
          fontWeight: FontWeight.w700,
          fontSize: 11,
        ),
      ),
    );
  }
}

class _RedeemProofCard extends StatelessWidget {
  const _RedeemProofCard({required this.item});

  final CustomerPointsTransaction item;

  CustomerRedeemDetail? get _detail => item.redeemDetail;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE0E3E1)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFFFFF3E0),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.qr_code_2_rounded, color: Color(0xFFB76E00)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _detail?.rewardName.isNotEmpty == true ? _detail!.rewardName : 'Canje realizado',
                        style: GoogleFonts.manrope(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                          color: const Color(0xFF191C1C),
                        ),
                      ),
                    ),
                    _StatusBadge(status: _detail?.status ?? 'pendiente'),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  'Codigo: ${_detail?.voucherCode.isNotEmpty == true ? _detail!.voucherCode : 'Pendiente'}',
                  style: GoogleFonts.manrope(
                    color: const Color(0xFF3E4946),
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  item.description.isEmpty ? 'Presenta este comprobante en farmacia para tu entrega.' : item.description,
                  style: GoogleFonts.manrope(
                    color: const Color(0xFF6F7977),
                    fontSize: 12,
                    height: 1.45,
                  ),
                ),
                if ((_detail?.createdAt ?? item.createdAt) != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    _formatDateTime((_detail?.createdAt ?? item.createdAt)!),
                    style: GoogleFonts.manrope(
                      color: const Color(0xFF9AA5A1),
                      fontSize: 11,
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _ChipLabel(label: 'Puntos usados ${_detail?.usedPoints ?? item.points.abs()}'),
                    _ChipLabel(label: 'Saldo ${item.resultingBalance}'),
                  ],
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: () async {
                    final code = _detail?.voucherCode.trim() ?? '';
                    if (code.isEmpty) return;
                    await Clipboard.setData(ClipboardData(text: code));
                  },
                  icon: const Icon(Icons.copy_rounded, size: 16),
                  label: Text(
                    'Copiar codigo',
                    style: GoogleFonts.manrope(fontWeight: FontWeight.w700),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFE4E7E5)),
                    foregroundColor: const Color(0xFF006A5E),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _formatDateTime(DateTime value) {
    final local = value.toLocal();
    String two(int number) => number.toString().padLeft(2, '0');
    return '${two(local.day)}/${two(local.month)}/${local.year} ${two(local.hour)}:${two(local.minute)}';
  }
}

class _HistoryMovementCard extends StatelessWidget {
  const _HistoryMovementCard({required this.item});

  final CustomerPointsTransaction item;

  bool get _isPositive => item.points >= 0;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE0E3E1)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: _isPositive ? const Color(0xFFEAF8F4) : const Color(0xFFFFE9E8),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              _isPositive ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
              color: _isPositive ? const Color(0xFF006A5E) : const Color(0xFFBA1A1A),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _labelForType(item.type),
                  style: GoogleFonts.manrope(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                    color: const Color(0xFF191C1C),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  item.description.isEmpty ? 'Movimiento registrado en tu cuenta.' : item.description,
                  style: GoogleFonts.manrope(
                    color: const Color(0xFF6F7977),
                    fontSize: 12,
                    height: 1.45,
                  ),
                ),
                if (item.createdAt != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    _formatDateTime(item.createdAt!),
                    style: GoogleFonts.manrope(
                      color: const Color(0xFF9AA5A1),
                      fontSize: 11,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${_isPositive ? '+' : ''}${item.points}',
                style: GoogleFonts.manrope(
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                  color: _isPositive ? const Color(0xFF006A5E) : const Color(0xFFBA1A1A),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Saldo ${item.resultingBalance}',
                style: GoogleFonts.manrope(
                  color: const Color(0xFF6F7977),
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _labelForType(String type) {
    switch (type) {
      case 'ganado':
        return 'Puntos ganados';
      case 'canjeado':
        return 'Canje realizado';
      case 'expirado':
        return 'Puntos expirados';
      case 'ajuste':
        return 'Ajuste manual';
      case 'reverso':
        return 'Reverso';
      default:
        return type;
    }
  }

  static String _formatDateTime(DateTime value) {
    final local = value.toLocal();
    String two(int number) => number.toString().padLeft(2, '0');
    return '${two(local.day)}/${two(local.month)}/${local.year} ${two(local.hour)}:${two(local.minute)}';
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final normalized = status.toLowerCase();
    final isApplied = normalized == 'aplicado';
    final isPending = normalized == 'pendiente';

    Color bg;
    Color fg;
    String label;

    if (isApplied) {
      bg = const Color(0xFFEAF8F4);
      fg = const Color(0xFF006A5E);
      label = 'Aplicado';
    } else if (isPending) {
      bg = const Color(0xFFFFF3E0);
      fg = const Color(0xFFB76E00);
      label = 'Pendiente';
    } else {
      bg = const Color(0xFFFFE9E8);
      fg = const Color(0xFFBA1A1A);
      label = status.isEmpty ? 'Pendiente' : status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: GoogleFonts.manrope(
          color: fg,
          fontWeight: FontWeight.w800,
          fontSize: 11,
        ),
      ),
    );
  }
}

class _EmptyStateCard extends StatelessWidget {
  const _EmptyStateCard({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE0E3E1)),
      ),
      child: Column(
        children: [
          Icon(icon, size: 44, color: const Color(0xFFBDC9C5)),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: GoogleFonts.manrope(
              fontWeight: FontWeight.w800,
              fontSize: 16,
              color: const Color(0xFF3E4946),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: GoogleFonts.manrope(
              color: const Color(0xFF6F7977),
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}