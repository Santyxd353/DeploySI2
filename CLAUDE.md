# CLAUDE.md
Respondeme siempre en español

# Project Overview

Farmacia Bibosi / SaludPlus - Sistema completo de gestión farmacéutica multi-tenant con:

Backend Django REST API (multi-tenant)

Frontend React (Vite + Tailwind)

Mobile App Flutter (multi-platform)

ML para predicciones de demanda

Pagos con Stripe

Notificaciones push (FCM)

Sistema de puntos/fidelización

Adherencia a tratamientos

Reportes con IA (voz y texto)

# Tech Stack
# Backend (Django)
Tecnología	Versión	Uso
Django	5.1.6	Framework web
DRF	3.15.2	API REST
django-tenants	3.7.0	Multi-tenant
Simple JWT	5.3.1	Autenticación
Celery	5.4.0	Tareas asíncronas
Redis	5.2.1	Broker/result backend
PostgreSQL	16	Base de datos
scikit-learn	1.5.2	ML (Random Forest)
faster-whisper	1.1.1	Speech-to-text
Stripe	15.1.0	Pagos
# Frontend (React)
Tecnología	Versión	Uso
React	18.3.1	UI Framework
React Router	7.13.1	Enrutamiento
Vite	6.2.0	Build tool
Tailwind CSS	3.4.17	Estilos
Recharts	2.12.7	Gráficos
Stripe.js	9.4.0	Pagos
# Mobile (Flutter)
Tecnología	Versión	Uso
Flutter	SDK 3.9.2	Framework
flutter_stripe	11.3.0	Pagos
firebase_messaging	15.2.7	Push notifications
shared_preferences	2.3.2	Almacenamiento local
pdf	3.11.1	PDF generation

# Project Structure
Backend (/backend/src/)

src/
├── backup/          # Backup automático (Celery tasks)
├── carrito/         # Carrito de compras (invitados/autenticados)
├── clientes/        # Clientes y recetas médicas
├── config/          # Settings, URLs, Celery config
├── core/            # Auth, RBAC, Auditoría, Seguridad
├── inventarios/     # Productos, categorías, laboratorios, stock
├── opiniones/       # Opiniones/NPS (clientes)
├── predicciones/    # ML (demanda, tendencias, estacionalidad)
├── publicidad/      # Campañas con segmentación RFM
├── puntos/          # Fidelización (puntos, canjes)
├── reportes/        # Reportes con IA (voz + texto)
├── tenants/         # Multi-tenant (django-tenants)
├── tratamientos/    # Adherencia (tratamientos, tomas, notificaciones)
└── ventas/          # Ventas, facturas, Stripe integration

# Frontend (/frontend/src/)

src/
├── components/
│   ├── admin/       # Admin components (users, roles, products, etc.)
│   ├── crm/         # Client management (recetas, historial)
│   ├── pos/         # Point of Sale (cart, search, confirmation)
│   ├── sections/    # Landing page sections
│   └── routing/     # Route protection (AdminRoute, POSRoute)
├── pages/
│   ├── admin/       # 20+ admin pages
│   ├── auth/        # Login, Register, Reset Password
│   ├── pos/         # POS page
│   └── saas/        # Global SaaS pages (register tenant, global login)
├── services/        # API clients (one per module)
└── context/         # AuthContext (React Context)

# Mobile (/mobile/lib/)

lib/
├── core/
│   ├── auth/        # AuthSessionManager
│   ├── config/      # AppConfig, TenantConfig
│   ├── network/     # ApiClient
│   └── theme/       # AppTheme
└── features/
    ├── auth/        # Login, registro
    ├── cart/        # Carrito
    ├── catalog/     # Productos, detalles
    ├── home/        # Home page
    ├── opinions/    # Opiniones/NPS
    ├── payments/    # Stripe, facturas
    ├── points/      # Puntos/fidelización
    └── treatments/  # Adherencia (recordatorios, notificaciones)

# Key Architecture Decisions
Multi-Tenant (django-tenants)
Cada tenant tiene su propio schema en PostgreSQL

Subdominio = identificador del tenant (ej: farmacia1.localhost)

Tablas tenants_tenant y tenants_domain gestionan los tenants

Middleware: TenantMainMiddleware + TenantContextMiddleware

Header: X-Tenant-Subdomain para requests desde frontend/mobile

# Autenticación (JWT + Cookies)
Backend: JWT con cookies (access + refresh) con tenant-suffix

Frontend: Bearer token en header + cookies (para login)

Mobile: Bearer token en header + SharedPreferences

Fallback: Cookie → Header (Bearer)

Tenant-suffix cookies: access_token_{schema} y refresh_token_{schema}

# RBAC (Role-Based Access Control)
Roles base: admin, farmaceutico, cajero, cliente

Permisos: 24 permisos definidos en core/rbac.py

Asignación: TenantUser model (tenant, user, role)

Roles personalizados: TenantRole (tenant, nombre, permisos JSON)

Verificación: tiene_permiso(user, permission_code, tenant)

# Celery Tasks
Worker: Procesa tareas asíncronas

Beat: Scheduler de tareas periódicas (DatabaseScheduler)

Backups: Programados automáticamente

Notificaciones: Recordatorios de tratamientos

# Payments (Stripe)
Backend: PaymentIntent creation + verification

Frontend: Stripe.js + React Stripe Elements

Mobile: flutter_stripe

Webhook: payment_intent.succeeded, invoice.payment_failed, subscription.deleted

# ML Predictions
Modelo: Random Forest Regressor (scikit-learn)

Features: producto_id, día_semana, mes, estación, fin_semana, promedio_móvil_7, tendencia, lag1, lag7

Entrenamiento: Historial de ventas (12 meses)

Endpoints: /predecir-demanda, /recomendaciones-compra, /tendencias, /patrones-estacionales

Fallback: Simulación con media + tendencia + ruido si modelo no disponible

# Speech-to-Text
Modelo: faster-whisper (small, CPU, int8)

Uso: Reportes por voz en backend

Endpoints: /api/reportes/ia/audio/ (interpretación de audio)

Cache: HF_HOME en volumen whisper_cache

# Key Business Flows
1. Carrito de Compras
Usuario (autenticado o invitado) agrega productos al carrito

Invitado → se genera invitado_token (X-Carrito-Token header)

Carrito guarda estado: activo → confirmado → cancelado

Confirmación → crea venta + factura

2. Pagos con Stripe
Frontend/Mobile solicita PaymentIntent (total)

Stripe devuelve client_secret

Cliente confirma pago en Stripe

Webhook payment_intent.succeeded confirma pago

Backend crea venta desde carrito + factura

3. Recetas Médicas
Cliente sube receta (archivo + firma digital)

Estado: pendiente → aprobada/rechazada

Validación por farmacéutico/admin

Productos que requieren receta → validación antes de venta

4. Tratamientos (Adherencia)
Admin crea TratamientoBase (producto, dosis, frecuencia, duración)

Cliente inicia TratamientoActivo (estado: pausado)

Primera toma → activa el tratamiento (estado: activo)

Generación automática de tomas programadas

Cliente registra tomas: tomada, pospuesta, omitida

Notificaciones push para recordatorios (FCM)

Estado: activo → completado / cancelado / abandonado

5. Puntos/Fidelización
Configuración por tenant (bolivianos_por_punto, puntos_minimos_canje)

Venta pagada → puntos ganados (total / bolivianos_por_punto)

Niveles: bronce (0-499), plata (500-1999), oro (2000-9999), diamante (≥10000)

Catálogo de canje (descuento, producto, cupón)

Canje de puntos → voucher único

Transacciones: ganado, canjeado, expirado, ajuste, reverso

6. Publicidad (RFM)
Segmentos RFM predefinidos: todos, champions, frecuentes, nuevos, en_riesgo, inactivos

Campañas con segmentos asignados (ManyToMany)

Clientes clasificados según RFM (compras + antigüedad)

Endpoint público /activas filtra campañas según segmento del cliente

7. Opiniones/NPS
Cliente crea opinión (tipo, puntuación 1-5, comentario)

Estados: pendiente → respondida / escalada / archivada

Admin responde (respuesta_staff, estado)

Métricas: promedio, distribución, urgentes (≤2★ + sin respuesta + >24h)

# API Conventions
URL Structure
Tenant API: /api/... (con X-Tenant-Subdomain header)

Public API: /api/... (sin tenant, para SaaS)

Admin API: /api/admin/... (requiere permisos)

Auth API: /api/auth/... (login, register, refresh, logout)

Headers
Authorization: Bearer {access_token} (preferido)

X-Tenant-Subdomain: {subdomain} (para multi-tenant)

X-Carrito-Token: {token} (para invitados en carrito)

# Pagination
Default: page_size=10 (admin) / page_size=8 (usuarios) / page_size=20 (bitácora)

Parámetros: page, page_size (max 50-100 según endpoint)

Respuesta: { count, page, page_size, next, previous, results }

# Key Models
Tenants
Tenant: name, subdomain, schema_name, status (activo/suspendido/cancelado)

Plan: nombre, slug, precios, límites, features

Suscripcion: tenant, plan, estado (trialing/active/past_due/canceled)

TenantUser: tenant, user, role, is_active

TenantRole: tenant, nombre, permisos (JSON)

Inventarios
Categoria, Subcategoria, Laboratorio

Producto: sku, nombre_comercial, precio_venta, requiere_receta, es_controlado

Inventario: stock_actual, stock_reservado, stock_minimo

LoteProducto: numero_lote, fecha_vencimiento, cantidad_disponible, estado

MovimientoInventario: entrada/salida/ajuste, motivo, cantidad

Ventas
Venta: cliente, vendedor, origen (fisica/online), estado, total

DetalleVenta: producto, cantidad, precio_unitario, subtotal

Factura: tipo (simple/con_nit), numero_factura (auto-generado), nombre_cliente

Tratamientos
TratamientoBase: producto, nombre_publico, dosis, frecuencia, duración

TratamientoActivo: cliente, base, estado (activo/pausado/completado/cancelado)

TomaMedicamento: fecha_hora_programada, estado (pendiente/tomada/omitida/pospuesta)

Puntos
ConfiguracionPuntos: bolivianos_por_punto, puntos_minimos_canje

CuentaPuntos: cliente, puntos_disponibles, puntos_acumulados, nivel

CatalogoCanje: tipo (descuento/producto/cupón), puntos_requeridos

CanjePuntos: código_voucher, estado (pendiente/aplicado/cancelado)

TransaccionPuntos: tipo (ganado/canjeado/expirado/ajuste/reverso), puntos

