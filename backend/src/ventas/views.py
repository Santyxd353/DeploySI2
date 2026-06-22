from decimal import Decimal, InvalidOperation

import stripe
from django.conf import settings
from django.db import transaction
from django.db.models import Count, Max, Min, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from clientes.models import Cliente
from core.audit import log_system_event
from carrito.models import Carrito

from .serializers import (
    POSVentaInputSerializer, VentaCreateInputSerializer, VentaSerializer,
    VentaClienteSerializer, VentaAdminSerializer
)
from .services import VentaServiceError, crear_venta_service, crear_payment_intent, verificar_payment_intent
from .models import DetalleVenta, Factura, Venta

_ESTADOS_COMPLETADOS = ["pagada", "entregada"]


def _to_decimal_2(value, *, field_name):
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise VentaServiceError(f"{field_name} invalido.", code="monto_invalido") from exc


def _build_checkout_response(venta):
    factura = venta.factura
    return {
        "venta": VentaSerializer(venta).data,
        "factura": {
            "numero": factura.numero_factura,
            "nombre_cliente": factura.nombre_cliente,
            "email_cliente": factura.email_cliente,
            "fecha_emision": factura.fecha_emision,
        },
    }


@transaction.atomic
def _confirmar_pago_desde_carrito(*, usuario, carrito_token, payment_intent_id, datos_factura, total_pagado):
    venta_existente = Venta.objects.filter(stripe_payment_intent_id=payment_intent_id).first()
    if venta_existente:
        return venta_existente, False

    if usuario:
        carrito = Carrito.objects.select_for_update().filter(usuario=usuario, estado="activo").first()
    else:
        carrito = Carrito.objects.select_for_update().filter(invitado_token=carrito_token, estado="activo").first()

    if not carrito:
        raise VentaServiceError("Carrito activo no encontrado.", code="carrito_no_encontrado")

    items = list(carrito.items.select_related("producto").all())
    if not items:
        raise VentaServiceError("El carrito esta vacio.", code="carrito_vacio")

    total_carrito = sum((item.subtotal for item in items), Decimal("0")).quantize(Decimal("0.01"))
    if total_pagado != total_carrito:
        raise VentaServiceError(
            f"Monto pagado no coincide con carrito. pagado={total_pagado} carrito={total_carrito}",
            code="monto_no_coincide",
        )

    nombre_cliente = (datos_factura or {}).get("nombre_cliente", "Cliente")
    email_cliente = (datos_factura or {}).get("email_cliente", "")
    telefono = (datos_factura or {}).get("telefono", "")

    if usuario:
        cliente, _ = Cliente.objects.get_or_create(
            usuario=usuario,
            defaults={
                "nombres": nombre_cliente,
                "apellidos": "",
                "email": email_cliente,
                "telefono": telefono,
                "tipo": "registrado",
                "estado": True,
            },
        )
    else:
        cliente = Cliente.objects.create(
            tipo="invitado",
            nombres=nombre_cliente,
            apellidos="",
            email=email_cliente,
            telefono=telefono,
            estado=True,
        )

    venta_items = [
        {
            "producto_id": item.producto_id,
            "cantidad": item.cantidad,
            "precio_unitario": item.precio_unitario,
        }
        for item in items
    ]

    venta = crear_venta_service(
        cliente=cliente,
        items=venta_items,
        origen="online",
        vendedor=None,
        estado="pagada",
        descuento=0,
        impuesto=0,
        observacion=f"Pago con Stripe - Intent ID: {payment_intent_id}",
        datos_factura=datos_factura,
        stripe_payment_intent_id=payment_intent_id,
    )

    carrito.estado = "confirmado"
    carrito.save(update_fields=["estado", "updated_at"])

    return venta, True


# ========== VENTAS EXISTENTES ==========

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def crear_venta_fisica(request):
    serializer = VentaCreateInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    data = serializer.validated_data
    cliente = get_object_or_404(Cliente, id=data["cliente_id"], estado=True)

    try:
        venta = crear_venta_service(
            cliente=cliente,
            items=data["items"],
            origen="fisica",
            vendedor=request.user,
            estado=data.get("estado", "pendiente"),
            descuento=data.get("descuento", 0),
            impuesto=data.get("impuesto", 0),
            observacion=data.get("observacion", ""),
        )
    except VentaServiceError as exc:
        log_system_event(
            request=request,
            accion="CREATE",
            modulo="ventas",
            resultado="FAILURE",
            mensaje=f"Error en venta fisica: {str(exc)}",
            entidad="Venta",
            entidad_id="",
        )
        return Response({"detail": str(exc), "code": exc.code}, status=status.HTTP_400_BAD_REQUEST)

    log_system_event(
        request=request,
        accion="CREATE",
        modulo="ventas",
        resultado="SUCCESS",
        mensaje=f"Venta fisica creada #{venta.id}",
        entidad="Venta",
        entidad_id=str(venta.id),
    )

    return Response(VentaSerializer(venta).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def crear_venta_online(request):
    serializer = VentaCreateInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    data = serializer.validated_data
    cliente = get_object_or_404(Cliente, id=data["cliente_id"], estado=True)

    try:
        venta = crear_venta_service(
            cliente=cliente,
            items=data["items"],
            origen="online",
            vendedor=None,
            estado=data.get("estado", "pendiente"),
            descuento=data.get("descuento", 0),
            impuesto=data.get("impuesto", 0),
            observacion=data.get("observacion", ""),
        )
    except VentaServiceError as exc:
        log_system_event(
            request=request,
            accion="CREATE",
            modulo="ventas",
            resultado="FAILURE",
            mensaje=f"Error en venta online: {str(exc)}",
            entidad="Venta",
            entidad_id="",
        )
        return Response({"detail": str(exc), "code": exc.code}, status=status.HTTP_400_BAD_REQUEST)

    log_system_event(
        request=request,
        accion="CREATE",
        modulo="ventas",
        resultado="SUCCESS",
        mensaje=f"Venta online creada #{venta.id}",
        entidad="Venta",
        entidad_id=str(venta.id),
        usuario=request.user if getattr(request, "user", None) and request.user.is_authenticated else None,
    )

    return Response(VentaSerializer(venta).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def crear_venta_pos(request):
    from core.rbac import ROLE_CAJERO, obtener_rol_usuario, tiene_permiso

    tenant = getattr(request, "tenant", None)
    current_role = obtener_rol_usuario(request.user, tenant=tenant)
    if not (tiene_permiso(request.user, "ventas.gestionar", tenant=tenant) or current_role == ROLE_CAJERO or request.user.is_superuser):
        return Response({"detail": "No tienes permiso para realizar ventas POS."}, status=status.HTTP_403_FORBIDDEN)

    serializer = POSVentaInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    data = serializer.validated_data
    cliente_id = data.get("cliente_id")
    cliente_data = data.get("cliente_data")

    if cliente_id:
        cliente = get_object_or_404(Cliente, id=cliente_id, estado=True)
    else:
        cliente = Cliente.objects.create(
            tipo="invitado",
            nombres=cliente_data.get("nombres", "Cliente"),
            apellidos=cliente_data.get("apellidos", "Mostrador"),
            email=cliente_data.get("email", ""),
            telefono=cliente_data.get("telefono", ""),
            ci_nit=cliente_data.get("ci_nit", ""),
            estado=True,
        )

    try:
        venta = crear_venta_service(
            cliente=cliente,
            items=data["items"],
            origen="fisica",
            vendedor=request.user,
            estado=data.get("estado", "pagada"),
            descuento=data.get("descuento", 0),
            impuesto=data.get("impuesto", 0),
            observacion=data.get("observacion", ""),
        )
    except VentaServiceError as exc:
        log_system_event(
            request=request,
            accion="CREATE",
            modulo="ventas",
            resultado="FAILURE",
            mensaje=f"Error en venta POS: {str(exc)}",
            entidad="Venta",
            entidad_id="",
        )
        return Response({"detail": str(exc), "code": exc.code}, status=status.HTTP_400_BAD_REQUEST)

    log_system_event(
        request=request,
        accion="CREATE",
        modulo="ventas",
        resultado="SUCCESS",
        mensaje=f"Venta POS creada #{venta.id}",
        entidad="Venta",
        entidad_id=str(venta.id),
    )

    return Response(VentaSerializer(venta).data, status=status.HTTP_201_CREATED)


# ========== NUEVAS VISTAS DE STRIPE Y FACTURACIÓN ==========

@api_view(['POST'])
@permission_classes([AllowAny])
def crear_intent_pago(request):
    """
    POST /api/ventas/intent-pago/
    Body: { "total": 150.50 }
    """
    total = request.data.get('total')
    metadata_raw = request.data.get('metadata') if isinstance(request.data, dict) else None
    
    if not total:
        return Response(
            {'detail': 'El campo "total" es requerido.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        total_decimal = Decimal(str(total))
    except:
        return Response(
            {'detail': 'Total inválido.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if total_decimal <= 0:
        return Response(
            {'detail': 'El total debe ser mayor a 0.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    metadata = {}
    if isinstance(metadata_raw, dict):
        for key, value in metadata_raw.items():
            if key is None:
                continue
            key_str = str(key).strip()[:40]
            if not key_str:
                continue
            metadata[key_str] = str(value).strip()[:500]

    if getattr(request, 'user', None) and request.user.is_authenticated:
        metadata.setdefault('user_id', str(request.user.id))

    try:
        intent_data = crear_payment_intent(total_decimal, metadata=metadata)
        return Response(intent_data, status=status.HTTP_200_OK)
    except Exception as e:
        log_system_event(
            request=request,
            accion='CREAR_INTENT_PAGO',
            modulo='ventas',
            resultado='FAILURE',
            mensaje=f'Error Stripe: {str(e)}'
        )
        return Response(
            {'detail': f'Error al crear el intent de pago: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def confirmar_pago_venta(request):
    """
    POST /api/ventas/confirmar-pago/
    Body: {
        "payment_intent_id": "pi_xxxxxxxx",
        "carrito_token": "token_del_carrito",
        "datos_factura": {
            "nombre_cliente": "Juan Perez",
            "email_cliente": "juan@email.com"
        }
    }
    """
    payment_intent_id = request.data.get('payment_intent_id')
    carrito_token = request.data.get('carrito_token', '')
    datos_factura = request.data.get('datos_factura', {})

    if not payment_intent_id:
        return Response(
            {'detail': 'payment_intent_id es requerido.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        intent_info = verificar_payment_intent(payment_intent_id)
    except Exception as e:
        log_system_event(
            request=request,
            accion='CONFIRMAR_PAGO',
            modulo='ventas',
            resultado='FAILURE',
            mensaje=f'Error al verificar pago Stripe: {str(e)}'
        )
        return Response(
            {'detail': f'Error al verificar el pago: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if intent_info['status'] != 'succeeded':
        return Response(
            {'detail': f'El pago no fue exitoso. Estado: {intent_info["status"]}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    usuario = request.user if request.user.is_authenticated else None
    if not usuario and not carrito_token:
        return Response(
            {'detail': 'carrito_token requerido para usuarios invitados.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        total_pagado = _to_decimal_2(intent_info['amount'], field_name='Monto pagado')
        venta, created = _confirmar_pago_desde_carrito(
            usuario=usuario,
            carrito_token=carrito_token,
            payment_intent_id=payment_intent_id,
            datos_factura=datos_factura if isinstance(datos_factura, dict) else {},
            total_pagado=total_pagado,
        )
    except VentaServiceError as exc:
        log_system_event(
            request=request,
            accion='CONFIRMAR_PAGO',
            modulo='ventas',
            resultado='FAILURE',
            mensaje=f'Error confirmar pago: {str(exc)}'
        )
        return Response(
            {'detail': str(exc), 'code': exc.code},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as exc:
        log_system_event(
            request=request,
            accion='CONFIRMAR_PAGO',
            modulo='ventas',
            resultado='FAILURE',
            mensaje=f'Error inesperado confirmar pago: {str(exc)}'
        )
        return Response(
            {'detail': f'Error al crear la venta: {str(exc)}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    log_system_event(
        request=request,
        accion='CONFIRMAR_PAGO',
        modulo='ventas',
        resultado='SUCCESS',
        mensaje=f'Venta #{venta.id} pagada con Stripe. Factura: {venta.factura.numero_factura}',
        entidad='Venta',
        entidad_id=str(venta.id),
    )

    return Response(
        _build_checkout_response(venta),
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def obtener_factura(request, numero_factura):
    """
    GET /api/ventas/factura/{numero}/
    """
    try:
        factura = Factura.objects.select_related('venta__cliente').get(numero_factura=numero_factura)
    except Factura.DoesNotExist:
        return Response(
            {'detail': 'Factura no encontrada.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Serializar manualmente (o usar serializer si lo prefieres)
    data = {
        'id': factura.id,
        'numero_factura': factura.numero_factura,
        'tipo': factura.tipo,
        'nombre_cliente': factura.nombre_cliente,
        'email_cliente': factura.email_cliente,
        'nit_ci': factura.nit_ci,
        'fecha_emision': factura.fecha_emision,
        'venta': {
            'id': factura.venta.id,
            'total': str(factura.venta.total),
            'fecha': factura.venta.created_at,
        },
        'items': [
            {
                'producto': d.producto.nombre_comercial,
                'cantidad': d.cantidad,
                'precio_unitario': str(d.precio_unitario),
                'subtotal': str(d.subtotal)
            }
            for d in factura.venta.detalles.all()
        ]
    }
    
    return Response(data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def listar_mis_facturas(request):
    cliente = Cliente.objects.filter(usuario=request.user, estado=True).first()
    if not cliente:
        return Response({'results': []}, status=status.HTTP_200_OK)

    facturas = (
        Factura.objects
        .select_related('venta')
        .filter(venta__cliente=cliente)
        .order_by('-fecha_emision')
    )

    data = [
        {
            'id': factura.id,
            'numero_factura': factura.numero_factura,
            'total': str(factura.venta.total),
            'estado': factura.venta.estado,
            'fecha_emision': factura.fecha_emision,
        }
        for factura in facturas
    ]
    return Response({'results': data}, status=status.HTTP_200_OK)


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    webhook_secret = settings.STRIPE_WEBHOOK_SECRET

    if not webhook_secret:
        return Response({'detail': 'Webhook secret no configurado.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError:
        return Response({'detail': 'Payload invalido.'}, status=status.HTTP_400_BAD_REQUEST)
    except stripe.error.SignatureVerificationError:
        return Response({'detail': 'Firma webhook invalida.'}, status=status.HTTP_400_BAD_REQUEST)

    if event.get('type') != 'payment_intent.succeeded':
        return Response({'ok': True, 'ignored': event.get('type')}, status=status.HTTP_200_OK)

    payment_intent = event['data']['object']
    payment_intent_id = payment_intent.get('id')
    metadata = payment_intent.get('metadata') or {}
    carrito_token = metadata.get('carrito_token', '')
    total_pagado = _to_decimal_2(Decimal(payment_intent.get('amount_received', 0)) / Decimal('100'), field_name='Monto pagado')

    if not payment_intent_id:
        return Response({'detail': 'Evento sin payment_intent id.'}, status=status.HTTP_400_BAD_REQUEST)

    usuario = None
    user_id = metadata.get('user_id')
    if user_id:
        try:
            from django.contrib.auth import get_user_model
            usuario = get_user_model().objects.filter(id=int(user_id)).first()
        except Exception:
            usuario = None

    if not usuario and not carrito_token:
        return Response({'ok': True, 'ignored': 'sin contexto de carrito'}, status=status.HTTP_200_OK)

    try:
        venta, created = _confirmar_pago_desde_carrito(
            usuario=usuario,
            carrito_token=carrito_token,
            payment_intent_id=payment_intent_id,
            datos_factura={
                'nombre_cliente': metadata.get('nombre_cliente', 'Cliente'),
                'email_cliente': metadata.get('email_cliente', ''),
                'telefono': metadata.get('telefono', ''),
                'nit_ci': metadata.get('nit_ci', ''),
            },
            total_pagado=total_pagado,
        )
    except VentaServiceError as exc:
        log_system_event(
            request=None,
            accion='STRIPE_WEBHOOK',
            modulo='ventas',
            resultado='FAILURE',
            mensaje=f'Webhook Stripe no pudo confirmar pago {payment_intent_id}: {exc}',
        )
        return Response({'detail': str(exc), 'code': exc.code}, status=status.HTTP_400_BAD_REQUEST)

    log_system_event(
        request=None,
        accion='STRIPE_WEBHOOK',
        modulo='ventas',
        resultado='SUCCESS',
        mensaje=f'Webhook Stripe confirmo venta #{venta.id} ({"created" if created else "idempotent"})',
        entidad='Venta',
        entidad_id=str(venta.id),
        usuario=usuario,
    )
    return Response({'ok': True, 'venta_id': venta.id, 'created': created}, status=status.HTTP_200_OK)


# ========== HU-18: HISTORIAL DE VENTAS ==========

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_historial_ventas(request):
    """
    GET /api/ventas/historial/
    Query params:
      - cliente_id  (solo admin/farmacéutico/cajero)
      - page        (default 1)
      - page_size   (default 10, max 50)
      - estado      (pendiente|pagada|preparando|entregada|cancelada)
      - fecha_desde (YYYY-MM-DD)
      - fecha_hasta (YYYY-MM-DD)

    RBAC:
      - ventas.ver → puede filtrar por cualquier cliente_id
      - ROLE_CLIENTE → solo sus propias ventas (ignora cliente_id)
    """
    from core.rbac import tiene_permiso

    tenant = getattr(request, "tenant", None)
    can_see_all = tiene_permiso(request.user, "ventas.ver", tenant=tenant)

    if can_see_all:
        cliente_id = request.query_params.get("cliente_id")
        ventas_qs = Venta.objects.filter(cliente_id=cliente_id) if cliente_id else Venta.objects.all()
    else:
        cliente = Cliente.objects.filter(usuario=request.user, estado=True).first()
        if not cliente:
            return Response({
                "count": 0, "page": 1, "page_size": 10,
                "next": None, "previous": None, "results": [],
                "resumen": {
                    "total_gastado": 0, "num_compras": 0,
                    "promedio_por_compra": 0, "ultima_compra": None,
                },
                "productos_frecuentes": [],
            })
        ventas_qs = Venta.objects.filter(cliente=cliente)

    # Filtros opcionales
    estado = request.query_params.get("estado")
    if estado:
        ventas_qs = ventas_qs.filter(estado=estado)

    fecha_desde = request.query_params.get("fecha_desde")
    if fecha_desde:
        ventas_qs = ventas_qs.filter(created_at__date__gte=fecha_desde)

    fecha_hasta = request.query_params.get("fecha_hasta")
    if fecha_hasta:
        ventas_qs = ventas_qs.filter(created_at__date__lte=fecha_hasta)

    # Resumen de ventas completadas (sobre el queryset filtrado, antes de paginar)
    agg = ventas_qs.filter(estado__in=_ESTADOS_COMPLETADOS).aggregate(
        total_gastado=Sum("total"),
        num_compras=Count("id"),
        ultima_compra=Max("created_at"),
    )
    total_gastado = float(agg["total_gastado"] or 0)
    num_compras = agg["num_compras"] or 0
    resumen = {
        "total_gastado": total_gastado,
        "num_compras": num_compras,
        "promedio_por_compra": round(total_gastado / num_compras, 2) if num_compras > 0 else 0,
        "ultima_compra": agg["ultima_compra"],
    }

    # Productos frecuentes (top 5)
    productos_frecuentes_qs = DetalleVenta.objects.filter(
        venta__in=ventas_qs.filter(estado__in=_ESTADOS_COMPLETADOS),
    ).values("producto__nombre_comercial").annotate(
        veces_comprado=Count("id"),
        cantidad_total=Sum("cantidad"),
    ).order_by("-veces_comprado")[:5]

    productos_frecuentes = [
        {
            "nombre": p["producto__nombre_comercial"],
            "veces_comprado": p["veces_comprado"],
            "cantidad_total": p["cantidad_total"],
        }
        for p in productos_frecuentes_qs
    ]

    # Paginación
    try:
        page = max(1, int(request.query_params.get("page", 1)))
        page_size = min(max(1, int(request.query_params.get("page_size", 10))), 50)
    except (ValueError, TypeError):
        page, page_size = 1, 10

    ventas_qs = (
        ventas_qs
        .select_related("factura", "cliente")
        .prefetch_related("detalles__producto")
        .order_by("-created_at")
    )
    total = ventas_qs.count()
    start = (page - 1) * page_size
    end = start + page_size
    ventas_page = ventas_qs[start:end]

    results = []
    for v in ventas_page:
        factura_numero = None
        try:
            factura_numero = v.factura.numero_factura
        except Exception:
            pass

        entry = {
            "id": v.id,
            "created_at": v.created_at,
            "total": float(v.total),
            "subtotal": float(v.subtotal),
            "descuento": float(v.descuento),
            "impuesto": float(v.impuesto),
            "origen": v.origen,
            "estado": v.estado,
            "numero_factura": factura_numero,
            "detalles": [
                {
                    "producto_nombre": d.producto.nombre_comercial,
                    "cantidad": d.cantidad,
                    "precio_unitario": float(d.precio_unitario),
                    "subtotal": float(d.subtotal),
                }
                for d in v.detalles.all()
            ],
        }
        if can_see_all:
            entry["cliente"] = {
                "id": v.cliente_id,
                "nombre": f"{v.cliente.nombres} {v.cliente.apellidos}".strip(),
            }
        results.append(entry)

    return Response({
        "count": total,
        "page": page,
        "page_size": page_size,
        "next": page + 1 if end < total else None,
        "previous": page - 1 if page > 1 else None,
        "results": results,
        "resumen": resumen,
        "productos_frecuentes": productos_frecuentes,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def obtener_estadisticas_cliente(request):
    """
    GET /api/ventas/historial/estadisticas/
    
    HU-18: Estadísticas personales del cliente autenticado.
    
    Devuelve:
    {
        "total_gastado": float,
        "total_compras": int,
        "ticket_promedio": float,
        "ultima_compra": object,
        "compras_este_mes": int,
        "estado_pagada_count": int,
        "estado_pendiente_count": int,
    }
    """
    usuario = request.user
    
    try:
        cliente = usuario.cliente
    except:
        return Response(
            {"detail": "Usuario no tiene cliente asociado"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Solo ventas completadas (pagadas o entregadas)
    qs_completadas = Venta.objects.filter(
        tenant=request.tenant,
        cliente=cliente,
        estado__in=['pagada', 'entregada']
    )
    
    # Agregados de ventas completadas
    agg = qs_completadas.aggregate(
        total=Sum('total'),
        cantidad=Count('id')
    )
    
    total_gastado = float(agg['total'] or 0)
    total_compras = agg['cantidad'] or 0
    
    # Ticket promedio
    ticket_promedio = 0
    if total_compras > 0:
        ticket_promedio = round(total_gastado / total_compras, 2)
    
    # Última compra
    ultima_compra = qs_completadas.order_by('-created_at').first()
    ultima_compra_data = None
    if ultima_compra:
        ultima_compra_data = VentaClienteSerializer(ultima_compra).data
    
    # Compras este mes
    from django.utils import timezone
    hoy = timezone.now()
    primer_dia_mes = hoy.replace(day=1)
    compras_este_mes = qs_completadas.filter(
        created_at__gte=primer_dia_mes
    ).count()
    
    # Contar por estado
    qs_todas = Venta.objects.filter(
        tenant=request.tenant,
        cliente=cliente
    )
    estado_pagada_count = qs_todas.filter(estado='pagada').count()
    estado_pendiente_count = qs_todas.filter(estado='pendiente').count()
    estado_entregada_count = qs_todas.filter(estado='entregada').count()
    estado_cancelada_count = qs_todas.filter(estado='cancelada').count()
    
    stats = {
        "total_gastado": total_gastado,
        "total_compras": total_compras,
        "ticket_promedio": ticket_promedio,
        "ultima_compra": ultima_compra_data,
        "compras_este_mes": compras_este_mes,
        "estado_pagada_count": estado_pagada_count,
        "estado_pendiente_count": estado_pendiente_count,
        "estado_entregada_count": estado_entregada_count,
        "estado_cancelada_count": estado_cancelada_count,
    }

    return Response(stats)


# ========== HU-36: DASHBOARD ADMIN DE VENTAS ==========

def _require_ventas_ver(request):
    from core.rbac import tiene_permiso

    tenant = getattr(request, "tenant", None)
    if request.user.is_superuser:
        return None
    if not tiene_permiso(request.user, "ventas.ver", tenant=tenant):
        return Response({"detail": "No tienes permiso para ver ventas."}, status=status.HTTP_403_FORBIDDEN)
    return None


def _periodo_resumen(qs):
    agg = qs.filter(estado__in=_ESTADOS_COMPLETADOS).aggregate(total=Sum("total"), ventas=Count("id"))
    total = float(agg["total"] or 0)
    ventas = agg["ventas"] or 0
    return {
        "ventas": ventas,
        "total": total,
        "promedio": round(total / ventas, 2) if ventas else 0,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_ventas_dashboard(request):
    """
    GET /api/admin/ventas/dashboard/

    RBAC: requiere permiso "ventas.ver" (o superusuario).

    Devuelve KPIs de ventas: totales por periodo (hoy/semana/mes/anio),
    ticket promedio general, top vendedores, top productos,
    ventas por estado y ventas por origen.
    """
    denied = _require_ventas_ver(request)
    if denied is not None:
        return denied

    base_qs = Venta.objects.all()

    ahora = timezone.now()
    inicio_hoy = ahora.replace(hour=0, minute=0, second=0, microsecond=0)
    inicio_semana = ahora - timezone.timedelta(days=7)
    inicio_mes = ahora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    inicio_anio = ahora.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

    hoy = _periodo_resumen(base_qs.filter(created_at__gte=inicio_hoy))
    semana = _periodo_resumen(base_qs.filter(created_at__gte=inicio_semana))
    mes = _periodo_resumen(base_qs.filter(created_at__gte=inicio_mes))
    anio = _periodo_resumen(base_qs.filter(created_at__gte=inicio_anio))

    completadas_qs = base_qs.filter(estado__in=_ESTADOS_COMPLETADOS)
    agg_general = completadas_qs.aggregate(total=Sum("total"), ventas=Count("id"))
    total_general = float(agg_general["total"] or 0)
    ventas_general = agg_general["ventas"] or 0
    ticket_promedio = round(total_general / ventas_general, 2) if ventas_general else 0

    top_vendedores_qs = (
        completadas_qs
        .filter(vendedor__isnull=False)
        .values("vendedor_id", "vendedor__first_name", "vendedor__last_name", "vendedor__email")
        .annotate(ventas=Count("id"), total=Sum("total"))
        .order_by("-total")[:5]
    )
    top_vendedores = [
        {
            "nombre": (f"{v['vendedor__first_name']} {v['vendedor__last_name']}".strip() or v["vendedor__email"]),
            "ventas": v["ventas"],
            "total": float(v["total"] or 0),
        }
        for v in top_vendedores_qs
    ]

    top_productos_qs = (
        DetalleVenta.objects.filter(venta__in=completadas_qs)
        .values("producto__nombre_comercial")
        .annotate(cantidad=Sum("cantidad"), total=Sum("subtotal"))
        .order_by("-cantidad")[:5]
    )
    top_productos = [
        {
            "nombre": p["producto__nombre_comercial"],
            "cantidad": p["cantidad"] or 0,
            "total": float(p["total"] or 0),
        }
        for p in top_productos_qs
    ]

    ventas_por_estado_qs = base_qs.values("estado").annotate(total=Count("id"))
    ventas_por_estado = {estado: 0 for estado, _ in Venta.ESTADO_CHOICES}
    for row in ventas_por_estado_qs:
        ventas_por_estado[row["estado"]] = row["total"]

    ventas_por_origen_qs = base_qs.values("origen").annotate(total=Count("id"))
    ventas_por_origen = {origen: 0 for origen, _ in Venta.ORIGEN_CHOICES}
    for row in ventas_por_origen_qs:
        ventas_por_origen[row["origen"]] = row["total"]

    return Response({
        "hoy": hoy,
        "semana": semana,
        "mes": mes,
        "anio": anio,
        "ticket_promedio": ticket_promedio,
        "top_vendedores": top_vendedores,
        "top_productos": top_productos,
        "ventas_por_estado": ventas_por_estado,
        "ventas_por_origen": ventas_por_origen,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_ventas_lista(request):
    """
    GET /api/admin/ventas/lista/
    Query params:
      - page        (default 1)
      - page_size   (default 20, max 100)
      - search      (busca por id de venta o nombre del cliente)
      - estado      (pendiente|pagada|preparando|entregada|cancelada)
      - origen      (fisica|online)
      - fecha_desde (YYYY-MM-DD)
      - fecha_hasta (YYYY-MM-DD)

    RBAC: requiere permiso "ventas.ver" (o superusuario).
    """
    denied = _require_ventas_ver(request)
    if denied is not None:
        return denied

    ventas_qs = Venta.objects.all()

    search = request.query_params.get("search", "").strip()
    if search:
        filtro = Q(cliente__nombres__icontains=search) | Q(cliente__apellidos__icontains=search)
        if search.isdigit():
            filtro |= Q(id=int(search))
        ventas_qs = ventas_qs.filter(filtro)

    estado = request.query_params.get("estado")
    if estado:
        ventas_qs = ventas_qs.filter(estado=estado)

    origen = request.query_params.get("origen")
    if origen:
        ventas_qs = ventas_qs.filter(origen=origen)

    fecha_desde = request.query_params.get("fecha_desde")
    if fecha_desde:
        ventas_qs = ventas_qs.filter(created_at__date__gte=fecha_desde)

    fecha_hasta = request.query_params.get("fecha_hasta")
    if fecha_hasta:
        ventas_qs = ventas_qs.filter(created_at__date__lte=fecha_hasta)

    try:
        page = max(1, int(request.query_params.get("page", 1)))
        page_size = min(max(1, int(request.query_params.get("page_size", 20))), 100)
    except (ValueError, TypeError):
        page, page_size = 1, 20

    ventas_qs = ventas_qs.select_related("cliente", "vendedor").order_by("-created_at")
    total = ventas_qs.count()
    start = (page - 1) * page_size
    end = start + page_size
    ventas_page = ventas_qs[start:end]

    estado_labels = dict(Venta.ESTADO_CHOICES)
    results = [
        {
            "id": v.id,
            "cliente_nombre": f"{v.cliente.nombres} {v.cliente.apellidos}".strip() if v.cliente_id else "-",
            "vendedor_nombre": (
                f"{v.vendedor.first_name} {v.vendedor.last_name}".strip() or v.vendedor.email
                if v.vendedor_id
                else "-"
            ),
            "origen": v.origen,
            "estado": v.estado,
            "estado_label": estado_labels.get(v.estado, v.estado),
            "total": float(v.total),
            "created_at": v.created_at,
        }
        for v in ventas_page
    ]

    return Response({
        "count": total,
        "page": page,
        "page_size": page_size,
        "next": page + 1 if end < total else None,
        "previous": page - 1 if page > 1 else None,
        "results": results,
    })