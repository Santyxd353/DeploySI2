# Sistema de Informacion - Monorepo

Monorepo de Farmacia con frontend web, backend API y cliente mobile.

- Backend: Django + DRF + JWT
- Frontend: React + Vite + Tailwind
- Base de datos: PostgreSQL
- Contenedores: Docker + Docker Compose
- Mobile: Flutter (separado)

## Estructura principal

```text
.
|-- backend/
|   |-- Dockerfile
|   |-- requirements.txt
|   |-- entrypoint.sh
|   `-- src/
|       |-- manage.py
|       `-- core/
|-- frontend/
|   |-- Dockerfile
|   |-- package.json
|   `-- src/
|-- mobile/
|   `-- README.md
|-- docker-compose.yml
`-- .env.example
```

## 1) Configuracion inicial

1. Copia `.env.example` a `.env`.
2. Ajusta variables de base de datos, backend y frontend.

## 2) Levantar el entorno con Docker

```bash
docker compose up --build
```

## Ver logs de frontend y backend
Logs en tiempo real de ambos servicios:
```bash
docker compose logs -f frontend backend
```
Solo logs de frontend:
```bash
docker compose logs -f frontend
```
Solo logs de backend:
```bash
docker compose logs -f backend
```
Ver las ultimas 100 lineas (sin seguir):
```bash
docker compose logs --tail=100 frontend backend
```

## 3) Comandos utiles (backend)

Aplicar migraciones:

```bash
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
```

Crear superusuario:

```bash
docker compose exec backend python manage.py createsuperuser
```
crear historias de ventas
```bash
docker compose exec backend python manage.py seed_ventas_historicas_fijo --all-tenants
```
Crear productos
```bash
docker compose exec backend python manage.py seed_productos --all-tenants
```
Sembrar roles y permisos RBAC:

```bash
docker compose exec backend python manage.py seed_roles_permisos --all-tenants
```

Sembrar 5 usuarios demo para pruebas de gestion de usuarios:

```bash
docker compose exec backend python manage.py seed_usuarios_demo --all-tenants
```

Opcional: redefinir contrasena para todos los usuarios demo existentes:

```bash
docker compose exec backend python manage.py seed_usuarios_demo --all-tenants --reset-password --password "MiClaveSegura123*"
```

Usuarios creados por defecto:

- carlos.mendoza@saludplus.com (admin)
- ana.rojas@saludplus.com (farmaceutico)
- luis.torrez@saludplus.com (cajero)
- maria.quispe@saludplus.com (cliente)
- jorge.vargas@saludplus.com (cliente)

Contrasena por defecto: `SaludPlus2026*`

Sembrar 10 laboratorios demo para pruebas de gestion de laboratorios:

```bash
docker compose exec backend python manage.py seed_laboratorios_demos --all-tenants
```

Sembrar 10 categorias con sus respectivas subcat. demo para pruebas de gestion de categorias:

```bash
docker compose exec backend python manage.py seed_categorias_subcategorias_demos --all-tenants
```
## 4) Mobile (Flutter)

Dentro de `mobile/`:

```bash
flutter create .
flutter run
```

## 5) Probar pagos con Stripe en local

### Backend con Docker

1. Copia `.env.example` a `.env` y deja tus claves de prueba de Stripe.
2. Levanta la infraestructura:

```bash
docker compose up -d --build
docker compose exec backend python manage.py migrate
```

### Webhook local opcional

Si quieres probar el webhook local, instala Stripe CLI en tu PC y ejecuta:

```bash
stripe login
stripe listen --events payment_intent.succeeded,payment_intent.payment_failed --forward-to http://localhost:8000/api/ventas/stripe/webhook/
```

La CLI te mostrará un secreto `whsec_...`; colócalo en `STRIPE_WEBHOOK_SECRET` y recrea el backend.

### Flutter mobile

En Android emulador:

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000 --dart-define=STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx --dart-define=STRIPE_MERCHANT_DISPLAY_NAME="Farmacia Bibosi"
```

Si usas un teléfono físico, cambia `API_BASE_URL` por la IP LAN de tu PC.

### Tarjeta de prueba

Usa `4242 4242 4242 4242`, cualquier fecha futura, cualquier CVC.

### Lo que debes ver

1. PaymentSheet abre en el móvil.
2. El pago se confirma.
3. El carrito se vacía.
4. Se crea la factura.
5. La factura aparece en `Mis Pagos`.

comando para crear apps con docker:

docker compose exec backend python src/manage.py startapp inventario

## Notas

- No guardar credenciales reales en el README.
- Para desarrollo local, usar usuarios de prueba en `.env` o en seeds internas.

# Ver desde el contenedor backend
docker compose exec backend python -c "import os; print('SECRET:', os.environ.get('STRIPE_SECRET_KEY', 'NO'))"
docker compose exec backend python -c "import os; print('PUBLIC:', os.environ.get('STRIPE_PUBLIC_KEY', 'NO'))"

## 6) SaaS multi-tenant con django-tenants

Esta version incluye soporte SaaS por subdominio usando schemas PostgreSQL aislados.

### Variables nuevas recomendadas

Agregar en `.env`:

```env
SAAS_ROOT_DOMAIN=localhost
SAAS_PUBLIC_BASE_URL=http://localhost:5173
SAAS_BILLING_SUCCESS_URL=http://localhost:5173/admin/suscripcion?status=ok
SAAS_BILLING_CANCEL_URL=http://localhost:5173/admin/suscripcion?status=cancel
VITE_ROOT_DOMAIN=localhost
```

### Dependencias

En backend:

```bash
pip install -r requirements.txt
```

### Flujo de migracion desde sistema actual (single-tenant)

1. Respaldar base de datos actual usando Docker Compose.

```bash
docker compose exec db pg_dump -U app_user app_db > backup_pre_saas.sql
```

2. Reconstruir el backend y validar el contenedor.

```bash
docker compose build backend
docker compose run --rm --entrypoint python backend manage.py check
```

3. Crear migraciones de los cambios (incluye app `tenants` y campos `tenant` en modelos de negocio).

```bash
docker compose exec backend python manage.py makemigrations tenants core inventarios clientes carrito ventas backup
```

4. Ejecutar migraciones compartidas y por schema.

```bash
docker compose exec backend python manage.py migrate_schemas --shared
docker compose exec backend python manage.py migrate_schemas
```

5. Crear planes base SaaS.

```bash
docker compose exec backend python manage.py bootstrap_saas
```

6. Migrar datos legados al tenant por defecto.

```bash
docker compose exec backend python manage.py migrate_legacy_to_tenant --schema farmacia_principal --subdomain farmacia-principal --domain farmacia-principal.localhost --name "Farmacia Principal" --email admin@farmacia.local
```

7. Ejecutar migraciones para tenants.

```bash
docker compose exec backend python manage.py migrate_schemas
```

8. Levantar todo el stack.

```bash
docker compose up -d --build
```

9. Validar el frontend.

```bash
docker compose run --rm --entrypoint npm frontend run build
```

### Endpoints SaaS principales

- Publico:
	- `GET /api/tenants/public/plans/`
	- `POST /api/tenants/public/register-tenant/`
	- `POST /api/tenants/public/login/`
- Tenant:
	- `GET /api/tenants/billing/current/`
	- `POST /api/tenants/billing/checkout/`
- Stripe webhook:
	- `POST /api/tenants/billing/webhook/stripe/`
- Superadmin global:
	- `GET /api/tenants/global/tenants/`
	- `PATCH /api/tenants/global/tenants/{id}/status/`

### Frontend SaaS

- Landing pública de precios: `/`
- Registro de farmacia: `/saas/register-farmacia`
- Login global: `/saas/login`
- Panel tenant de suscripcion: `/admin/suscripcion`
- Panel global de tenants (superadmin): `/admin/global/tenants`

### Desarrollo local con subdominios

Para simular subdominios en local, usa hosts como:

- `farmacia-principal.localhost:5173`
- `farmacia-principal.localhost:8000`

Si tu entorno no resuelve subdominios de `localhost`, agrega entradas en `hosts` apuntando a `127.0.0.1`.

### Seguridad y aislamiento

- Middleware `TenantMainMiddleware` resuelve tenant por dominio/subdominio.
- Middleware `TenantAccessMiddleware` bloquea tenants suspendidos/cancelados y valida limites de plan.
- Modelos de negocio ahora son `TenantAwareModel`.
- JWT usa nombre de cookie con sufijo por schema (`access_token_<tenant>` y `refresh_token_<tenant>`).

### Despliegue (resumen)

1. Configura DNS wildcard (`*.midominio.com`) al frontend/proxy.
2. Configura reverse proxy para mantener `Host` original hacia Django.
3. Ejecuta `migrate_schemas --shared` y luego `migrate_schemas`.
4. Configura `SAAS_ROOT_DOMAIN`, claves Stripe y `STRIPE_WEBHOOK_SECRET`.
5. Crea tenant inicial con endpoint público o comando `migrate_legacy_to_tenant`.

