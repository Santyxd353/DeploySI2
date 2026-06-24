import random
from datetime import timedelta, datetime, time
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
    help = 'Genera ventas historicas con patrones agresivos (12 meses)'

    def add_arguments(self, parser):
        parser.add_argument("--schema", type=str)
        parser.add_argument("--all-tenants", action="store_true")

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
        raise ValueError("Debes indicar --schema o --all-tenants.")

    def _seed_for_current_schema(self):
        ventas_por_dia_base = 8
        meses = 12
        self.stdout.write(f"Generando ventas con patrones MUY MARCADOS durante {meses} meses...")

        clientes = list(Cliente.objects.all())
        if not clientes:
            usuario, _ = User.objects.get_or_create(username='cliente_demo_fijo', defaults={'email': 'cliente_demo_fijo@farmacia.com'})
            cliente_demo = Cliente.objects.create(usuario=usuario, tipo='natural', nombres='Cliente', apellidos='Fijo', email='cliente_demo_fijo@farmacia.com', telefono='000000000', ci_nit='111111111', estado=True)
            clientes = [cliente_demo]

        productos = list(Producto.objects.filter(estado=True))
        if not productos:
            self.stdout.write(self.style.ERROR('No hay productos.'))
            return

        popularidad = {prod.id: random.choices([1,2,3,4,5], weights=[0.3,0.3,0.2,0.15,0.05])[0] for prod in productos}
        tipo_estacional = {prod.id: random.choice(['invierno','verano','todo_ano']) for prod in productos}

        for prod in productos:
            Inventario.objects.get_or_create(producto=prod, defaults={'stock_actual':100,'stock_minimo':10})

        vendedor, _ = User.objects.get_or_create(username='vendedor_demo_fijo', defaults={'email':'vendedor@demo.com'})

        fecha_fin = timezone.now().date()
        fecha_inicio = fecha_fin.replace(year=fecha_fin.year - 1)
        total_ventas = 0
        current_date = fecha_inicio

        while current_date <= fecha_fin:
            w = current_date.weekday()
            fdia = {0:1.8,1:1.0,2:0.7,3:1.1,4:2.0,5:1.5,6:0.4}.get(w,1.0)
            mes = current_date.month
            if mes in [6,7,8]: fmes=2.0
            elif mes==12: fmes=2.2
            elif mes in [1,2]: fmes=0.5
            elif mes in [3,4,5]: fmes=0.9
            else: fmes=1.0
            ftend = 1.0 + ((current_date - fecha_inicio).days / (meses*30)) * 0.20
            fev = 1.0
            if random.random()<0.03: fev=2.5
            if current_date.day in [15,30]: fev*=1.6
            media = ventas_por_dia_base * fdia * fmes * ftend * fev
            ventas_dia = max(1, int(random.gauss(media, media*0.5)))

            for _ in range(ventas_dia):
                cliente = random.choice(clientes)
                num_prod = random.randint(1,4)
                if len(productos) < num_prod: continue
                pesos = []
                for p in productos:
                    peso = popularidad[p.id]
                    if tipo_estacional[p.id]=='invierno' and mes in [6,7,8]: peso*=3.0
                    elif tipo_estacional[p.id]=='verano' and mes in [12,1,2]: peso*=3.0
                    elif tipo_estacional[p.id]=='todo_ano': peso*=1.5
                    pesos.append(peso)
                prods = random.choices(productos, weights=pesos, k=num_prod)
                subtotal=0
                detalles=[]
                for prod in prods:
                    cant = max(1, int(random.gauss(popularidad[prod.id]*1.2, 1.5)))
                    precio = float(prod.precio_venta)
                    subtotal += precio*cant
                    detalles.append({'producto':prod,'cantidad':cant,'precio_unitario':precio,'subtotal':precio*cant})
                descuento = 0
                if random.random()<0.1: descuento=round(subtotal*random.uniform(0.05,0.15),2)
                impuesto = round((subtotal-descuento)*0.19,2)
                total = subtotal - descuento + impuesto

                # Fecha histórica simulada
                naive_dt = datetime.combine(current_date, time(hour=random.randint(8,20), minute=random.randint(0,59)))
                venta_dt = timezone.make_aware(naive_dt)

                # Crear venta SIN pasar created_at/updated_at
                venta = Venta.objects.create(
                    cliente=cliente,
                    vendedor=vendedor,
                    origen=random.choice(['fisica','online']),
                    estado=random.choice(['pagada','entregada']),
                    subtotal=subtotal,
                    descuento=descuento,
                    impuesto=impuesto,
                    total=total,
                    observacion=f"Venta simulada - {current_date}",
                )

                # Forzar la fecha histórica con update() para evitar auto_now_add
                Venta.objects.filter(pk=venta.pk).update(
                    created_at=venta_dt,
                    updated_at=venta_dt
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
        self.stdout.write(self.style.SUCCESS(f"✅ Generadas {total_ventas} ventas desde {fecha_inicio} hasta {fecha_fin}"))

    def handle(self, *args, **options):
        tenants = self._resolve_tenants(options.get("schema"), options.get("all_tenants", False))
        for tenant in tenants:
            with schema_context(tenant.schema_name):
                set_current_tenant(tenant)
                self.stdout.write(f"[{tenant.schema_name}] Ejecutando seed...")
                try:
                    self._seed_for_current_schema()
                finally:
                    clear_current_tenant()