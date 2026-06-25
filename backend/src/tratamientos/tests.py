from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework import status
from rest_framework.test import APITestCase

from clientes.models import Cliente
from inventarios.models import Categoria, Inventario, Laboratorio, Producto
from tenants.context import clear_current_tenant, set_current_tenant
from tenants.models import Domain, Tenant
from ventas.models import DetalleVenta, Venta

from .models import TratamientoBase


class TratamientosDisponiblesTests(APITestCase):
    def setUp(self):
        connection.set_schema_to_public()

        self.tenant = Tenant.objects.create(
            schema_name="testtenant_tratamientos",
            name="Test Tenant Tratamientos",
            subdomain="testtenant-tratamientos",
            contact_email="tenant-tratamientos@test.com",
        )
        Domain.objects.create(
            domain="testtenant-tratamientos.localhost",
            tenant=self.tenant,
            is_primary=True,
        )

        connection.set_tenant(self.tenant)
        set_current_tenant(self.tenant)
        self.client.defaults["HTTP_X_TENANT_SUBDOMAIN"] = self.tenant.subdomain

        user_model = get_user_model()
        with schema_context(self.tenant.schema_name):
            self.user = user_model.objects.create_user(
                username="cliente1",
                email="c1@test.com",
                password="pass1234",
            )
            self.cliente = Cliente.objects.create(
                usuario=self.user,
                tipo="registrado",
                nombres="Cliente",
                apellidos="Prueba",
                email=self.user.email,
            )

            categoria = Categoria.objects.create(nombre="Antibióticos")
            laboratorio = Laboratorio.objects.create(nombre="Lab Test")
            self.producto_comprado = Producto.objects.create(
                sku="SKU-1",
                nombre_comercial="Metronidazol",
                categoria=categoria,
                laboratorio=laboratorio,
                forma_farmaceutica="tableta",
                presentacion="caja x 20",
                unidad_medida="caja",
                precio_compra=Decimal("7.00"),
                precio_venta=Decimal("20.00"),
                stock_minimo=1,
                estado=True,
                requiere_receta=False,
            )
            inv = Inventario.objects.get(producto=self.producto_comprado)
            inv.stock_actual = 20
            inv.save(update_fields=["stock_actual", "updated_at"])

            self.producto_no_comprado = Producto.objects.create(
                sku="SKU-2",
                nombre_comercial="Ibuprofeno",
                categoria=categoria,
                laboratorio=laboratorio,
                forma_farmaceutica="tableta",
                presentacion="caja x 20",
                unidad_medida="caja",
                precio_compra=Decimal("5.00"),
                precio_venta=Decimal("15.00"),
                stock_minimo=1,
                estado=True,
                requiere_receta=False,
            )
            inv2 = Inventario.objects.get(producto=self.producto_no_comprado)
            inv2.stock_actual = 20
            inv2.save(update_fields=["stock_actual", "updated_at"])

            self.tratamiento_base = TratamientoBase.objects.create(
                producto=self.producto_comprado,
                nombre_publico="Metronidazol 500 mg",
                dosis_cantidad=Decimal("1"),
                unidad_dosis="tableta",
                frecuencia_horas=8,
                duracion_dias=7,
                instrucciones="1 cada 8 hrs durante 7 dias",
                activo=True,
            )

            venta = Venta.objects.create(
                cliente=self.cliente,
                origen="online",
                estado="pagada",
                subtotal=Decimal("20.00"),
                descuento=Decimal("0.00"),
                impuesto=Decimal("0.00"),
                total=Decimal("20.00"),
            )
            DetalleVenta.objects.create(
                venta=venta,
                producto=self.producto_comprado,
                cantidad=1,
                precio_unitario=Decimal("20.00"),
                subtotal=Decimal("20.00"),
            )

    def tearDown(self):
        connection.set_schema_to_public()
        clear_current_tenant()
        super().tearDown()

    def test_solo_muestra_tratamientos_de_productos_comprados(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/tratamientos/disponibles/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        nombres = [item["producto_nombre"] for item in response.data]
        self.assertIn("Metronidazol", nombres)
        self.assertNotIn("Ibuprofeno", nombres)
