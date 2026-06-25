import base64
import json
import re
from math import ceil
from difflib import SequenceMatcher
from dataclasses import dataclass

from django.db import transaction
from django.conf import settings
from django.utils import timezone
import requests
from carrito.services import CarritoServiceError, agregar_item_carrito, obtener_o_crear_carrito_activo
from inventarios.models import Producto

from .models import CapturaReceta, ItemCapturaReceta


class PrescripcionesServiceError(Exception):
    pass


@dataclass
class ResultadoExtraccionReceta:
    texto_extraido: str
    respuesta_ia: dict
    datos_extraidos: dict
    requiere_revision_manual: bool = True


class GeminiExtractorRecetaService:
    def __init__(self, *, api_key=None, model_name=None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model_name = model_name or settings.GEMINI_MODEL
        self.timeout_sec = settings.GEMINI_TIMEOUT_SEC

    def extraer_desde_captura(self, captura: CapturaReceta) -> ResultadoExtraccionReceta:
        if not self.api_key:
            raise PrescripcionesServiceError("Falta configurar GEMINI_API_KEY en el backend.")

        image_bytes = captura.archivo_imagen.read()
        if not image_bytes:
            raise PrescripcionesServiceError("La imagen de la receta está vacía o no pudo leerse.")

        encoded_image = base64.b64encode(image_bytes).decode("utf-8")
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "inline_data": {
                                "mime_type": captura.mime_type or "image/jpeg",
                                "data": encoded_image,
                            }
                        },
                        {
                            "text": self._build_prompt(),
                        },
                    ],
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": self._build_response_schema(),
                "temperature": 0.2,
                "topP": 0.8,
                "maxOutputTokens": 4096,
            },
        }

        try:
            response = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent",
                headers={
                    "x-goog-api-key": self.api_key,
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=self.timeout_sec,
            )
        except requests.RequestException as exc:
            raise PrescripcionesServiceError(f"No se pudo conectar con Gemini: {exc}") from exc

        if response.status_code < 200 or response.status_code >= 300:
            detail = self._extract_error_detail(response)
            raise PrescripcionesServiceError(f"Gemini respondió con error: {detail}")

        response_data = response.json()
        parsed_json = self._extract_structured_payload(response_data)
        texto_extraido = self._build_texto_extraido(parsed_json)

        return ResultadoExtraccionReceta(
            texto_extraido=texto_extraido,
            respuesta_ia=response_data,
            datos_extraidos=parsed_json,
            requiere_revision_manual=bool(parsed_json.get("requiere_revision_manual", True)),
        )

    def _build_prompt(self) -> str:
        return (
            "Analiza esta foto de una receta médica manuscrita y extrae solamente la información visible. "
            "No inventes datos. Si un campo no es legible o no estás seguro, devuelve null o 'ilegible'. "
            "Devuelve exclusivamente un JSON válido que cumpla el esquema solicitado. "
            "Incluye el texto completo transcrito. "
            "Devuelve un objeto encabezado con medico, paciente y fecha si están visibles. "
            "Devuelve items_receta con producto, cantidad, dosis_diaria y tratamiento_dias. "
            "Marca requiere_revision_manual=true si existe cualquier duda, ambigüedad o ilegibilidad."
        )

    def _build_response_schema(self) -> dict:
        encabezado_schema = {
            "type": "object",
            "properties": {
                "medico": {"type": ["string", "null"]},
                "paciente": {"type": ["string", "null"]},
                "fecha": {"type": ["string", "null"]},
            },
            "required": ["medico", "paciente", "fecha"],
            "additionalProperties": False,
        }
        item_receta_schema = {
            "type": "object",
            "properties": {
                "producto": {"type": ["string", "null"]},
                "cantidad": {"type": ["string", "null"]},
                "dosis_diaria": {"type": ["string", "null"]},
                "tratamiento_dias": {"type": ["string", "null"]},
                "confianza": {"type": ["number", "null"], "minimum": 0, "maximum": 1},
            },
            "required": ["producto", "cantidad", "dosis_diaria", "tratamiento_dias", "confianza"],
            "additionalProperties": False,
        }
        return {
            "type": "object",
            "properties": {
                "texto_completo": {"type": ["string", "null"]},
                "encabezado": encabezado_schema,
                "items_receta": {
                    "type": "array",
                    "items": item_receta_schema,
                },
                "observaciones": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "confianza_general": {"type": ["number", "null"], "minimum": 0, "maximum": 1},
                "requiere_revision_manual": {"type": "boolean"},
            },
            "required": [
                "texto_completo",
                "encabezado",
                "items_receta",
                "observaciones",
                "confianza_general",
                "requiere_revision_manual",
            ],
            "additionalProperties": False,
        }

    def _extract_structured_payload(self, response_data: dict) -> dict:
        candidates = response_data.get("candidates")
        if not isinstance(candidates, list) or not candidates:
            raise PrescripcionesServiceError("Gemini no devolvió candidatos válidos.")

        content = candidates[0].get("content") or {}
        parts = content.get("parts")
        if not isinstance(parts, list) or not parts:
            raise PrescripcionesServiceError("Gemini no devolvió contenido utilizable.")

        raw_text = ""
        for part in parts:
            if isinstance(part, dict) and isinstance(part.get("text"), str):
                raw_text += part["text"]

        raw_text = raw_text.strip()
        if not raw_text:
            raise PrescripcionesServiceError("Gemini devolvió una respuesta vacía.")

        try:
            parsed = json.loads(raw_text)
        except json.JSONDecodeError:
            sanitized = raw_text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            try:
                parsed = json.loads(sanitized)
            except json.JSONDecodeError as exc:
                candidate = self._extract_json_object_candidate(sanitized)
                if candidate:
                    try:
                        parsed = json.loads(candidate)
                    except json.JSONDecodeError:
                        raise PrescripcionesServiceError("Gemini no devolvió un JSON válido.") from exc
                else:
                    raise PrescripcionesServiceError("Gemini no devolvió un JSON válido.") from exc

        if not isinstance(parsed, dict):
            raise PrescripcionesServiceError("La respuesta estructurada de Gemini no es un objeto JSON.")

        parsed = self._normalizar_payload(parsed)

        observaciones = parsed.get("observaciones")
        if not isinstance(observaciones, list):
            parsed["observaciones"] = []

        return parsed

    def _normalizar_payload(self, parsed: dict) -> dict:
        encabezado = parsed.get("encabezado")
        if not isinstance(encabezado, dict):
            encabezado = {
                "medico": parsed.get("medico"),
                "paciente": parsed.get("paciente"),
                "fecha": parsed.get("fecha"),
            }
        parsed["encabezado"] = {
            "medico": encabezado.get("medico"),
            "paciente": encabezado.get("paciente"),
            "fecha": encabezado.get("fecha"),
        }

        items_receta = parsed.get("items_receta")
        if not isinstance(items_receta, list):
            medicamentos = parsed.get("medicamentos")
            if isinstance(medicamentos, list):
                items_receta = []
                for item in medicamentos:
                    if not isinstance(item, dict):
                        continue
                    items_receta.append(
                        {
                            "producto": item.get("nombre"),
                            "cantidad": item.get("cantidad"),
                            "dosis_diaria": item.get("indicaciones"),
                            "tratamiento_dias": item.get("duracion"),
                            "confianza": item.get("confianza"),
                        }
                    )
            else:
                items_receta = []
        parsed["items_receta"] = items_receta
        return parsed

    def _extract_json_object_candidate(self, raw_text: str) -> str | None:
        match = re.search(r"\{[\s\S]*\}", raw_text)
        if not match:
            return None
        return match.group(0).strip()

    def _build_texto_extraido(self, parsed_json: dict) -> str:
        texto = str(parsed_json.get("texto_completo") or "").strip()
        if texto:
            return texto

        lines = []
        encabezado = parsed_json.get("encabezado") or {}
        medico = str(encabezado.get("medico") or "").strip()
        paciente = str(encabezado.get("paciente") or "").strip()
        fecha = str(encabezado.get("fecha") or "").strip()
        if medico:
            lines.append(f"Médico: {medico}")
        if paciente:
            lines.append(f"Paciente: {paciente}")
        if fecha:
            lines.append(f"Fecha: {fecha}")

        items_receta = parsed_json.get("items_receta") or []
        for index, item in enumerate(items_receta, start=1):
            if not isinstance(item, dict):
                continue
            fragmentos = [
                str(item.get("producto") or "").strip(),
                str(item.get("cantidad") or "").strip(),
                str(item.get("dosis_diaria") or "").strip(),
                str(item.get("tratamiento_dias") or "").strip(),
            ]
            contenido = " | ".join([fragmento for fragmento in fragmentos if fragmento])
            if contenido:
                lines.append(f"{index}. {contenido}")

        return "\n".join(lines).strip()

    def _extract_error_detail(self, response) -> str:
        try:
            payload = response.json()
        except ValueError:
            return response.text.strip() or f"HTTP {response.status_code}"
        error = payload.get("error")
        if isinstance(error, dict):
            message = error.get("message")
            if isinstance(message, str) and message.strip():
                return message.strip()
        return response.text.strip() or f"HTTP {response.status_code}"


class ResolucionRecetaService:
    def resolver_items(self, captura: CapturaReceta) -> dict:
        return {
            "captura_id": captura.id,
            "items_resueltos": captura.items.count(),
            "pendiente_matching_catalogo": True,
        }


class ProcesadorCapturaReceta:
    def __init__(self, *, extractor=None, resolvedor=None):
        self.extractor = extractor or GeminiExtractorRecetaService()
        self.resolvedor = resolvedor or ResolucionRecetaService()

    @transaction.atomic
    def procesar(self, captura: CapturaReceta) -> CapturaReceta:
        captura.estado = CapturaReceta.Estado.PROCESANDO
        captura.error_detalle = ""
        captura.save(update_fields=["estado", "error_detalle", "updated_at"])

        resultado = self.extractor.extraer_desde_captura(captura)

        captura.texto_extraido = resultado.texto_extraido
        captura.respuesta_ia = resultado.respuesta_ia
        captura.datos_extraidos = resultado.datos_extraidos
        captura.requiere_revision_manual = resultado.requiere_revision_manual
        captura.modelo_ia = self.extractor.model_name
        captura.estado = CapturaReceta.Estado.PROCESADA
        captura.save(
            update_fields=[
                "texto_extraido",
                "respuesta_ia",
                "datos_extraidos",
                "requiere_revision_manual",
                "modelo_ia",
                "estado",
                "updated_at",
            ]
        )

        self._sincronizar_items_desde_resultado(captura, resultado.datos_extraidos)
        captura.datos_resueltos = self.resolvedor.resolver_items(captura)
        captura.save(update_fields=["datos_resueltos", "updated_at"])
        return captura

    def marcar_fallida(self, captura: CapturaReceta, detalle: str) -> CapturaReceta:
        captura.estado = CapturaReceta.Estado.FALLIDA
        captura.error_detalle = detalle
        captura.save(update_fields=["estado", "error_detalle", "updated_at"])
        return captura

    def _sincronizar_items_desde_resultado(self, captura: CapturaReceta, datos_extraidos: dict) -> None:
        captura.items.all().delete()
        items_receta = datos_extraidos.get("items_receta") if isinstance(datos_extraidos, dict) else None
        if not isinstance(items_receta, list):
            return

        for index, item in enumerate(items_receta, start=1):
            if not isinstance(item, dict):
                continue
            ItemCapturaReceta.objects.create(
                tenant=captura.tenant,
                captura=captura,
                orden=index,
                nombre_detectado=str(item.get("producto") or "").strip(),
                presentacion_detectada="",
                cantidad_detectada=str(item.get("cantidad") or "").strip(),
                indicaciones_detectadas=str(item.get("dosis_diaria") or "").strip(),
                duracion_detectada=str(item.get("tratamiento_dias") or "").strip(),
                confianza=item.get("confianza"),
                nombre_resuelto=str(item.get("producto") or "").strip(),
                indicaciones_resueltas=str(item.get("dosis_diaria") or "").strip(),
                duracion_resuelta=str(item.get("tratamiento_dias") or "").strip(),
            )


class AplicacionRecetaService:
    @transaction.atomic
    def confirmar_captura(self, captura: CapturaReceta, *, resumen_receta=None, items_receta=None) -> CapturaReceta:
        if resumen_receta is not None:
            captura.datos_extraidos = resumen_receta
        if items_receta is not None:
            captura.datos_resueltos = {"items_receta": items_receta}
            self._sincronizar_items_confirmados(captura, items_receta)
        captura.estado = CapturaReceta.Estado.CONFIRMADA
        captura.save(update_fields=["datos_extraidos", "datos_resueltos", "estado", "updated_at"])
        return captura

    @transaction.atomic
    def aplicar_captura(
        self,
        captura: CapturaReceta,
        *,
        item_ids_confirmados=None,
        crear_tratamientos=False,
        agregar_a_carrito=False,
    ) -> dict:
        resultado = {
            "captura_id": captura.id,
            "item_ids_confirmados": item_ids_confirmados or [],
            "crear_tratamientos": crear_tratamientos,
            "agregar_a_carrito": agregar_a_carrito,
            "pendiente_integracion": False,
            "items_agregados": [],
            "items_omitidos": [],
        }

        if agregar_a_carrito:
            if captura.carrito_enviado:
                raise PrescripcionesServiceError("Esta receta ya fue enviada al carrito.")
            resultado.update(self._agregar_items_a_carrito(captura))
            if resultado["items_agregados"]:
                captura.carrito_enviado = True
                captura.carrito_enviado_at = timezone.now()
                captura.save(update_fields=["carrito_enviado", "carrito_enviado_at", "updated_at"])

        if crear_tratamientos:
            resultado["tratamientos_pendiente"] = True
            resultado["mensaje_tratamientos"] = "La acción de tratamientos quedará habilitada en una siguiente iteración."

        return resultado

    def _agregar_items_a_carrito(self, captura: CapturaReceta) -> dict:
        usuario = captura.creada_por or getattr(getattr(captura, "cliente", None), "usuario", None)
        if usuario is None:
            raise PrescripcionesServiceError("No se pudo identificar el usuario para crear el carrito.")

        carrito = obtener_o_crear_carrito_activo(usuario=usuario)
        items_agregados = []
        items_omitidos = []

        for item in captura.items.select_related("producto").order_by("orden", "id"):
            producto, motivo = self._resolver_producto_para_carrito(item)
            if producto is None:
                items_omitidos.append(
                    {
                        "item_id": item.id,
                        "nombre_detectado": item.nombre_detectado,
                        "motivo": motivo,
                    }
                )
                continue

            cantidad = self._calcular_cantidad_carrito(item, producto)
            try:
                agregar_item_carrito(carrito=carrito, producto_id=producto.id, cantidad=cantidad)
            except CarritoServiceError as exc:
                items_omitidos.append(
                    {
                        "item_id": item.id,
                        "producto_id": producto.id,
                        "producto_nombre": producto.nombre_comercial,
                        "cantidad": cantidad,
                        "motivo": str(exc),
                    }
                )
                continue

            items_agregados.append(
                {
                    "item_id": item.id,
                    "producto_id": producto.id,
                    "producto_nombre": producto.nombre_comercial,
                    "cantidad": cantidad,
                }
            )

        return {
            "carrito_id": carrito.id,
            "items_agregados": items_agregados,
            "items_omitidos": items_omitidos,
        }

    def _resolver_producto_para_carrito(self, item: ItemCapturaReceta):
        producto_relacionado = item.producto
        if producto_relacionado is not None:
            if not producto_relacionado.estado:
                return None, "Producto inactivo."
            if producto_relacionado.requiere_receta:
                return None, "Producto requiere receta y no se puede vender por internet."
            if producto_relacionado.es_controlado:
                return None, "Producto controlado y no se puede vender por internet."
            return producto_relacionado, "Producto vinculado desde la captura."

        consulta = " ".join(
            parte
            for parte in [
                item.nombre_resuelto,
                item.nombre_detectado,
                item.presentacion_detectada,
            ]
            if parte and str(parte).strip()
        ).strip()
        if not consulta:
            return None, "No se detectó un nombre de producto utilizable."

        candidatos = (
            Producto.objects.select_related("inventario")
            .filter(estado=True, requiere_receta=False, es_controlado=False)
            .order_by("nombre_comercial")
        )
        mejor_producto = None
        mejor_puntaje = 0.0

        for producto in candidatos:
            puntaje = self._puntuar_producto(consulta, producto)
            if puntaje > mejor_puntaje:
                mejor_puntaje = puntaje
                mejor_producto = producto

        if mejor_producto is None or mejor_puntaje < 0.62:
            return None, "No se encontró un medicamento del catálogo con confianza suficiente."

        return mejor_producto, f"Coincidencia de catálogo (confianza {mejor_puntaje:.2f})."

    def _sincronizar_items_confirmados(self, captura: CapturaReceta, items_receta: list[dict]) -> None:
        items_existentes = {
            item.id: item
            for item in captura.items.select_related("producto").all()
        }
        items_por_orden = list(captura.items.select_related("producto").order_by("orden", "id"))

        for index, item_payload in enumerate(items_receta):
            if not isinstance(item_payload, dict):
                continue

            item_obj = None
            item_id = item_payload.get("item_id")
            if item_id is not None:
                try:
                    item_obj = items_existentes.get(int(item_id))
                except (TypeError, ValueError):
                    item_obj = None

            if item_obj is None and index < len(items_por_orden):
                item_obj = items_por_orden[index]

            if item_obj is None:
                continue

            producto_texto = str(item_payload.get("producto") or "").strip()
            cantidad_texto = str(item_payload.get("cantidad") or "").strip()
            dosis_texto = str(item_payload.get("dosis_diaria") or "").strip()
            dias_texto = str(item_payload.get("tratamiento_dias") or "").strip()

            producto_match = self._resolver_producto_por_texto(producto_texto) if producto_texto else None
            decision = ItemCapturaReceta.DecisionCliente.EDITADO
            if (
                producto_texto
                and producto_texto == item_obj.nombre_detectado.strip()
                and cantidad_texto == item_obj.cantidad_detectada.strip()
                and dosis_texto == item_obj.indicaciones_detectadas.strip()
                and dias_texto == item_obj.duracion_detectada.strip()
            ):
                decision = ItemCapturaReceta.DecisionCliente.ACEPTADO

            item_obj.nombre_resuelto = producto_texto or item_obj.nombre_detectado
            item_obj.cantidad_detectada = cantidad_texto or item_obj.cantidad_detectada
            item_obj.indicaciones_resueltas = dosis_texto or item_obj.indicaciones_detectadas
            item_obj.duracion_resuelta = dias_texto or item_obj.duracion_detectada
            item_obj.decision_cliente = decision
            item_obj.producto = producto_match
            item_obj.save(
                update_fields=[
                    "nombre_resuelto",
                    "cantidad_detectada",
                    "indicaciones_resueltas",
                    "duracion_resuelta",
                    "decision_cliente",
                    "producto",
                    "updated_at",
                ]
            )

    def _resolver_producto_por_texto(self, texto: str):
        consulta = self._normalizar_texto(texto)
        if not consulta:
            return None

        candidatos = (
            Producto.objects.select_related("inventario")
            .filter(estado=True, requiere_receta=False, es_controlado=False)
            .order_by("nombre_comercial")
        )
        mejor_producto = None
        mejor_puntaje = 0.0

        for producto in candidatos:
            puntaje = self._puntuar_producto(consulta, producto)
            if puntaje > mejor_puntaje:
                mejor_puntaje = puntaje
                mejor_producto = producto

        if mejor_producto is None or mejor_puntaje < 0.62:
            return None
        return mejor_producto

    def _puntuar_producto(self, consulta: str, producto: Producto) -> float:
        consulta_norm = self._normalizar_texto(consulta)
        if not consulta_norm:
            return 0.0

        candidatos = [
            producto.nombre_comercial,
            producto.nombre_generico,
            producto.sku,
            producto.presentacion,
        ]
        mejor = 0.0
        for candidato in candidatos:
            candidato_norm = self._normalizar_texto(candidato)
            if not candidato_norm:
                continue
            ratio = SequenceMatcher(None, consulta_norm, candidato_norm).ratio()
            if candidato_norm in consulta_norm or consulta_norm in candidato_norm:
                ratio = max(ratio, 0.92)
            mejor = max(mejor, ratio)
        return mejor

    def _normalizar_texto(self, texto) -> str:
        valor = str(texto or "").strip().lower()
        valor = re.sub(r"[^a-z0-9áéíóúñü ]+", " ", valor)
        valor = re.sub(r"\s+", " ", valor)
        return valor

    def _parsear_cantidad_para_carrito(self, texto) -> int:
        valor = str(texto or "").strip()
        match = re.search(r"\d+", valor)
        if match:
            return max(1, int(match.group(0)))
        return 1

    def _parsear_unidades_por_presentacion(self, producto: Producto) -> int:
        texto = self._normalizar_texto(producto.presentacion)
        match = re.search(r"\bx\s*(\d+)\b", texto)
        if match:
            return max(1, int(match.group(1)))
        match = re.search(r"\b(\d+)\s*(tabletas?|capsulas?|cápsulas?|unidades?|sobres?|ampollas?|comprimidos?)\b", texto)
        if match:
            return max(1, int(match.group(1)))
        return 1

    def _cantidad_texto_indica_paquete(self, texto: str) -> bool:
        valor = self._normalizar_texto(texto)
        return bool(re.search(r"\b(caja|cajas|frasco|frascos|blister|blisteres|ampolla|ampollas|sobre|sobres|unidad|unidades)\b", valor))

    def _calcular_cantidad_carrito(self, item: ItemCapturaReceta, producto: Producto) -> int:
        cantidad_texto = item.cantidad_detectada
        cantidad_base = self._parsear_cantidad_para_carrito(cantidad_texto)
        unidades_por_presentacion = self._parsear_unidades_por_presentacion(producto)

        if unidades_por_presentacion <= 1:
            return max(1, cantidad_base)

        if self._cantidad_texto_indica_paquete(cantidad_texto):
            return max(1, cantidad_base)

        return max(1, ceil(cantidad_base / unidades_por_presentacion))
