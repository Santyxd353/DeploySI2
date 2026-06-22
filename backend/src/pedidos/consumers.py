import logging
from decimal import Decimal, InvalidOperation
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

logger = logging.getLogger(__name__)


# ── Query-string helpers ──────────────────────────────────────────────────────

def _token_from_scope(scope):
    params = parse_qs(scope.get("query_string", b"").decode())
    values = params.get("token", [])
    return values[0] if values else None


def _subdomain_from_scope(scope):
    params = parse_qs(scope.get("query_string", b"").decode())
    values = params.get("subdomain", [])
    return values[0] if values else None


# ── Async DB helpers ──────────────────────────────────────────────────────────

@database_sync_to_async
def _autenticar_token(token_str):
    from django.contrib.auth import get_user_model
    from rest_framework_simplejwt.tokens import AccessToken

    if not token_str:
        return None
    try:
        access_token = AccessToken(token_str)
        User = get_user_model()
        return User.objects.get(id=access_token["user_id"])
    except Exception:
        return None


@database_sync_to_async
def _schema_de_subdomain(subdomain):
    """Devuelve schema_name del tenant activo, o None. Tenant está en schema public."""
    if not subdomain:
        return None
    try:
        from tenants.models import Tenant
        tenant = Tenant.objects.get(subdomain=subdomain, status="activo")
        return tenant.schema_name
    except Exception:
        return None


# ── Consumer: cliente / repartidor / admin ─────────────────────────────────────

class OrderTrackingConsumer(AsyncJsonWebsocketConsumer):
    """
    Recibe actualizaciones en tiempo real de estado y posición del repartidor.
    URL: /ws/pedidos/<pedido_id>/tracking/?token=<jwt>&subdomain=<subdomain>

    Nota: usamos all_objects (sin filtro tenant) junto con schema_context para
    que las queries corran en el schema correcto en el contexto ASGI donde
    connection.tenant no está configurado por middleware.
    """

    async def connect(self):
        self.pedido_id = self.scope["url_route"]["kwargs"]["pedido_id"]
        self.group_name = f"pedido_{self.pedido_id}"

        token_str = _token_from_scope(self.scope)
        subdomain = _subdomain_from_scope(self.scope)

        user = await _autenticar_token(token_str)
        if user is None:
            await self.close(code=4001)
            return

        self.schema_name = await _schema_de_subdomain(subdomain)
        if not self.schema_name:
            await self.close(code=4003)
            return

        tiene_acceso = await self._verificar_acceso(user)
        if not tiene_acceso:
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        estado_actual = await self._estado_actual()
        await self.send_json({"tipo": "estado_inicial", **estado_actual})

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content):
        pass

    async def pedido_update(self, event):
        await self.send_json(event["data"])

    async def pedido_nuevo(self, event):
        await self.send_json(event["data"])

    @database_sync_to_async
    def _verificar_acceso(self, user):
        from django_tenants.utils import schema_context
        from .models import Pedido

        with schema_context(self.schema_name):
            try:
                pedido = Pedido.all_objects.select_related(
                    "venta__cliente"
                ).get(id=self.pedido_id)
            except Pedido.DoesNotExist:
                return False

            # Staff Django
            if user.is_staff or user.is_superuser:
                return True

            # Admin / farmacéutico del tenant
            try:
                from tenants.models import TenantUser, Tenant
                tenant = Tenant.objects.get(schema_name=self.schema_name)
                if TenantUser.objects.filter(
                    tenant=tenant,
                    user=user,
                    role__in=["admin", "farmaceutico", "cajero"],
                    is_active=True,
                ).exists():
                    return True
            except Exception:
                pass

            # Cliente dueño del pedido
            try:
                from clientes.models import Cliente
                cliente = Cliente.all_objects.filter(usuario=user).first()
                if cliente and pedido.venta.cliente_id == cliente.id:
                    return True
            except Exception:
                pass

            # Repartidor asignado
            if pedido.repartidor_id == user.id:
                return True

        return False

    @database_sync_to_async
    def _estado_actual(self):
        from django_tenants.utils import schema_context
        from .models import Pedido

        with schema_context(self.schema_name):
            try:
                pedido = Pedido.all_objects.select_related(
                    "venta__cliente", "repartidor"
                ).get(id=self.pedido_id)
                return {
                    "estado": pedido.estado,
                    "pedido_id": pedido.id,
                    "lat_repartidor": (
                        str(pedido.lat_repartidor) if pedido.lat_repartidor else None
                    ),
                    "lon_repartidor": (
                        str(pedido.lon_repartidor) if pedido.lon_repartidor else None
                    ),
                    "repartidor_nombre": (
                        pedido.repartidor.get_full_name() or pedido.repartidor.username
                        if pedido.repartidor
                        else None
                    ),
                }
            except Pedido.DoesNotExist:
                return {}


# ── Consumer: repartidor envía GPS ───────────────────────────────────────────

class RepartidorLocationConsumer(AsyncJsonWebsocketConsumer):
    """
    Repartidor envía su posición GPS en tiempo real.
    URL: /ws/pedidos/<pedido_id>/ubicacion/?token=<jwt>&subdomain=<subdomain>
    """

    async def connect(self):
        self.pedido_id = self.scope["url_route"]["kwargs"]["pedido_id"]
        self.group_name = f"pedido_{self.pedido_id}"

        token_str = _token_from_scope(self.scope)
        subdomain = _subdomain_from_scope(self.scope)

        user = await _autenticar_token(token_str)
        if user is None:
            await self.close(code=4001)
            return

        self.schema_name = await _schema_de_subdomain(subdomain)
        if not self.schema_name:
            await self.close(code=4003)
            return

        es_asignado = await self._verificar_asignacion(user)
        if not es_asignado:
            await self.close(code=4003)
            return

        self.repartidor_id = user.id
        await self.accept()

    async def disconnect(self, code):
        pass

    async def receive_json(self, content):
        lat = content.get("lat")
        lon = content.get("lon")
        if lat is None or lon is None:
            return

        try:
            lat_d = Decimal(str(lat))
            lon_d = Decimal(str(lon))
        except (InvalidOperation, ValueError):
            return

        await self._actualizar_ubicacion(lat_d, lon_d)

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "pedido.update",
                "data": {
                    "tipo": "ubicacion_repartidor",
                    "lat": str(lat_d),
                    "lon": str(lon_d),
                    "pedido_id": int(self.pedido_id),
                },
            },
        )

    async def pedido_update(self, event):
        pass

    async def pedido_nuevo(self, event):
        pass

    @database_sync_to_async
    def _verificar_asignacion(self, user):
        from django_tenants.utils import schema_context
        from .models import Pedido

        with schema_context(self.schema_name):
            try:
                pedido = Pedido.all_objects.get(id=self.pedido_id)
                return pedido.repartidor_id == user.id
            except Pedido.DoesNotExist:
                return False

    @database_sync_to_async
    def _actualizar_ubicacion(self, lat, lon):
        from django_tenants.utils import schema_context
        from .models import Pedido

        with schema_context(self.schema_name):
            Pedido.all_objects.filter(id=self.pedido_id).update(
                lat_repartidor=lat,
                lon_repartidor=lon,
            )


# ── Consumer: admin dashboard ─────────────────────────────────────────────────

class AdminPedidosConsumer(AsyncJsonWebsocketConsumer):
    """
    Admin recibe nuevos pedidos y cambios de estado en tiempo real.
    URL: /ws/pedidos/admin/?token=<jwt>&subdomain=<subdomain>
    """

    async def connect(self):
        token_str = _token_from_scope(self.scope)
        subdomain = _subdomain_from_scope(self.scope)

        user = await _autenticar_token(token_str)
        if user is None:
            await self.close(code=4001)
            return

        tenant = await self._obtener_tenant(subdomain)
        if tenant is None:
            await self.close(code=4003)
            return

        tiene_acceso = await self._verificar_rol_admin(user, tenant)
        if not tiene_acceso:
            await self.close(code=4001)
            return

        self.group_name = f"admin_pedidos_{tenant.schema_name}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content):
        pass

    async def pedido_nuevo(self, event):
        await self.send_json(event["data"])

    async def pedido_update(self, event):
        await self.send_json(event["data"])

    @database_sync_to_async
    def _obtener_tenant(self, subdomain):
        if not subdomain:
            return None
        try:
            from tenants.models import Tenant
            return Tenant.objects.get(subdomain=subdomain, status="activo")
        except Exception:
            return None

    @database_sync_to_async
    def _verificar_rol_admin(self, user, tenant):
        try:
            from tenants.models import TenantUser
            return TenantUser.objects.filter(
                tenant=tenant,
                user=user,
                role__in=["admin", "farmaceutico"],
                is_active=True,
            ).exists()
        except Exception:
            return user.is_staff or user.is_superuser
