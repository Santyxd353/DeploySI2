# 📋 PLAN DE IMPLEMENTACIÓN: HU-36 & HU-18 - MÓDULO VENTAS

**Fecha:** 21 de Junio, 2026  
**Rama:** `modulo_ventas`  
**Estado:** Análisis Completo ✅

---

## 📊 RESUMEN EJECUTIVO

| Aspecto | Detalle |
|--------|---------|
| **HU-36** | Módulo gestión y análisis de ventas (Admin) |
| **HU-18** | Historial de ventas (Cliente) |
| **Estado Actual** | HU-18: 40% implementada / HU-36: 30% implementada |
| **Timeline Estimado** | 10-12 días de desarrollo |
| **Complejidad** | Media-Alta (permisos RBAC + análisis de datos) |
| **Dependencias** | Django DRF, PostgreSQL, React Vite |

---

## 🔍 ESTADO ACTUAL DEL CODEBASE

### ✅ YA IMPLEMENTADO

#### Backend - Módulo `ventas/`
```
models.py:
  ✅ Venta (con origen, estado, stripe_payment_intent_id)
  ✅ DetalleVenta (relación con Producto)
  ✅ Factura (generación automática de número)

views.py:
  ✅ crear_venta_fisica()
  ✅ crear_venta_online()
  ✅ crear_venta_pos()
  ✅ confirmar_pago_venta()
  ✅ listar_historial_ventas() - ENDPOINT HU-18

urls.py:
  ✅ GET /api/ventas/historial/ - HU-18 (con paginación)
  ✅ GET /api/ventas/mis-facturas/ - HU-18 (para cliente)
```

#### Frontend - Components
```
pages/MisComprasPage.jsx:
  ✅ Página HU-18 con historial de compras

components/crm/HistorialComprasPanel.jsx:
  ✅ Panel mostrando compras con detalles

pages/admin/AdminReportesPage.jsx:
  ✅ Dashboard con 20+ reportes (parcial HU-36)
```

#### Backend - Reportes
```
services.py (1500+ líneas):
  ✅ 20+ reportes de ventas:
     - ventas_resumen
     - ventas_detalle
     - ventas_tendencia
     - ventas_por_vendedor
     - rentabilidad_productos
     - ticket_promedio
     - ... (15 más)
```

---

### ❌ FALTA IMPLEMENTAR

#### HU-36: Gestión y Análisis de Ventas (Admin)

**Backend:**
```python
# ❌ Falta: ViewSet/API dedicado para admin
- GET /api/admin/ventas/dashboard/ (KPIs principales)
- GET /api/admin/ventas/mapa-calor/ (ventas por hora/día)
- GET /api/admin/ventas/comparativa-periodos/
- POST /api/admin/ventas/exportar-excel/
- PUT /api/admin/ventas/<id>/actualizar-estado/
- DELETE /api/admin/ventas/<id>/cancelar/

# ❌ Falta: Permisos granulares (RBAC)
- Permiso: "ventas.view_dashboard"
- Permiso: "ventas.view_analisis"
- Permiso: "ventas.export_data"
```

**Frontend:**
```jsx
// ❌ Falta: Páginas admin específicas
- AdminVentasPage.jsx (reemplazar reportes genéricos)
  └─ Tabs: Dashboard, Análisis, Transacciones, Reportes
  
- VentasKPIPanel.jsx (métricas principales)
  └─ Ventas hoy, semana, mes
  └─ Ticket promedio
  └─ Top vendedores
  └─ Top clientes
  
- VentasMapaCalorPanel.jsx (hora/día más vendedor)
  └─ Gráfico heatmap por hora
  └─ Gráfico por día semana
  
- VentasDetallePanel.jsx (tabla transacciones)
  └─ Filtros avanzados
  └─ Acciones: editar estado, cancelar, reimprir factura
```

#### HU-18: Historial de Ventas (Cliente)

**Backend:**
```python
# ⚠️  Parcialmente implementado:
- GET /api/ventas/historial/ → Exists pero falta validar:
  - ✅ Filtro por fecha (desde/hasta)
  - ❌ Filtro por estado (pagada, cancelada)
  - ❌ Filtro por rango montos
  - ❌ Search por número venta
  
# ❌ Falta: Endpoints adicionales
- GET /api/ventas/historial/<id>/ (detalle de 1 venta)
- GET /api/ventas/historial/estadisticas/ (stats del cliente)
  └─ Total gastado, promedio ticket, últimas compras
- POST /api/ventas/historial/<id>/reorden/ (recomprar)
```

**Frontend:**
```jsx
// ⚠️  Parcialmente implementado:
- MisComprasPage.jsx → Exists pero falta:
  - ❌ Filtros avanzados (estado, fecha, monto)
  - ❌ Búsqueda por número transacción
  - ❌ Botón descargar factura PDF
  - ❌ Botón reorden (repite última compra)
  - ❌ Estadísticas personales (total gastado)
  
// ❌ Falta: Componentes
- VentaDetalleModal.jsx (ver detalles de 1 venta)
- VentaReimprimirFacturaModal.jsx
- EstadisticasClientePanel.jsx (gasto total, promedio, tendencia)
```

---

## 🏗️ ARQUITECTURA ACTUAL

### Multi-Tenant + RBAC
```
┌─────────────────────────────────────┐
│ Usuario (JWT Token)                 │
├─────────────────────────────────────┤
│ Roles: ADMIN, FARMACEUTICO, CLIENTE │
│ Permisos: ventas.*, inventario.*    │
└────────────┬────────────────────────┘
             │
      ┌──────▼──────┐
      │   Tenant    │
      │ (Farmacia)  │
      └──────┬──────┘
             │
    ┌────────▼──────────┐
    │ Venta (TenantAware)
    │ ├─ cliente
    │ ├─ detalles[]
    │ ├─ factura
    │ └─ permisos: solo ver propias
    └────────────────────┘
```

### Flujo de Autenticación
```
Frontend (JWT in Header o Cookie)
         ↓
CookieOrHeaderJWTAuthentication
         ↓
@permission_classes([IsAuthenticated, ...])
         ↓
Obtener tenant del JWT
         ↓
Filtrar Ventas por tenant + usuario_role
```

---

## 🎯 PLAN DE TRABAJO POR FASE

### FASE 1: Backend - API (3-4 días)

#### 1.1 Crear ViewSet `VentasAdminViewSet`
**Archivo:** `backend/src/ventas/views.py` (agregar)

```python
from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Count, Q
from datetime import timedelta

class VentasAdminViewSet(viewsets.ModelViewSet):
    """
    ViewSet para HU-36: Gestión de ventas admin.
    
    Permisos:
    - list/retrieve: [IsAuthenticated, IsAdmin]
    - update/partial_update: [IsAuthenticated, IsAdmin]
    - destroy: [IsAuthenticated, IsAdmin]
    
    Acciones personalizadas:
    - @action GET /ventas/admin/dashboard/
    - @action GET /ventas/admin/mapa-calor/
    - @action GET /ventas/admin/comparativa/
    - @action POST /ventas/admin/exportar-excel/
    """
    
    queryset = Venta.objects.all()
    serializer_class = VentaSerializer
    permission_classes = [IsAuthenticated, IsAdminOrPharmacist]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['id', 'cliente__nombres', 'cliente__email']
    ordering_fields = ['created_at', 'total', 'estado']
    
    def get_queryset(self):
        # Solo ventas del tenant actual
        return super().get_queryset().filter(
            tenant=self.request.tenant
        )
    
    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """HU-36: KPIs principales del dashboard"""
        today = timezone.now().date()
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)
        
        qs = self.get_queryset()
        
        kpis = {
            "hoy": {
                "ventas": qs.filter(created_at__date=today).count(),
                "total": qs.filter(created_at__date=today).aggregate(Sum('total'))['total__sum'] or 0,
            },
            "semana": {
                "ventas": qs.filter(created_at__date__gte=week_ago).count(),
                "total": qs.filter(created_at__date__gte=week_ago).aggregate(Sum('total'))['total__sum'] or 0,
            },
            "mes": {
                "ventas": qs.filter(created_at__date__gte=month_ago).count(),
                "total": qs.filter(created_at__date__gte=month_ago).aggregate(Sum('total'))['total__sum'] or 0,
            },
            "ticket_promedio": self._calcular_ticket_promedio(),
            "top_vendedores": self._top_vendedores(),
            "top_clientes": self._top_clientes(),
            "estado_ventas": self._estado_ventas(),
        }
        
        return Response(kpis)
    
    @action(detail=False, methods=['get'])
    def mapa_calor(self, request):
        """HU-36: Mapa de calor por hora del día y día de semana"""
        pass
    
    @action(detail=False, methods=['post'])
    def exportar_excel(self, request):
        """HU-36: Exportar ventas a Excel"""
        pass
```

#### 1.2 Actualizar Serializers
**Archivo:** `backend/src/ventas/serializers.py` (agregar)

```python
class VentaAdminSerializer(serializers.ModelSerializer):
    """Serializer completo para admin (más campos que cliente)"""
    cliente_nombre = serializers.ReadOnlyField(source='cliente.nombres')
    vendedor_nombre = serializers.ReadOnlyField(source='vendedor.get_full_name')
    
    class Meta:
        model = Venta
        fields = [
            'id', 'cliente', 'cliente_nombre', 'vendedor', 'vendedor_nombre',
            'origen', 'estado', 'subtotal', 'descuento', 'impuesto', 'total',
            'stripe_payment_intent_id', 'observacion', 'created_at', 'updated_at',
            'detalles'
        ]

class VentaClienteSerializer(serializers.ModelSerializer):
    """Serializer limitado para cliente (solo info relevante)"""
    detalles = DetalleVentaSerializer(many=True)
    
    class Meta:
        model = Venta
        fields = ['id', 'estado', 'total', 'created_at', 'detalles']
```

#### 1.3 Agregar Permisos RBAC
**Archivo:** `backend/src/core/permissions.py` (agregar)

```python
class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and obtener_rol_usuario(request.user) == ROLE_ADMIN

class IsAdminOrPharmacist(permissions.BasePermission):
    def has_permission(self, request, view):
        role = obtener_rol_usuario(request.user)
        return role in [ROLE_ADMIN, ROLE_FARMACEUTICO]
```

#### 1.4 Registrar URLs
**Archivo:** `backend/src/ventas/urls.py` (actualizar)

```python
from rest_framework.routers import DefaultRouter
from .views import VentasAdminViewSet

router = DefaultRouter()
router.register(r'admin/ventas', VentasAdminViewSet, basename='admin-ventas')

urlpatterns = [
    # ... URLs existentes
    path('', include(router.urls)),
]
```

#### 1.5 Mejorar endpoints HU-18
**Archivo:** `backend/src/ventas/views.py` (actualizar)

```python
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def listar_historial_ventas(request):
    """
    HU-18: Historial de ventas del cliente autenticado.
    
    Query params:
    - estado: [pagada, pendiente, entregada, cancelada]
    - fecha_desde: YYYY-MM-DD
    - fecha_hasta: YYYY-MM-DD
    - monto_min: float
    - monto_max: float
    - search: string (búsqueda en ID, cliente)
    """
    
    usuario = request.user
    cliente = usuario.cliente  # OneToOne
    
    if not cliente:
        return Response(
            {"detail": "Usuario no tiene cliente asociado"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    qs = Venta.objects.filter(
        tenant=request.tenant,
        cliente=cliente
    ).select_related('cliente', 'factura').prefetch_related('detalles')
    
    # Filtros
    if estado := request.query_params.get('estado'):
        qs = qs.filter(estado=estado)
    
    if fecha_desde := request.query_params.get('fecha_desde'):
        qs = qs.filter(created_at__date__gte=fecha_desde)
    
    if fecha_hasta := request.query_params.get('fecha_hasta'):
        qs = qs.filter(created_at__date__lte=fecha_hasta)
    
    if monto_min := request.query_params.get('monto_min'):
        qs = qs.filter(total__gte=float(monto_min))
    
    if monto_max := request.query_params.get('monto_max'):
        qs = qs.filter(total__lte=float(monto_max))
    
    # Paginación
    paginator = PageNumberPagination()
    paginator.page_size = request.query_params.get('page_size', 20)
    page = paginator.paginate_queryset(qs, request)
    
    serializer = VentaClienteSerializer(page, many=True)
    return paginator.get_paginated_response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def obtener_estadisticas_cliente(request):
    """HU-18: Estadísticas personales del cliente"""
    usuario = request.user
    cliente = usuario.cliente
    
    if not cliente:
        return Response({"detail": "Cliente no encontrado"}, status=404)
    
    qs = Venta.objects.filter(
        tenant=request.tenant,
        cliente=cliente,
        estado__in=['pagada', 'entregada']
    )
    
    stats = {
        "total_gastado": qs.aggregate(Sum('total'))['total__sum'] or 0,
        "total_compras": qs.count(),
        "ticket_promedio": 0,
        "ultima_compra": None,
    }
    
    if stats['total_compras'] > 0:
        stats['ticket_promedio'] = stats['total_gastado'] / stats['total_compras']
    
    ultima = qs.order_by('-created_at').first()
    if ultima:
        stats['ultima_compra'] = VentaClienteSerializer(ultima).data
    
    return Response(stats)
```

---

### FASE 2: Frontend Admin (3-4 días)

#### 2.1 Crear `AdminVentasPage.jsx`
**Archivo:** `frontend/src/pages/admin/AdminVentasPage.jsx` (nuevo)

```jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import VentasKPIPanel from '../../components/admin/VentasKPIPanel';
import VentasDetallePanel from '../../components/admin/VentasDetallePanel';
import VentasAnalisisPanel from '../../components/admin/VentasAnalisisPanel';

/**
 * HU-36: Página de gestión y análisis de ventas para admin.
 * Tabs: Dashboard, Detalle, Análisis
 */
export default function AdminVentasPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetchDashboard();
  }, []);
  
  const fetchDashboard = async () => {
    try {
      const response = await fetch('/api/ventas/admin/dashboard/');
      const data = await response.json();
      setData(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-7xl">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Gestión de Ventas</h1>
          <p className="mt-1 text-sm text-slate-600">Monitoreo de rendimiento comercial</p>
        </div>
        
        {/* Tabs */}
        <div className="mb-6 border-b border-slate-200">
          <div className="flex gap-4">
            {[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'detalle', label: 'Transacciones' },
              { id: 'analisis', label: 'Análisis' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 font-medium text-sm transition ${
                  activeTab === tab.id
                    ? 'border-b-2 border-teal-600 text-teal-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">Cargando...</div>
        ) : (
          <>
            {activeTab === 'dashboard' && <VentasKPIPanel data={data} />}
            {activeTab === 'detalle' && <VentasDetallePanel />}
            {activeTab === 'analisis' && <VentasAnalisisPanel />}
          </>
        )}
      </div>
    </main>
  );
}
```

#### 2.2 Componentes específicos
**Archivo:** `frontend/src/components/admin/VentasKPIPanel.jsx`

```jsx
// KPIs: Ventas hoy/semana/mes, ticket promedio, top vendedores, estado
export default function VentasKPIPanel({ data }) {
  // Renderizar 4 metric cards principales
  // Gráficos de tendencia (Chart.js)
  // Top vendedores / clientes
}
```

**Archivo:** `frontend/src/components/admin/VentasDetallePanel.jsx`

```jsx
// Tabla con filtros: estado, fecha, vendedor, monto
// Acciones: ver detalle, cambiar estado, cancelar, reimprimir factura
export default function VentasDetallePanel() {
  // Tabla paginada de ventas
  // Filtros avanzados
}
```

#### 2.3 Actualizar rutas
**Archivo:** `frontend/src/App.jsx` (actualizar rutas)

```jsx
import AdminVentasPage from './pages/admin/AdminVentasPage';

// En el router:
{
  path: '/admin/ventas',
  element: <AdminVentasPage />,
  requiredRole: ['ROLE_ADMIN'],
}
```

---

### FASE 3: Frontend Cliente (2-3 días)

#### 3.1 Mejorar `MisComprasPage.jsx`
**Archivo:** `frontend/src/pages/MisComprasPage.jsx` (actualizar)

Agregar:
- Filtros: estado, fecha, monto
- Búsqueda por número transacción
- Estadísticas personales (total gastado, promedio, últimas compras)
- Botón "Descargar factura PDF"
- Botón "Reordenar" (repite últimas compras)

#### 3.2 Crear `VentaDetalleModal.jsx`
**Archivo:** `frontend/src/components/ventas/VentaDetalleModal.jsx`

```jsx
// Modal con detalle completo de 1 venta
// Muestra: Cliente, Detalles productos, Factura, Monto
export default function VentaDetalleModal({ ventaId, onClose }) {
  // ...
}
```

#### 3.3 Crear `EstadisticasClientePanel.jsx`
**Archivo:** `frontend/src/components/ventas/EstadisticasClientePanel.jsx`

```jsx
// Estadísticas personales:
// - Total gastado (Bs)
// - Número de compras
// - Ticket promedio
// - Gráfico de tendencia últimos 30 días
export default function EstadisticasClientePanel() {
  // ...
}
```

---

### FASE 4: Testing & QA (2 días)

#### 4.1 Tests Backend
```bash
# pytest para endpoints admin
# pytest para endpoints cliente
# Validar permisos RBAC
```

#### 4.2 Tests Frontend
```bash
# E2E: Admin dashboard carga
# E2E: Filtros funcionan
# E2E: Exportar Excel
# E2E: Cliente ve historial
```

---

## 📈 CHECKLIST TÉCNICO

### Backend

- [ ] **Modelos** → Ya existen, solo validar campos
- [ ] **Serializers** → Crear `VentaAdminSerializer`, `VentaClienteSerializer`
- [ ] **ViewSet Admin** → `VentasAdminViewSet` con acciones
- [ ] **Permisos** → `IsAdmin`, `IsAdminOrPharmacist`
- [ ] **URLs** → Registrar router
- [ ] **Mejoras HU-18** → Filtros + estadísticas
- [ ] **Tests** → Unittest con pytest
- [ ] **Validaciones** → Datos de entrada

### Frontend Admin

- [ ] **AdminVentasPage.jsx** → Nuevo archivo
- [ ] **VentasKPIPanel.jsx** → KPIs + gráficos
- [ ] **VentasDetallePanel.jsx** → Tabla + filtros
- [ ] **VentasAnalisisPanel.jsx** → Análisis avanzado
- [ ] **Rutas** → Agregar a App.jsx
- [ ] **Permisos** → Validar role ROLE_ADMIN

### Frontend Cliente

- [ ] **Mejorar MisComprasPage.jsx** → Filtros + estadísticas
- [ ] **VentaDetalleModal.jsx** → Nuevo componente
- [ ] **EstadisticasClientePanel.jsx** → Nuevo componente
- [ ] **Integración API** → Endpoints `/historial/` con filtros

### DevOps

- [ ] **Migraciones** → No se necesitan (modelos ya existen)
- [ ] **Docker** → No requiere recompilación
- [ ] **Seeds** → Ejecutar seed de ventas si es necesario

---

## 📅 TIMELINE ESTIMADO

| Fase | Tarea | Días | Inicio | Fin |
|------|-------|------|--------|-----|
| 1 | Backend API | 3-4 | Lunes | Miércoles |
| 2 | Frontend Admin | 3-4 | Jueves | Viernes |
| 3 | Frontend Cliente | 2-3 | Lunes | Martes |
| 4 | Testing | 2 | Miércoles | Jueves |
| **TOTAL** | | **10-12 días** | | |

---

## 🔐 SEGURIDAD & RBAC

### Matriz de Permisos

| Rol | Ver Dashboard | Ver Historial | Editar Venta | Cancelar Venta | Exportar |
|-----|---|---|---|---|---|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Farmacéutico | ✅ | ✅ | ⚠️ | ⚠️ | ✅ |
| Vendedor | ❌ | ✅ | ❌ | ❌ | ❌ |
| Cliente | ❌ | ✅ (propias) | ❌ | ❌ | ❌ |

---

## 🚀 PRIORIDADES

### MVP (Semana 1)
1. Backend: Endpoints admin + cliente
2. Frontend Admin: Dashboard KPIs
3. Frontend Cliente: Filtros + estadísticas
4. Testing básico

### Nice-to-Have (Semana 2)
1. Mapa de calor (ventas por hora/día)
2. Exportar Excel avanzado
3. Predicción de ventas (ML)
4. Notificaciones en tiempo real

---

## 📌 NOTAS IMPORTANTES

### Dependencias Existentes ✅
- Django 5.1.6
- DRF 3.15.2
- PostgreSQL 16
- React 18.3.1
- TenantAware mixins (multi-tenant)
- JWT authentication

### Packages Requeridos ❌
```bash
# Si no existen:
pip install openpyxl  # Exportar Excel
pip install reportlab  # PDF avanzado
```

### Archivos a Consultar
- `backend/src/reportes/services.py` → Lógica de reportes
- `backend/src/ventas/models.py` → Estructura actual
- `frontend/src/pages/admin/AdminReportesPage.jsx` → Inspiración UI
- `backend/src/core/permissions.py` → Patrón RBAC

---

## ✅ PRÓXIMOS PASOS

1. **Validar** este plan con el equipo
2. **Crear branches** por componente (opcional)
3. **Comenzar** Phase 1: Backend API
4. **Documentar** cambios en cada PR

---

**Documento preparado para:** @melqu  
**Rama de trabajo:** `modulo_ventas`  
**Status:** Listo para implementación ✅

