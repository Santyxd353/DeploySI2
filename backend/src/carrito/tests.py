from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework import status
from rest_framework.test import APITestCase

from inventarios.models import Categoria, Inventario, Laboratorio, Producto
from tenants.context import clear_current_tenant, set_current_tenant
from tenants.models import Domain, Tenant


class CarritoApiFlowTests(APITestCase):
    def setUp(self):
        connection.set_schema_to_public()

        self.tenant = Tenant.objects.create(
            schema_name="testtenant_carrito",
            name="Test Tenant Carrito",
            subdomain="testtenant-carrito",
            contact_email="tenant-carrito@test.com",
        )
        Domain.objects.create(
            domain="testtenant-carrito.localhost",
            tenant=self.tenant,
            is_primary=True,
        )

        connection.set_tenant(self.tenant)
        set_current_tenant(self.tenant)
        self.client.defaults["HTTP_X_TENANT_SUBDOMAIN"] = self.tenant.subdomain

        user_model = get_user_model()
        with schema_context(self.tenant.schema_name):
            self.user = user_model.objects.create_user(username="cliente1", email="c1@test.com", password="pass1234")

            categoria = Categoria.objects.create(nombre="Analgesicos")
            laboratorio = Laboratorio.objects.create(nombre="Lab Test")
            self.producto = Producto.objects.create(
                sku="SKU-1",
                nombre_comercial="Paracetamol",
                categoria=categoria,
                laboratorio=laboratorio,
                forma_farmaceutica="tableta",
                presentacion="caja x 10",
                unidad_medida="caja",
                precio_compra=Decimal("7.00"),
                precio_venta=Decimal("20.00"),
                stock_minimo=1,
                estado=True,
                requiere_receta=False,
            )
            inv = Inventario.objects.get(producto=self.producto)
            inv.stock_actual = 20
            inv.save(update_fields=["stock_actual", "updated_at"])

    def tearDown(self):
        connection.set_schema_to_public()
        clear_current_tenant()
        super().tearDown()

    def test_agregar_item_al_carrito(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post("/api/carrito/agregar/", {"producto_id": self.producto.id, "cantidad": 1}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("id", response.data)
        self.assertEqual(response.data["estado"], "activo")

    def test_listar_carrito(self):
        self.client.force_authenticate(user=self.user)
        self.client.post("/api/carrito/agregar/", {"producto_id": self.producto.id, "cantidad": 2}, format="json")

        response = self.client.get("/api/carrito/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["items"]), 1)
        self.assertEqual(response.data["items"][0]["cantidad"], 2)
