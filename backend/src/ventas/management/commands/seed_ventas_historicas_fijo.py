import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context
from django.utils import timezone
from django.contrib.auth import get_user_model
from ventas.models import Venta, DetalleVenta
from inventarios.models import Producto, Inventario
from clientes.models import Cliente
from tenants.models import Tenant
from tenants.context import clear_current_tenant, set_current_tenant

User = get_user_model()

class Command(BaseCommand):
    help = 'Genera ventas historicas con valores fijos (8 ventas/dia, 12 meses)'

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

    def _seed_for_current_schema(self):
        # Valores fijos dentro del código
        ventas_por_dia = 8
        meses = 12

        self.stdout.write(f"Generando {ventas_por_dia} ventas por día durante {meses} meses...")

        # Crear cliente si no existe
        clientes = list(Cliente.objects.all())
        if not clientes:
            self.stdout.write(self.style.WARNING('No hay clientes. Creando cliente demo...'))
            usuario, _ = User.objects.get_or_create(
                username='cliente_demo_fijo',
                defaults={'email': 'cliente_demo_fijo@farmacia.com'}
            )
            cliente_demo = Cliente.objects.create(
                usuario=usuario,
                tipo='natural',
                nombres='Cliente',
                apellidos='Fijo',
                email='cliente_demo_fijo@farmacia.com',
                telefono='000000000',
                ci_nit='111111111',
                estado=True
            )
            clientes = [cliente_demo]
            self.stdout.write(self.style.SUCCESS('Cliente demo creado.'))

        productos = list(Producto.objects.filter(estado=True))
        if not productos:
            self.stdout.write(self.style.ERROR('No hay productos. Ejecuta seed_productos primero.'))
            return

        # Asegurar inventarios
        for prod in productos:
            Inventario.objects.get_or_create(producto=prod, defaults={'stock_actual': 100, 'stock_minimo': 10})

        vendedor, _ = User.objects.get_or_create(username='vendedor_demo_fijo', defaults={'email': 'vendedor@demo.com'})

        fecha_fin = timezone.now().date()
        fecha_inicio = fecha_fin - timedelta(days=meses*30)

        total_ventas = 0
        current_date = fecha_inicio

        while current_date <= fecha_fin:
            num_ventas = max(1, int(random.gauss(ventas_por_dia, ventas_por_dia*0.3)))
            for _ in range(num_ventas):
                cliente = random.choice(clientes)
                num_prod = random.randint(1, 4)
                if len(productos) < num_prod:
                    continue
                productos_venta = random.sample(productos, num_prod)

                detalles = []
                subtotal = 0
                for prod in productos_venta:
                    cantidad = random.randint(1, 5)
                    precio = float(prod.precio_venta)
                    subtotal += precio * cantidad
                    detalles.append({
                        'producto': prod,
                        'cantidad': cantidad,
                        'precio_unitario': precio,
                        'subtotal': precio * cantidad
                    })

                descuento = 0
                if random.random() < 0.1:
                    descuento = round(subtotal * random.uniform(0.05, 0.15), 2)

                impuesto = round((subtotal - descuento) * 0.19, 2)
                total = subtotal - descuento + impuesto

                random_hour = random.randint(8, 20)
                random_minute = random.randint(0, 59)
                venta_datetime = timezone.make_aware(
                    timezone.datetime.combine(current_date, timezone.datetime.min.time()) +
                    timedelta(hours=random_hour, minutes=random_minute)
                )

                venta = Venta.objects.create(
                    cliente=cliente,
                    vendedor=vendedor,
                    origen=random.choice(['fisica', 'online']),
                    estado=random.choice(['pagada', 'entregada']),
                    subtotal=subtotal,
                    descuento=descuento,
                    impuesto=impuesto,
                    total=total,
                    observacion=f"Venta simulada - {current_date}",
                    created_at=venta_datetime,
                    updated_at=venta_datetime
                )

                for det in detalles:
                    DetalleVenta.objects.create(
                        venta=venta,
                        producto=det['producto'],
                        cantidad=det['cantidad'],
                        precio_unitario=det['precio_unitario'],
                        subtotal=det['subtotal']
                    )
                total_ventas += 1

            current_date += timedelta(days=1)
            if total_ventas % 100 == 0:
                self.stdout.write(f"Generadas {total_ventas} ventas hasta {current_date}")

        self.stdout.write(self.style.SUCCESS(f"✅ Generadas {total_ventas} ventas desde {fecha_inicio} hasta {fecha_fin}"))

    def handle(self, *args, **options):
        tenants = self._resolve_tenants(options.get("schema"), options.get("all_tenants", False))
        for tenant in tenants:
            with schema_context(tenant.schema_name):
                set_current_tenant(tenant)
                self.stdout.write(f"[{tenant.schema_name}] Ejecutando seed de ventas historicas...")
                try:
                    self._seed_for_current_schema()
                finally:
                    clear_current_tenant()