# 📊 ANÁLISIS COMPLETO DEL CODEBASE - FARMACIA-PROJECT

**Fecha de Análisis:** Mayo 30, 2026  
**Estado:** SaaS Multi-Tenant - Sprint 3 Completado

---

## 📑 TABLA DE CONTENIDOS

1. [Arquitectura General](#1-arquitectura-general)
2. [Backend (Django)](#2-backend-django)
3. [Frontend (React + Vite)](#3-frontend-react--vite)
4. [Mobile (Flutter)](#4-mobile-flutter)
5. [Infraestructura (Docker)](#5-infraestructura-docker)
6. [Dependencias Principales](#6-dependencias-principales)
7. [Flujo de Datos y Patrones](#7-flujo-de-datos-y-patrones)
8. [Migraciones y Setup](#8-migraciones-y-setup)
9. [Entorno de Desarrollo](#9-entorno-de-desarrollo)
10. [Características Especiales (Sprint 3)](#10-características-especiales-sprint-3)

---

## 1. ARQUITECTURA GENERAL

### Patrón Arquitectónico: **SaaS Multi-Tenant**

**Modelo de Despliegue:**
- **Tipo:** Monolítico vertical (una única aplicación Django sirviendo múltiples "farmacias" como tenants independientes)
- **Aislamiento:** Schemas PostgreSQL separados por tenant (usando `django-tenants`)
- **Acceso:** Por subdominio HTTP (ej: `farmacia1.localhost`, `farmacia2.localhost`)
- **Escalabilidad:** Soporta múltiples farmacias sin código duplicado

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                      ARQUITECTURA GENERAL                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  CLIENT LAYER (Web)              CLIENT LAYER (Mobile)      │
│  ├─ React SPA (Vite)             ├─ Flutter iOS            │
│  └─ Port 5173                    ├─ Flutter Android        │
│                                   └─ Firebase Messaging     │
│        │                               │                     │
│        └───────────────┬───────────────┘                     │
│                        ▼                                      │
│  ┌──────────────────────────────────────────┐               │
│  │   NGINX / API Gateway (Port 80, 443)     │               │
│  │   ├─ Multitenancy Detection              │               │
│  │   └─ CORS / Security Headers             │               │
│  └──────────────────────────────────────────┘               │
│                        │                                      │
│        ┌───────────────┴───────────────┐                     │
│        ▼                               ▼                      │
│  ┌─────────────────┐          ┌─────────────────┐          │
│  │  DJANGO REST    │          │  CELERY WORKER  │          │
│  │  API            │          │  + Celery-Beat  │          │
│  │  ├─ JWT Auth    │          │  (Async Tasks)  │          │
│  │  ├─ RBAC        │          └─────────────────┘          │
│  │  ├─ Multi-Tenant│                │                       │
│  │  └─ REST APIs   │                │ Scheduled              │
│  └─────────────────┘                │ Backups                │
│        │                            │                        │
│        └────────────┬────────────────┘                       │
│                     ▼                                         │
│  ┌──────────────────────────────────────────┐               │
│  │     POSTGRESQL 16                        │               │
│  │  ├─ Shared Schema (Users, Tenants)      │               │
│  │  ├─ Tenant-Specific Schemas              │               │
│  │  │  ├─ farmacia1.*                       │               │
│  │  │  ├─ farmacia2.*                       │               │
│  │  │  └─ ... farmacia_n.*                  │               │
│  │  └─ Full Text Search Indexes             │               │
│  └──────────────────────────────────────────┘               │
│                     │                                         │
│     ┌───────────────┴───────────────┐                       │
│     ▼                               ▼                        │
│  ┌──────────┐                   ┌──────────┐               │
│  │ REDIS 7  │                   │ BACKUPS  │               │
│  │ (Cache & │                   │ /backups │               │
│  │  Queue)  │                   │ (Volume) │               │
│  └──────────┘                   └──────────┘               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Frontend Web** | React + Vite | 18.3.1 + 6.2.0 |
| **Frontend Mobile** | Flutter | 3.9.2+ |
| **Backend API** | Django REST Framework | 5.1.6 + 3.15.2 |
| **Database** | PostgreSQL | 16-alpine |
| **Cache/Queue** | Redis | 7-alpine |
| **Task Queue** | Celery | 5.4.0 |
| **Task Scheduler** | Celery-Beat | 2.7.0 |
| **Authentication** | JWT + RBAC | django-tenants 3.7.0 |
| **Payments** | Stripe API | 15.1.0 |
| **Push Notifications** | Firebase Cloud Messaging | 3.15.1+ |
| **AI/ML** | Google Gemini + scikit-learn | 2.5-flash + 1.5.2 |

---

## 2. BACKEND (DJANGO 5.1.6)

### Estructura de Aplicaciones Django

#### **Core App** - Fundación del Sistema
- **Responsabilidad:** Auditoría, autenticación, permisos RBAC, seguridad
- **Modelos:**
  - `BitacoraSistema` - Log completo de acciones (create/update/delete/login)
  - `PermissionGroup` - Grupos de permisos granulares
  - `RolePermission` - Mapeo roles ↔ permisos
  - `UserRole` - Asignación de roles a usuarios
- **Vistas:** ViewSet para auditoría y permisos
- **Middleware:**
  - `TenantContextMiddleware` - Resuelve tenant por subdominio
  - `TenantAccessMiddleware` - Valida acceso a tenant
  - `SecurityMiddleware` - Headers de seguridad

#### **Inventarios App** - Gestión de Stock
- **Modelos:**
  - `Producto` - Datos base (nombre, descripción, principio_activo)
  - `Categoria` - Clasificación de productos
  - `Subcategoria` - Subcategorización
  - `Laboratorio` - Datos de manufactura
  - `Inventario` - Stock actual por producto/ubicación
  - `MovimientoInventario` - Historial de cambios (entrada/salida/ajuste)
  - `EntradaStock` - Registros de compras
  - `ProductoPermiso` - Control granular de acceso a productos
- **Vistas:**
  - `ProductoViewSet` - CRUD con filtros avanzados
  - `InventarioViewSet` - Stock real-time
  - `MovimientoInventarioViewSet` - Historial con auditoría
- **Funcionalidades:**
  - Búsqueda full-text por nombre/principio_activo
  - Historial completo de movimientos
  - Validación de stock en ventas

#### **Clientes App** - Gestión de Usuarios Finales
- **Modelos:**
  - `Cliente` - Datos demográficos (nombre, email, teléfono, dirección)
  - `RecetaMedica` ✨ **[SPRINT 3]** - Recetas médicas con medico_receta
  - `MedicoReceta` ✨ **[SPRINT 3]** - Profesional que prescribe
  - `ClienteSegmento` - Clasificación por cohorte (RFM analysis)
- **Vistas:**
  - `ClienteViewSet` - CRUD con búsqueda
  - `RecetaMedicaViewSet` - Validación y consulta de recetas ✨
  - `SegmentacionViewSet` - Análisis de cohortes (RFM)
- **Servicios:**
  - `cliente_service.py` - Lógica de segmentación automática
  - Validación de recetas en ventas (prevent_venta_sin_receta)

#### **Ventas App** - Transacciones y Facturación
- **Modelos:**
  - `Venta` - Orden maestra (fecha, cliente, total, estado)
  - `DetalleVenta` - Ítems de la venta (producto, cantidad, precio)
  - `Factura` - Documento fiscal (número de autorización, NIT, etc.)
  - `CarritoInvitado` - Validación de receta_requerida antes de checkout
- **Vistas:**
  - `VentaViewSet` - CRUD con transacciones atómicas
  - `FacturaViewSet` - Generación y consulta de facturas
- **Servicios:**
  - `ventas_service.py`
    - `crear_venta_desde_carrito()` - Atomic transaction
    - `validar_receta_en_venta()` - Verificar receta si es medicamento controlado
    - `generar_factura()` - PDF generation + blockchain (future)
    - `registrar_movimientos_inventario()` - Stock update

#### **Carrito App** - Compra Online y Tienda
- **Modelos:**
  - `Carrito` - Sesión de compra (usuario autenticado)
  - `CarritoItem` - Detalle de productos (producto, cantidad, precio)
  - `CarritoInvitado` - Soporte para invitados con token
- **Vistas:**
  - `CarritoViewSet` - Agregar/quitar/actualizar items
  - `CarritoInvitadoViewSet` - Checkout anónimo
- **Funcionalidades:**
  - Tokens de invitado (64-char hex secret) persistidos en cookies
  - Validación de stock antes de checkout
  - Cálculo automático de subtotal/IVA/total
  - Soporte para cupones/descuentos

#### **Tratamientos App** - Planes Terapéuticos
- **Modelos:**
  - `TratamientoBase` - Plantilla (medicamento, dosis, frecuencia)
  - `TratamientoActivo` - Instancia asignada a cliente (fecha_inicio, fecha_fin)
  - `TomaMedicamento` - Log de cada vez que se toma (timestamp, confirmado)
  - `Recordatorio` - Notificaciones push (hora, canales)
  - `ParametroNotificacion` - Config global de recordatorios
- **Vistas:**
  - `TratamientoViewSet` - CRUD de planes
  - `TomaMedicamentoViewSet` - Registrar tomas
  - `ReminderViewSet` - FCM push via Firebase
- **Servicios:**
  - `reminder_service.py` - Envío a Firebase Cloud Messaging
  - `treatment_service.py` - Validación de adherencia
- **Celery Tasks:**
  - `send_treatment_reminders.py` - Scheduled (cada 6 horas)

#### **Backup App** - Backups Automáticos
- **Modelos:**
  - `BackupLog` - Registro de cada backup (schema, date, size, status)
  - `BackupSchedule` - Configuración de frecuencia (hourly/daily/weekly/monthly/custom cron)
- **Vistas:**
  - `BackupViewSet` - Listar/descargar/restaurar backups
- **Servicios:**
  - `backup_service.py`
    - `perform_backup()` - PostgreSQL dump con pg_dump
    - `restore_backup()` - pg_restore con validación
- **Celery Tasks:**
  - `celery_beat` - Ejecuta según `BackupSchedule`
  - Archivos almacenados en `/app/backups` (volumen Docker)

#### **Reportes App** - Analytics e IA
- **Modelos:**
  - `Reporte` - Configuración de reportes guardados
  - `ReporteFavorito` - Bookmarks de usuarios
- **Vistas:**
  - `ReporteViewSet` - CRUD de reportes
  - `AnalyticsViewSet` - Endpoints para dashboards
- **Servicios:**
  - `gemini_service.py` - Integración Google Gemini
    - `analizar_por_texto()` - Procesa preguntas en NLP
    - `analizar_por_audio()` - Transcribe + analiza audio
    - Fallback models: gemini-2.5-flash → 2.0-flash → 2.0-flash-lite
  - `report_service.py` - Agregaciones, filtros, segmentación
- **Endpoints:**
  - `/api/reportes/ventas/` - Totales, tendencias, top productos
  - `/api/reportes/inventario/` - Stock bajo, rotación, ABC
  - `/api/reportes/clientes/` - RFM, lifetime value, churn
  - `/api/reportes/gemini/` - IA text/audio analysis

#### **Predicciones App** - ML para Demanda
- **Modelos:**
  - `Prediccion` - Resultados de ML (producto, período, forecast_cantidad)
  - `ModeloEntrenado` - Metadata de modelo (fecha, accuracy, rmse)
- **Vistas:**
  - `PrediccionViewSet` - Consultar predicciones
- **Servicios:**
  - `ml_service.py`
    - `entrenar_modelo()` - scikit-learn ARIMA/Prophet
    - `predecir_demanda()` - Forecast 30 días
    - `calcular_punto_reorden()` - Stock mínimo automático
  - Celery tasks: Reentrenamiento semanal automático
- **Algoritmos:**
  - ARIMA (AutoRegressive Integrated Moving Average)
  - Prophet (Facebook) para tendencias estacionales
  - Fallback: Media móvil simple

#### **Opiniones App** - Reviews y Feedback
- **Modelos:**
  - `Opinion` - Base (calificación 1-5, comentario, fecha)
  - `OpinionVenta` - Feedback sobre transacción
  - `OpinionProducto` - Reseña de medicamento
  - `OpinionServicio` - Feedback general
- **Vistas:**
  - `OpinionViewSet` - CRUD con filtros por tipo
- **Análisis:**
  - Ratings promedio por producto/vendedor
  - Moderación de comentarios (puede configurarse)

#### **Tenants App** - Gestión Multi-Tenancy
- **Modelos:**
  - `Tenant` - Definición de cada farmacia (nombre, schema_name, plan)
  - `Domain` - Subdominio(s) asociados (farmacia1.localhost)
  - `TenantUser` - Usuarios específicos del tenant
  - `TenantRole` - Roles customizables por tenant (admin, farmacéutico, cajero, cliente)
  - `TenantPlan` - Planes de suscripción (plan, precio, features)
  - `TenantSubscription` - Historial de suscripciones (estado, fecha_inicio, fecha_fin)
- **Vistas:**
  - `TenantViewSet` - Crear/actualizar tenants (admin global)
  - `TenantSubscriptionViewSet` - Gestión de billing
- **Servicios:**
  - `tenants_service.py`
    - `create_tenant_with_admin()` - Setup completo nuevo tenant
    - `sync_roles_across_tenants()` - Sincronizar roles
    - `migrate_tenant_data()` - Migración de datos entre schemas
  - Stripe webhook integration para pagos

### Autenticación y Autorización

#### **JWT (JSON Web Tokens)**
```python
# Librería: djangorestframework-simplejwt 5.3.1

# Token Structure:
{
  "token_type": "Bearer",
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",  # 15 min TTL
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."   # 7 días TTL
}

# Almacenamiento (Frontend):
- Cookie: access_token_{schema_name}
- Header: Authorization: Bearer <token>
- Cookie: refresh_token (HttpOnly, Secure)

# Validación (Backend):
- CookieOrHeaderJWTAuthentication
- Verifica firma + TTL + usuario existe
- Resuelve tenant_id desde usuario.tenant
```

#### **RBAC (Role-Based Access Control)**
```
Roles Definidos:
├─ ROLE_ADMIN
│  └─ Acceso total (todos los permisos)
│
├─ ROLE_FARMACEUTICO
│  ├─ inventario.ver, inventario.gestionar
│  ├─ productos.ver, productos.crear, productos.editar
│  ├─ ventas.ver, ventas.crear
│  ├─ reportes.ver, reportes.crear
│  └─ tratamientos.ver
│
├─ ROLE_CAJERO
│  ├─ ventas.ver, ventas.crear, ventas.editar
│  ├─ carrito.ver, carrito.gestionar
│  ├─ clientes.ver
│  └─ reportes.ver_caja
│
└─ ROLE_CLIENTE
   ├─ clientes.ver_perfil_propio
   ├─ carrito.gestionar_propio
   ├─ ventas.ver_propias
   ├─ tratamientos.ver_propios
   └─ opiniones.crear

Permisos Granulares:
├─ usuarios.ver
├─ usuarios.crear
├─ usuarios.editar
├─ usuarios.eliminar
├─ productos.ver
├─ productos.gestionar
├─ inventario.registrar_entrada
├─ inventario.registrar_salida
├─ ventas.procesar_sin_receta (para medicamentos OTC)
├─ reportes.analizar_con_ia
└─ [30+ permisos adicionales]
```

#### **Middleware Order (Ejecución)**
```
1. TenantMainMiddleware
   └─ Detecta tenant por Request (subdominio, header X-Tenant-ID)
   └─ Carga Tenant object, establece schema

2. DevTenantHeaderMiddleware (solo DEBUG=True)
   └─ Permite override con header X-Tenant-ID=farmacia1

3. SecurityMiddleware
   └─ HSTS, X-Frame-Options, X-Content-Type-Options, etc.

4. CORS Middleware (django-cors-headers)
   └─ Valida CORS_ALLOWED_ORIGINS

5. TenantContextMiddleware
   └─ connection.set_tenant(tenant)
   └─ Todas las queries posteriores filtran por schema

6. AuthenticationMiddleware
   └─ Resuelve request.user desde JWT

7. TenantAccessMiddleware
   └─ Verifica que user.tenant == request.tenant
   └─ Previene saltos entre tenants

8. PermissionMiddleware (Custom)
   └─ Cache de permisos en Redis
```

### URL Configuration

```
Backend URL Namespace Structure:
├─ /api/
│  ├─ token/
│  │  ├─ POST → access_token + refresh_token
│  │  └─ refresh/ → nuevo access_token
│  │
│  ├─ core/
│  │  ├─ usuarios/ → CRUD usuarios
│  │  ├─ roles/ → CRUD roles
│  │  ├─ permisos/ → CRUD permisos
│  │  ├─ bitacora/ → Auditoría (log-only)
│  │  └─ configuracion/ → Settings por tenant
│  │
│  ├─ inventarios/
│  │  ├─ productos/ → CRUD productos
│  │  ├─ categorias/ → CRUD categorías
│  │  ├─ subcategorias/ → CRUD subcategorías
│  │  ├─ laboratorios/ → CRUD laboratorios
│  │  ├─ inventarios/ → Stock real-time
│  │  └─ movimientos/ → Historial
│  │
│  ├─ clientes/
│  │  ├─ clientes/ → CRUD clientes
│  │  ├─ recetas/ → CRUD RecetaMedica (Sprint 3)
│  │  ├─ medicos/ → CRUD MedicoReceta
│  │  └─ segmentacion/ → RFM analysis
│  │
│  ├─ ventas/
│  │  ├─ ventas/ → CRUD ventas
│  │  ├─ detalles/ → Items de venta
│  │  ├─ facturas/ → Facturación
│  │  └─ devoluciones/ → Notas de crédito
│  │
│  ├─ carrito/
│  │  ├─ carrito/ → Mi carrito (autenticado)
│  │  └─ invitado/ → Carrito anónimo
│  │
│  ├─ tratamientos/
│  │  ├─ tratamientos/ → CRUD planes
│  │  ├─ tomas/ → Log de tomas
│  │  └─ recordatorios/ → Push notifications
│  │
│  ├─ backups/
│  │  ├─ backups/ → Listar/descargar/restaurar
│  │  └─ schedules/ → Configurar automatización
│  │
│  ├─ reportes/
│  │  ├─ ventas/ → Agregaciones de ventas
│  │  ├─ inventario/ → Stock y rotación
│  │  ├─ clientes/ → Segmentación y lifetime value
│  │  ├─ gemini/ → IA analysis (text/audio)
│  │  └─ favoritos/ → Reportes guardados
│  │
│  ├─ predicciones/
│  │  ├─ predicciones/ → Forecast de demanda
│  │  ├─ entrenar/ → Reentrenamiento manual
│  │  └─ metrics/ → Accuracy/RMSE
│  │
│  ├─ opiniones/
│  │  ├─ opiniones/ → CRUD opiniones
│  │  ├─ ventas/ → Feedback por transacción
│  │  ├─ productos/ → Reseñas de medicamentos
│  │  └─ servicios/ → Feedback general
│  │
│  └─ tenants/
│     ├─ tenants/ → CRUD (admin global)
│     ├─ planes/ → Planes de suscripción
│     └─ subscripciones/ → Billing
│
├─ /admin/
│  └─ Django Admin Interface (para superuser global)
│
└─ /health/
   └─ Health check (liveness probe Docker)
```

---

## 3. FRONTEND (REACT + VITE)

### Stack Tecnológico

| Librería | Versión | Propósito |
|----------|---------|----------|
| **React** | 18.3.1 | UI library (hooks, components) |
| **React Router** | 7.13.1 | Routing (SPA navigation) |
| **Vite** | 6.2.0 | Build tool + dev server |
| **Tailwind CSS** | 3.4.17 | Utility-first styling |
| **Recharts** | 2.12.7 | Gráficos e charts |
| **Stripe React** | 6.3.0 | Formulario de pagos (PCI-compliant) |
| **jsPDF** | 4.2.1 | Generación PDF de facturas |
| **jsPDF-AutoTable** | 5.0.7 | Tablas en PDF |
| **Axios** (via fetch) | - | HTTP client (apiClient.js) |
| **PostCSS** | 8+ | CSS processing (Tailwind) |

### Estructura de Carpetas

```
frontend/
├─ src/
│  ├─ components/
│  │  ├─ admin/
│  │  │  ├─ AdminDashboard.jsx          ← KPI cards, charts
│  │  │  ├─ AdminUsersList.jsx          ← CRUD usuarios
│  │  │  ├─ AdminRolesPermisos.jsx      ← RBAC management
│  │  │  ├─ AdminProductos.jsx          ← Catálogo
│  │  │  ├─ AdminInventarios.jsx        ← Stock management
│  │  │  ├─ AdminLaboratorios.jsx       ← Laboratorios
│  │  │  ├─ AdminCategorias.jsx         ← Categorías/subcategorías
│  │  │  ├─ AdminTratamientos.jsx       ← Planes terapéuticos
│  │  │  ├─ AdminBackups.jsx            ← Gestión de backups
│  │  │  ├─ AdminPredicciones.jsx       ← ML forecasts
│  │  │  ├─ AdminReportes.jsx           ← Reportes + Gemini IA
│  │  │  ├─ AdminBitacora.jsx           ← Auditoría log
│  │  │  ├─ AdminRecetas.jsx            ← RecetaMedica (Sprint 3)
│  │  │  ├─ AdminOpinames.jsx           ← Reviews
│  │  │  └─ SegmentacionClientesPanel.jsx ← RFM (Sprint 3)
│  │  │
│  │  ├─ auth/
│  │  │  ├─ LoginForm.jsx               ← Form login
│  │  │  ├─ RegisterForm.jsx            ← Form registro
│  │  │  ├─ ForgotPasswordForm.jsx      ← Reset password
│  │  │  ├─ VerifyEmailModal.jsx        ← Email verification
│  │  │  └─ ResetPasswordForm.jsx       ← Token-based reset
│  │  │
│  │  ├─ crm/
│  │  │  ├─ ClientesList.jsx            ← Listado clientes
│  │  │  ├─ ClienteDetail.jsx           ← Detalle + editar
│  │  │  ├─ ClienteSegmentationPanel.jsx ← RFM analysis
│  │  │  └─ ClienteRecetas.jsx          ← Recetas del cliente
│  │  │
│  │  ├─ layout/
│  │  │  ├─ Header.jsx                  ← Top navigation
│  │  │  ├─ Sidebar.jsx                 ← Menu lateral (RBAC aware)
│  │  │  ├─ Footer.jsx                  ← Footer
│  │  │  └─ PageLoader.jsx              ← Loading skeleton
│  │  │
│  │  ├─ pos/
│  │  │  ├─ POSTerminal.jsx             ← Punto de venta
│  │  │  ├─ ProductSearch.jsx           ← Búsqueda rápida
│  │  │  ├─ CartSummary.jsx             ← Resumen venta
│  │  │  ├─ PaymentProcessor.jsx        ← Pago (cash/card/stripe)
│  │  │  └─ ReceiptPrinter.jsx          ← Impresora térmica
│  │  │
│  │  ├─ routing/
│  │  │  ├─ ProtectedRoute.jsx          ← Requiere auth
│  │  │  ├─ AdminRoute.jsx              ← Requiere role ADMIN
│  │  │  ├─ POSRoute.jsx                ← Requiere role FARMACEUTICO/CAJERO
│  │  │  └─ ClientRoute.jsx             ← Requiere role CLIENTE
│  │  │
│  │  ├─ sections/
│  │  │  ├─ CarritoSection.jsx          ← Carrito online
│  │  │  ├─ CheckoutForm.jsx            ← Checkout flow
│  │  │  ├─ PaymentForm.jsx             ← Stripe integration
│  │  │  ├─ ValidarRecetaModal.jsx      ← Validación receta (Sprint 3)
│  │  │  ├─ MedicoCard.jsx              ← Card medico (Sprint 3)
│  │  │  └─ ConfirmacionPedido.jsx      ← Order confirmation
│  │  │
│  │  └─ ui/
│  │     ├─ Button.jsx                  ← Styled button
│  │     ├─ Input.jsx                   ← Styled input
│  │     ├─ Modal.jsx                   ← Modal container
│  │     ├─ Alert.jsx                   ← Alert messages
│  │     ├─ Tabs.jsx                    ← Tab navigation
│  │     ├─ Dropdown.jsx                ← Select menu
│  │     ├─ Badge.jsx                   ← Status badges
│  │     └─ Spinner.jsx                 ← Loading spinner
│  │
│  ├─ pages/
│  │  ├─ admin/
│  │  │  ├─ AdminDashboardPage.jsx      ← KPI + charts dashboard
│  │  │  ├─ AdminUsersPage.jsx          ← Gestión usuarios
│  │  │  ├─ AdminRolesPermisosPage.jsx  ← RBAC admin
│  │  │  ├─ AdminClientesPage.jsx       ← CRM
│  │  │  ├─ AdminProductosPage.jsx      ← Catálogo management
│  │  │  ├─ AdminInventariosPage.jsx    ← Stock management
│  │  │  ├─ AdminLaboratoriosPage.jsx   ← Laboratorios
│  │  │  ├─ AdminCategoriasPage.jsx     ← Categorías
│  │  │  ├─ AdminTratamientosPage.jsx   ← Planes terapéuticos
│  │  │  ├─ AdminBackupsPage.jsx        ← Backups management
│  │  │  ├─ AdminPrediccionesPage.jsx   ← ML forecasts
│  │  │  ├─ AdminReportesPage.jsx       ← Reportes + IA (Gemini)
│  │  │  ├─ AdminBitacoraPage.jsx       ← Auditoría
│  │  │  ├─ RecetasPage.jsx             ← RecetaMedica CRUD (Sprint 3)
│  │  │  ├─ AdminOpinionesPage.jsx      ← Reviews management
│  │  │  ├─ SegmentacionClientesPage.jsx ← RFM analysis (Sprint 3)
│  │  │  └─ AdminSuscripcionesPage.jsx  ← Billing (SaaS)
│  │  │
│  │  ├─ auth/
│  │  │  ├─ LoginPage.jsx
│  │  │  ├─ RegisterPage.jsx
│  │  │  ├─ ForgotPasswordPage.jsx
│  │  │  ├─ ResetPasswordPage.jsx
│  │  │  └─ VerifyEmailPage.jsx
│  │  │
│  │  ├─ saas/
│  │  │  ├─ SaaSLandingPage.jsx         ← Landing global
│  │  │  ├─ RegisterTenantPage.jsx      ← Crear farmacia
│  │  │  ├─ GlobalLoginPage.jsx         ← Login admin global
│  │  │  └─ TenantSubscriptionPage.jsx  ← Billing
│  │  │
│  │  ├─ pos/
│  │  │  └─ POSPage.jsx                 ← Terminal punto de venta
│  │  │
│  │  ├─ CheckoutPage.jsx               ← Carrito → venta
│  │  ├─ ClientePerfilPage.jsx          ← Perfil cliente
│  │  ├─ HomePage.jsx                   ← Tienda (catálogo + carrito)
│  │  ├─ TratamientosClientePage.jsx    ← Mis tratamientos
│  │  └─ NotFoundPage.jsx               ← 404 page
│  │
│  ├─ context/
│  │  └─ AuthContext.jsx
│  │     ├─ useAuth() hook
│  │     ├─ login(email, password) → JWT cookie
│  │     ├─ logout() → clear cookies + localStorage
│  │     ├─ setUser(userData)
│  │     └─ isAdmin, isTerminal, isCliente (role helpers)
│  │
│  ├─ hooks/
│  │  ├─ useAdminCategories.js         ← API hook categorías
│  │  ├─ useAdminUsers.js               ← API hook usuarios
│  │  ├─ useAdminRoles.js               ← API hook roles
│  │  ├─ useAdminProducts.js            ← API hook productos
│  │  ├─ useAdminInventory.js           ← API hook inventario
│  │  ├─ useAdminClients.js             ← API hook clientes
│  │  ├─ useAdminTreatments.js          ← API hook tratamientos
│  │  ├─ useAdminBackups.js             ← API hook backups
│  │  ├─ useAdminPredictions.js         ← API hook ML
│  │  ├─ useAdminReports.js             ← API hook reportes
│  │  ├─ useCart.js                     ← Carrito local
│  │  ├─ useCheckout.js                 ← Checkout flow
│  │  ├─ useRecetas.js                  ← RecetaMedica (Sprint 3)
│  │  └─ useGeminiReports.js            ← IA analysis
│  │
│  ├─ services/
│  │  ├─ apiClient.js
│  │  │  ├─ BASE_URL = determina por subdominio
│  │  │  ├─ fetch wrapper con JWT auth
│  │  │  ├─ Error handling + refresh token
│  │  │  └─ Tenant-aware requests (headers)
│  │  │
│  │  ├─ auth.js
│  │  │  ├─ login(email, password)
│  │  │  ├─ register(email, nombre, password)
│  │  │  ├─ logout()
│  │  │  ├─ forgotPassword(email)
│  │  │  └─ resetPassword(token, password)
│  │  │
│  │  ├─ stripe.js
│  │  │  ├─ loadStripe(PUBLIC_KEY)
│  │  │  ├─ createPaymentIntent(amount)
│  │  │  └─ processCardPayment(element, PI)
│  │  │
│  │  ├─ gemini.js
│  │  │  ├─ analizarPorTexto(pregunta)
│  │  │  ├─ analizarPorAudio(audioBlob)
│  │  │  └─ generarReporte(filtros)
│  │  │
│  │  └─ localStorage.js
│  │     ├─ guardaToken(token)
│  │     ├─ obtenerToken()
│  │     └─ limpiarToken()
│  │
│  ├─ lib/
│  │  ├─ formatters.js
│  │  │  ├─ formatCurrency(amount)
│  │  │  ├─ formatDate(date)
│  │  │  ├─ formatPhone(phone)
│  │  │  └─ formatNIT(nit)
│  │  │
│  │  ├─ validators.js
│  │  │  ├─ validateEmail(email)
│  │  │  ├─ validatePassword(password)
│  │  │  ├─ validateNIT(nit)
│  │  │  └─ validateQuantity(qty)
│  │  │
│  │  └─ tenants.js
│  │     ├─ getTenantFromSubdomain()
│  │     ├─ getTenantAPI()
│  │     └─ isGlobalContext()
│  │
│  ├─ data/
│  │  ├─ constants.js                  ← CONSTANTS.ROLES, PERMISSIONS, COLORS
│  │  └─ mockData.js                   ← Demo data
│  │
│  ├─ App.jsx                          ← Root component
│  ├─ index.css                        ← Global styles + Tailwind
│  └─ main.jsx                         ← React entry point
│
├─ index.html                          ← HTML template
├─ vite.config.js                      ← Vite config (dev server, build)
├─ tailwind.config.js                  ← Tailwind customization
├─ postcss.config.js                   ← PostCSS config
├─ package.json                        ← Dependencies + scripts
└─ .env.example                        ← Environment variables template
```

### Routing del Frontend

```javascript
const routes = [
  // Public routes
  { path: '/', element: <HomePage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/auth/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/auth/reset/:token', element: <ResetPasswordPage /> },
  { path: '/auth/verify/:token', element: <VerifyEmailPage /> },
  
  // SaaS global routes
  { path: '/saas', element: <SaaSLandingPage /> },
  { path: '/saas/register', element: <RegisterTenantPage /> },
  
  // Protected routes (require auth)
  {
    path: '/checkout',
    element: <ProtectedRoute><CheckoutPage /></ProtectedRoute>
  },
  {
    path: '/perfil',
    element: <ProtectedRoute><ClientePerfilPage /></ProtectedRoute>
  },
  {
    path: '/tratamientos',
    element: <ProtectedRoute><TratamientosClientePage /></ProtectedRoute>
  },
  
  // Admin routes (require ADMIN role)
  {
    path: '/admin',
    element: <AdminRoute><AdminDashboardPage /></AdminRoute>
  },
  {
    path: '/admin/usuarios',
    element: <AdminRoute><AdminUsersPage /></AdminRoute>
  },
  {
    path: '/admin/roles',
    element: <AdminRoute><AdminRolesPermisosPage /></AdminRoute>
  },
  {
    path: '/admin/clientes',
    element: <AdminRoute><AdminClientesPage /></AdminRoute>
  },
  {
    path: '/admin/productos',
    element: <AdminRoute><AdminProductosPage /></AdminRoute>
  },
  // ... más admin routes
  
  // POS routes (require FARMACEUTICO/CAJERO role)
  {
    path: '/pos',
    element: <POSRoute><POSPage /></POSRoute>
  },
  
  // 404
  { path: '*', element: <NotFoundPage /> }
];
```

### Determinación Automática de Base URL

```javascript
// services/apiClient.js

const getTenantFromSubdomain = () => {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  
  if (parts[0] === 'localhost' || parts[0] === '127') {
    // Local: localhost:5173 → SaaS global
    //        farmacia1.localhost:5173 → tenant farmacia1
    const subdomain = parts[0];
    if (subdomain === 'localhost') return 'shared';
    return subdomain;
  } else {
    // Production: app.farmacia1.com → tenant farmacia1
    return parts[0];
  }
};

const BASE_URL = (() => {
  const tenant = getTenantFromSubdomain();
  const protocol = window.location.protocol;
  const host = window.location.host.split(':')[0];
  
  if (tenant === 'shared') {
    return `${protocol}//${host}:8000/api`;
  } else {
    return `${protocol}//${tenant}.${host}:8000/api`;
  }
})();

// Todos los requests incluyen headers:
headers: {
  'Authorization': `Bearer ${token}`,
  'X-Tenant-ID': getTenantFromSubdomain(),
  'Content-Type': 'application/json'
}
```

### Lazy Loading y Optimización

```javascript
// App.jsx

const HomePage = lazy(() => import('./pages/HomePage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
// ... más lazy imports

const App = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* routes aquí */}
    </Routes>
  </Suspense>
);
```

---

## 4. MOBILE (FLUTTER 3.9.2+)

### Funcionalidades Principales

```
lib/features/
├─ auth/
│  ├─ services/
│  │  ├─ auth_service.dart       ← JWT + refresh tokens
│  │  └─ token_storage.dart      ← SharedPreferences
│  ├─ screens/
│  │  ├─ login_screen.dart
│  │  ├─ register_screen.dart
│  │  └─ forgot_password_screen.dart
│  └─ models/
│     └─ user_model.dart
│
├─ home/
│  ├─ screens/
│  │  └─ home_screen.dart        ← Dashboard cliente
│  └─ widgets/
│     ├─ product_card.dart
│     └─ quick_actions.dart
│
├─ catalog/
│  ├─ screens/
│  │  ├─ catalog_screen.dart     ← Listado productos
│  │  └─ product_detail_screen.dart
│  ├─ services/
│  │  ├─ product_service.dart    ← API calls
│  │  └─ search_service.dart     ← Búsqueda full-text
│  └─ models/
│     └─ product_model.dart
│
├─ cart/
│  ├─ services/
│  │  └─ cart_service.dart       ← Carrito local + sincronización
│  ├─ models/
│  │  └─ cart_item_model.dart
│  └─ screens/
│     └─ cart_screen.dart
│
├─ treatments/
│  ├─ services/
│  │  ├─ treatment_service.dart
│  │  └─ reminder_service.dart   ← Local notifications
│  ├─ models/
│  │  ├─ treatment_model.dart
│  │  └─ reminder_model.dart
│  └─ screens/
│     ├─ treatments_list_screen.dart
│     ├─ treatment_detail_screen.dart
│     └─ treatment_adherence_screen.dart
│
└─ payments/
   ├─ services/
   │  └─ stripe_service.dart     ← flutter_stripe 11.3.0
   └─ screens/
      └─ payment_screen.dart
```

### Integraciones Principales

#### **Firebase Cloud Messaging (Push Notifications)**
```dart
// lib/core/notifications/fcm_service.dart

class FCMService {
  static final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  
  static Future<void> initializeFCM() async {
    // Solicita permiso de notificaciones (iOS)
    await _firebaseMessaging.requestPermission();
    
    // Token FCM para registrar en backend
    String? token = await _firebaseMessaging.getToken();
    // POST /api/clientes/:id/fcm_tokens/ con token
    
    // Escucha mensajes en foreground
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      _handleForegroundMessage(message);
    });
    
    // Escucha cuando la app se abre desde notificación
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      _handleMessageOpenedApp(message);
    });
  }
  
  static void _handleForegroundMessage(RemoteMessage message) {
    // Flutter Local Notifications
    flutterLocalNotificationsPlugin.show(
      message.notification?.title ?? '',
      message.notification?.body ?? '',
      NotificationDetails(...)
    );
  }
}
```

**Casos de Uso:**
- Recordatorios de medicamentos (TreatmentNotificationService)
- Notificaciones de venta completada
- Alertas de inventario bajo (a farmacéutico)
- Mensajes de soporte

#### **Local Notifications (Recordatorios de Medicamentos)**
```dart
// lib/features/treatments/services/treatment_notification_service.dart

class TreatmentNotificationService {
  static final FlutterLocalNotificationsPlugin _plugin = 
    FlutterLocalNotificationsPlugin();
  
  static Future<void> scheduleReminderForTreatment(
    TreatmentModel treatment
  ) async {
    // Parsear horas de toma (ej: "08:00, 14:00, 20:00")
    final hours = treatment.takeTimes.split(',');
    
    for (String hour in hours) {
      final parts = hour.trim().split(':');
      final DateTime nextTime = _nextOccurrence(
        int.parse(parts[0]), 
        int.parse(parts[1])
      );
      
      // Android timezone-aware scheduling
      await _plugin.zonedSchedule(
        treatment.id.hashCode,
        'Recordatorio de medicamento',
        '${treatment.medicationName} - ${treatment.dosage}',
        nextTime,
        NotificationDetails(...),
        androidAllowWhileIdle: true,
        matchDateTimeComponents: DateTimeComponents.time,
      );
    }
  }
}
```

#### **Stripe Payments (flutter_stripe 11.3.0)**
```dart
// lib/features/payments/services/stripe_service.dart

class StripeService {
  static const String publishableKey = 'pk_test_...';
  
  static Future<void> initializeStripe() async {
    await Stripe.instance.publishableKey = publishableKey;
  }
  
  static Future<PaymentResult> processPayment({
    required double amount,
    required String currency,
  }) async {
    try {
      // 1. Crear PaymentIntent en backend
      final response = await http.post(
        Uri.parse('${apiBase}/ventas/create_payment_intent/'),
        headers: {'Authorization': 'Bearer $token'},
        body: jsonEncode({
          'amount': (amount * 100).toInt(), // cents
          'currency': currency,
        })
      );
      
      final clientSecret = jsonDecode(response.body)['client_secret'];
      
      // 2. Presentar formulario de pago con Sheet
      await Stripe.instance.presentPaymentSheet(
        parameters: SetupPaymentSheetParameters(
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'Farmacia',
        )
      );
      
      return PaymentResult.success;
    } catch (e) {
      return PaymentResult.failed(e.toString());
    }
  }
}
```

### Configuración Firebase

```yaml
# pubspec.yaml
firebase_core: ^3.15.1
firebase_messaging: ^15.2.7

# firebase.json (descargar de Firebase Console)
{
  "project_id": "farmacia-446f5",
  "storage_bucket": "farmacia-446f5.appspot.com"
}

# lib/firebase_options.dart (auto-generado por `flutterfire configure`)
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    return android; // or ios, web
  }
  
  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyD...',
    appId: '1:123456...',
    projectId: 'farmacia-446f5',
  );
}
```

### Configuración Multiplataforma

```yaml
# pubspec.yaml
sdk: ">=3.0.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter
  http: ^1.2.2
  shared_preferences: ^2.3.2
  google_fonts: ^6.3.1
  flutter_local_notifications: ^18.0.1
  firebase_core: ^3.15.1
  firebase_messaging: ^15.2.7
  flutter_stripe: ^11.3.0
  pdf: ^4.0.4
  printing: ^6.0.2

flutter:
  uses-material-design: true
```

**Soporta:**
- Android 21+
- iOS 11+
- Web (Flutter Web)
- macOS 10.11+
- Windows 10+
- Linux

---

## 5. INFRAESTRUCTURA (DOCKER)

### Docker Compose Services

```yaml
# docker-compose.yml

version: '3.9'

services:
  # ========== DATABASE ==========
  db:
    image: postgres:16-alpine
    container_name: farmacia_db
    environment:
      POSTGRES_DB: app_db
      POSTGRES_USER: app_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app_user -d app_db"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - farmacia_network

  # ========== REDIS (Cache + Queue) ==========
  redis:
    image: redis:7-alpine
    container_name: farmacia_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    networks:
      - farmacia_network

  # ========== BACKEND (Django) ==========
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: farmacia_backend
    command: >
      sh -c "python manage.py migrate &&
             python manage.py collectstatic --noinput &&
             gunicorn config.wsgi:application --bind 0.0.0.0:8000 --timeout 120"
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings
      - DJANGO_SECRET_KEY=${DJANGO_SECRET_KEY}
      - DJANGO_DEBUG=False
      - DJANGO_ALLOWED_HOSTS=${DJANGO_ALLOWED_HOSTS}
      - DATABASE_URL=postgresql://app_user:${POSTGRES_PASSWORD}@db:5432/app_db
      - REDIS_URL=redis://redis:6379/0
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_PUBLIC_KEY=${STRIPE_PUBLIC_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    ports:
      - "8000:8000"
    volumes:
      - ./backend/src:/app/src
      - ./backups:/app/backups
      - media_files:/app/media
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - farmacia_network

  # ========== FRONTEND (React Vite) ==========
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: farmacia_frontend
    environment:
      - VITE_API_URL=http://localhost:8000/api
      - VITE_STRIPE_PUBLIC_KEY=${STRIPE_PUBLIC_KEY}
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend
    networks:
      - farmacia_network

  # ========== CELERY WORKER ==========
  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: farmacia_worker
    command: celery -A config worker --loglevel=info --concurrency=4
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings
      - DJANGO_SECRET_KEY=${DJANGO_SECRET_KEY}
      - DATABASE_URL=postgresql://app_user:${POSTGRES_PASSWORD}@db:5432/app_db
      - REDIS_URL=redis://redis:6379/0
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    volumes:
      - ./backend/src:/app/src
    depends_on:
      - db
      - redis
      - backend
    networks:
      - farmacia_network

  # ========== CELERY BEAT (Task Scheduler) ==========
  beat:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: farmacia_beat
    command: celery -A config beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings
      - DJANGO_SECRET_KEY=${DJANGO_SECRET_KEY}
      - DATABASE_URL=postgresql://app_user:${POSTGRES_PASSWORD}@db:5432/app_db
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - ./backend/src:/app/src
    depends_on:
      - db
      - redis
      - backend
    networks:
      - farmacia_network

volumes:
  postgres_data:
  redis_data:
  media_files:

networks:
  farmacia_network:
    driver: bridge
```

### Archivos Dockerfile

#### **Backend Dockerfile**
```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    postgresql-client \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY requirements.txt .

# Instalar Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código
COPY . .

# Crear volumen para media
RUN mkdir -p /app/media /app/backups

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
```

#### **Frontend Dockerfile**
```dockerfile
# frontend/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
```

### Volúmenes

| Volumen | Propósito |
|---------|-----------|
| `postgres_data` | Base de datos PostgreSQL persistente |
| `redis_data` | Cache y queue de Celery persistente |
| `media_files` | Imágenes, PDFs de facturas, uploads |
| `/backups` (host mounted) | Dumps de PostgreSQL + respaldos |
| `./backend/src` (dev) | Código Django para hot-reload |
| `./frontend` (dev) | Código React para hot-reload |

### Healthcheck

```yaml
db:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U app_user"]
    interval: 10s
    timeout: 5s
    retries: 5

backend:
  depends_on:
    db:
      condition: service_healthy
```

### Networking

```
farmacia_network (bridge)
├─ db (5432 interno)
├─ redis (6379 interno)
├─ backend (8000 → localhost:8000)
├─ frontend (5173 → localhost:5173)
├─ worker (sin puerto, solo internal)
└─ beat (sin puerto, solo internal)
```

---

## 6. DEPENDENCIAS PRINCIPALES

### Backend (Python)

```
# Core Django
Django==5.1.6
djangorestframework==3.15.2
djangorestframework-simplejwt==5.3.1
django-cors-headers==4.6.0

# Multi-tenancy
django-tenants==3.7.0
django-tenant-schemas==1.10.7

# Database
psycopg[binary]==3.2.6
dj-database-url==2.1.0

# Async Tasks
celery[redis]==5.4.0
django-celery-beat==2.7.0
redis==5.2.1

# Payments & External APIs
stripe==15.1.0
requests==2.33.1
google-auth==2.38.0

# Machine Learning
scikit-learn==1.5.2
pandas==2.2.3
numpy==1.26.4

# Image Processing
Pillow==11.2.1

# Environment
python-dotenv==1.0.1

# PDF Generation
reportlab==4.0.9
pypdf==4.0.2

# Caching
django-redis==5.4.0

# Testing
pytest==8.3.2
pytest-django==4.9.0
factory-boy==3.3.0

# Swagger/API Docs
drf-spectacular==0.27.2

# Utilities
phonenumbers==8.13.0
python-dateutil==2.9.0
pytz==2024.1
```

### Frontend (Node.js)

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.13.1",
    "@stripe/react-stripe-js": "^6.3.0",
    "@stripe/stripe-js": "^6.3.0",
    "recharts": "^2.12.7",
    "jspdf": "^4.2.1",
    "jspdf-autotable": "^5.0.7",
    "axios": "^1.6.0",
    "tailwindcss": "^3.4.17",
    "postcss": "^8.4.38",
    "autoprefixer": "^10.4.17",
    "lucide-react": "^0.305.0"
  },
  "devDependencies": {
    "vite": "^6.2.0",
    "@vitejs/plugin-react": "^4.2.1",
    "@tailwindcss/forms": "^0.5.7",
    "eslint": "^8.56.0",
    "eslint-plugin-react": "^7.33.2"
  }
}
```

### Mobile (Flutter)

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # Core
  http: ^1.2.2
  shared_preferences: ^2.3.2
  
  # Firebase
  firebase_core: ^3.15.1
  firebase_messaging: ^15.2.7
  
  # Payments
  flutter_stripe: ^11.3.0
  
  # Notifications
  flutter_local_notifications: ^18.0.1
  timezone: ^0.9.4
  
  # UI
  google_fonts: ^6.3.1
  cupertino_icons: ^1.0.0
  
  # PDF & Printing
  pdf: ^4.0.4
  printing: ^6.0.2
  
  # State Management (opcional)
  provider: ^6.1.0
  
  # Logging
  logger: ^2.2.0
```

---

## 7. FLUJO DE DATOS Y PATRONES

### Authentication Flow (JWT)

```
┌────────────────────────────────────────────────────────────┐
│                    AUTENTICACIÓN JWT                        │
└────────────────────────────────────────────────────────────┘

1️⃣ LOGIN REQUEST
   ├─ POST /api/token/
   ├─ Body: { email, password }
   └─ Tenant detectado por subdominio

2️⃣ BACKEND VALIDATION
   ├─ Hash password vs. BD
   ├─ Valida que usuario pertenece a tenant
   └─ Genera JWT tokens

3️⃣ TOKEN GENERATION
   ├─ Access Token
   │  ├─ TTL: 15 minutos
   │  ├─ Payload: user_id, tenant_id, roles, permisos
   │  └─ Signature: DJANGO_SECRET_KEY
   │
   └─ Refresh Token
      ├─ TTL: 7 días
      ├─ Payload: user_id, jti (unique ID)
      └─ Signature: DJANGO_SECRET_KEY

4️⃣ FRONTEND STORAGE
   ├─ access_token → Cookie (HttpOnly, Secure, SameSite=Lax)
   │  └─ Name: access_token_{schema_name}
   │
   └─ refresh_token → Cookie (HttpOnly, Secure, SameSite=Lax)
      └─ Name: refresh_token_{schema_name}

5️⃣ SUBSEQUENT REQUESTS
   ├─ Header: Authorization: Bearer <access_token>
   ├─ OR Cookie: access_token_{schema_name} (automático)
   └─ Middleware: CookieOrHeaderJWTAuthentication valida

6️⃣ REFRESH FLOW (cuando Access expira)
   ├─ POST /api/token/refresh/
   ├─ Body/Cookie: refresh_token
   ├─ Backend verifica firma + TTL
   └─ Retorna nuevo access_token

7️⃣ LOGOUT
   ├─ DELETE /api/logout/
   ├─ Frontend limpia cookies
   ├─ Backend invalida refresh_token (opcional)
   └─ Redirige a login
```

### Multitenancy Flow

```
┌────────────────────────────────────────────────────────────┐
│              MULTITENANCY REQUEST FLOW                      │
└────────────────────────────────────────────────────────────┘

1️⃣ REQUEST INGRESA
   ├─ URL: https://farmacia1.localhost:5173/api/productos/
   ├─ Header: X-Tenant-ID (opcional)
   └─ Cookie: access_token_farmacia1

2️⃣ MIDDLEWARE: TenantMainMiddleware
   ├─ Detecta tenant del subdominio
   │  └─ farmacia1.localhost → schema_name = 'farmacia1'
   ├─ Query: SELECT * FROM public.tenants_tenant WHERE schema_name='farmacia1'
   └─ Guarda en request.tenant

3️⃣ MIDDLEWARE: TenantContextMiddleware
   ├─ Establece conexión PostgreSQL a schema farmacia1
   │  └─ connection.set_tenant(request.tenant)
   │  └─ SET search_path TO farmacia1;
   ├─ Todas las queries posteriores usan este schema
   └─ ⚠️ CRÍTICO: Evita SQL injection entre tenants

4️⃣ DATABASE QUERY
   ├─ ORM Query: Producto.objects.all()
   ├─ SQL Generado:
   │  └─ SET search_path TO farmacia1;
   │  └─ SELECT * FROM farmacia1.inventarios_producto;
   └─ Retorna solo productos de farmacia1

5️⃣ AUTHORIZATION CHECK
   ├─ request.user.tenant_id == request.tenant.id ?
   ├─ request.user.has_perm('productos.ver') ?
   └─ Si ambas pasan → OK, retorna datos

6️⃣ RESPONSE
   ├─ JSON con productos de farmacia1
   ├─ Header: X-Tenant-ID: farmacia1
   └─ Cookie: Set-Cookie: access_token_farmacia1=...
```

### Carrito (Autenticado + Invitado)

```
┌────────────────────────────────────────────────────────────┐
│                    CARRITO MULTIFORMA                       │
└────────────────────────────────────────────────────────────┘

FLUJO USUARIO AUTENTICADO:
├─ POST /api/carrito/ (crea carrito para user)
├─ GET /api/carrito/{id}/ (obtiene carrito)
├─ POST /api/carrito/{id}/items/ (agrega item)
└─ DELETE /api/carrito/{id}/items/{item_id}/ (quita)

FLUJO USUARIO INVITADO:
├─ GET /api/carrito/invitado/iniciar/ 
│  └─ Retorna: { invitado_token: "abc123def456..." }
├─ Fronted guarda en localStorage + cookie
├─ Header X-Carrito-Token: abc123def456...
├─ POST /api/carrito/invitado/agregar-item/
│  ├─ Body: { producto_id, cantidad }
│  ├─ Lookup: CarritoInvitado.objects.get(token=X-Carrito-Token)
│  └─ Crea CarritoInvitadoItem
└─ Persiste entre sesiones mientras token sea válido

CHECKOUT:
├─ POST /api/carrito/{id}/checkout/
├─ Validaciones:
│  ├─ Stock disponible
│  ├─ Receta si medicamento controlado
│  ├─ Pago autorizado (Stripe)
│  └─ Datos de envío completos
├─ Crear Venta + DetalleVenta (atomic transaction)
├─ Actualizar Inventario (MovimientoInventario)
├─ Generar Factura
└─ Limpiar Carrito + invalidar invitado_token
```

### Tareas Asincrónicas (Celery)

```
┌────────────────────────────────────────────────────────────┐
│              CELERY TASK ARCHITECTURE                       │
└────────────────────────────────────────────────────────────┘

REDIS QUEUE:
redis:6379
├─ celery (default queue)
│  ├─ send_treatment_reminders (alta prioridad)
│  ├─ send_email_notification (media)
│  ├─ process_backup (baja)
│  └─ train_ml_model (baja)
└─ backup (queue específica para backups)

CELERY WORKER:
├─ Escucha: redis://redis:6379/0
├─ Procesos: 4 (--concurrency=4)
├─ Retry: 3 intentos
└─ Timeout: 10 minutos por tarea

CELERY BEAT (Scheduler):
├─ Backend: DatabaseScheduler
├─ Tabla: django_celery_beat_periodicaleartask
└─ Tasks programadas:
   ├─ send_treatment_reminders (cada 6 horas)
   ├─ perform_backup (según BackupSchedule)
   ├─ train_ml_model (semanal, lunes 2am)
   ├─ cleanup_old_sessions (diario)
   └─ sync_firebase_tokens (diario)

EJEMPLO TASK:
@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def send_treatment_reminders(self):
    try:
        # Lógica aquí
        send_fcm_notifications(...)
    except Exception as exc:
        # Retry en 5 minutos
        raise self.retry(exc=exc, countdown=300)
```

### Backup Automático

```
┌────────────────────────────────────────────────────────────┐
│                AUTOMATIC BACKUP FLOW                        │
└────────────────────────────────────────────────────────────┘

1️⃣ CONFIGURAR SCHEDULE
   ├─ POST /api/backups/schedules/
   ├─ Body: { schema, frequency: 'daily', hour: 02:00 }
   └─ Crea: BackupSchedule en BD

2️⃣ CELERY BEAT DISPATCHER (00:00, 02:00, 06:00, etc.)
   ├─ Lee BackupSchedule de BD
   ├─ Encola: backup_service.perform_backup.delay(schema='farmacia1')
   └─ Task envía a Redis queue

3️⃣ CELERY WORKER EXECUTA
   ├─ Recibe task
   ├─ Conecta a BD
   ├─ Ejecuta: pg_dump -Fc farmacia1 > /app/backups/farmacia1_20260530.dump
   ├─ Comprime (gzip si > 100MB)
   ├─ Calcula checksum SHA256
   └─ Registra en BackupLog (success, size, duration)

4️⃣ ALMACENAMIENTO
   ├─ Ubicación: /app/backups (volumen Docker)
   ├─ Formato: farmacia1_20260530_140000.dump.gz
   ├─ Retención: Configurable (30 días default)
   └─ Estructura:
      ├─ Manifesto (lista de schemas)
      └─ Archivo dump (comprimido, verificado)

5️⃣ RESTAURACIÓN (Manual o Recovery)
   ├─ GET /api/backups/{id}/download/
   ├─ POST /api/backups/{id}/restore/
   │  ├─ Validar checksum
   │  ├─ Decomprimir
   │  ├─ Ejecutar: pg_restore -d farmacia1 backup.dump
   │  └─ Verificar integridad
   └─ Log en BitacoraSistema

6️⃣ ALERTAS
   ├─ Failed backup → Email a admin
   ├─ Backup > 1GB → Warning
   └─ No backup en 48h → Critical alert
```

---

## 8. MIGRACIONES Y SETUP

### Comandos de Setup Inicial

```bash
# 1. Limpiar estado anterior (DESTRUCTIVO)
docker compose down -v

# 2. Construir e iniciar servicios
docker compose up -d --build

# 3. Aplicar migraciones (shared + tenant schemas)
docker compose exec backend python manage.py migrate

# 4. Crear planes SaaS iniciales
docker compose exec backend python manage.py bootstrap_saas

# 5. Crear superusuario global (admin del SaaS)
docker compose exec backend python manage.py createsuperuser
# Prompt interactivo para email/password

# 6. Crear primera farmacia (tenant 1)
docker compose exec backend python manage.py shell << EOF
from tenants.services import create_tenant_with_admin
create_tenant_with_admin(
    nombre_farmacia='Farmacia 1',
    subdominio='farmacia1',
    email_admin='admin@farmacia1.local',
    password='Farmacia1*2026'
)
EOF

# 7. Crear segunda farmacia (tenant 2)
docker compose exec backend python manage.py shell << EOF
from tenants.services import create_tenant_with_admin
create_tenant_with_admin(
    nombre_farmacia='Farmacia 2',
    subdominio='farmacia2',
    email_admin='admin@farmacia2.local',
    password='Farmacia2*2026'
)
EOF

# 8. Sembrar roles y permisos base
docker compose exec backend python manage.py seed_roles_permisos \
  --all-tenants --sincronizar-usuarios

# 9. Crear usuarios demo (opcional)
docker compose exec backend python manage.py seed_usuarios_demo \
  --all-tenants --password SaludPlus2026* --reset-password

# 10. Sembrar catálogo de productos
docker compose exec backend python manage.py seed_productos --all-tenants

# 11. Entrenar modelos ML
docker compose exec backend python manage.py tenant_command \
  entrenar_modelo --schema=farmacia1

# 12. Verificación final
docker compose exec backend python manage.py check
```

### Estructura de Migraciones Django

```
backend/src/
├─ [app_name]/migrations/
│  ├─ 0001_initial.py
│  ├─ 0002_add_fields.py
│  ├─ 0003_tenant_migration.py
│  └─ __init__.py
```

**Nota importante:** Con `django-tenants`, existen dos tipos de migraciones:
- **Shared schema:** `manage.py migrate` (usuarios globales, tenants)
- **Tenant schemas:** `manage.py migrate_schemas` (datos de cada farmacia)

---

## 9. ENTORNO DE DESARROLLO

### Requisitos del Sistema

| Componente | Versión | Descarga |
|-----------|---------|----------|
| **Python** | 3.9+ (idealmente 3.11) | https://www.python.org/ |
| **Node.js** | 18+ | https://nodejs.org/ |
| **Flutter** | 3.9.2+ | https://flutter.dev/ |
| **Docker Desktop** | Latest | https://www.docker.com/products/docker-desktop |
| **PostgreSQL** | 16 (en contenedor) | ✓ Docker |
| **Redis** | 7 (en contenedor) | ✓ Docker |
| **Git** | Latest | https://git-scm.com/ |

### Archivo `.env` Ejemplo

```env
# ========== POSTGRESQL ==========
POSTGRES_DB=app_db
POSTGRES_USER=app_user
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_HOST=db
POSTGRES_PORT=5432

# ========== DJANGO ==========
DJANGO_SECRET_KEY=your-secret-key-here-change-in-production
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,farmacia1.localhost,farmacia2.localhost
DJANGO_PORT=8000

# ========== SAAS CONFIG ==========
SAAS_ROOT_DOMAIN=localhost
SAAS_PUBLIC_BASE_URL=http://localhost:5173
SAAS_BILLING_SUCCESS_URL=http://localhost:5173/admin/suscripcion?status=ok
SAAS_BILLING_CANCEL_URL=http://localhost:5173/admin/suscripcion?status=cancel

# ========== CORS ==========
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://farmacia1.localhost:5173,http://farmacia2.localhost:5173

# ========== STRIPE (Test Keys) ==========
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLIC_KEY=pk_test_your_public_key_here
STRIPE_CURRENCY=BOB
STRIPE_WEBHOOK_SECRET=whsec_test_your_webhook_secret

# ========== FIREBASE (Cloud Messaging) ==========
FCM_PROJECT_ID=farmacia-446f5
FIREBASE_SERVICE_ACCOUNT_FILE=/app/config/firebase-service-account.json

# ========== GOOGLE GEMINI (IA Reports) ==========
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_REPORTS_MODEL=gemini-2.5-flash
GEMINI_AUDIO_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODELS=gemini-2.5-flash,gemini-2.0-flash,gemini-2.0-flash-lite

# ========== FRONTEND ==========
REACT_PORT=5173
VITE_API_URL=http://localhost:8000/api
VITE_STRIPE_PUBLIC_KEY=pk_test_your_public_key_here

# ========== EMAIL (para notificaciones) ==========
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your_email@gmail.com
EMAIL_HOST_PASSWORD=your_app_password

# ========== CELERY ==========
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0
```

### Setup Local sin Docker (Desarrollo)

#### **Backend (Django)**

```bash
# 1. Clonar repo
git clone <repo>
cd farmacia-project

# 2. Crear virtual environment
python -m venv venv

# 3. Activar venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 4. Instalar dependencias
pip install -r backend/requirements.txt

# 5. Configurar .env (copiar .env.example)
cp .env.example .env
# Editar .env con credenciales locales

# 6. Migraciones (requiere PostgreSQL local o Docker)
cd backend/src
python manage.py migrate
python manage.py migrate_schemas

# 7. Crear superusuario
python manage.py createsuperuser

# 8. Crear tenant test
python manage.py shell -c "
from tenants.services import create_tenant_with_admin
create_tenant_with_admin('Farmacia Test', 'test', 'admin@test.local', 'Test2026*')
"

# 9. Sembrar datos
python manage.py seed_productos --schema test
python manage.py seed_usuarios_demo --schema test

# 10. Iniciar dev server
python manage.py runserver 0.0.0.0:8000
```

#### **Frontend (React)**

```bash
# 1. Instalar dependencias
cd frontend
npm install

# 2. Configurar .env
cp .env.example .env
# Editar con VITE_API_URL=http://localhost:8000/api

# 3. Iniciar dev server (Vite)
npm run dev
# Abre http://localhost:5173

# 4. Build para producción
npm run build
# Genera ./dist/
```

#### **Mobile (Flutter)**

```bash
# 1. Configurar Flutter
flutter doctor

# 2. Obtener dependencias
cd mobile
flutter pub get

# 3. Configurar Firebase
flutterfire configure

# 4. Ejecutar en emulador
flutter run

# 5. Build APK (Android)
flutter build apk --release

# 6. Build IPA (iOS)
flutter build ios --release
```

### Manejo de Hosts Locales (Multitenancy)

#### **Windows (hosts file)**

```
# C:\Windows\System32\drivers\etc\hosts
127.0.0.1 localhost
127.0.0.1 farmacia1.localhost
127.0.0.1 farmacia2.localhost
```

#### **macOS/Linux (/etc/hosts)**

```bash
# Edit con: sudo nano /etc/hosts
127.0.0.1 localhost
127.0.0.1 farmacia1.localhost
127.0.0.1 farmacia2.localhost
```

### URLs de Acceso Locales

```
Frontend SaaS Global:        http://localhost:5173
Farmacia 1:                  http://farmacia1.localhost:5173
Farmacia 2:                  http://farmacia2.localhost:5173

Backend API (Global):        http://localhost:8000/api/
Backend API (Farmacia 1):    http://localhost:8000/api/ (auto-detecta por cookie)
Django Admin:                http://localhost:8000/admin/

PostgreSQL:                  localhost:5432 (user: app_user)
Redis:                       localhost:6379
```

### IDE Recomendados

- **Backend:** VS Code + Python + Pylance
- **Frontend:** VS Code + ES7+ React/Redux snippets + Prettier
- **Mobile:** Android Studio (o VS Code + Flutter extension)
- **Database:** pgAdmin (http://localhost:5050) o DBeaver

### Pre-commit Hooks

```bash
# Instalar pre-commit
pip install pre-commit

# Copiar .pre-commit-config.yaml
cp .pre-commit-config.yaml.example .pre-commit-config.yaml

# Instalar hooks
pre-commit install

# Validaciones automáticas antes de commit:
# - Black (Python formatter)
# - Isort (import sorter)
# - Flake8 (linter)
# - Prettier (JS formatter)
```

---

## 10. CARACTERÍSTICAS ESPECIALES (SPRINT 3)

### ✨ RecetaMedica y MedicoReceta

**Problema Resuelto:** Validación de recetas para medicamentos controlados en venta

**Modelos Nuevos:**

```python
# clientes/models.py

class MedicoReceta(BaseModel):
    """Profesional que prescribe medicamentos"""
    nombre = models.CharField(max_length=255)
    apellido = models.CharField(max_length=255)
    especialidad = models.CharField(max_length=255)
    numero_colegiado = models.CharField(max_length=100, unique=True)
    email = models.EmailField()
    telefono = models.CharField(max_length=20)
    
    class Meta:
        verbose_name = "Médico (Receta)"
        indexes = [
            models.Index(fields=['numero_colegiado']),
        ]

class RecetaMedica(BaseModel):
    """Receta médica para medicamentos controlados"""
    cliente = models.ForeignKey('clientes.Cliente', on_delete=models.CASCADE)
    medico = models.ForeignKey(MedicoReceta, on_delete=models.PROTECT)
    fecha_emision = models.DateTimeField(auto_now_add=True)
    fecha_vencimiento = models.DateField()
    productos = models.ManyToManyField('inventarios.Producto')
    numero_receta = models.CharField(max_length=100, unique=True)
    observaciones = models.TextField(blank=True)
    estado = models.CharField(
        max_length=20,
        choices=[('activa', 'Activa'), ('vencida', 'Vencida'), ('usada', 'Usada')],
        default='activa'
    )
    
    class Meta:
        verbose_name = "Receta Médica"
        ordering = ['-fecha_emision']
```

**Validación en Venta:**

```python
# ventas/services.py

def validar_receta_en_venta(venta_data):
    """Verifica que medicamentos controlados tengan receta válida"""
    cliente = venta_data['cliente']
    productos = venta_data['detalles']
    
    for detalle in productos:
        producto = detalle['producto']
        
        if producto.requiere_receta:
            receta = RecetaMedica.objects.filter(
                cliente=cliente,
                productos=producto,
                estado='activa',
                fecha_vencimiento__gte=timezone.now().date()
            ).first()
            
            if not receta:
                raise ValidationError(
                    f"{producto.nombre} requiere receta médica válida"
                )
```

**Frontend:**

```jsx
// components/sections/ValidarRecetaModal.jsx
export function ValidarRecetaModal({ producto, cliente, onValidate }) {
  const [receta, setReceta] = useState(null);
  
  useEffect(() => {
    if (cliente) {
      // GET /api/clientes/{cliente}/recetas/?activas=true
      cargarRecetasDelCliente(cliente);
    }
  }, [cliente]);
  
  return (
    <Modal>
      <h3>Validar Receta - {producto.nombre}</h3>
      <select onChange={(e) => setReceta(e.target.value)}>
        <option>Selecciona una receta...</option>
        {recetas.map(r => (
          <option key={r.id} value={r.id}>
            Receta #{r.numero} - Dr. {r.medico.nombre}
          </option>
        ))}
      </select>
      <MedicoCard medico={receta?.medico} />
      <button onClick={() => onValidate(receta)}>Usar Receta</button>
    </Modal>
  );
}

// components/ui/MedicoCard.jsx
export function MedicoCard({ medico }) {
  return (
    <div className="border p-4 rounded">
      <p><strong>{medico.nombre} {medico.apellido}</strong></p>
      <p>{medico.especialidad}</p>
      <p>Colegiado: {medico.numero_colegiado}</p>
    </div>
  );
}
```

### 📊 Segmentación de Clientes (RFM Analysis)

**Problema Resuelto:** Entender patrones de compra de clientes para marketing dirigido

**Modelo:**

```python
# clientes/models.py

class ClienteSegmento(BaseModel):
    """Clasificación RFM de cliente"""
    cliente = models.OneToOneField('Cliente', on_delete=models.CASCADE)
    
    # RFM Scores (0-5, donde 5 es mejor)
    recency_score = models.IntegerField(default=0)    # ¿Cuándo compró?
    frequency_score = models.IntegerField(default=0)  # ¿Cuántas veces?
    monetary_score = models.IntegerField(default=0)   # ¿Cuánto gastó?
    
    # Clasificación
    SEGMENTOS = [
        ('champions', 'Champions'),           # RFM: 5-5-5
        ('loyal', 'Clientes Leales'),         # RFM: 4-4-4
        ('at_risk', 'En Riesgo'),             # RFM: 3-2-2
        ('lost', 'Perdidos'),                 # RFM: 1-1-1
    ]
    segmento = models.CharField(max_length=20, choices=SEGMENTOS)
    
    fecha_actualizacion = models.DateTimeField(auto_now=True)
```

**Servicio de Cálculo:**

```python
# clientes/services.py

def recalcular_segmentacion(schema_name=None):
    """Ejecuta RFM analysis para todos los clientes activos"""
    
    from django.utils import timezone
    from datetime import timedelta
    
    # Parámetros
    today = timezone.now().date()
    df = 30  # days_frame para recency
    
    for cliente in Cliente.objects.all():
        # 1. RECENCY (últimas 30 días)
        ultima_compra = cliente.venta_set.filter(
            fecha__gte=today - timedelta(days=df)
        ).order_by('-fecha').first()
        
        if ultima_compra:
            dias_desde_compra = (today - ultima_compra.fecha.date()).days
            recency_score = 5 if dias_desde_compra <= 7 else (
                4 if dias_desde_compra <= 14 else (
                    3 if dias_desde_compra <= 30 else 1
                )
            )
        else:
            recency_score = 1
        
        # 2. FREQUENCY (compras en últimos 90 días)
        frequency = cliente.venta_set.filter(
            fecha__gte=today - timedelta(days=90)
        ).count()
        
        frequency_score = 5 if frequency >= 10 else (
            4 if frequency >= 5 else (
                3 if frequency >= 2 else 1
            )
        )
        
        # 3. MONETARY (monto gastado últimos 90 días)
        monetary = cliente.venta_set.filter(
            fecha__gte=today - timedelta(days=90)
        ).aggregate(total=models.Sum('total'))['total'] or 0
        
        monetary_score = 5 if monetary >= 5000 else (
            4 if monetary >= 2500 else (
                3 if monetary >= 1000 else 1
            )
        )
        
        # 4. ASIGNAR SEGMENTO
        rfm_sum = recency_score + frequency_score + monetary_score
        
        if rfm_sum >= 13:
            segmento = 'champions'
        elif rfm_sum >= 10:
            segmento = 'loyal'
        elif rfm_sum >= 6:
            segmento = 'at_risk'
        else:
            segmento = 'lost'
        
        # 5. GUARDAR
        ClienteSegmento.objects.update_or_create(
            cliente=cliente,
            defaults={
                'recency_score': recency_score,
                'frequency_score': frequency_score,
                'monetary_score': monetary_score,
                'segmento': segmento
            }
        )
```

**Frontend - Dashboard:**

```jsx
// pages/admin/SegmentacionClientesPage.jsx
export function SegmentacionClientesPage() {
  const [segmentacion, setSegmentacion] = useState(null);
  
  useEffect(() => {
    // GET /api/clientes/segmentacion/
    fetch('/api/clientes/segmentacion/')
      .then(r => r.json())
      .then(setSegmentacion);
  }, []);
  
  const stats = {
    champions: segmentacion?.filter(s => s.segmento === 'champions').length,
    loyal: segmentacion?.filter(s => s.segmento === 'loyal').length,
    at_risk: segmentacion?.filter(s => s.segmento === 'at_risk').length,
    lost: segmentacion?.filter(s => s.segmento === 'lost').length,
  };
  
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Segmentación de Clientes</h1>
      
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card title="Champions" value={stats.champions} color="green" />
        <Card title="Leales" value={stats.loyal} color="blue" />
        <Card title="En Riesgo" value={stats.at_risk} color="yellow" />
        <Card title="Perdidos" value={stats.lost} color="red" />
      </div>
      
      <RFMScatterPlot data={segmentacion} />
      <SegmentacionTable data={segmentacion} />
    </div>
  );
}
```

### 🤖 Reportes Inteligentes con Google Gemini

**Problema Resuelto:** Análisis natural de datos sin saber SQL, por voz o texto

**Integración:**

```python
# reportes/services.py

from google import genai
from google.api_core import gapic_v1

class GeminiReportService:
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model = settings.GEMINI_REPORTS_MODEL
    
    def analizar_por_texto(self, pregunta: str):
        """Procesa pregunta natural sobre datos"""
        
        # 1. Obtener contexto de datos relevantes
        context = self._preparar_contexto_para_pregunta(pregunta)
        
        # 2. Enviar a Gemini
        prompt = f"""
        Eres un analista de datos farmacéutico.
        Contexto de datos:
        {context}
        
        Pregunta: {pregunta}
        
        Proporciona:
        1. Análisis detallado
        2. Números clave con contexto
        3. Recomendaciones accionables
        """
        
        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            generation_config=gapic_v1.client_options.GenerationConfig(
                temperature=0.7,
                top_p=0.9,
            )
        )
        
        return response.text
    
    def analizar_por_audio(self, audio_path: str):
        """Transcribe audio y analiza pregunta"""
        
        # 1. Transcribir audio
        import speech_recognition as sr
        recognizer = sr.Recognizer()
        
        with sr.AudioFile(audio_path) as source:
            audio = recognizer.record(source)
        
        try:
            text = recognizer.recognize_google(audio, language='es-ES')
        except sr.UnknownValueError:
            return {"error": "No se entiende el audio"}
        
        # 2. Procesar texto transcrito
        return self.analizar_por_texto(text)
    
    def _preparar_contexto_para_pregunta(self, pregunta: str):
        """Extrae datos relevantes para la pregunta"""
        
        # Análisis simple de keywords
        if 'venta' in pregunta.lower():
            data = self._obtener_datos_ventas()
        elif 'inventario' in pregunta.lower():
            data = self._obtener_datos_inventario()
        elif 'cliente' in pregunta.lower():
            data = self._obtener_datos_clientes()
        else:
            data = self._obtener_datos_generales()
        
        return json.dumps(data, indent=2)
```

**Frontend:**

```jsx
// hooks/useGeminiReports.js
export function useGeminiReports() {
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [mediaRecorder, setMediaRecorder] = useState(null);
  
  const startAudioRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    
    recorder.ondataavailable = (event) => {
      // POST /api/reportes/gemini/audio/
      const formData = new FormData();
      formData.append('audio', event.data);
      
      setLoading(true);
      fetch('/api/reportes/gemini/audio/', {
        method: 'POST',
        body: formData
      })
      .then(r => r.json())
      .then(data => setTranscript(data.analisis))
      .finally(() => setLoading(false));
    };
    
    recorder.start();
    setMediaRecorder(recorder);
  };
  
  const stopAudioRecording = () => {
    mediaRecorder?.stop();
  };
  
  const analizarTexto = (pregunta) => {
    setLoading(true);
    return fetch('/api/reportes/gemini/texto/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pregunta })
    })
    .then(r => r.json())
    .then(data => setTranscript(data.analisis))
    .finally(() => setLoading(false));
  };
  
  return { startAudioRecording, stopAudioRecording, analizarTexto, transcript, loading };
}

// components/admin/GeminiAnalysisPanel.jsx
export function GeminiAnalysisPanel() {
  const { analizarTexto, startAudioRecording, transcript, loading } = useGeminiReports();
  const [pregunta, setPregunta] = useState('');
  
  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg">
      <h2 className="text-2xl font-bold mb-4">🤖 Análisis Inteligente</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block mb-2">Pregunta sobre tus datos:</label>
          <input
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            placeholder="Ej: ¿Cuál fue la venta total en mayo?"
            className="w-full border p-2 rounded"
          />
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={() => analizarTexto(pregunta)}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Analizar Texto
          </button>
          
          <button
            onClick={startAudioRecording}
            className="bg-purple-500 text-white px-4 py-2 rounded"
          >
            🎤 Registrar Pregunta
          </button>
        </div>
        
        {transcript && (
          <div className="bg-white p-4 rounded border-l-4 border-green-500">
            <h3 className="font-bold mb-2">Análisis Gemini:</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{transcript}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 📈 Predicciones ML (Demanda)

**Algoritmos:**
- ARIMA (series temporales de medicamentos)
- Prophet (tendencias estacionales)
- Media móvil (fallback simple)

**Ejecución:**

```bash
# Entrenar modelo (weekly, Monday 2am)
docker compose exec backend python manage.py tenant_command \
  entrenar_modelo --schema=farmacia1

# Resultado: Predicciones para próximos 30 días
GET /api/predicciones/?producto=123&dias=30
→ { forecast: [50, 48, 55, ...], confidence_intervals: [...] }
```

### 💬 Sistema de Opiniones

**Tipos:**
- `OpinionVenta` - Feedback sobre transacción
- `OpinionProducto` - Reseña de medicamento
- `OpinionServicio` - Feedback general

**Análisis:**

```
GET /api/opiniones/productos/123/estadísticas/
→ {
    rating_promedio: 4.5,
    total_opiniones: 125,
    distribucion: { 5: 70, 4: 30, 3: 15, ... }
    trending: "up",
    comentarios_destacados: ["Excelente calidad", ...]
  }
```

---

## 📚 RESUMEN DE CAMBIOS SPRINT 3

| Componente | Cambios |
|-----------|---------|
| **Backend** | +2 modelos (RecetaMedica, MedicoReceta), +1 ViewSet (RecetaMedicaViewSet), validación en venta |
| **Frontend** | +3 componentes (SegmentacionClientesPage, ValidarRecetaModal, MedicoCard), +1 hook (useRecetas) |
| **Docencia** | 3 archivos de migración + instrucciones completas |
| **Total LOC** | ~500 líneas nuevas/modificadas |

---

## 🚀 PRÓXIMOS PASOS RECOMENDADOS

1. **Ejecutar Git Push:**
   ```bash
   git add .
   git commit -m "feat: Sprint 3 - RecetaMedica, SegmentacionClientes, Gemini IA"
   git push origin develop
   ```

2. **Deploy a Staging:**
   - Verificar migraciones en BD
   - Ejecutar seeds
   - Pruebas E2E

3. **Sprint 4 - Prioridades:**
   - HU-47/48/49: Modelo Lote + Vencimiento
   - HU-31/39: Notificaciones push (Firebase)
   - HU-56: Programa de Puntos/Lealtad

---

**Generado:** 2026-05-30  
**Autor:** GitHub Copilot  
**Versión del Proyecto:** Sprint 3 ✅ Completado

