import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django_tenants.utils import schema_context

from inventarios.models import EntradaStock, Inventario, LoteProducto, Producto
from inventarios.services.stock_service import aumentar_stock, descontar_stock
from tenants.context import clear_current_tenant, set_current_tenant
from tenants.models import Tenant

User = get_user_model()


class Command(BaseCommand):
    help = "Genera entradas de stock demo para cubrir estados de inventario (stock bajo, lotes por vencer, vencidos, bloqueados)."

    def add_arguments(self, parser):
        parser.add_argument("--schema", type=str, help="Schema del tenant (ej: farmacia1)")
        parser.add_argument("--all-tenants", action="store_true", help="Ejecuta en todos los tenants activos.")
        parser.add_argument("--total", type=int, default=30, help="Total de entradas a generar (default: 30).")

    def _resolve_tenants(self, schema_name=None, all_tenants=False):
        if schema_name and all_tenants:
            raise ValueError("No uses --schema y --all-tenants al mismo tiempo.")

        if schema_name:
            tenant = Tenant.objects.filter(schema_name=schema_name).first()
            if tenant is None:
                raise ValueError(f"No existe tenant con schema '{schema_name}'.")
            return [tenant]

        if all_tenants:
            return list(Tenant.objects.filter(status="activo").exclude(schema_name="public").order_by("id"))

        raise ValueError("Debes indicar --schema o --all-tenants para ejecutar este seed.")

    def _get_seed_user(self):
        user = User.objects.filter(is_superuser=True).order_by("id").first()
        if user:
            return user
        user = User.objects.filter(is_staff=True).order_by("id").first()
        if user:
            return user
        return User.objects.order_by("id").first()

    @transaction.atomic
    def _crear_entrada(self, *, producto, user, numero_lote, cantidad, dias_vencimiento, lote_estado, entrada_estado):
        today = timezone.localdate()
        fecha_fabricacion = today - timedelta(days=240)
        fecha_vencimiento = today + timedelta(days=dias_vencimiento)

        lote = LoteProducto.objects.create(
            producto=producto,
            numero_lote=numero_lote,
            fecha_fabricacion=fecha_fabricacion,
            fecha_vencimiento=fecha_vencimiento,
            cantidad_inicial=cantidad,
            cantidad_disponible=0,
            precio_compra=producto.precio_compra,
            proveedor="Proveedor Seed Inventario",
            estado="disponible",
        )

        motivo_entrada = random.choice(["reposicion", "devolucion", "ajuste", "correccion", "otro"])
        motivo_movimiento = {
            "reposicion": "compra",
            "devolucion": "devolucion_cliente",
            "ajuste": "ajuste_fisico",
            "correccion": "ajuste_fisico",
            "otro": "transferencia",
        }[motivo_entrada]

        entrada = EntradaStock.objects.create(
            producto=producto,
            lote=lote,
            cantidad=cantidad,
            motivo=motivo_entrada,
            referencia=f"SEED-ENT-{timezone.now().strftime('%Y%m%d%H%M%S%f')}",
            descripcion=f"Entrada seed para estados de inventario ({entrada_estado}).",
            estado=entrada_estado,
            usuario=user,
        )

        if entrada_estado == "confirmada":
            aumentar_stock(
                producto=producto,
                cantidad=cantidad,
                motivo=motivo_movimiento,
                referencia=entrada.referencia,
                usuario=user,
                observacion=entrada.descripcion or "",
                lote=lote,
            )
            lote.cantidad_disponible = cantidad
            lote.cantidad_inicial = cantidad
            lote.estado = lote_estado
            lote.save(update_fields=["cantidad_disponible", "cantidad_inicial", "estado", "updated_at"])
        else:
            lote.estado = "disponible"
            lote.save(update_fields=["estado", "updated_at"])

        return entrada

    def _seed_for_current_schema(self, total):
        productos = list(Producto.objects.filter(estado=True).order_by("id"))
        if not productos:
            self.stdout.write(self.style.ERROR("No hay productos activos. Ejecuta primero seed_productos."))
            return

        user = self._get_seed_user()
        if user is None:
            self.stdout.write(self.style.ERROR("No hay usuarios para asociar las entradas."))
            return

        # Asegura inventario por producto.
        for producto in productos:
            Inventario.objects.get_or_create(
                producto=producto,
                defaults={"stock_actual": 0, "stock_minimo": max(5, producto.stock_minimo)},
            )

        # Distribucion objetivo para cubrir estados visibles en dashboard/listados.
        base_plan = [
            ("normal", 8),
            ("stock_bajo", 8),
            ("proximo_vencer", 6),
            ("vencido", 4),
            ("bloqueado", 2),
            ("pendiente", 1),
            ("anulada", 1),
        ]
        base_total = sum(item[1] for item in base_plan)
        if total != base_total:
            # Ajusta proporcionalmente y asegura al menos 1 por tipo.
            scaled = []
            acc = 0
            for key, count in base_plan:
                new_count = max(1, round((count / base_total) * total))
                scaled.append([key, new_count])
                acc += new_count
            while acc > total:
                for item in scaled:
                    if item[1] > 1 and acc > total:
                        item[1] -= 1
                        acc -= 1
            while acc < total:
                scaled[0][1] += 1
                acc += 1
            plan = [(k, c) for k, c in scaled]
        else:
            plan = base_plan

        random.shuffle(productos)
        created = 0
        idx = 0

        for estado_objetivo, cantidad_registros in plan:
            for _ in range(cantidad_registros):
                producto = productos[idx % len(productos)]
                idx += 1

                inventario = Inventario.objects.get(producto=producto)
                if estado_objetivo == "normal":
                    cantidad = random.randint(18, 35)
                    dias_venc = random.randint(120, 300)
                    lote_estado = "disponible"
                    entrada_estado = "confirmada"
                    nuevo_min = min(inventario.stock_minimo or 5, max(3, cantidad // 4))
                elif estado_objetivo == "stock_bajo":
                    cantidad = random.randint(2, 7)
                    dias_venc = random.randint(60, 180)
                    lote_estado = "disponible"
                    entrada_estado = "confirmada"
                    nuevo_min = max(inventario.stock_minimo or 10, cantidad + random.randint(6, 20))
                elif estado_objetivo == "proximo_vencer":
                    cantidad = random.randint(8, 20)
                    dias_venc = random.randint(1, 30)
                    lote_estado = "disponible"
                    entrada_estado = "confirmada"
                    nuevo_min = inventario.stock_minimo or max(5, cantidad // 2)
                elif estado_objetivo == "vencido":
                    cantidad = random.randint(5, 12)
                    dias_venc = -random.randint(1, 45)
                    lote_estado = "vencido"
                    entrada_estado = "confirmada"
                    nuevo_min = inventario.stock_minimo or max(5, cantidad // 2)
                elif estado_objetivo == "bloqueado":
                    cantidad = random.randint(6, 14)
                    dias_venc = random.randint(50, 180)
                    lote_estado = "bloqueado"
                    entrada_estado = "confirmada"
                    nuevo_min = inventario.stock_minimo or max(5, cantidad // 2)
                elif estado_objetivo == "pendiente":
                    cantidad = random.randint(5, 15)
                    dias_venc = random.randint(80, 200)
                    lote_estado = "disponible"
                    entrada_estado = "pendiente"
                    nuevo_min = inventario.stock_minimo or 8
                else:  # anulada
                    cantidad = random.randint(5, 15)
                    dias_venc = random.randint(80, 200)
                    lote_estado = "disponible"
                    entrada_estado = "anulada"
                    nuevo_min = inventario.stock_minimo or 8

                lote_code = f"SEED-{estado_objetivo[:3].upper()}-{timezone.now().strftime('%y%m%d')}-{created+1:03d}"
                self._crear_entrada(
                    producto=producto,
                    user=user,
                    numero_lote=lote_code,
                    cantidad=cantidad,
                    dias_vencimiento=dias_venc,
                    lote_estado=lote_estado,
                    entrada_estado=entrada_estado,
                )

                inventario.stock_minimo = max(1, int(nuevo_min))
                inventario.save(update_fields=["stock_minimo", "updated_at"])
                created += 1

        # Genera tambien salidas por venta para reflejar consumo real del stock.
        ventas_creadas = 0
        lotes_para_venta = list(
            LoteProducto.objects.select_related("producto")
            .filter(
                estado="disponible",
                cantidad_disponible__gt=1,
                producto__estado=True,
            )
            .order_by("id")
        )
        random.shuffle(lotes_para_venta)
        objetivo_ventas = min(max(6, total // 4), len(lotes_para_venta))

        for lote in lotes_para_venta[:objetivo_ventas]:
            cantidad_max = max(1, int(lote.cantidad_disponible))
            cantidad_venta = random.randint(1, min(4, cantidad_max))
            try:
                descontar_stock(
                    producto=lote.producto,
                    cantidad=cantidad_venta,
                    motivo="venta",
                    referencia=f"SEED-VENTA-{timezone.now().strftime('%Y%m%d%H%M%S%f')}",
                    usuario=user,
                    observacion="Salida por venta generada por seed de inventario.",
                    lote=lote,
                )
                lote.cantidad_disponible = max(0, int(lote.cantidad_disponible) - cantidad_venta)
                if lote.cantidad_disponible == 0:
                    lote.estado = "agotado"
                lote.save(update_fields=["cantidad_disponible", "estado", "updated_at"])
                ventas_creadas += 1
            except Exception:
                continue

        self.stdout.write(
            self.style.SUCCESS(
                f"Seed completado: {created} entradas creadas "
                f"(normal, stock_bajo, proximos a vencer, vencidos, bloqueados, pendiente, anulada) "
                f"y {ventas_creadas} salidas por venta."
            )
        )

    def handle(self, *args, **options):
        tenants = self._resolve_tenants(options.get("schema"), options.get("all_tenants", False))
        total = max(1, int(options.get("total", 30)))
        for tenant in tenants:
            with schema_context(tenant.schema_name):
                set_current_tenant(tenant)
                self.stdout.write(f"[{tenant.schema_name}] Ejecutando seed_entradas_inventario_estados...")
                try:
                    self._seed_for_current_schema(total=total)
                finally:
                    clear_current_tenant()
