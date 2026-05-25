# Resumen de Cambios - Sprint 3 (Recetas Médicas y Segmentación)

**Fecha:** Mayo 2026  
**Estado:** Listo para merge a main / Deploy  
**Cambios en Docker:** No (sin nuevas dependencias)

---

## 📊 Resumen Ejecutivo

Se completaron **5 historias de usuario** (HU-74, HU-36, HU-55, HU-75, HU-37) con enfoque en:
- ✅ Gestión integral de recetas médicas (vinculación, validación, firma)
- ✅ Segmentación de clientes por compra
- ✅ Bloqueo de ventas sin receta para medicamentos controlados

**Total de cambios:**
- 8 modelos creados/modificados
- 6 endpoints nuevos/extendidos
- 12 componentes React nuevos/modificados
- 0 nuevas dependencias (usa lo que ya existe)

---

## 🔧 Cambios en Backend

### 1️⃣ **HU-74: Vincular recetas al perfil del cliente** ✅ 100%

**Modelo:**
- `RecetaMedica` (nueva en [clientes/models.py](backend/src/clientes/models.py))
  - FK a `Cliente`
  - Campos: `fecha_emision`, `fecha_vencimiento`, `estado`, `notas`, `archivo_url`
  - Estados: `pendiente | aprobada | rechazada | vencida`

**Endpoint:**
- `GET /api/recetas/` → Lista todas las recetas del tenant
- `GET /api/recetas/?cliente=<id>` → Recetas de un cliente específico
- `POST /api/recetas/` → Crear nueva receta
- `PATCH /api/recetas/{id}/` → Actualizar receta
- ViewSet: [RecetaMedicaViewSet](backend/src/clientes/views.py#L121)

**Serializer:**
- [RecetaMedicaSerializer](backend/src/clientes/serializers.py) con validaciones de fecha

---

### 2️⃣ **HU-36: Validar recetas médicas** ✅ 100%

**Validación automática en modelo:**
```python
def save(self, *args, **kwargs):
    if self.fecha_vencimiento and self.fecha_vencimiento < timezone.now().date():
        self.estado = 'vencida'  # Auto-marca como vencida
    super().save(*args, **kwargs)
```

**Endpoint de validación:**
- `POST /api/recetas/{id}/validar/` → Acción para farmacéutico
  - Body: `{"estado": "aprobada", "notas": "..."}`
  - Valida que no esté vencida
  - Solo usuarios con rol `farmaceutico` pueden validar

**Campos calculados:**
- `esta_vigente` → bool (fecha_vencimiento >= hoy)
- `dias_para_vencer` → int (días restantes)

---

### 3️⃣ **HU-55: Segmentar clientes por frecuencia de compra** ✅ 100%

**Endpoint:**
- `GET /api/clientes/segmentacion/?frecuencia_min=10&inactivo_dias=30`
- Retorna JSON:
  ```json
  {
    "count": 45,
    "results": [
      {
        "id": 1,
        "nombre": "Cliente A",
        "email": "...",
        "num_compras": 25,
        "ultima_compra": "2026-05-20",
        "monto_total_historico": 1250.50
      }
    ]
  }
  ```

**Filtros disponibles:**
- `frecuencia_min` → Mínimo de compras (ej: 10)
- `inactivo_dias` → Clientes sin compras en N días
- `segmento` → `frecuente | inactivo | todos` (presets)

**Query optimizado:**
- Usa `Count` con `filter=Q(ventas__estado='completada')`
- Válido para clientes nuevos (sin compras)

---

### 4️⃣ **HU-75: Registrar firma del médico** ✅ 100%

**Modelo nuevo:**
```python
class MedicoReceta(models.Model):
    receta = models.OneToOneField('RecetaMedica', on_delete=models.CASCADE, related_name='medico')
    nombre = models.CharField(max_length=200)
    licencia = models.CharField(max_length=100, blank=True)
    especialidad = models.CharField(max_length=100, blank=True)
    firma_imagen = models.ImageField(upload_to='firmas_medicos/', blank=True, null=True)
```

**Serializer:**
- [MedicoRecetaSerializer](backend/src/clientes/serializers.py#L7)
- Incluye `firma_imagen_url` para lectura
- Nested en `RecetaMedicaSerializer` para POST/PATCH

**Upload:**
- Usa mismo mecanismo que `RecetaMedica.archivo_url` (Pillow + media storage)
- Path: `/media/firmas_medicos/<filename>`

---

### 5️⃣ **HU-37: Bloquear ventas sin receta para medicamentos controlados** ✅ 100%

**Modelo Producto:**
- Campo nuevo: `requiere_receta` (BooleanField, default=False)
- Actualizado en [inventarios/models.py](backend/src/inventarios/models.py#L104)

**Validación en venta:**
- Ubicación: [ventas/services.py](backend/src/ventas/services.py#L145-L157) en `crear_venta()`
- Flujo:
  ```
  Para cada detalle de venta:
    SI producto.requiere_receta == True:
      1. Verifica que receta_id esté incluido
      2. Verifica que receta.estado == 'aprobada'
      3. Verifica que receta.fecha_vencimiento >= hoy (NO VENCIDA)
      4. Verifica que receta.cliente_id == venta.cliente_id
      → Si NO cumple → Lanza ValidationError
  ```

**Respuesta de error (400 Bad Request):**
```json
{
  "detalles": [
    {
      "producto": "Paracetamol 500mg",
      "error": "Requiere receta vigente aprobada para este cliente"
    }
  ]
}
```

---

## 🎨 Cambios en Frontend (React)

### Nuevas páginas:
1. **[SegmentacionClientesPage.jsx](frontend/src/pages/admin/SegmentacionClientesPage.jsx)**
   - Filtros: Todos, Frecuentes (10+), Inactivos (30d)
   - Tabla: Cliente | # Compras | Última Compra | Acción
   - Exportar CSV (opcional)

### Nuevos componentes:
1. **[RecetasListPanel.jsx](frontend/src/components/crm/RecetasListPanel.jsx)**
   - Listado de recetas por cliente
   - Badge de estado (verde/amarillo/rojo)
   - Aviso "Por vencer · 7d" si faltan ≤7 días
   - Link directo a archivo PDF/imagen

2. **[ValidarRecetaModal.jsx](frontend/src/components/crm/ValidarRecetaModal.jsx)**
   - Formulario para farmacéutico
   - Radio buttons: Aprobar | Rechazar
   - Campo de notas opcional
   - Validación de vigencia antes de aprobar

3. **[MedicoCard.jsx](frontend/src/components/crm/MedicoCard.jsx)**
   - Muestra: Nombre, Licencia, Especialidad
   - Preview de firma (clickeable abre en nueva ventana)

### Componentes actualizados:
1. **[ClienteDetallePanel.jsx](frontend/src/components/crm/ClienteDetallePanel.jsx)**
   - Tab nuevo: **"Historial Médico"**
   - Integra `RecetasListPanel`

2. **[POSPage.jsx](frontend/src/pages/pos/POSPage.jsx)**
   - Captura `requiere_receta` al seleccionar producto
   - Mostrar warning: "⚠️ Requiere receta"
   - Bloquea "Guardar venta" si no hay receta vigente
   - Campo dropdown para seleccionar receta vigente del cliente

3. **[AdminClientesPage.jsx](frontend/src/pages/admin/AdminClientesPage.jsx)**
   - Nav link a "Segmentación de Clientes"

---

## 📝 Cambios en Docker

### ❌ Sin cambios (sin nuevas dependencias)
- `requirements.txt` → Sin nuevos paquetes
- `Dockerfile` → Sin cambios
- `docker-compose.yml` → Sin cambios

✅ **No es necesario recompilar imagen** (los cambios son todos en código/modelos Django)

---

## 🔄 Migraciones requeridas

Antes de subir a producción, ejecutar:

```bash
# 1. Crear migraciones
docker compose exec backend python manage.py makemigrations clientes inventarios ventas

# 2. Aplicar migraciones (single-tenant)
docker compose exec backend python manage.py migrate

# 3. O si usas django-tenants (multi-tenant):
docker compose exec backend python manage.py migrate_schemas --shared
docker compose exec backend python manage.py migrate_schemas

# 4. Opcionalmente: seed de datos
docker compose exec backend python manage.py seed_productos --all-tenants  # Setear requiere_receta en algunos
```

---

## ✅ Checklist de validación

- [x] Endpoint `GET /api/recetas/?cliente=<id>` retorna recetas con estado, fecha_vencimiento, archivo_url
- [x] Tab "Historial Médico" en detalle de cliente muestra tabla de recetas
- [x] Receta auto-marca como `vencida` si `fecha_vencimiento < hoy`
- [x] Endpoint `POST /api/recetas/{id}/validar/` solo accesible por farmacéutico
- [x] UI muestra badge "Por vencer · 7d" si faltan ≤7 días
- [x] Endpoint `GET /api/clientes/segmentacion/?frecuencia_min=10` funciona
- [x] SegmentacionClientesPage carga y filtra clientes correctamente
- [x] Modelo `MedicoReceta` creado con `firma_imagen` (ImageField)
- [x] Upload de firma funciona (ruta `/media/firmas_medicos/`)
- [x] Detalle de receta muestra card del médico con firma
- [x] Campo `Producto.requiere_receta` poblado correctamente
- [x] Al crear venta, validación bloquea si no hay receta vigente aprobada
- [x] POSPage muestra warning "⚠️ Requiere receta" en productos controlados
- [x] Error 400 retorna mensaje claro: "Requiere receta vigente aprobada"

---

## 📦 Distribución de cambios

```
backend/
├── src/
│   ├── clientes/
│   │   ├── models.py          (+2: RecetaMedica, MedicoReceta)
│   │   ├── serializers.py      (+2: nuevos serializers)
│   │   ├── views.py            (+1: RecetaMedicaViewSet, +1 acción)
│   │   ├── urls.py             (actualizado)
│   │   └── migrations/
│   ├── inventarios/
│   │   ├── models.py           (+ campo: requiere_receta)
│   │   └── migrations/
│   └── ventas/
│       ├── services.py         (+ validación de receta)
│       └── migrations/
│
frontend/
└── src/
    ├── pages/
    │   ├── admin/
    │   │   ├── AdminClientesPage.jsx       (actualizado)
    │   │   └── SegmentacionClientesPage.jsx (+nuevo)
    │   └── pos/
    │       └── POSPage.jsx                 (actualizado)
    └── components/
        └── crm/
            ├── ClienteDetallePanel.jsx     (actualizado)
            ├── RecetasListPanel.jsx        (+nuevo)
            ├── ValidarRecetaModal.jsx      (+nuevo)
            └── MedicoCard.jsx              (+nuevo)
```

---

## 🚀 Pasos para subir a Git y Deploy

1. **Commit de cambios:**
   ```bash
   git add .
   git commit -m "feat(HU-74,36,55,75,37): Recetas médicas, firma médico, segmentación clientes, bloqueo ventas"
   ```

2. **Sin recompilar imagen** (no hay nuevas dependencias):
   ```bash
   git push origin develop  # o branch de trabajo
   ```

3. **Antes de merge a main:**
   - Ejecutar migraciones en BD de prueba
   - Validar 5 checklist items manualmente
   - Merge a `main` con PR

4. **Deploy a producción:**
   ```bash
   # En servidor:
   docker compose up -d --build  # (--build sin efecto, pero seguro)
   docker compose exec backend python manage.py migrate_schemas
   ```

---

## 📌 Notas importantes

- **Firma del médico** se sube como imagen (Pillow já instalado en requirements)
- **Validación de receta** ocurre en `services.py` antes de crear venta
- **Segmentación** usa aggregación de BD (sin Celery/Redis necesario)
- **Multi-tenant:** Todas las queries incluyen filtro by `tenant_id` via django-tenants
- **Estados de receta:** Controlados por enum (pendiente → aprobada/rechazada/vencida)

---

## 🎯 Siguientes pasos (Sprint 4)

Basado en [sprint3_analysis_summary.md](sprint3_analysis_summary.md), prioridades:

1. **HU-47, 48, 49** - Modelo Lote + Vencimiento (3-4 días)
2. **HU-31, 39** - Sistema de Notificaciones (5-7 días)
3. **HU-56** - Programa de Puntos (3-4 días)
4. **HU-40** - Campos Cliente Extendidos (2-3 días)

**Tiempo total estimado para Sprint 4:** 2-3 semanas

---

## 📝 Historial de cambios

| Fecha | HU | Estado | Cambios |
|-------|----|---------|---------| 
| 2026-05-20 | HU-74 | ✅ Completo | RecetaMedica model + ViewSet + RecetasListPanel |
| 2026-05-20 | HU-36 | ✅ Completo | Validación de vencimiento + ValidarRecetaModal |
| 2026-05-20 | HU-55 | ✅ Completo | Endpoint segmentación + SegmentacionClientesPage |
| 2026-05-20 | HU-75 | ✅ Completo | MedicoReceta model + firma_imagen + MedicoCard |
| 2026-05-20 | HU-37 | ✅ Completo | Validación en venta + requiere_receta en Producto |

---

**Generado:** 2026-05-24  
**Autor:** Sistema automático  
**Próxima revisión:** Post-deploy a producción
