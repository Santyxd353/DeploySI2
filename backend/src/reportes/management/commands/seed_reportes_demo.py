from datetime import datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django_tenants.utils import schema_context

from clientes.models import Cliente, RecetaMedica
from core.models import BitacoraSistema
from core.rbac import ROLE_ADMIN, ROLE_CAJERO, ROLE_FARMACEUTICO, asignar_rol_usuario, seed_roles_y_permisos
from inventarios.models import Categoria, Inventario, Laboratorio, MovimientoInventario, Producto, Subcategoria
from tenants.models import Tenant
from ventas.models import DetalleVenta, Factura, Venta


SEED_TAG = "[SEED_REPORTES]"
DEFAULT_PASSWORD = "SaludPlus2026*"


class Command(BaseCommand):
    help = "Puebla datos demo de ventas, stock, recetas y bitacora para probar el modulo de reportes."

    def add_arguments(self, parser):
        parser.add_argument(
            "--schema",
            type=str,
            help="Schema del tenant donde se ejecutara el seed (ej: farmacia1)",
        )
        parser.add_argument(
            "--all-tenants",
            action="store_true",
            help="Ejecuta el seed en todos los tenants activos.",
        )
        parser.add_argument(
            "--keep-existing",
            action="store_true",
            help="No borra datos demo previos. Por defecto se regeneran para evitar duplicados.",
        )

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

    def _aware(self, day_offset, hour=10, minute=0):
        base = timezone.localdate() + timedelta(days=day_offset)
        return timezone.make_aware(datetime.combine(base, time(hour=hour, minute=minute)))

    def _set_datetime(self, model, pk, **fields):
        model.objects.filter(pk=pk).update(**fields)

    def _user(self, email, first_name, last_name, role):
        user_model = get_user_model()
        user, created = user_model.objects.get_or_create(
            email=email,
            defaults={
                "username": email.split("@")[0],
                "first_name": first_name,
                "last_name": last_name,
                "is_active": True,
            },
        )
        user.first_name = first_name
        user.last_name = last_name
        user.is_active = True
        if created:
            user.set_password(DEFAULT_PASSWORD)
        asignar_rol_usuario(user, role)
        user.save()
        return user

    def _cleanup(self):
        Venta.objects.filter(observacion__startswith=SEED_TAG).delete()
        MovimientoInventario.objects.filter(observacion__startswith=SEED_TAG).delete()
        RecetaMedica.objects.filter(codigo__startswith="REP-RX-").delete()
        BitacoraSistema.objects.filter(mensaje__startswith=SEED_TAG).delete()

    def _seed_catalog(self):
        categorias_data = {
            "Medicamentos": ["Analgesicos", "Antibioticos", "Gastrointestinal", "Antialergicos", "Cronicos"],
            "Suplementos": ["Vitaminas"],
            "Cuidado Personal": ["Dermocuidado"],
            "Dispositivos": ["Primeros auxilios"],
        }
        categorias = {}
        subcategorias = {}
        for categoria_nombre, subs in categorias_data.items():
            categoria, _ = Categoria.objects.update_or_create(
                nombre=categoria_nombre,
                defaults={"descripcion": f"{categoria_nombre} demo para reportes", "estado": True},
            )
            categorias[categoria_nombre] = categoria
            for sub_nombre in subs:
                sub, _ = Subcategoria.objects.update_or_create(
                    categoria=categoria,
                    nombre=sub_nombre,
                    defaults={"descripcion": f"{sub_nombre} demo para reportes", "estado": True},
                )
                subcategorias[(categoria_nombre, sub_nombre)] = sub

        laboratorios = {}
        for nombre in ["INTI", "IFA", "VITA", "COFAR", "LAFAR"]:
            lab, _ = Laboratorio.objects.update_or_create(
                nombre=nombre,
                defaults={"pais": "Bolivia", "telefono": "+591 70000000", "email": f"contacto@{nombre.lower()}.bo", "estado": True},
            )
            laboratorios[nombre] = lab

        productos_data = [
            ("REP-PARA500", "Paracetamol INTI 500 mg", "Paracetamol", "Medicamentos", "Analgesicos", "INTI", "tableta", "caja", "9.90", 25, 118, False, False),
            ("REP-IBU400", "Ibuprofeno IFA 400 mg", "Ibuprofeno", "Medicamentos", "Analgesicos", "IFA", "tableta", "caja", "13.50", 22, 82, False, False),
            ("REP-AMOX500", "Amoxicilina VITA 500 mg", "Amoxicilina", "Medicamentos", "Antibioticos", "VITA", "capsula", "caja", "21.00", 20, 16, True, False),
            ("REP-OMEP20", "Omeprazol COFAR 20 mg", "Omeprazol", "Medicamentos", "Gastrointestinal", "COFAR", "capsula", "caja", "15.90", 18, 44, False, False),
            ("REP-LORA10", "Loratadina LAFAR 10 mg", "Loratadina", "Medicamentos", "Antialergicos", "LAFAR", "tableta", "caja", "11.50", 16, 9, False, False),
            ("REP-METF500", "Metformina VITA 500 mg", "Metformina", "Medicamentos", "Cronicos", "VITA", "tableta", "caja", "11.90", 24, 72, True, False),
            ("REP-CIPRO500", "Ciprofloxacino IFA 500 mg", "Ciprofloxacino", "Medicamentos", "Antibioticos", "IFA", "tableta", "caja", "24.90", 14, 0, True, False),
            ("REP-VITC1000", "Vitamina C VITA 1000 mg", "Acido ascorbico", "Suplementos", "Vitaminas", "VITA", "tableta", "frasco", "28.50", 12, 65, False, False),
            ("REP-B12", "Vitamina B12 COFAR 1000 mcg", "Cianocobalamina", "Suplementos", "Vitaminas", "COFAR", "inyectable", "caja", "32.90", 8, 24, False, False),
            ("REP-CREMA60", "Crema Dermoprotectora COFAR", "Crema hidratante", "Cuidado Personal", "Dermocuidado", "COFAR", "crema", "unidad", "24.90", 10, 39, False, False),
            ("REP-ESPARA", "Esparadrapo COFAR 5m x 2cm", "Cinta adhesiva", "Dispositivos", "Primeros auxilios", "COFAR", "polvo", "unidad", "4.90", 30, 140, False, False),
            ("REP-TERM", "Termometro digital IFA", "Termometro", "Dispositivos", "Primeros auxilios", "IFA", "polvo", "unidad", "36.00", 8, 11, False, False),
        ]

        productos = []
        for sku, nombre, generico, categoria_nombre, sub_nombre, lab_nombre, forma, unidad, precio, minimo, stock, receta, controlado in productos_data:
            producto, _ = Producto.objects.update_or_create(
                sku=sku,
                defaults={
                    "nombre_comercial": nombre,
                    "nombre_generico": generico,
                    "descripcion": f"{SEED_TAG} Producto demo para reportes",
                    "categoria": categorias[categoria_nombre],
                    "subcategoria": subcategorias[(categoria_nombre, sub_nombre)],
                    "laboratorio": laboratorios[lab_nombre],
                    "forma_farmaceutica": forma,
                    "concentracion": generico,
                    "presentacion": "Presentacion demo",
                    "unidad_medida": unidad,
                    "precio_compra": Decimal(precio) * Decimal("0.55"),
                    "precio_venta": Decimal(precio),
                    "stock_minimo": minimo,
                    "requiere_receta": receta,
                    "es_controlado": controlado,
                    "estado": True,
                },
            )
            inventario, _ = Inventario.objects.get_or_create(producto=producto)
            inventario.stock_actual = max(stock, 80)
            inventario.stock_minimo = minimo
            inventario.save(update_fields=["stock_actual", "stock_minimo", "updated_at"])
            productos.append((producto, stock, minimo))

        return productos

    def _seed_inventory_movements(self, productos, users):
        for index, (producto, target_stock, minimo) in enumerate(productos):
            entrada = MovimientoInventario.objects.create(
                producto=producto,
                tipo_movimiento="entrada",
                cantidad=35 + (index % 5) * 8,
                motivo="compra",
                referencia=f"REP-ENT-{index + 1:03d}",
                usuario=users[index % len(users)],
                observacion=f"{SEED_TAG} entrada demo para reportes",
            )
            entrada_dt = self._aware(-70 + index * 3, 9, 30)
            self._set_datetime(MovimientoInventario, entrada.pk, fecha_movimiento=entrada_dt, created_at=entrada_dt)

            if index % 2 == 0:
                salida = MovimientoInventario.objects.create(
                    producto=producto,
                    tipo_movimiento="salida",
                    cantidad=5 + (index % 4) * 3,
                    motivo="venta",
                    referencia=f"REP-SAL-{index + 1:03d}",
                    usuario=users[(index + 1) % len(users)],
                    observacion=f"{SEED_TAG} salida demo para reportes",
                )
                salida_dt = self._aware(-35 + index, 16, 15)
                self._set_datetime(MovimientoInventario, salida.pk, fecha_movimiento=salida_dt, created_at=salida_dt)

            inventario = producto.inventario
            inventario.stock_actual = target_stock
            inventario.stock_minimo = minimo
            inventario.save(update_fields=["stock_actual", "stock_minimo", "updated_at"])

    def _seed_clients(self):
        data = [
            ("cliente.quispe@demo.bo", "Maria", "Quispe", "registrado", -88),
            ("jorge.vargas@demo.bo", "Jorge", "Vargas", "registrado", -61),
            ("lucia.choque@demo.bo", "Lucia", "Choque", "registrado", -44),
            ("roberto.mamani@demo.bo", "Roberto", "Mamani", "registrado", -32),
            ("camila.suarez@demo.bo", "Camila", "Suarez", "registrado", -18),
            ("invitado.pos@demo.bo", "Cliente", "POS", "invitado", -8),
        ]
        clientes = []
        for email, nombres, apellidos, tipo, offset in data:
            cliente, _ = Cliente.objects.update_or_create(
                email=email,
                defaults={
                    "tipo": tipo,
                    "nombres": nombres,
                    "apellidos": apellidos,
                    "telefono": "70000000",
                    "ci_nit": "123456",
                    "estado": True,
                },
            )
            created_dt = self._aware(offset, 8, 0)
            self._set_datetime(Cliente, cliente.pk, created_at=created_dt, updated_at=created_dt)
            clientes.append(cliente)
        return clientes

    def _seed_sales(self, productos, clientes, sellers):
        product_list = [item[0] for item in productos]
        estados = ["pagada", "entregada", "pagada", "preparando", "pagada", "cancelada"]
        origenes = ["fisica", "online", "fisica", "fisica", "online"]
        created_count = 0

        for index in range(72):
            sale_dt = self._aware(-88 + index * 2, 9 + (index % 8), (index * 7) % 55)
            cliente = clientes[index % len(clientes)]
            seller = sellers[index % len(sellers)]
            estado = estados[index % len(estados)]
            origen = origenes[index % len(origenes)]
            details = []
            subtotal = Decimal("0.00")

            for line in range(1 + (index % 3)):
                producto = product_list[(index + line * 3) % len(product_list)]
                cantidad = (index + line) % 4 + 1
                precio = producto.precio_venta
                line_total = precio * cantidad
                subtotal += line_total
                details.append((producto, cantidad, precio, line_total))

            descuento = Decimal("0.00") if index % 5 else subtotal * Decimal("0.05")
            impuesto = Decimal("0.00")
            total = subtotal - descuento + impuesto

            venta = Venta.objects.create(
                cliente=cliente,
                vendedor=seller,
                origen=origen,
                estado=estado,
                subtotal=subtotal,
                descuento=descuento,
                impuesto=impuesto,
                total=total,
                observacion=f"{SEED_TAG} venta demo para reportes",
            )
            self._set_datetime(Venta, venta.pk, created_at=sale_dt, updated_at=sale_dt)

            for producto, cantidad, precio, line_total in details:
                detalle = DetalleVenta.objects.create(
                    venta=venta,
                    producto=producto,
                    cantidad=cantidad,
                    precio_unitario=precio,
                    subtotal=line_total,
                )
                self._set_datetime(DetalleVenta, detalle.pk, created_at=sale_dt)

            if estado in {"pagada", "entregada"}:
                factura = Factura.objects.create(
                    venta=venta,
                    tipo="simple" if index % 4 else "con_nit",
                    nombre_cliente=str(cliente),
                    email_cliente=cliente.email,
                    nit_ci=cliente.ci_nit or "",
                )
                self._set_datetime(Factura, factura.pk, fecha_emision=sale_dt)

            created_count += 1

        return created_count

    def _seed_recipes(self, clientes, validator):
        estados = ["pendiente", "aprobada", "rechazada", "vencida"]
        for index in range(14):
            emision = timezone.localdate() - timedelta(days=55 - index * 4)
            vencimiento = emision + timedelta(days=30)
            receta = RecetaMedica.objects.create(
                cliente=clientes[index % len(clientes)],
                codigo=f"REP-RX-{index + 1:03d}",
                fecha_emision=emision,
                fecha_vencimiento=vencimiento,
                estado=estados[index % len(estados)],
                observacion=f"{SEED_TAG} receta demo para reportes",
                validada_por=validator if index % 2 else None,
                validada_en=self._aware(-20 + index, 11, 0) if index % 2 else None,
            )
            created_dt = self._aware(-55 + index * 4, 10, 0)
            self._set_datetime(RecetaMedica, receta.pk, created_at=created_dt, updated_at=created_dt)

    def _seed_audit(self, users):
        modulos = ["ventas", "inventario", "productos", "clientes", "reportes", "auth"]
        acciones = ["CREAR", "ACTUALIZAR", "CONSULTAR", "GENERAR_REPORTE", "LOGIN", "VALIDAR_RECETA"]
        for index in range(42):
            event_dt = self._aware(-40 + index, 8 + (index % 9), (index * 11) % 55)
            evento = BitacoraSistema.objects.create(
                usuario=users[index % len(users)],
                accion=acciones[index % len(acciones)],
                modulo=modulos[index % len(modulos)],
                entidad="demo",
                entidad_id=str(index + 1),
                resultado="FAILURE" if index % 7 == 0 else "SUCCESS",
                mensaje=f"{SEED_TAG} evento demo para reportes",
                ip_origen="127.0.0.1",
                navegador="seed_reportes_demo",
                ruta="/api/demo/",
                metodo_http="POST",
            )
            self._set_datetime(BitacoraSistema, evento.pk, fecha_hora=event_dt)

    @transaction.atomic
    def _seed_for_current_schema(self, *args, **options):
        seed_roles_y_permisos()
        if not options["keep_existing"]:
            self._cleanup()

        admin = self._user("carlos.mendoza@saludplus.com", "Carlos", "Mendoza", ROLE_ADMIN)
        farmaceutico = self._user("ana.rojas@saludplus.com", "Ana", "Rojas", ROLE_FARMACEUTICO)
        cajero = self._user("luis.torrez@saludplus.com", "Luis", "Torrez", ROLE_CAJERO)

        productos = self._seed_catalog()
        self._seed_inventory_movements(productos, [admin, farmaceutico, cajero])
        clientes = self._seed_clients()
        ventas_count = self._seed_sales(productos, clientes, [admin, farmaceutico, cajero])
        self._seed_recipes(clientes, farmaceutico)
        self._seed_audit([admin, farmaceutico, cajero])

        self.stdout.write(self.style.SUCCESS("Datos demo de reportes creados correctamente."))
        self.stdout.write(self.style.SUCCESS(f"Productos demo: {len(productos)} | Ventas demo: {ventas_count} | Clientes demo: {len(clientes)}"))

    def handle(self, *args, **options):
        tenants = self._resolve_tenants(options.get("schema"), options.get("all_tenants", False))
        for tenant in tenants:
            with schema_context(tenant.schema_name):
                self.stdout.write(f"[{tenant.schema_name}] Ejecutando seed de reportes demo...")
                self._seed_for_current_schema(*args, **options)
