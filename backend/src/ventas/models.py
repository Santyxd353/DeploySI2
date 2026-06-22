from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from tenants.mixins import TenantAwareModel


class Venta(TenantAwareModel):
    ORIGEN_CHOICES = [
        ("fisica", "Venta fisica"),
        ("online", "Venta online"),
    ]

    ESTADO_CHOICES = [
        ("pendiente", "Pendiente"),
        ("pagada", "Pagada"),
        ("preparando", "Preparando"),
        ("entregada", "Entregada"),
        ("cancelada", "Cancelada"),
    ]

    cliente = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.PROTECT,
        related_name="ventas",
    )
    vendedor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ventas_realizadas",
    )
    origen = models.CharField(max_length=10, choices=ORIGEN_CHOICES)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default="pendiente")

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    descuento = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    impuesto = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    total = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    stripe_payment_intent_id = models.CharField(max_length=128, blank=True, null=True, db_index=True)

    observacion = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Venta"
        verbose_name_plural = "Ventas"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "stripe_payment_intent_id"],
                name="uq_venta_tenant_payment_intent",
            ),
        ]

    def __str__(self):
        return f"Venta #{self.pk} - {self.get_origen_display()} - {self.total}"


class DetalleVenta(TenantAwareModel):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name="detalles")
    producto = models.ForeignKey("inventarios.Producto", on_delete=models.PROTECT, related_name="detalles_venta")
    cantidad = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Detalle de venta"
        verbose_name_plural = "Detalles de venta"

    def __str__(self):
        return f"Venta #{self.venta_id} - {self.producto} x{self.cantidad}"
    
class Factura(TenantAwareModel):
    TIPO_CHOICES = [
        ('simple', 'Comprobante simple'),
        ('con_nit', 'Factura con NIT'),
    ]
    
    venta = models.OneToOneField(
        Venta,
        on_delete=models.CASCADE,
        related_name='factura'
    )
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='simple')
    numero_factura = models.CharField(max_length=50, editable=False)
    nombre_cliente = models.CharField(max_length=200)
    email_cliente = models.EmailField()
    nit_ci = models.CharField(max_length=50, blank=True, default='')
    fecha_emision = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Factura'
        verbose_name_plural = 'Facturas'
        ordering = ['-fecha_emision']
        constraints = [
            models.UniqueConstraint(fields=["tenant", "numero_factura"], name="uq_factura_tenant_numero"),
        ]
    
    def save(self, *args, **kwargs):
        if not self.numero_factura:
            # Generar número correlativo: FACT-202500001
            from django.utils import timezone
            last = Factura.objects.order_by('-id').first()
            next_num = (last.id + 1) if last else 1
            year = timezone.now().year
            self.numero_factura = f'FACT-{year}{next_num:06d}'
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f'{self.numero_factura} - {self.nombre_cliente}'
