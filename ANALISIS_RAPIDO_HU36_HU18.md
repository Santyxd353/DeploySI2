# 📊 ANÁLISIS RÁPIDO: HU-36 & HU-18

## Estado Actual en 30 segundos

### HU-18: Historial de Ventas (Cliente) ⚠️ 40% LISTO

**Backend:**
- ✅ Endpoint `/api/ventas/historial/` existe
- ✅ Paginación funciona
- ❌ Faltan filtros: estado, fecha, monto, búsqueda

**Frontend:**
- ✅ Página `MisComprasPage.jsx` existe
- ✅ Componente `HistorialComprasPanel.jsx` existe
- ❌ Sin filtros avanzados
- ❌ Sin estadísticas personales
- ❌ Sin botón reorden/reimprir factura

**Estimado para completar:** 3-4 días

---

### HU-36: Gestión y Análisis de Ventas (Admin) ⚠️ 30% LISTO

**Backend:**
- ❌ NO existe ViewSet admin específico
- ❌ Faltan endpoints: `/admin/ventas/dashboard/`, `/admin/ventas/mapa-calor/`
- ✅ Reportes existen en `reportes/services.py` (puedo reutilizar lógica)
- ❌ Faltan permisos granulares

**Frontend:**
- ✅ Página reportes existe `AdminReportesPage.jsx`
- ❌ NO existe página específica para gestión de ventas (solo reportes)
- ❌ Sin componentes de KPI tiempo real
- ❌ Sin acciones (cambiar estado, cancelar venta)

**Estimado para completar:** 5-7 días

---

## Lo que Existe Ahora

```
Backend:
├── models/
│   ├── Venta ✅
│   ├── DetalleVenta ✅
│   └── Factura ✅
├── views/
│   ├── crear_venta_fisica() ✅
│   ├── crear_venta_online() ✅
│   ├── crear_venta_pos() ✅
│   ├── listar_historial_ventas() ✅ (pero sin filtros)
│   └── confirmar_pago_venta() ✅
├── reportes/ ✅
│   ├── 20+ reportes de ventas
│   └── Dashboard con gráficos
└── urls/ ✅
    └── rutas existentes

Frontend:
├── pages/
│   ├── MisComprasPage.jsx ✅ (cliente, sin filtros)
│   └── admin/AdminReportesPage.jsx ✅ (reportes genéricos)
└── components/
    └── HistorialComprasPanel.jsx ✅ (simple)
```

---

## Lo que Falta Implementar

```
BACKEND (6-7 días)
├── API ViewSet para admin
│   ├── GET /api/admin/ventas/dashboard/ (KPIs)
│   ├── GET /api/admin/ventas/mapa-calor/ (heatmap)
│   ├── GET /api/admin/ventas/comparativa/ (periodos)
│   ├── POST /api/admin/ventas/exportar-excel/
│   ├── PUT /api/admin/ventas/<id>/cambiar-estado/
│   └── DELETE /api/admin/ventas/<id>/cancelar/
├── Mejorar historial cliente
│   ├── Filtros: estado, fecha, monto
│   ├── Búsqueda por número
│   └── Estadísticas personales
└── Permisos RBAC
    ├── ventas.view_dashboard
    ├── ventas.view_analisis
    └── ventas.export_data

FRONTEND ADMIN (3-4 días)
├── AdminVentasPage.jsx (nueva)
│   └── Tabs: Dashboard | Transacciones | Análisis
├── VentasKPIPanel.jsx (nueva)
│   └── Métrica cards + gráficos
├── VentasDetallePanel.jsx (nueva)
│   └── Tabla + filtros + acciones
└── VentasAnalisisPanel.jsx (nueva)
    └── Gráficos avanzados

FRONTEND CLIENTE (2-3 días)
├── Mejorar MisComprasPage.jsx
│   ├── Agregar filtros
│   ├── Agregar búsqueda
│   └── Agregar estadísticas
├── VentaDetalleModal.jsx (nueva)
│   └── Ver detalle de 1 compra
├── EstadisticasClientePanel.jsx (nueva)
│   └─ Total gastado, ticket promedio, gráfico
└── Botones: Descargar factura, Reordenar
```

---

## Decisiones Técnicas Importantes

### 1. Reutilizar Reportes Existentes ✅
**Ubicación:** `backend/src/reportes/services.py`

No necesito crear toda la lógica de análisis desde cero. Puedo:
- Reutilizar funciones como `reporte_ventas_por_vendedor()`, `reporte_rentabilidad_productos()`
- Adaptarlas para devolver respuestas de API en lugar de reportes

**Beneficio:** Ahorro de 2-3 días de desarrollo

### 2. Estructura de Permisos
**Patrón usado en el proyecto:**
```python
# En views.py
@permission_classes([IsAuthenticated, IsAdmin])
def mi_endpoint(request):
    pass

# O más granular:
if not request.user.has_perm('ventas.view_dashboard'):
    return Response({'detail': 'No permission'}, status=403)
```

### 3. TenantAware: Automático
Las queries ya filtran por tenant automáticamente gracias a `TenantAwareModel`.

```python
# Esto SOLO devuelve ventas del tenant actual:
qs = Venta.objects.filter(...)  # tenant filtrado automáticamente
```

---

## Dependencias Externas

```bash
# Verificar si existen:
pip list | grep openpyxl    # Para Excel
pip list | grep reportlab   # Para PDF

# Si no existen, instalar:
pip install openpyxl reportlab
```

---

## Recursos Dentro del Proyecto

| Recurso | Ubicación | Utilidad |
|---------|-----------|----------|
| Reportes | `backend/src/reportes/` | Lógica de análisis |
| Modelos | `backend/src/ventas/models.py` | Estructura datos |
| Permisos | `backend/src/core/permissions.py` | RBAC |
| UI Reportes | `frontend/src/pages/admin/AdminReportesPage.jsx` | Inspiración UI |
| Componentes | `frontend/src/components/` | Reutilizar widgets |

---

## Orden Recomendado de Implementación

### Semana 1: MVP
1. **Día 1-2:** Backend ViewSet admin + endpoints
2. **Día 3-4:** Frontend admin - Dashboard KPIs
3. **Día 5:** Frontend cliente - Mejorar filtros
4. **Día 6:** Testing básico

### Semana 2: Polish
1. **Día 1-2:** Mapa de calor + análisis avanzado
2. **Día 3:** Exportar Excel
3. **Día 4:** Testing completo
4. **Día 5:** Deploy + documentación

---

## Comandos Útiles (Backend)

```bash
# Después de cambios:
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate_schemas

# Ver datos:
docker compose exec backend python manage.py shell
>>> from ventas.models import Venta
>>> Venta.objects.count()

# Tests:
docker compose exec backend pytest tests/ventas/ -v
```

---

## Comandos Útiles (Frontend)

```bash
# Verificar cambios en tiempo real:
cd frontend
npm run dev

# Build:
npm run build

# Tests:
npm run test
```

---

## Checklist de Inicio

- [ ] Estoy en rama `modulo_ventas` ✅ (ya hecho)
- [ ] Leí `PLAN_IMPLEMENTACION_HU36_HU18.md` completo
- [ ] Identifiqué dónde editar (backend/src/ventas/, frontend/src/pages/admin, etc.)
- [ ] Tengo clara la prioridad: Backend primero, luego Frontend
- [ ] Entiendo el flujo de permisos (IsAuthenticated → IsAdmin/IsPharmacist)
- [ ] Sé que TenantAware filtra automáticamente

**Status:** ✅ Listo para comenzar

---

## Dudas Comunes

**P: ¿Necesito migración de BD?**  
R: NO. Los modelos ya existen.

**P: ¿Qué pasa si el cliente no tiene usuario?**  
R: Maneja con `usuario.cliente` OneToOne, verificar null.

**P: ¿Los reportes funcionan en tiempo real?**  
R: Sí, consultan BD directamente. Considera caché si hay volumen.

**P: ¿Cómo exportar Excel?**  
R: Usa `openpyxl`. Ver `AdminReportesPage.jsx` línea 1242+

**P: ¿Dónde están los tests?**  
R: Aún no. Crear en `tests/ventas/` siguiendo pattern de otros tests.

---

**Preparado por:** AI Assistant  
**Rama:** `modulo_ventas`  
**Fecha:** 21 de Junio, 2026

