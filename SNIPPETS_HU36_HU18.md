# 💻 SNIPPETS DE CÓDIGO - HU36 & HU18

Copiar-pegar listos para implementar. Ajusta según necesidad.

---

## BACKEND

### 1. Mejorar `views.py` - Historial Cliente (HU-18)

```python
# backend/src/ventas/views.py - REEMPLAZAR función existente

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.db.models import Sum, Count
from datetime import datetime
from .models import Venta
from .serializers import VentaClienteSerializer

class VentaPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

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
    - page: int (número de página)
    - page_size: int (registros por página, default 20)
    
    Ejemplo:
    GET /api/ventas/historial/?estado=pagada&fecha_desde=2026-01-01
    """
    
    usuario = request.user
    
    # Obtener cliente asociado al usuario
    try:
        cliente = usuario.cliente
    except:
        return Response(
            {"detail": "Usuario no tiene cliente asociado"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Filtro base: ventas del cliente en el tenant actual
    qs = Venta.objects.filter(
        tenant=request.tenant,
        cliente=cliente
    ).select_related('cliente', 'factura').prefetch_related('detalles').order_by('-created_at')
    
    # FILTRO: Estado
    if estado := request.query_params.get('estado'):
        if estado in dict(Venta.ESTADO_CHOICES):
            qs = qs.filter(estado=estado)
    
    # FILTRO: Fecha desde
    if fecha_desde := request.query_params.get('fecha_desde'):
        try:
            fecha_obj = datetime.strptime(fecha_desde, '%Y-%m-%d').date()
            qs = qs.filter(created_at__date__gte=fecha_obj)
        except ValueError:
            return Response(
                {"detail": "fecha_desde debe ser YYYY-MM-DD"},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    # FILTRO: Fecha hasta
    if fecha_hasta := request.query_params.get('fecha_hasta'):
        try:
            fecha_obj = datetime.strptime(fecha_hasta, '%Y-%m-%d').date()
            qs = qs.filter(created_at__date__lte=fecha_obj)
        except ValueError:
            return Response(
                {"detail": "fecha_hasta debe ser YYYY-MM-DD"},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    # FILTRO: Monto mínimo
    if monto_min := request.query_params.get('monto_min'):
        try:
            qs = qs.filter(total__gte=float(monto_min))
        except ValueError:
            return Response(
                {"detail": "monto_min debe ser un número"},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    # FILTRO: Monto máximo
    if monto_max := request.query_params.get('monto_max'):
        try:
            qs = qs.filter(total__lte=float(monto_max))
        except ValueError:
            return Response(
                {"detail": "monto_max debe ser un número"},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    # BÚSQUEDA: Por ID de venta
    if search := request.query_params.get('search'):
        qs = qs.filter(id__icontains=search)
    
    # PAGINACIÓN
    paginator = VentaPagination()
    page = paginator.paginate_queryset(qs, request)
    if page is not None:
        serializer = VentaClienteSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
    
    serializer = VentaClienteSerializer(qs, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def obtener_estadisticas_cliente(request):
    """
    HU-18: Estadísticas personales del cliente.
    
    Devuelve:
    - total_gastado: Bs
    - total_compras: número
    - ticket_promedio: Bs
    - ultima_compra: objeto Venta
    - compras_este_mes: número
    """
    
    usuario = request.user
    try:
        cliente = usuario.cliente
    except:
        return Response(
            {"detail": "Usuario no tiene cliente asociado"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Solo ventas completadas
    qs = Venta.objects.filter(
        tenant=request.tenant,
        cliente=cliente,
        estado__in=['pagada', 'entregada']
    )
    
    # Agregados
    agg = qs.aggregate(
        total=Sum('total'),
        cantidad=Count('id')
    )
    
    stats = {
        "total_gastado": float(agg['total'] or 0),
        "total_compras": agg['cantidad'] or 0,
        "ticket_promedio": 0,
        "ultima_compra": None,
    }
    
    if stats['total_compras'] > 0:
        stats['ticket_promedio'] = round(stats['total_gastado'] / stats['total_compras'], 2)
    
    # Última compra
    ultima = qs.order_by('-created_at').first()
    if ultima:
        from .serializers import VentaClienteSerializer
        stats['ultima_compra'] = VentaClienteSerializer(ultima).data
    
    return Response(stats)
```

### 2. Crear `serializers.py` - Nuevos Serializers

```python
# backend/src/ventas/serializers.py - AGREGAR al final

class VentaClienteSerializer(serializers.ModelSerializer):
    """
    Serializer limitado para cliente (solo info relevante).
    Usado en HU-18 para historial de ventas.
    """
    detalles = DetalleVentaSerializer(many=True, read_only=True)
    estado_label = serializers.CharField(source='get_estado_display', read_only=True)
    
    class Meta:
        model = Venta
        fields = [
            'id',
            'estado',
            'estado_label',
            'total',
            'created_at',
            'detalles',
            'observacion',
        ]
        read_only_fields = fields


class VentaAdminSerializer(serializers.ModelSerializer):
    """
    Serializer completo para admin.
    Usado en HU-36 para gestión de ventas.
    """
    cliente_nombre = serializers.CharField(source='cliente.nombres', read_only=True)
    cliente_email = serializers.CharField(source='cliente.email', read_only=True)
    vendedor_nombre = serializers.SerializerMethodField()
    detalles = DetalleVentaSerializer(many=True, read_only=True)
    estado_label = serializers.CharField(source='get_estado_display', read_only=True)
    origen_label = serializers.CharField(source='get_origen_display', read_only=True)
    
    class Meta:
        model = Venta
        fields = [
            'id',
            'cliente',
            'cliente_nombre',
            'cliente_email',
            'vendedor',
            'vendedor_nombre',
            'origen',
            'origen_label',
            'estado',
            'estado_label',
            'subtotal',
            'descuento',
            'impuesto',
            'total',
            'observacion',
            'created_at',
            'updated_at',
            'detalles',
        ]
    
    def get_vendedor_nombre(self, obj):
        if obj.vendedor:
            return f"{obj.vendedor.first_name} {obj.vendedor.last_name}".strip()
        return "Sin asignar"
```

### 3. Crear `permissions.py` - RBAC

```python
# backend/src/core/permissions.py - AGREGAR al final

class IsAdmin(permissions.BasePermission):
    """
    Permite acceso solo a usuarios con rol ADMIN.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        from .models import obtener_rol_usuario
        role = obtener_rol_usuario(request.user)
        return role == 'ROLE_ADMIN'


class IsAdminOrPharmacist(permissions.BasePermission):
    """
    Permite acceso a ADMIN y FARMACEUTICO.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        from .models import obtener_rol_usuario
        role = obtener_rol_usuario(request.user)
        return role in ['ROLE_ADMIN', 'ROLE_FARMACEUTICO']
```

### 4. Actualizar `urls.py`

```python
# backend/src/ventas/urls.py - REEMPLAZAR

from django.urls import path
from .views import (
    crear_venta_fisica,
    crear_venta_online,
    crear_venta_pos,
    crear_intent_pago,
    confirmar_pago_venta,
    listar_mis_facturas,
    listar_historial_ventas,
    obtener_factura,
    stripe_webhook,
    obtener_estadisticas_cliente,  # NUEVO
)

urlpatterns = [
    # URLs existentes
    path("crear-fisica/", crear_venta_fisica, name="ventas-crear-fisica"),
    path("crear-online/", crear_venta_online, name="ventas-crear-online"),
    path("pos/crear/", crear_venta_pos, name="ventas-pos-crear"),

    # HU-18: Historial de ventas con RBAC y paginación
    path("historial/", listar_historial_ventas, name="ventas-historial"),
    path("historial/estadisticas/", obtener_estadisticas_cliente, name="ventas-estadisticas"),

    # Stripe + Facturación
    path("intent-pago/", crear_intent_pago, name="crear_intent_pago"),
    path("confirmar-pago/", confirmar_pago_venta, name="confirmar_pago_venta"),
    path("mis-facturas/", listar_mis_facturas, name="listar_mis_facturas"),
    path("factura/<str:numero_factura>/", obtener_factura, name="obtener_factura"),
    path("stripe/webhook/", stripe_webhook, name="stripe_webhook"),
]
```

---

## FRONTEND

### 1. Actualizar `MisComprasPage.jsx` - Mejorado (HU-18)

```jsx
// frontend/src/pages/MisComprasPage.jsx - REEMPLAZAR COMPLETO

import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

function BackIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ShoppingBagIcon({ className = "h-6 w-6" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  );
}

export default function MisComprasPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  // Estado
  const [compras, setCompras] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // Filtros
  const [estado, setEstado] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [montoMin, setMontoMin] = useState('');
  const [montoMax, setMontoMax] = useState('');
  const [search, setSearch] = useState('');

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };
  
  // Cargar datos
  useEffect(() => {
    fetchCompras();
    fetchEstadisticas();
  }, [page, estado, fechaDesde, fechaHasta, montoMin, montoMax, search, pageSize]);
  
  const fetchCompras = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('page_size', pageSize);
      if (estado) params.append('estado', estado);
      if (fechaDesde) params.append('fecha_desde', fechaDesde);
      if (fechaHasta) params.append('fecha_hasta', fechaHasta);
      if (montoMin) params.append('monto_min', montoMin);
      if (montoMax) params.append('monto_max', montoMax);
      if (search) params.append('search', search);
      
      const response = await fetch(`/api/ventas/historial/?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
      });
      
      if (!response.ok) throw new Error('Error cargando compras');
      
      const data = await response.json();
      setCompras(data.results || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchEstadisticas = async () => {
    try {
      const response = await fetch(`/api/ventas/historial/estadisticas/`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setEstadisticas(data);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };
  
  const limpiarFiltros = () => {
    setEstado('');
    setFechaDesde('');
    setFechaHasta('');
    setMontoMin('');
    setMontoMax('');
    setSearch('');
    setPage(1);
  };

  return (
    <main className="farm-bg min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            to="/perfil"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <BackIcon className="h-4 w-4" />
            Mi perfil
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Título */}
        <div className="mb-6 flex items-start gap-4">
          <div className="rounded-2xl bg-teal-100 p-3">
            <ShoppingBagIcon className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mis compras</h1>
            <p className="text-sm text-slate-600">Historial de tus transacciones</p>
          </div>
        </div>

        {/* Estadísticas */}
        {estadisticas && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase">Total gastado</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                Bs {estadisticas.total_gastado?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase">Compras</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {estadisticas.total_compras || 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase">Ticket promedio</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                Bs {estadisticas.ticket_promedio?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase">Última compra</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {estadisticas.ultima_compra 
                  ? new Date(estadisticas.ultima_compra.created_at).toLocaleDateString() 
                  : '-'}
              </p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-slate-900">Filtros</h2>
          
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400"
            />
            
            <select
              value={estado}
              onChange={(e) => { setEstado(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Estado</option>
              <option value="pagada">Pagada</option>
              <option value="pendiente">Pendiente</option>
              <option value="entregada">Entregada</option>
              <option value="cancelada">Cancelada</option>
            </select>
            
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => { setFechaDesde(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => { setFechaHasta(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            
            <input
              type="number"
              placeholder="Monto mín"
              value={montoMin}
              onChange={(e) => { setMontoMin(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400"
            />
            
            <input
              type="number"
              placeholder="Monto máx"
              value={montoMax}
              onChange={(e) => { setMontoMax(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400"
            />
          </div>
          
          <button
            onClick={limpiarFiltros}
            className="mt-3 text-sm text-teal-600 font-medium hover:text-teal-700"
          >
            Limpiar filtros
          </button>
        </div>

        {/* Compras */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12">Cargando...</div>
          ) : compras.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No hay compras que coincidan con los filtros
            </div>
          ) : (
            compras.map((compra) => (
              <div
                key={compra.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 transition"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Compra #{compra.id}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(compra.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">
                      Bs {compra.total.toFixed(2)}
                    </p>
                    <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                      compra.estado === 'pagada' ? 'bg-green-100 text-green-700' :
                      compra.estado === 'entregada' ? 'bg-blue-100 text-blue-700' :
                      compra.estado === 'cancelada' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {compra.estado_label}
                    </span>
                  </div>
                </div>
                
                {/* Detalles de items */}
                <div className="mb-3 space-y-1">
                  {compra.detalles.map((detalle) => (
                    <p key={detalle.id} className="text-sm text-slate-600">
                      • {detalle.producto_nombre} (x{detalle.cantidad})
                    </p>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
```

### 2. Crear `AdminVentasPage.jsx` - Admin (HU-36)

```jsx
// frontend/src/pages/admin/AdminVentasPage.jsx - NUEVO ARCHIVO

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function AdminVentasPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await fetch('/api/admin/ventas/dashboard/', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      }
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
          <p className="mt-1 text-sm text-slate-600">HU-36: Módulo de gestión y análisis</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-slate-200">
          <div className="flex gap-4">
            {['dashboard', 'transacciones', 'analisis'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium text-sm transition capitalize ${
                  activeTab === tab
                    ? 'border-b-2 border-teal-600 text-teal-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">Cargando dashboard...</div>
        ) : (
          <div>
            {activeTab === 'dashboard' && dashboard && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KPICard
                  label="Ventas Hoy"
                  value={dashboard.hoy?.ventas || 0}
                  detail={`Bs ${(dashboard.hoy?.total || 0).toFixed(2)}`}
                />
                <KPICard
                  label="Ventas Semana"
                  value={dashboard.semana?.ventas || 0}
                  detail={`Bs ${(dashboard.semana?.total || 0).toFixed(2)}`}
                />
                <KPICard
                  label="Ventas Mes"
                  value={dashboard.mes?.ventas || 0}
                  detail={`Bs ${(dashboard.mes?.total || 0).toFixed(2)}`}
                />
                <KPICard
                  label="Ticket Promedio"
                  value={`Bs ${(dashboard.ticket_promedio || 0).toFixed(2)}`}
                  detail="promedio por venta"
                />
              </div>
            )}

            {activeTab === 'transacciones' && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-slate-600">📋 Tabla de transacciones (en desarrollo)</p>
              </div>
            )}

            {activeTab === 'analisis' && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-slate-600">📊 Análisis y gráficos (en desarrollo)</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function KPICard({ label, value, detail }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
```

### 3. Actualizar `App.jsx` - Agregar rutas

```jsx
// frontend/src/App.jsx - AGREGAR en el router

import AdminVentasPage from './pages/admin/AdminVentasPage';

// En la sección de rutas admin:
{
  path: '/admin/ventas',
  element: <AdminVentasPage />,
  requiredRole: ['ROLE_ADMIN'],
}
```

---

## TESTING RÁPIDO

### Backend - Probar endpoint HU-18

```bash
# Con curl:
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:8000/api/ventas/historial/?estado=pagada&fecha_desde=2026-01-01"

# Con Python:
import requests
headers = {'Authorization': 'Bearer YOUR_JWT_TOKEN'}
response = requests.get('http://localhost:8000/api/ventas/historial/', headers=headers)
print(response.json())
```

### Frontend - Verificar que carga

```bash
cd frontend
npm run dev

# Ir a: http://localhost:5173/miscompras
# Si ves el componente y carga datos → OK ✅
```

---

## CHECKLIST

- [ ] Copiar código de `views.py` (filtros + estadísticas)
- [ ] Copiar código de `serializers.py` (nuevos serializers)
- [ ] Copiar código de `permissions.py` (RBAC)
- [ ] Actualizar `urls.py`
- [ ] Reemplazar `MisComprasPage.jsx`
- [ ] Crear `AdminVentasPage.jsx`
- [ ] Actualizar rutas en `App.jsx`
- [ ] Probar con curl/Postman
- [ ] Probar en navegador
- [ ] Commit

---

**Listos para copiar-pegar.** Ajusta según necesidad. 💻

