from decimal import Decimal

from django.db import models

from tenants.mixins import TenantAwareModel


class ConfiguracionPuntos(TenantAwareModel):
    activo = models.BooleanField(default=True)
    bolivianos_por_punto = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("10.00"))
    puntos_minimos_canje = models.PositiveIntegerField(default=100)
    dias_expiracion = models.PositiveIntegerField(default=0)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuracion de puntos"
        verbose_name_plural = "Configuraciones de puntos"
        constraints = [
            models.UniqueConstraint(fields=["tenant"], name="uq_configuracion_puntos_tenant"),
        ]

    def __str__(self):
        return f"Configuracion de puntos - {self.tenant_id}"


class CuentaPuntos(TenantAwareModel):
    NIVEL_CHOICES = [
        ("bronce", "Bronce"),
        ("plata", "Plata"),
        ("oro", "Oro"),
        ("diamante", "Diamante"),
    ]

    cliente = models.OneToOneField(
        "clientes.Cliente",
        on_delete=models.CASCADE,
        related_name="cuenta_puntos",
    )
    puntos_disponibles = models.PositiveIntegerField(default=0)
    puntos_acumulados = models.PositiveIntegerField(default=0)
    puntos_canjeados = models.PositiveIntegerField(default=0)
    puntos_expirados = models.PositiveIntegerField(default=0)
    nivel = models.CharField(max_length=20, choices=NIVEL_CHOICES, default="bronce")
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Cuenta de puntos"
        verbose_name_plural = "Cuentas de puntos"

    def __str__(self):
        return f"Cuenta de puntos - Cliente {self.cliente_id}"


class CatalogoCanje(TenantAwareModel):
    TIPO_CHOICES = [
        ("descuento_compra", "Descuento en compra"),
        ("producto_farmacia", "Producto de farmacia"),
        ("cupon_externo", "Cupon externo"),
    ]

    nombre = models.CharField(max_length=160)
    tipo = models.CharField(max_length=40, choices=TIPO_CHOICES)
    descripcion = models.TextField(blank=True)
    imagen = models.ImageField(upload_to="puntos/canje/", null=True, blank=True)
    puntos_requeridos = models.PositiveIntegerField()
    valor_descuento_bs = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    producto = models.ForeignKey(
        "inventarios.Producto",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="recompensas_puntos",
    )
    codigo_cupon_externo = models.CharField(max_length=120, blank=True)
    instrucciones_canje = models.TextField(blank=True)
    url_externa = models.URLField(blank=True)
    stock_disponible = models.IntegerField(default=-1, help_text="-1 significa ilimitado")
    limite_por_cliente = models.PositiveIntegerField(default=1)
    activo = models.BooleanField(default=True)
    valido_hasta = models.DateField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Catalogo de canje"
        verbose_name_plural = "Catalogo de canjes"
        ordering = ["puntos_requeridos", "nombre"]

    def __str__(self):
        return self.nombre


class CanjePuntos(TenantAwareModel):
    ESTADO_CHOICES = [
        ("pendiente", "Pendiente"),
        ("aplicado", "Aplicado"),
        ("cancelado", "Cancelado"),
    ]

    cuenta = models.ForeignKey(CuentaPuntos, on_delete=models.CASCADE, related_name="canjes")
    catalogo = models.ForeignKey(CatalogoCanje, on_delete=models.PROTECT, related_name="canjes")
    venta = models.ForeignKey(
        "ventas.Venta",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="canjes_puntos",
    )
    codigo_voucher = models.CharField(max_length=40, unique=True)
    puntos_usados = models.PositiveIntegerField()
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default="pendiente")
    observacion = models.TextField(blank=True)
    aplicado_en = models.DateTimeField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Canje de puntos"
        verbose_name_plural = "Canjes de puntos"
        ordering = ["-creado_en"]

    def __str__(self):
        return f"Canje {self.codigo_voucher} - Cliente {self.cuenta.cliente_id}"


class TransaccionPuntos(TenantAwareModel):
    TIPO_CHOICES = [
        ("ganado", "Ganado"),
        ("canjeado", "Canjeado"),
        ("expirado", "Expirado"),
        ("ajuste", "Ajuste"),
        ("reverso", "Reverso"),
    ]

    cuenta = models.ForeignKey(CuentaPuntos, on_delete=models.CASCADE, related_name="transacciones")
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    puntos = models.IntegerField()
    saldo_resultante = models.PositiveIntegerField()
    venta = models.ForeignKey(
        "ventas.Venta",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transacciones_puntos",
    )
    canje = models.ForeignKey(
        CanjePuntos,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transacciones",
    )
    descripcion = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Transaccion de puntos"
        verbose_name_plural = "Transacciones de puntos"
        ordering = ["-creado_en"]

    def __str__(self):
        return f"{self.tipo} {self.puntos} pts - Cuenta {self.cuenta_id}"