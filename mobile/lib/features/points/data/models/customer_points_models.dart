class CustomerPointsDashboard {
  const CustomerPointsDashboard({
    required this.account,
    required this.configuration,
    required this.catalog,
    required this.history,
  });

  final CustomerPointsAccount account;
  final CustomerPointsConfiguration configuration;
  final List<CustomerRewardItem> catalog;
  final List<CustomerPointsTransaction> history;
}

class CustomerPointsAccount {
  const CustomerPointsAccount({
    required this.id,
    required this.availablePoints,
    required this.accumulatedPoints,
    required this.redeemedPoints,
    required this.expiredPoints,
    required this.level,
  });

  final int id;
  final int availablePoints;
  final int accumulatedPoints;
  final int redeemedPoints;
  final int expiredPoints;
  final String level;

  factory CustomerPointsAccount.fromJson(Map<String, dynamic> json) {
    return CustomerPointsAccount(
      id: (json['id'] as num?)?.toInt() ?? 0,
      availablePoints: (json['puntos_disponibles'] as num?)?.toInt() ?? 0,
      accumulatedPoints: (json['puntos_acumulados'] as num?)?.toInt() ?? 0,
      redeemedPoints: (json['puntos_canjeados'] as num?)?.toInt() ?? 0,
      expiredPoints: (json['puntos_expirados'] as num?)?.toInt() ?? 0,
      level: (json['nivel'] as String? ?? 'bronce').trim(),
    );
  }
}

class CustomerPointsConfiguration {
  const CustomerPointsConfiguration({
    required this.active,
    required this.bolivianosPerPoint,
    required this.minimumRedeemPoints,
    required this.expirationDays,
  });

  final bool active;
  final double bolivianosPerPoint;
  final int minimumRedeemPoints;
  final int expirationDays;

  factory CustomerPointsConfiguration.fromJson(Map<String, dynamic> json) {
    return CustomerPointsConfiguration(
      active: json['activo'] == true,
      bolivianosPerPoint: double.tryParse(json['bolivianos_por_punto']?.toString() ?? '') ?? 0,
      minimumRedeemPoints: (json['puntos_minimos_canje'] as num?)?.toInt() ?? 0,
      expirationDays: (json['dias_expiracion'] as num?)?.toInt() ?? 0,
    );
  }
}

class CustomerRewardItem {
  const CustomerRewardItem({
    required this.id,
    required this.name,
    required this.type,
    required this.description,
    required this.pointsRequired,
    required this.discountBs,
    required this.stockAvailable,
    required this.instructions,
    required this.externalUrl,
    required this.active,
    this.validUntil,
  });

  final int id;
  final String name;
  final String type;
  final String description;
  final int pointsRequired;
  final double discountBs;
  final int stockAvailable;
  final String instructions;
  final String externalUrl;
  final bool active;
  final DateTime? validUntil;

  bool get unlimitedStock => stockAvailable < 0;

  factory CustomerRewardItem.fromJson(Map<String, dynamic> json) {
    return CustomerRewardItem(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: (json['nombre'] as String? ?? 'Recompensa').trim(),
      type: (json['tipo'] as String? ?? '').trim(),
      description: (json['descripcion'] as String? ?? '').trim(),
      pointsRequired: (json['puntos_requeridos'] as num?)?.toInt() ?? 0,
      discountBs: double.tryParse(json['valor_descuento_bs']?.toString() ?? '') ?? 0,
      stockAvailable: (json['stock_disponible'] as num?)?.toInt() ?? -1,
      instructions: (json['instrucciones_canje'] as String? ?? '').trim(),
      externalUrl: (json['url_externa'] as String? ?? '').trim(),
      active: json['activo'] == true,
      validUntil: DateTime.tryParse(json['valido_hasta']?.toString() ?? ''),
    );
  }
}

class CustomerPointsTransaction {
  const CustomerPointsTransaction({
    required this.id,
    required this.type,
    required this.points,
    required this.resultingBalance,
    required this.description,
    required this.createdAt,
    this.redeemDetail,
  });

  final int id;
  final String type;
  final int points;
  final int resultingBalance;
  final String description;
  final DateTime? createdAt;
  final CustomerRedeemDetail? redeemDetail;

  factory CustomerPointsTransaction.fromJson(Map<String, dynamic> json) {
    return CustomerPointsTransaction(
      id: (json['id'] as num?)?.toInt() ?? 0,
      type: (json['tipo'] as String? ?? '').trim(),
      points: (json['puntos'] as num?)?.toInt() ?? 0,
      resultingBalance: (json['saldo_resultante'] as num?)?.toInt() ?? 0,
      description: (json['descripcion'] as String? ?? '').trim(),
      createdAt: DateTime.tryParse(json['creado_en']?.toString() ?? ''),
      redeemDetail: CustomerRedeemDetail.fromNullableJson(json['canje_detalle']),
    );
  }
}

class CustomerRedeemDetail {
  const CustomerRedeemDetail({
    required this.id,
    required this.voucherCode,
    required this.status,
    required this.usedPoints,
    required this.rewardName,
    required this.rewardType,
    this.createdAt,
    this.appliedAt,
  });

  final int id;
  final String voucherCode;
  final String status;
  final int usedPoints;
  final String rewardName;
  final String rewardType;
  final DateTime? createdAt;
  final DateTime? appliedAt;

  factory CustomerRedeemDetail.fromJson(Map<String, dynamic> json) {
    return CustomerRedeemDetail(
      id: (json['id'] as num?)?.toInt() ?? 0,
      voucherCode: (json['codigo_voucher'] as String? ?? '').trim(),
      status: (json['estado'] as String? ?? '').trim(),
      usedPoints: (json['puntos_usados'] as num?)?.toInt() ?? 0,
      rewardName: (json['catalogo_nombre'] as String? ?? 'Recompensa').trim(),
      rewardType: (json['catalogo_tipo'] as String? ?? '').trim(),
      createdAt: DateTime.tryParse(json['creado_en']?.toString() ?? ''),
      appliedAt: DateTime.tryParse(json['aplicado_en']?.toString() ?? ''),
    );
  }

  static CustomerRedeemDetail? fromNullableJson(dynamic value) {
    if (value is! Map<String, dynamic>) return null;
    return CustomerRedeemDetail.fromJson(value);
  }
}

class CustomerRedeemResult {
  const CustomerRedeemResult({
    required this.rewardName,
    required this.voucherCode,
    required this.usedPoints,
    required this.status,
  });

  final String rewardName;
  final String voucherCode;
  final int usedPoints;
  final String status;

  factory CustomerRedeemResult.fromJson(Map<String, dynamic> json) {
    final reward = json['catalogo_detalle'];
    final rewardMap = reward is Map<String, dynamic> ? reward : const <String, dynamic>{};
    return CustomerRedeemResult(
      rewardName: (rewardMap['nombre'] as String? ?? 'Recompensa').trim(),
      voucherCode: (json['codigo_voucher'] as String? ?? '').trim(),
      usedPoints: (json['puntos_usados'] as num?)?.toInt() ?? 0,
      status: (json['estado'] as String? ?? '').trim(),
    );
  }
}