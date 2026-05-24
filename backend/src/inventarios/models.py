from django.db import models
from django.core.validators import MinValueValidator
from django.conf import settings
from tenants.mixins import TenantAwareModel

class Categoria(TenantAwareModel):
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True)
    estado = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Categoría"
        verbose_name_plural = "Categorías"
        ordering = ["nombre"]
        constraints = [
            models.UniqueConstraint(fields=["tenant", "nombre"], name="uq_categoria_tenant_nombre"),
        ]

    def __str__(self):
        return self.nombre


class Subcategoria(TenantAwareModel):
    categoria = models.ForeignKey(Categoria, on_delete=models.CASCADE, related_name="subcategorias")
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True)
    estado = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Subcategoría"
        verbose_name_plural = "Subcategorías"
        unique_together = ["categoria", "nombre"]
        ordering = ["categoria__nombre", "nombre"]

    def __str__(self):
        return f"{self.categoria.nombre} - {self.nombre}"


class Laboratorio(TenantAwareModel):
    nombre = models.CharField(max_length=150)
    pais = models.CharField(max_length=100, blank=True)
    telefono = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    direccion = models.TextField(blank=True)
    contacto_representante = models.CharField(max_length=100, blank=True)
    estado = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Laboratorio"
        verbose_name_plural = "Laboratorios"
        ordering = ["nombre"]
        constraints = [
            models.UniqueConstraint(fields=["tenant", "nombre"], name="uq_laboratorio_tenant_nombre"),
        ]

    def __str__(self):
        return self.nombre


class Producto(TenantAwareModel):
    FORMA_FARMACEUTICA_CHOICES = [
        ("tableta", "Tableta"),
        ("capsula", "Cápsula"),
        ("jarabe", "Jarabe"),
        ("crema", "Crema"),
        ("gotas", "Gotas"),
        ("inyectable", "Inyectable"),
        ("suspension", "Suspensión"),
        ("polvo", "Polvo"),
    ]

    UNIDAD_MEDIDA_CHOICES = [
        ("unidad", "Unidad"),
        ("caja", "Caja"),
        ("frasco", "Frasco"),
        ("blister", "Blíster"),
        ("ampolla", "Ampolla"),
        ("sobre", "Sobre"),
    ]

    sku = models.CharField(max_length=50, help_text="Código interno único")
    nombre_comercial = models.CharField(max_length=200)
    nombre_generico = models.CharField(max_length=200, blank=True)
    descripcion = models.TextField(blank=True)
    imagen = models.ImageField(upload_to="productos/", null=True, blank=True)

    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT, related_name="productos")
    subcategoria = models.ForeignKey(
        Subcategoria,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="productos",
    )
    laboratorio = models.ForeignKey(Laboratorio, on_delete=models.PROTECT, related_name="productos")

    forma_farmaceutica = models.CharField(max_length=20, choices=FORMA_FARMACEUTICA_CHOICES)
    concentracion = models.CharField(max_length=100, blank=True, help_text="Ej: 500 mg, 100 mg/5 ml")
    presentacion = models.CharField(max_length=100, help_text="Ej: caja x 10, frasco x 120 ml")
    unidad_medida = models.CharField(max_length=20, choices=UNIDAD_MEDIDA_CHOICES)

    precio_compra = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    precio_venta = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    stock_minimo = models.PositiveIntegerField(default=0)

    requiere_receta = models.BooleanField(default=False)
    es_controlado = models.BooleanField(default=False)
    estado = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Producto"
        verbose_name_plural = "Productos"
        ordering = ["nombre_comercial"]
        constraints = [
            models.UniqueConstraint(fields=["tenant", "sku"], name="uq_producto_tenant_sku"),
        ]
        indexes = [
            models.Index(fields=["sku"]),
            models.Index(fields=["nombre_comercial"]),
        ]

    def __str__(self):
        return f"{self.sku} - {self.nombre_comercial}"


class Inventario(TenantAwareModel):
    producto = models.OneToOneField(Producto, on_delete=models.CASCADE, related_name="inventario")
    stock_actual = models.PositiveIntegerField(default=0)
    stock_reservado = models.PositiveIntegerField(default=0)
    stock_minimo = models.PositiveIntegerField(
        default=0,
        help_text="Stock mínimo para este producto (sobrescribe al del producto si es necesario)",
    )
    ultima_entrada_fecha = models.DateTimeField(null=True, blank=True)
    ultima_salida_fecha = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Inventario"
        verbose_name_plural = "Inventarios"

    @property
    def stock_disponible(self):
        return max(0, self.stock_actual - self.stock_reservado)

    @property
    def necesita_reabastecimiento(self):
        return self.stock_actual <= self.stock_minimo

    def __str__(self):
        return f"Inventario - {self.producto.nombre_comercial}: {self.stock_actual} unidades"


class LoteProducto(TenantAwareModel):
    ESTADO_CHOICES = [
        ("disponible", "Disponible"),
        ("agotado", "Agotado"),
        ("vencido", "Vencido"),
        ("bloqueado", "Bloqueado"),
        ("danado", "Dañado"),
        ("retirado", "Retirado"),
    ]

    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name="lotes",
    )
    numero_lote = models.CharField(max_length=100)
    fecha_fabricacion = models.DateField(null=True, blank=True)
    fecha_vencimiento = models.DateField(null=True, blank=True)
    cantidad_inicial = models.PositiveIntegerField(default=0)
    cantidad_disponible = models.PositiveIntegerField(default=0)
    precio_compra = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    proveedor = models.CharField(max_length=200, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default="disponible")
    fecha_ingreso = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Lote de Producto"
        verbose_name_plural = "Lotes de Producto"
        ordering = ["producto", "fecha_vencimiento", "numero_lote"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "producto", "numero_lote"],
                name="uq_loteproducto_tenant_numero_lote",
            ),
        ]

    def __str__(self):
        return f"{self.producto.sku} - {self.numero_lote}"


class MovimientoInventario(TenantAwareModel):
    TIPO_MOVIMIENTO_CHOICES = [
        ("entrada", "Entrada"),
        ("salida", "Salida"),
        ("ajuste", "Ajuste"),
    ]

    MOTIVO_CHOICES = [
        ("compra", "Compra"),
        ("venta", "Venta"),
        ("merma", "Merma"),
        ("ajuste_fisico", "Ajuste físico"),
        ("devolucion_proveedor", "Devolución a proveedor"),
        ("devolucion_cliente", "Devolución de cliente"),
        ("transferencia", "Transferencia"),
    ]

    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name="movimientos",
    )
    lote = models.ForeignKey(
        "LoteProducto",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="movimientos",
    )
    tipo_movimiento = models.CharField(max_length=20, choices=TIPO_MOVIMIENTO_CHOICES)
    cantidad = models.PositiveIntegerField()
    stock_anterior = models.PositiveIntegerField(null=True, blank=True)
    stock_posterior = models.PositiveIntegerField(null=True, blank=True)
    motivo = models.CharField(max_length=20, choices=MOTIVO_CHOICES)
    referencia = models.CharField(max_length=100, blank=True, help_text="N° factura, orden de compra, etc.")
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="movimientos_inventario",
    )
    fecha_movimiento = models.DateTimeField(auto_now_add=True)
    observacion = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Movimiento de Inventario"
        verbose_name_plural = "Movimientos de Inventario"
        ordering = ["-fecha_movimiento"]
        indexes = [
            models.Index(fields=["producto", "fecha_movimiento"]),
            models.Index(fields=["tipo_movimiento"]),
        ]



    def __str__(self):
        return f"{self.get_tipo_movimiento_display()} - {self.producto.sku} x{self.cantidad} - {self.fecha_movimiento}"


class EntradaStock(TenantAwareModel):
    MOTIVOS_CHOICES = [
        ("reposicion", "Reposición Proveedor"),
        ("devolucion", "Devolución de Cliente"),
        ("ajuste", "Ajuste de Inventario"),
        ("correccion", "Corrección de Conteo"),
        ("otro", "Otro"),
    ]
    ESTADO_CHOICES = [
        ("pendiente", "Pendiente"),
        ("confirmada", "Confirmada"),
        ("anulada", "Anulada"),
    ]

    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name="entradas",
    )
    lote = models.ForeignKey(
        "LoteProducto",
        on_delete=models.PROTECT,
        related_name="entradas",
    )
    cantidad = models.PositiveIntegerField()
    motivo = models.CharField(max_length=20, choices=MOTIVOS_CHOICES)
    referencia = models.CharField(max_length=100, blank=True)
    descripcion = models.TextField(blank=True, null=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default="pendiente")
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Entrada de Stock"
        verbose_name_plural = "Entradas de Stock"

    def __str__(self):
        return f"{self.producto.nombre_comercial} - {self.cantidad} unidades ({self.motivo})"






