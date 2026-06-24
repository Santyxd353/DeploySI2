# Prescripciones IA

## Variables de entorno

- `GEMINI_API_KEY`: API key de Google AI Studio
- `GEMINI_MODEL`: opcional, por defecto `gemini-2.5-flash`
- `GEMINI_TIMEOUT_SEC`: opcional, por defecto `60`

## Arranque cuando Docker esté encendido

1. Agregar variables al `.env` del backend
2. Levantar contenedores
3. Ejecutar migraciones tenant
4. Probar el endpoint de captura

## Comandos esperados

```powershell
docker compose up -d
docker compose exec backend python manage.py migrate_schemas --noinput
```

## Endpoint base

- `POST /api/prescripciones/capturas/`

Campo multipart esperado:

- `archivo_imagen`

Opcionales:

- `cliente`
- `mime_type`
- `nombre_archivo_original`
