# Referencia Rápida: HU-18, HU-75, HU-34, HU-76

**Quick Reference Guide para Desarrolladores**

---

## 📱 Endpoints Backend

### HU-18: Historial de Ventas

```
GET /api/ventas/historial/
  Query Params:
    - page:           int (default: 1)
    - page_size:      int (default: 10, max: 50)
    - cliente_id:     int (admin only)
    - estado:         str (pendiente|pagada|preparando|entregada|cancelada)
    - fecha_desde:    date (YYYY-MM-DD)
    - fecha_hasta:    date (YYYY-MM-DD)
  
  Response: {
    count: int,
    page: int,
    page_size: int,
    next: string|null,
    previous: string|null,
    results: [{
      id: int,
      cliente_id: int,
      estado: str,
      total: decimal,
      created_at: datetime,
      detalles: [{
        producto: {...},
        cantidad: int,
        precio_unitario: decimal,
        subtotal: decimal
      }],
      factura: {numero: str, ...}
    }],
    resumen: {
      total_gastado: decimal,
      num_compras: int,
      promedio_por_compra: decimal,
      ultima_compra: datetime|null
    },
    productos_frecuentes: [{
      nombre: str,
      veces_comprado: int,
      cantidad_total: int
    }]
  }
```

### HU-75: Validación de Recetas

```
POST /api/clientes/recetas/{id}/validar/
  Payload: {
    estado:      "aprobada" | "rechazada",
    observacion: str (optional)
  }
  
  Response: {
    id: int,
    cliente_id: int,
    codigo: str,
    archivo_url: str|null,
    firma_digital_url: str|null,  ← NEW HU-75
    fecha_emision: date,
    fecha_vencimiento: date,
    fecha_validez: date|null,     ← NEW HU-75
    dias_para_vencer: int|null,
    estado: str,
    observacion: str,
    validada_por_id: int,
    validada_en: datetime,
    medico: {
      id: int,
      nombre: str,
      licencia: str,
      especialidad: str,
      firma_imagen_url: str|null
    }
  }

GET /api/clientes/recetas/?estado=pendiente&cliente={id}
  (List endpoint - similar filtering)
```

### HU-76: Límites de Dispensación

```
GET /api/inventarios/limites-dispensacion/
  Query Params:
    - producto:    int (optional)
    - estado:      bool (optional)
  
POST /api/inventarios/limites-dispensacion/
  Payload: {
    producto: int,
    cantidad_maxima: int,
    periodo_dias: int
  }

PUT /api/inventarios/limites-dispensacion/{id}/
  Payload: { cantidad_maxima?, periodo_dias? }

DELETE /api/inventarios/limites-dispensacion/{id}/

GET /api/inventarios/limites-dispensacion/{id}/

Response: {
  id: int,
  producto_id: int,
  cantidad_maxima: int,
  periodo_dias: int,
  created_at: datetime,
  updated_at: datetime
}
```

### HU-34: Campañas Publicitarias

```
GET /api/publicidad/campanas/
  Query Params:
    - segmento:    int (optional)
    - activa:      bool (optional)

POST /api/publicidad/campanas/
  Payload: {
    titulo: str,
    descripcion: str,
    descuento: decimal,
    fecha_inicio: date,
    fecha_fin: date,
    activa: bool,
    segmentos_ids: [int, int, ...],
    imagen: File (optional)
  }

PUT /api/publicidad/campanas/{id}/

DELETE /api/publicidad/campanas/{id}/

Response: {
  id: int,
  titulo: str,
  descripcion: str,
  imagen_url: str|null,
  descuento: decimal,
  segmentos: [{
    id: int,
    codigo: str,
    nombre: str,
    descripcion: str
  }],
  fecha_inicio: date,
  fecha_fin: date,
  activa: bool,
  created_at: datetime,
  updated_at: datetime
}
```

---

## 🔧 Services Frontend (JavaScript)

### ventasService

```javascript
import { ventasService } from "../../services/ventasService";

// Obtener historial de ventas del cliente autenticado
const response = await ventasService.historialVentas({
  page: 1,
  page_size: 10,
  estado: "pagada",  // optional
  fecha_desde: "2026-05-01",  // optional
  fecha_hasta: "2026-05-31"   // optional
});

// response.results[0] = {
//   id, cliente_id, estado, total, created_at,
//   detalles: [{ producto, cantidad, ... }],
//   factura: { numero, ... }
// }
```

### clientesService

```javascript
import { clientesService } from "../../services/clientesService";

// Validar receta
await clientesService.validarReceta(
  recetaId,
  "aprobada",  // o "rechazada"
  "Firma valida"  // observacion optional
);

// Listar recetas
const recetas = await clientesService.listarRecetas({
  estado: "pendiente",
  cliente: clienteId
});

// Crear/Editar receta con firma
const formData = new FormData();
formData.append("codigo", "REC-001");
formData.append("firma_digital", imagenFile);
formData.append("fecha_validez", "2026-12-31");
formData.append("medico_nombre", "Dr. López");
formData.append("medico_licencia", "LIC-12345");

await clientesService.crearReceta(formData);
```

### publicidadService

```javascript
import { publicidadService } from "../../services/publicidadService";

// Listar campañas
const campanas = await publicidadService.listar();

// Crear campaña
const formData = new FormData();
formData.append("titulo", "Descuento Campeones");
formData.append("descuento", "15");
formData.append("fecha_inicio", "2026-06-01");
formData.append("fecha_fin", "2026-06-30");
formData.append("activa", "true");
formData.append("segmentos_ids", "1");  // champions
formData.append("imagen", imagenFile);

await publicidadService.crear(formData);

// Editar
await publicidadService.actualizar(id, formData);

// Eliminar
await publicidadService.eliminar(id);
```

### limitesDispensacionService

```javascript
import { limitesDispensacionService } from "../../services/inventarioService";

// Listar límites
const limites = await limitesDispensacionService.listar({
  producto: productoId
});

// Crear límite
await limitesDispensacionService.crear({
  producto: productoId,
  cantidad_maxima: 2,
  periodo_dias: 30
});

// Editar
await limitesDispensacionService.actualizar(limiteId, {
  cantidad_maxima: 3,
  periodo_dias: 60
});

// Eliminar
await limitesDispensacionService.eliminar(limiteId);
```

---

## 🗂️ Modelos Django

### RecetaMedica (Con cambios HU-75)

```python
from clientes.models import RecetaMedica

receta = RecetaMedica.objects.get(id=1)
print(receta.codigo)              # "REC-001"
print(receta.fecha_emision)       # 2026-05-28
print(receta.fecha_vencimiento)   # 2026-12-31 (validez legal receta médica)
print(receta.fecha_validez)       # 2026-06-30 (NEW - validez personalizada)
print(receta.firma_digital)       # ImageFieldFile
print(receta.firma_digital.url)   # "/media/firmas_recetas/uuid.jpg"
print(receta.estado)              # "aprobada"
print(receta.validada_por)        # User object
print(receta.validada_en)         # 2026-05-29 14:30:00
print(receta.medico.nombre)       # "Dr. López"
print(receta.medico.firma_imagen.url)  # "/media/firmas_medicos/uuid.jpg"

# Auto-mark como vencida si fecha_vencimiento < today y estado == "pendiente"
receta.save()
```

### MedicoReceta (NEW)

```python
from clientes.models import MedicoReceta

medico = receta.medico
print(medico.nombre)        # "Dr. López"
print(medico.licencia)      # "LIC-12345"
print(medico.especialidad)  # "Cardiología"
print(medico.firma_imagen)  # ImageFieldFile
```

### LimiteDispensacion (NEW)

```python
from inventarios.models import LimiteDispensacion

limite = LimiteDispensacion.objects.get(producto_id=123)
print(limite.cantidad_maxima)     # 2
print(limite.periodo_dias)        # 30
print(limite.producto.nombre_comercial)  # "Ranitidina 150mg"

# Usage in venta creation:
# - Verifica que cliente no exceda limite.cantidad_maxima en los últimos periodo_dias
```

### CampanaPublicitaria (NEW)

```python
from publicidad.models import CampanaPublicitaria, SegmentoRFM

campana = CampanaPublicitaria.objects.get(id=1)
print(campana.titulo)           # "Descuento Campeones"
print(campana.descuento)        # Decimal("15.00")  ← porcentaje
print(campana.fecha_inicio)     # 2026-06-01
print(campana.fecha_fin)        # 2026-06-30
print(campana.activa)           # True

# ManyToMany relación
segmentos = campana.segmentos.all()  # [SegmentoRFM(codigo='champions'), ...]
for seg in segmentos:
    print(seg.nombre)           # "Campeones"

# Crear campaña
campana = CampanaPublicitaria.objects.create(
    titulo="Descuento",
    descuento=Decimal("20.00"),
    fecha_inicio="2026-06-01",
    fecha_fin="2026-06-30",
    activa=True
)
campana.segmentos.add(SegmentoRFM.objects.get(codigo='champions'))
```

### SegmentoRFM (NEW)

```python
from publicidad.models import SegmentoRFM

# Códigos disponibles:
TODOS = "todos"           # Todos los clientes
CHAMPIONS = "champions"   # Alto RFM score (frecuente, reciente, alto gasto)
FRECUENTES = "frecuentes" # Compran frecuentemente pero bajo gasto
NUEVOS = "nuevos"         # Clientes nuevos (< 30 días)
EN_RIESGO = "en_riesgo"   # Clientes que no compran hace tiempo
INACTIVOS = "inactivos"   # Sin compras en 6 meses

# Listar segmentos
segmentos = SegmentoRFM.objects.all()
for seg in segmentos:
    print(f"{seg.codigo}: {seg.nombre}")
```

---

## 🔐 Permisos y RBAC

### IsPharmacistOrAdmin (HU-75)

```python
from core.permissions import IsPharmacistOrAdmin

class RecetaMedicaViewSet(viewsets.ModelViewSet):
    def get_permissions(self):
        if self.action in ("create", "update", "destroy", "validar"):
            return [IsAuthenticated(), IsPharmacistOrAdmin()]
        return [IsAuthenticated()]
        
# Solo ROLE_FARMACÉUTICO o ROLE_ADMIN pueden validar recetas
```

### IsAdmin (HU-76, HU-34)

```python
# En views
if not request.user.is_superuser:
    return Response({"detail": "Acceso denegado"}, status=403)

# O usar IsAdminUser permission
from rest_framework.permissions import IsAdminUser

class LimiteDispensacionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
```

### tiene_permiso (HU-18 RBAC)

```python
from core.rbac import tiene_permiso

tenant = getattr(request, "tenant", None)
can_see_all = tiene_permiso(request.user, "ventas.ver", tenant=tenant)

if can_see_all:
    # Admin/Farmacéutico: puede ver todas las ventas
    ventas = Venta.objects.all()
else:
    # Cliente: solo sus propias ventas
    cliente = Cliente.objects.filter(usuario=request.user).first()
    ventas = Venta.objects.filter(cliente=cliente)
```

---

## ⚠️ Error Codes

### VentaServiceError

```python
from ventas.services import VentaServiceError

try:
    crear_venta_service(...)
except VentaServiceError as e:
    print(e.code)  # Error code machine-readable
    print(str(e))  # Error message human-readable

# Códigos:
# - "limite_dispensacion_excedido"
# - "receta_vencida"
# - "receta_invalida"
# - "receta_requerida"
# - "stock_insuficiente"
# - "inventario_faltante"
# - "producto_no_disponible"
# - "origen_invalido"
# - "items_requeridos"
# - "vendedor_requerido"
```

### Errores HTTP

```
400 Bad Request:
  {
    "error": "Límite de dispensación excedido para 'Ranitidina'...",
    "code": "limite_dispensacion_excedido"
  }

401 Unauthorized:
  { "detail": "Invalid token" }

403 Forbidden:
  { "detail": "No tienes permiso para..." }

404 Not Found:
  { "detail": "Not found" }

500 Internal Server Error:
  { "detail": "Internal server error" }
```

---

## 📝 Validaciones

### Backend (Serializers)

```python
class RecetaMedicaSerializer:
    def validate_firma_digital(self, value):
        if not value:
            return value
        
        # Validar extensión
        allowed = {"jpg", "jpeg", "png"}
        ext = value.name.rsplit(".", 1)[-1].lower()
        if ext not in allowed:
            raise ValidationError("Debe ser JPG o PNG")
        
        # Validar tamaño
        if value.size > 5 * 1024 * 1024:  # 5MB
            raise ValidationError("Máximo 5 MB")
        
        return value
```

### Frontend (React)

```javascript
// Validar cantidad (HU-76)
if (!cantidad || cantidad < 1) {
  setError("La cantidad máxima debe ser mayor a 0.");
  return;
}

// Validar fechas (HU-34)
if (!form.fecha_inicio || !form.fecha_fin) {
  setError("Las fechas son obligatorias.");
  return;
}
if (form.fecha_fin < form.fecha_inicio) {
  setError("La fecha de fin debe ser posterior a la de inicio.");
  return;
}

// Validar archivo (HU-75)
const ext = file.name.rsplit(".", 1)[-1].toLowerCase();
if (!["jpg", "jpeg", "png"].includes(ext)) {
  setError("Solo JPG/PNG");
  return;
}
if (file.size > 5 * 1024 * 1024) {
  setError("Máximo 5 MB");
  return;
}
```

---

## 🧪 Testing Snippets

### Test HU-18: Historial Ventas

```python
def test_historial_ventas_cliente_role():
    """Cliente solo ve sus propias ventas"""
    cliente = Cliente.objects.create(usuario=user)
    otro_cliente = Cliente.objects.create(usuario=otro_user)
    
    venta1 = Venta.objects.create(cliente=cliente, total=100)
    venta2 = Venta.objects.create(cliente=otro_cliente, total=200)
    
    response = client.get('/api/ventas/historial/')
    assert len(response.data['results']) == 1
    assert response.data['results'][0]['id'] == venta1.id
```

### Test HU-75: Validación Receta

```python
def test_validar_receta_aprobada():
    """Farmacéutico puede validar receta a aprobada"""
    receta = RecetaMedica.objects.create(cliente=cliente, estado="pendiente")
    
    response = client.post(f'/api/clientes/recetas/{receta.id}/validar/', {
        "estado": "aprobada",
        "observacion": "OK"
    })
    
    assert response.status_code == 200
    assert response.data['estado'] == 'aprobada'
    assert response.data['validada_por_id'] == user.id
```

### Test HU-76: Límites Dispensación

```python
def test_limite_dispensacion_excedido():
    """Venta rechazada si excede límite"""
    limite = LimiteDispensacion.objects.create(
        producto=producto,
        cantidad_maxima=2,
        periodo_dias=30
    )
    
    # Primera venta: 1 unidad
    venta1 = crear_venta_service(cliente, [{"producto_id": 1, "cantidad": 1}])
    
    # Segunda venta: intenta 2 más (total 3, excede 2)
    with pytest.raises(VentaServiceError) as exc_info:
        crear_venta_service(cliente, [{"producto_id": 1, "cantidad": 2}])
    
    assert exc_info.value.code == "limite_dispensacion_excedido"
```

### Test HU-34: Campañas

```python
def test_crear_campaña_con_segmentos():
    """Admin crea campaña con segmentos"""
    champions = SegmentoRFM.objects.create(codigo="champions")
    
    campana = CampanaPublicitaria.objects.create(
        titulo="Descuento",
        descuento=Decimal("15.00"),
        fecha_inicio="2026-06-01",
        fecha_fin="2026-06-30"
    )
    campana.segmentos.add(champions)
    
    assert campana.segmentos.count() == 1
    assert campana.descuento == Decimal("15.00")
```

---

## 📚 URLs Útiles

```
Admin Panel:
  http://localhost:8000/admin/clientes/recetamedica/
  http://localhost:8000/admin/inventarios/limitedispensacion/
  http://localhost:8000/admin/publicidad/campanapublicitaria/
  http://localhost:8000/admin/publicidad/segmentorfm/

API Docs (si está configurado):
  http://localhost:8000/api/schema/
  http://localhost:8000/api/docs/

Frontend:
  http://localhost:3000/perfil/mis-compras
  http://localhost:3000/admin/recetas
  http://localhost:3000/admin/limites-dispensacion
  http://localhost:3000/admin/publicidad
```

---

## 🎯 Decisiones Rápidas de Desarrollo

### Pregunta: ¿Dónde validar límites?

**Respuesta:** En `_validar_limites_dispensacion()` dentro de `crear_venta_service()` (antes de @transaction.atomic)

### Pregunta: ¿Cómo almacenar firma digital?

**Respuesta:** ImageField con upload_to="firmas_recetas/" + validación en serializer

### Pregunta: ¿Quién crea SegmentoRFM?

**Respuesta:** Admin desde Django admin o script inicial (`python manage.py shell`)

### Pregunta: ¿Cuándo se aplica la promoción?

**Respuesta:** **No está implementado aún** - es future work (arreglo carrito en future sprint)

### Pregunta: ¿Multi-tenant para todo?

**Respuesta:** Sí - todos los modelos new heredan `TenantAwareModel`

---

**Fin de Referencia Rápida**
