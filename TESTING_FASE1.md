# 🧪 PRUEBAS - FASE 1: Backend API

## Endpoints Disponibles Ahora

### 1. GET `/api/ventas/historial/` (Ya existía)
Historial de ventas del cliente con filtros.

```bash
# Ejemplo con curl:
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:8000/api/ventas/historial/?estado=pagada&fecha_desde=2026-01-01"
```

### 2. GET `/api/ventas/historial/estadisticas/` (NUEVO ✅)
Estadísticas personales del cliente.

```bash
# Ejemplo con curl:
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:8000/api/ventas/historial/estadisticas/"

# Respuesta esperada:
{
  "total_gastado": 2540.50,
  "total_compras": 12,
  "ticket_promedio": 211.70,
  "ultima_compra": {
    "id": 101,
    "estado": "pagada",
    "estado_label": "Pagada",
    "total": 245.30,
    "created_at": "2026-06-20T15:30:00Z",
    "detalles": [
      {
        "id": 1,
        "producto": 5,
        "producto_nombre": "Paracetamol 500mg",
        "producto_sku": "PARA-500-001",
        "cantidad": 2,
        "precio_unitario": "15.50",
        "subtotal": "31.00"
      }
    ],
    "observacion": "Compra con receta"
  },
  "compras_este_mes": 3,
  "estado_pagada_count": 10,
  "estado_pendiente_count": 1,
  "estado_entregada_count": 12,
  "estado_cancelada_count": 0
}
```

---

## Cómo Obtener un JWT Token

### Opción 1: Login API

```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@example.com",
    "password": "password123"
  }'

# Respuesta:
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": { ... }
}
```

Usar el `access` token en requests.

### Opción 2: Desde Admin Django

```bash
# 1. Acceder a shell Django
docker compose exec backend python manage.py shell

# 2. En el shell:
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model

User = get_user_model()
user = User.objects.get(email="cliente@example.com")
refresh = RefreshToken.for_user(user)
print(str(refresh.access_token))  # Copiar este token
```

---

## Pruebas en Postman

### 1. Crear Collection
Nombre: `Farmacia - HU-18 & HU-36`

### 2. Agregar Requests

#### Request 1: Get Historial
```
Method: GET
URL: {{base_url}}/api/ventas/historial/
Headers:
  Authorization: Bearer {{access_token}}
Params:
  estado: pagada
  page_size: 10
```

#### Request 2: Get Estadísticas (NUEVO)
```
Method: GET
URL: {{base_url}}/api/ventas/historial/estadisticas/
Headers:
  Authorization: Bearer {{access_token}}
```

### 3. Variables de Postman
```
base_url = http://localhost:8000/api
access_token = eyJ0eXAi...  (token de tu usuario)
```

---

## Pruebas en Python

```python
import requests
import json

BASE_URL = "http://localhost:8000/api"
TOKEN = "YOUR_JWT_TOKEN_HERE"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

# Test 1: Historial
response = requests.get(
    f"{BASE_URL}/ventas/historial/?estado=pagada",
    headers=headers
)
print("Test 1 - Historial:")
print(json.dumps(response.json(), indent=2))

# Test 2: Estadísticas (NUEVO)
response = requests.get(
    f"{BASE_URL}/ventas/historial/estadisticas/",
    headers=headers
)
print("\nTest 2 - Estadísticas:")
print(json.dumps(response.json(), indent=2))
```

---

## Verificaciones

### ✅ Sin autenticación
```bash
curl "http://localhost:8000/api/ventas/historial/estadisticas/"
# Esperado: Error 401 Unauthorized
```

### ✅ Con rol de ADMIN
```bash
# Usar token de usuario admin
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  "http://localhost:8000/api/ventas/historial/estadisticas/"
# Esperado: Success 200 con estadísticas del admin (si tiene cliente asociado)
```

### ✅ Cliente sin compras
```bash
# Usar token de nuevo cliente (sin compras)
curl -H "Authorization: Bearer NEW_CUSTOMER_TOKEN" \
  "http://localhost:8000/api/ventas/historial/estadisticas/"
# Esperado: Success 200 con todos los contadores en 0
```

---

## Respuestas Esperadas

### ✅ 200 OK - Cliente con compras
```json
{
  "total_gastado": 2540.50,
  "total_compras": 12,
  "ticket_promedio": 211.70,
  "ultima_compra": { venta_object },
  "compras_este_mes": 3,
  "estado_pagada_count": 10,
  "estado_pendiente_count": 1,
  "estado_entregada_count": 12,
  "estado_cancelada_count": 0
}
```

### ✅ 200 OK - Cliente sin compras
```json
{
  "total_gastado": 0,
  "total_compras": 0,
  "ticket_promedio": 0,
  "ultima_compra": null,
  "compras_este_mes": 0,
  "estado_pagada_count": 0,
  "estado_pendiente_count": 0,
  "estado_entregada_count": 0,
  "estado_cancelada_count": 0
}
```

### ❌ 401 Unauthorized
```json
{
  "detail": "Authentication credentials were not provided."
}
```

### ❌ 404 Not Found
```json
{
  "detail": "Usuario no tiene cliente asociado"
}
```

---

## Datos de Prueba (Si necesitas crear)

### Crear cliente de prueba
```bash
docker compose exec backend python manage.py shell

from django.contrib.auth import get_user_model
from clientes.models import Cliente

User = get_user_model()

# Crear usuario
user = User.objects.create_user(
    email="testcliente@test.com",
    password="test123",
    first_name="Test",
    last_name="Cliente"
)

# Crear cliente asociado
cliente = Cliente.objects.create(
    usuario=user,
    tipo="registrado",
    nombres="Test",
    apellidos="Cliente",
    email="testcliente@test.com",
    estado=True
)

print(f"Usuario: {user.id} - {user.email}")
print(f"Cliente: {cliente.id} - {cliente.nombres}")
```

### Crear ventas de prueba
```bash
docker compose exec backend python manage.py seed_ventas_historicas_fijo --all-tenants
```

---

## Logs para Debug

### Ver logs del backend
```bash
docker compose logs -f backend

# Buscar errores:
docker compose logs backend | grep -i "error\|exception"
```

### Habilitar debug en Django
Editar `backend/src/config/settings.py`:
```python
DEBUG = True
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
    },
    'loggers': {
        'ventas': {'handlers': ['console'], 'level': 'DEBUG'},
    },
}
```

---

## Checklist de Pruebas

- [ ] El endpoint `/historial/estadisticas/` responde 200
- [ ] Devuelve todos los campos esperados
- [ ] Sin autenticación devuelve 401
- [ ] Con cliente sin compras devuelve 0 en todos los contadores
- [ ] Usuario sin cliente asociado devuelve 404
- [ ] Los totales coinciden con BD
- [ ] El `ticket_promedio` es correcto: `total_gastado / total_compras`
- [ ] Solo cuenta ventas en estado "pagada" o "entregada" para `total_gastado`
- [ ] Cuenta TODAS las ventas por estado incluyendo canceladas

---

**Listo para Fase 2: Frontend Admin** ✅

