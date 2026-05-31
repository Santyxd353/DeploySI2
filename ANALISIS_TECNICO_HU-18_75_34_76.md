# Análisis Técnico Detallado: HU-18, HU-75, HU-34, HU-76

**Documento de Arquitectura y Decisiones Técnicas**  
**Fecha:** 30 de mayo de 2026  
**Estado:** Listo para Arquitectos/Revisores

---

## 📐 Decisiones Arquitectónicas

### 1. Modelo Tenant-Aware para HU-34 y HU-76

#### Decisión: ✅ Usar `TenantAwareModel` para CampanaPublicitaria y LimiteDispensacion

**Justificación:**
- Multi-tenant SaaS: cada farmacia debe tener sus propias promociones y límites
- Seguridad: datos de farmacia A nunca visibles en farmacia B
- Escalabilidad: soporta N farmacias sin modificar código

**Implementación:**
```python
class CampanaPublicitaria(TenantAwareModel):
    # Hereda tenant_id automáticamente
    # QuerySet filtrada por tenant en permisos
    pass

class LimiteDispensacion(TenantAwareModel):
    # Cada producto tiene límites por tenant
    pass
```

**Alternativas consideradas:**
- ❌ Campo manual `tenant_id` en modelo → requiere migración si se cambia estructura
- ❌ Tablespace de BD separada → más complejo de mantener
- ✅ TenantAwareModel → patrón establecido en proyecto

---

### 2. Validación de Límites de Dispensación en Service, No en Model

#### Decisión: ✅ Validación en `_validar_limites_dispensacion()` dentro de `crear_venta_service()`

**Justificación:**
```python
# ✅ BUENO: En service (transacción atómica)
@transaction.atomic
def crear_venta_service(...):
    _validar_limites_dispensacion(cliente, cantidades, productos_map)
    # Si falla aquí, toda la transacción se revierte
    crear_venta()
```

**vs**

```python
# ❌ MALO: En model.save()
class Venta(models.Model):
    def save(self, *args, **kwargs):
        _validar_limites_dispensacion()  # No es transaccional
        super().save()
```

**Ventajas:**
- Transacción atómica: si falla validación, se revierte TODO (venta, stock, factura)
- Contexto completo: tenemos acceso a todos los items, cliente, etc.
- Rollback garantizado: `@transaction.atomic` lo asegura
- Errores claros: `VentaServiceError` con código y mensaje específico

---

### 3. OneToOne vs ManyToMany para LimiteDispensacion

#### Decisión: ✅ OneToOne (Producto → LimiteDispensacion)

**Justificación:**
```python
class LimiteDispensacion(TenantAwareModel):
    producto = models.OneToOneField(
        Producto,
        on_delete=models.CASCADE,
        related_name="limite_dispensacion"  # producto.limite_dispensacion
    )
```

**Razón:**
- Cada medicamento tiene 1 límite legal
- No múltiples límites por producto
- Consultas rápidas: `producto.limite_dispensacion` (direct access)
- Si no existe, es `None` (OK)

**Vs ManyToMany:**
- ❌ Más lento (JOIN)
- ❌ Más complejo (através de tabla intermedia)
- ❌ Semánticamente incorrecto (1:1 relationship)

---

### 4. Almacenamiento de Firmas Digitales

#### Decisión: ✅ ImageField + S3/Almacenamiento Local

**Campos agregados:**
```python
class RecetaMedica(TenantAwareModel):
    firma_digital = models.ImageField(
        upload_to="firmas_recetas/",  # /media/firmas_recetas/{uuid}.jpg
        null=True,
        blank=True
    )

class MedicoReceta(models.Model):
    firma_imagen = models.ImageField(
        upload_to="firmas_medicos/",
        blank=True,
        null=True
    )
```

**Validaciones en Serializer:**
```python
def validate_firma_digital(self, value):
    if not value:
        return value
    # Solo JPG/PNG
    allowed = {"jpg", "jpeg", "png"}
    ext = value.name.rsplit(".", 1)[-1].lower()
    if ext not in allowed:
        raise serializers.ValidationError(
            "La firma digital debe ser JPG o PNG."
        )
    # Máximo 5 MB
    if value.size > 5 * 1024 * 1024:
        raise serializers.ValidationError(
            "La firma digital no puede superar los 5 MB."
        )
    return value
```

**Ventajas:**
- ✅ Django maneja ruta y acceso automáticamente
- ✅ Validación de formato/tamaño en serializer
- ✅ URLs generadas automáticamente (`request.build_absolute_uri()`)
- ✅ Compatible con S3/CloudStorage en producción

**Vs alternativas:**
- ❌ Base64 en la BD → hincha BD, lenta
- ❌ Almacenamiento externo con URL → pérdida de imagen si servicio cae
- ✅ ImageField con almacenamiento local/S3 → estándar Django

---

### 5. Segmentación RFM con ManyToMany

#### Decisión: ✅ ManyToMany (CampanaPublicitaria ↔ SegmentoRFM)

**Estructura:**
```python
class CampanaPublicitaria(TenantAwareModel):
    segmentos = models.ManyToManyField(
        SegmentoRFM,
        blank=True,
        related_name="campanas"
    )

# Uso:
campana.segmentos.add(segmento_champions, segmento_frecuentes)
campana.segmentos.all()  # [champions, frecuentes]
cliente_segmentos = clasificar_cliente_rfm(cliente)  # [champions]
campana.segmentos.filter(pk__in=cliente_segmentos).exists()  # True
```

**Justificación:**
- Una campaña aplica a múltiples segmentos
- Un segmento tiene múltiples campañas
- M2M es la estructura correcta
- Consultas rápidas con `filter()` y `exists()`

---

### 6. RBAC: Permisos vs Roles

#### Decisión: ✅ Sistema Hybrid (Roles + Permisos)

**Implementación:**
```python
# En views.py
def get_permissions(self):
    if self.action in ("create", "update", "destroy", "validar"):
        return [IsAuthenticated(), IsPharmacistOrAdmin()]
    return [IsAuthenticated()]

# IsPharmacistOrAdmin checks:
class IsPharmacistOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = obtener_rol_usuario(request.user)
        return role in (ROLE_ADMIN, ROLE_FARMACEUTICO)

# Para filtros más finos (RBAC):
from core.rbac import tiene_permiso
can_see_all = tiene_permiso(request.user, "ventas.ver", tenant=tenant)
```

**Ventajas:**
- ✅ Roles simples (admin, farmacéutico, cliente, cajero)
- ✅ Permisos granulares para lógica específica
- ✅ Escalable: agregar permiso sin modificar vistas
- ✅ Auditabilidad: cada acción registrada con rol/permiso

---

## 🗂️ Estructura de Carpetas y Responsabilidades

### Backend

```
backend/src/
├── ventas/
│   ├── services.py          ← crear_venta_service(), _validar_limites_dispensacion()
│   ├── views.py             ← listar_historial_ventas(), crear_venta_fisica(), crear_venta_online()
│   ├── models.py            ← Venta, DetalleVenta, Factura
│   └── serializers.py       ← VentaSerializer, DetalleVentaSerializer
│
├── clientes/
│   ├── models.py            ← RecetaMedica (con firma_digital, fecha_validez), MedicoReceta
│   ├── views.py             ← RecetaMedicaViewSet.validar()
│   ├── serializers.py       ← RecetaMedicaSerializer, MedicoRecetaSerializer
│   └── migrations/
│       ├── 0005_medicoreceta.py
│       └── 0006_recetamedica_firma_digital_fecha_validez.py
│
├── inventarios/
│   ├── models.py            ← LimiteDispensacion (nuevo)
│   ├── views.py             ← LimiteDispensacionViewSet (CRUD)
│   ├── serializers.py       ← LimiteDispensacionSerializer
│   └── services/
│       └── stock_service.py ← descontar_stock(), aumentar_stock()
│
├── publicidad/
│   ├── models.py            ← CampanaPublicitaria, SegmentoRFM
│   ├── views.py             ← CampanaPublicitariaViewSet (CRUD)
│   └── serializers.py       ← CampanaPublicitariaSerializer
│
├── core/
│   ├── permissions.py       ← IsPharmacistOrAdmin
│   ├── rbac.py              ← obtener_rol_usuario(), tiene_permiso()
│   └── audit.py             ← log_system_event()
└── carrito/
    └── services.py          ← (aplicar_promocion() - future)
```

### Frontend

```
frontend/src/
├── pages/
│   ├── MisComprasPage.jsx                       ← HU-18: Cliente
│   └── admin/
│       ├── AdminPublicidadPage.jsx              ← HU-34: Campañas
│       ├── AdminLimitesDispensacionPage.jsx     ← HU-76: Límites
│       └── RecetasPage.jsx                      ← HU-75: Recetas
│
├── components/crm/
│   ├── HistorialComprasPanel.jsx                ← HU-18: Tabla pagina ventas
│   ├── ValidarRecetaModal.jsx                   ← HU-75: Modal validación
│   ├── RecetasListPanel.jsx                     ← HU-75: Lista recetas
│   └── RecetaMedicaFormModal.jsx                ← HU-75: Formulario receta
│
└── services/
    ├── ventasService.js                         ← historialVentas()
    ├── publicidadService.js                     ← CRUD campañas
    └── inventarioService.js
        └── limitesDispensacionService           ← CRUD límites
```

---

## 🔄 Flujos de Datos Detallados

### HU-18: Historial de Ventas - Flujo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENTE ROLE_CLIENTE                                            │
│ URL: /perfil/mis-compras                                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ MisComprasPage.jsx               │
        │ - Obtiene user de AuthContext    │
        │ - Renderiza HistorialComprasPanel│
        └──────────┬───────────────────────┘
                   │
                   ▼
        ┌──────────────────────────────────────────────┐
        │ HistorialComprasPanel.jsx                    │
        │ - useCallback para filtros (estado)          │
        │ - useState: page, estado, pageSize           │
        │ - Tabla con expansible por venta             │
        │ - DetalleVenta mostrados si expandido        │
        └──────────┬──────────────────────────────────┘
                   │
                   ▼ useEffect (dependencies: page, estado)
        ┌──────────────────────────────────────────────┐
        │ ventasService.historialVentas({              │
        │   page: 1,                                   │
        │   page_size: 10,                             │
        │   estado: "pagada" (opcional)                │
        │ })                                           │
        └──────────┬──────────────────────────────────┘
                   │
         requestJsonWithAuthRetry (headers automáticos)
                   │
                   ▼
        ┌──────────────────────────────────────────────┐
        │ GET /api/ventas/historial/                   │
        │ ?page=1&page_size=10&estado=pagada           │
        │                                               │
        │ Headers:                                      │
        │ - Authorization: Bearer <JWT>                │
        │ - X-Tenant-ID: <tenant_from_jwt>            │
        └──────────┬──────────────────────────────────┘
                   │
                   ▼ BACKEND
        ┌──────────────────────────────────────────────┐
        │ listar_historial_ventas(request)             │
        │ @api_view(["GET"])                           │
        │ @permission_classes([IsAuthenticated])       │
        └──────────┬──────────────────────────────────┘
                   │
                   ├─ tiene_permiso(user, "ventas.ver")?
                   │  ├─ NO → ventas_qs = Venta.objects.filter(cliente__usuario=user)
                   │  └─ SÍ → ventas_qs = Venta.objects.all()
                   │
                   ├─ Filter: estado (if provided)
                   ├─ Filter: fecha_desde (if provided)
                   ├─ Filter: fecha_hasta (if provided)
                   │
                   ├─ Agregaciones:
                   │  ├─ Sum(total) → total_gastado
                   │  ├─ Count(id) → num_compras
                   │  └─ Max(created_at) → ultima_compra
                   │
                   ├─ Productos frecuentes:
                   │  ├─ DetalleVenta.objects.filter(venta__in=ventas_qs, estado="pagada")
                   │  ├─ .values("producto__nombre")
                   │  ├─ .annotate(veces_comprado=Count("id"))
                   │  └─ .order_by("-veces_comprado")[:5]
                   │
                   ├─ Paginación:
                   │  ├─ page = (page - 1) * page_size
                   │  ├─ end = page + page_size
                   │  └─ ventas_page = ventas_qs[page:end]
                   │
                   └─ select_related("factura", "cliente")
                   └─ prefetch_related("detalles__producto")
                   
                   ▼
        ┌──────────────────────────────────────────────┐
        │ Response {                                    │
        │   count: 42,                                 │
        │   page: 1,                                   │
        │   page_size: 10,                             │
        │   next: "/api/ventas/historial/?page=2",     │
        │   previous: null,                            │
        │   results: [                                 │
        │     {                                        │
        │       id: 1,                                 │
        │       cliente_id: 5,                         │
        │       estado: "pagada",                      │
        │       total: "250.50",                       │
        │       created_at: "2026-05-28T14:30:00Z",    │
        │       detalles: [                            │
        │         { producto: {...}, cantidad: 2, ... }│
        │       ],                                     │
        │       factura: { numero: "000001", ... }     │
        │     },                                       │
        │     ...                                      │
        │   ],                                         │
        │   resumen: {                                 │
        │     total_gastado: 1250.50,                  │
        │     num_compras: 5,                          │
        │     promedio_por_compra: 250.10,             │
        │     ultima_compra: "2026-05-28T14:30:00Z"    │
        │   },                                         │
        │   productos_frecuentes: [                    │
        │     { nombre: "Paracetamol", veces: 3, ... }│
        │   ]                                          │
        │ }                                            │
        └──────────┬──────────────────────────────────┘
                   │
                   ▼ setVentas(response.results)
        ┌──────────────────────────────────────────────┐
        │ Renderizar tabla:                            │
        │ - Header: fechas, totales, estado, origen    │
        │ - Rows expandibles: mostrar items            │
        │ - Paginación: Previous/Next buttons          │
        │ - Filtros: Select estado                     │
        │ - Resumen: total_gastado, num_compras, etc   │
        └──────────────────────────────────────────────┘
```

### HU-75: Firma y Validación de Receta

```
FARMACÉUTICO accede a AdminRecetas
        │
        ▼
RecetasPage.jsx
    ├─ [RecetasListPanel] → lista recetas pendientes
    │   ├─ clientesService.listarRecetas()
    │   └─ GET /api/clientes/recetas/?estado=pendiente
    │
    └─ Click en receta → [ValidarRecetaModal]
        │
        ├─ Muestra:
        │  ├─ código, fecha_emision, fecha_vencimiento
        │  ├─ fecha_validez ← HU-75 NEW
        │  ├─ archivo (link descarga)
        │  └─ firma_digital (IMG tag) ← HU-75 NEW
        │
        └─ Inputs:
           ├─ Select estado (aprobada/rechazada)
           ├─ Textarea observación
           └─ Botones: [Aprobar] [Rechazar] [Cancelar]

Submit → clientesService.validarReceta(id, estado, observacion)
    │
    ▼ POST /api/clientes/recetas/{id}/validar/
    │  payload: { estado: "aprobada", observacion: "Firma valida" }
    │
    ▼ BACKEND
RecetaMedicaViewSet.validar()
    │
    ├─ Validar receta.estado == "pendiente"
    ├─ Validar estado in ("aprobada", "rechazada")
    │
    ├─ UPDATE receta:
    │  ├─ estado = nuevo_estado
    │  ├─ observacion = observacion
    │  ├─ validada_por = request.user
    │  └─ validada_en = timezone.now()
    │
    └─ Response: RecetaMedicaSerializer(receta)
       ├─ firma_digital_url ← request.build_absolute_uri(firma.url)
       ├─ fecha_validez
       ├─ estado: "aprobada"
       └─ validada_por, validada_en

CUANDO CLIENTE COMPRA MEDICAMENTO CON RECETA:
    │
    ▼ POST /api/ventas/crear_venta_online/
    │  payload: {
    │    items: [{ producto_id: 1, cantidad: 2, receta_id: 5 }]
    │  }
    │
    ▼ BACKEND crear_venta_service()
    │
    ├─ Validar producto.requiere_receta == True
    ├─ Obtener receta por receta_id
    ├─ Validar receta.cliente_id == cliente.id
    ├─ Validar receta.estado == "aprobada"
    ├─ Validar receta.fecha_vencimiento >= hoy
    │   (fecha_vencimiento es el vencimiento de la receta médica)
    │   (fecha_validez es opcional, para validez extendida)
    │
    └─ Si todo OK → crear venta, detalles, factura
```

### HU-76: Validación de Límites de Dispensación

```
CLIENTE intenta comprar medicamento controlado
        │
        ▼ POST /api/ventas/crear_venta_online/
        │  {
        │    items: [{
        │      producto_id: 123,  # ej: Ranitidina (controlado)
        │      cantidad: 3,
        │      receta_id: 456
        │    }]
        │  }
        │
        ▼ BACKEND crear_venta_service()
        │
        ├─ Validar productos existen y activos
        ├─ Validar recetas (HU-75)
        ├─ Validar stock disponible
        │
        ├─ _validar_limites_dispensacion(cliente, cantidades, productos)
        │   │
        │   ├─ Obtener LimiteDispensacion para producto 123
        │   │  ├─ cantidad_maxima: 2
        │   │  └─ periodo_dias: 30
        │   │
        │   ├─ Calcular ventana temporal:
        │   │  └─ fecha_inicio = now() - 30 days
        │   │
        │   ├─ Sumar dispensado en período:
        │   │  SELECT SUM(cantidad)
        │   │  WHERE producto_id = 123
        │   │    AND cliente_id = 5
        │   │    AND estado IN ("pagada", "entregada")
        │   │    AND created_at >= fecha_inicio
        │   │
        │   │  Resultado: ya_dispensado = 1 (1 unidad vendida hace 5 días)
        │   │
        │   ├─ Validar límite:
        │   │  total_solicitado = 1 (ya) + 3 (nuevo) = 4
        │   │  máximo = 2
        │   │  4 > 2 → EXCEDE
        │   │
        │   └─ Lanzar VentaServiceError(
        │       "Límite de dispensación excedido para 'Ranitidina 150mg'. "
        │       "Puede dispensar hasta 2 unidad(es) cada 30 días. "
        │       "Ya dispensó 1 — disponible: 1 unidad(es).",
        │       code="limite_dispensacion_excedido"
        │     )
        │
        ▼ Response 400 Bad Request
        │ {
        │   "error": "Límite de dispensación excedido...",
        │   "code": "limite_dispensacion_excedido"
        │ }
        │
        ▼ CLIENTE ve error en carrito
           [AlertBox] "Límite de dispensación excedido..."
           Reduce cantidad a 1 (total 2)
           Reintenta

POST /api/ventas/crear_venta_online/ (con cantidad ajustada)
    │ items: [{ producto_id: 123, cantidad: 1 }]
    │
    ├─ _validar_limites_dispensacion():
    │  total = 1 (ya) + 1 (nuevo) = 2
    │  máximo = 2
    │  2 <= 2 ✓ PASS
    │
    └─ Venta creada exitosamente
```

---

## 🧬 Decisiones de Base de Datos

### Indización

**Recomendaciones:**
```python
# Ubicación: backend/src/*/models.py Meta.indexes

class Venta(TenantAwareModel):
    class Meta:
        indexes = [
            models.Index(fields=['cliente', '-created_at']),
            models.Index(fields=['estado', '-created_at']),
            models.Index(fields=['tenant', 'cliente']),
        ]

class DetalleVenta(TenantAwareModel):
    class Meta:
        indexes = [
            models.Index(fields=['venta_id']),
            models.Index(fields=['producto_id']),
        ]

class RecetaMedica(TenantAwareModel):
    class Meta:
        indexes = [
            models.Index(fields=['cliente', 'estado']),
            models.Index(fields=['tenant', '-created_at']),
        ]

class LimiteDispensacion(TenantAwareModel):
    class Meta:
        indexes = [
            models.Index(fields=['tenant', 'producto']),
        ]
```

**Razón:** Queries de filtrado/ordenamiento en historial y validaciones necesitan índices.

### Constraints (Integridad)

```python
class RecetaMedica(TenantAwareModel):
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'codigo'],
                name='uq_receta_tenant_codigo'
            ),
        ]
```

**Razón:** Cada receta tiene código único por tenant (no global).

---

## 🔒 Seguridad

### 1. Inyección SQL
- ✅ Django ORM con parametrized queries
- ✅ `filter()`, `exclude()` usan prepared statements
- ✅ Sin string interpolation en queries

### 2. XSS (Cross-Site Scripting)
- ✅ React escapa automáticamente en JSX
- ✅ URLs en `href` no interpretadas como JS
- ✅ Imágenes de firma en `<img src>` seguras (no eval)

### 3. CSRF
- ✅ Django CSRF middleware activo
- ✅ `axios` incluye token CSRF automáticamente (via cookie)

### 4. Autenticación
- ✅ JWT en headers (Authorization: Bearer)
- ✅ Validación en cada endpoint con `@permission_classes`
- ✅ User extraído de token en `request.user`

### 5. Autorización (RBAC)
- ✅ `IsPharmacistOrAdmin()` valida rol en cada operación
- ✅ `tiene_permiso()` para permisos granulares
- ✅ ROLE_CLIENTE solo ve sus propias ventas/recetas

### 6. Datos Sensibles
- ✅ Firmas digitales en almacenamiento (no BD)
- ✅ URLs firmadas para descargas (si se implementa)
- ✅ Logs auditados en `BitacoraSistema` con encriptación

---

## 🚀 Performance

### Query Optimization

**HU-18: Historial de Ventas**
```python
# ❌ LENTO (N+1)
for venta in ventas:
    factura = venta.factura  # Query por cada venta

# ✅ RÁPIDO (select_related)
ventas_qs.select_related("factura", "cliente")

# ✅ RÁPIDO (prefetch_related para M2M)
ventas_qs.prefetch_related("detalles__producto")
```

**HU-75: Validación Receta**
```python
# ✅ RÁPIDO
receta = RecetaMedica.objects.select_related(
    "medico", "validada_por"
).get(id=receta_id)
```

**HU-76: Validación Límites**
```python
# ✅ RÁPIDO: select_for_update() + aggregate
inventarios = Inventario.objects.select_for_update().filter(...)
agg = DetalleVenta.objects.filter(...).aggregate(total=Sum("cantidad"))
```

### Caché Recomendado

```python
# HU-34: Promociones activas (cambian 1x/día)
cache.set("campanas_activas", queryset, timeout=3600)

# HU-76: Límites (cambian raramente)
cache.set("limites_dispensacion", queryset, timeout=86400)
```

---

## 🧪 Casos Edge y Manejo de Errores

### HU-18: Historial sin compras
```python
# Cliente sin ventas
cliente = Cliente.objects.filter(usuario=user).first()
if not cliente:
    return Response({
        "count": 0, "page": 1, "page_size": 10,
        "next": None, "previous": None, "results": [],
        "resumen": {...}
    })
```

### HU-75: Receta vencida
```python
# Validación automática en model.save()
def save(self, *args, **kwargs):
    if (self.fecha_vencimiento < today() 
        and self.estado == "pendiente"):
        self.estado = "vencida"  # Auto-mark as expired
    super().save()
```

### HU-76: Múltiples límites en 1 venta
```python
# Ejemplo: cliente compra 3 productos con límites
productos = [123, 124, 125]  # Ranitidina, Lorazepam, Propranolol

for producto_id, cantidad in cantidades_por_producto.items():
    limite = limites_map.get(producto_id)
    if limite:
        # Valida CADA uno
        if ya_dispensado + cantidad > limite.cantidad_maxima:
            raise VentaServiceError(...)
    else:
        # Sin límite = OK
        pass
```

### HU-34: Promoción vencida
```python
# Validación en backend (no en model.save, en logic)
def obtener_campanas_activas():
    today = timezone.now().date()
    return CampanaPublicitaria.objects.filter(
        activa=True,
        fecha_inicio__lte=today,
        fecha_fin__gte=today
    )
```

---

## 📝 Notas de Implementación

### Migraciones Necesarias (Ya Hechas)

```bash
python manage.py makemigrations clientes
python manage.py makemigrations inventarios
python manage.py makemigrations publicidad
```

### Comandos de Testing Local

```bash
# Test HU-18: historial de ventas
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/ventas/historial/?page=1&estado=pagada"

# Test HU-75: validar receta
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"estado":"aprobada","observacion":"OK"}' \
  http://localhost:8000/api/clientes/recetas/1/validar/

# Test HU-76: crear venta con límite
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "items":[{"producto_id":1,"cantidad":3,"receta_id":1}]
  }' \
  http://localhost:8000/api/ventas/crear_venta_online/
```

---

## 🎓 Lecciones Aprendidas

### ✅ Lo Que Funcionó Bien

1. **Usar `@transaction.atomic`** en operaciones complejas (crear venta)
2. **Validar en service layer**, no en modelo
3. **Tenant-aware desde el inicio** previene problemas de segregación
4. **M2M para segmentos RFM** es semánticamente correcto y escalable
5. **ImageField para firmas** es estándar y validable

### ⚠️ Lo Que Requiere Atención

1. **Aplicación automática de promociones** aún no implementada en carrito
2. **Exportación de historial a PDF** puede ser slow (agregar task async)
3. **Auditoría de firmas digitales** requiere timestamping
4. **Cálculo RFM automático** necesita background task (Celery)

---

**Fin del Análisis Técnico**
