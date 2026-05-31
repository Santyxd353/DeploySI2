# Módulo Opiniones — Documentación para implementación Flutter (Cliente)

## 1. Endpoints relevantes para el cliente

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/opiniones/` | Crear opinión |
| `GET` | `/api/opiniones/mias/` | Listar opiniones propias |
| `GET` | `/api/ventas/mias/` | Obtener ventas propias (para el dropdown) |

> Todos los endpoints requieren el header `Authorization: Bearer <token>` o la cookie JWT del tenant.

---

## 2. Crear opinión

### Request
```
POST /api/opiniones/
Content-Type: application/json
Authorization: Bearer <token>

{
  "tipo": "general" | "venta" | "producto" | "servicio",
  "puntuacion": 1..5,                   // obligatorio
  "comentario": "Texto opcional...",    // máx 500 chars, puede omitirse
  "venta": 123,                         // ID de venta — obligatorio si tipo=venta
  "producto": 456                       // ID de producto — obligatorio si tipo=producto
}
```

### Respuesta exitosa `201 Created`
```json
{
  "id": 7,
  "venta": 123,
  "producto": null,
  "tipo": "venta",
  "puntuacion": 4,
  "comentario": "Excelente atención",
  "estado": "pendiente",
  "created_at": "2026-05-27T14:30:00Z"
}
```

### Errores posibles
| Status | Causa |
|--------|-------|
| `400` | Anti-spam activo (opinión general enviada en los últimos 7 días) |
| `400` | La venta no pertenece al cliente |
| `400` | Ya existe una opinión para esa venta |
| `400` | Falta `venta` cuando `tipo=venta`, o falta `producto` cuando `tipo=producto` |
| `403` | El usuario no tiene rol `cliente` |

---

## 3. Listar opiniones propias

### Request
```
GET /api/opiniones/mias/
Authorization: Bearer <token>
```

### Respuesta `200 OK`
```json
{
  "count": 3,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 7,
      "venta": 123,
      "venta_numero": 123,
      "producto": null,
      "producto_nombre": null,
      "tipo": "venta",
      "puntuacion": 4,
      "comentario": "Excelente atención",
      "estado": "respondida",
      "respuesta_staff": "Gracias por tu opinión, volvemos pronto.",
      "fecha_respuesta": "2026-05-28T09:00:00Z",
      "created_at": "2026-05-27T14:30:00Z"
    }
  ]
}
```

---

## 4. Obtener ventas propias (dropdown)

```
GET /api/ventas/mias/
Authorization: Bearer <token>
```

Devuelve las últimas ventas del cliente autenticado. Usa el campo `id` como valor del dropdown y muestra `created_at` + `total` como etiqueta.

---

## 5. Modelo de datos Flutter sugerido

```dart
class Opinion {
  final int id;
  final int? venta;
  final int? ventaNumero;
  final int? producto;
  final String? productoNombre;
  final String tipo;      // 'general' | 'venta' | 'producto' | 'servicio'
  final int puntuacion;   // 1..5
  final String comentario;
  final String estado;    // 'pendiente' | 'respondida' | 'escalada' | 'archivada'
  final String? respuestaStaff;
  final DateTime? fechaRespuesta;
  final DateTime createdAt;

  const Opinion({
    required this.id,
    this.venta,
    this.ventaNumero,
    this.producto,
    this.productoNombre,
    required this.tipo,
    required this.puntuacion,
    required this.comentario,
    required this.estado,
    this.respuestaStaff,
    this.fechaRespuesta,
    required this.createdAt,
  });

  factory Opinion.fromJson(Map<String, dynamic> json) => Opinion(
    id: json['id'],
    venta: json['venta'],
    ventaNumero: json['venta_numero'],
    producto: json['producto'],
    productoNombre: json['producto_nombre'],
    tipo: json['tipo'],
    puntuacion: json['puntuacion'],
    comentario: json['comentario'] ?? '',
    estado: json['estado'],
    respuestaStaff: json['respuesta_staff'],
    fechaRespuesta: json['fecha_respuesta'] != null
        ? DateTime.parse(json['fecha_respuesta'])
        : null,
    createdAt: DateTime.parse(json['created_at']),
  );
}
```

---

## 6. Servicio HTTP Flutter sugerido

```dart
class OpinionesService {
  final Dio _dio; // inyectado con baseUrl y headers de auth configurados

  OpinionesService(this._dio);

  Future<void> crearOpinion({
    required String tipo,
    required int puntuacion,
    String comentario = '',
    int? ventaId,
    int? productoId,
  }) async {
    await _dio.post('/api/opiniones/', data: {
      'tipo': tipo,
      'puntuacion': puntuacion,
      if (comentario.isNotEmpty) 'comentario': comentario,
      if (ventaId != null) 'venta': ventaId,
      if (productoId != null) 'producto': productoId,
    });
  }

  Future<List<Opinion>> misOpiniones({int page = 1}) async {
    final response = await _dio.get('/api/opiniones/mias/', queryParameters: {'page': page});
    final results = response.data['results'] as List;
    return results.map((e) => Opinion.fromJson(e)).toList();
  }
}
```

---

## 7. Flujo de pantallas sugerido

```
Menú principal / Perfil
  └── "Tu Opinión" (ítem con icono estrella)
        ├── [Tab] Dejar opinión   →  FormularioOpinionScreen
        └── [Tab] Mis opiniones   →  MisOpinionesScreen


FormularioOpinionScreen:
  1. SegmentedControl: General | Compra | Producto
  2. Si "Compra": DropdownButton con ventas propias
  3. Si "Producto": SearchField de productos
  4. RatingBar interactivo (1-5 estrellas)
  5. TextField comentario (contador 0/500)
  6. ElevatedButton "Enviar Opinión"
  7. SnackBar éxito / diálogo de error con mensaje del backend

MisOpinionesScreen:
  - ListView de Cards con:
      · Estrellas (puntuacion)
      · Tipo y fecha
      · Comentario del cliente
      · Chip de estado (pendiente/respondida/escalada/archivada)
      · Si estado == "respondida": sección "Respuesta de la farmacia"
```

---

## 8. Reglas de negocio a validar en cliente (UX preventivo)

| Regla | Acción en UI |
|-------|-------------|
| Anti-spam 7 días (general) | Si el último intento falla con 400, mostrar "Ya enviaste una opinión general recientemente. Podrás enviar otra en X días." |
| Venta ya opinada | Filtrar del dropdown las ventas que ya tienen opinión (`GET /api/opiniones/mias/` → extraer IDs de venta). |
| Puntuación obligatoria | Deshabilitar botón "Enviar" hasta que el usuario toque al menos 1 estrella. |
| Inmutabilidad (R6) | No mostrar opción de editar/eliminar en `MisOpinionesScreen`. Solo lectura. |
