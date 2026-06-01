from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework import status
from rest_framework.test import APITestCase

from inventarios.models import Categoria, Inventario, Laboratorio, Producto
from tenants.context import clear_current_tenant, set_current_tenant
from tenants.models import Domain, Tenant
from .voice_search import parse_voice_search_command


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

    def test_voice_parser_busqueda_texto(self):
        result = parse_voice_search_command("buscar paracetamol")
        self.assertEqual(result["intent"], "search_text")
        self.assertEqual(result["query"], "paracetamol")

    def test_voice_parser_limpiar(self):
        result = parse_voice_search_command("mostrar todo")
        self.assertEqual(result["intent"], "clear_filters")

    def test_voice_parser_categoria(self):
        result = parse_voice_search_command("filtrar por suplementos")
        self.assertEqual(result["intent"], "filter_category")
        self.assertEqual(result["categoria"], "suplementos")
    def test_no_permite_agregar_por_encima_del_stock(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/carrito/agregar/",
            {"producto_id": self.producto.id, "cantidad": 25},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Stock insuficiente", response.data.get("detail", ""))

    def test_no_permite_actualizar_item_por_encima_del_stock(self):
        self.client.force_authenticate(user=self.user)
        add_response = self.client.post(
            "/api/carrito/agregar/",
            {"producto_id": self.producto.id, "cantidad": 1},
            format="json",
        )
        item_id = add_response.data["items"][0]["id"]
        response = self.client.patch(
            f"/api/carrito/items/{item_id}/",
            {"cantidad": 30},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Stock insuficiente", response.data.get("detail", ""))

    def test_permite_disminuir_item_si_stock_bajo_por_venta_externa(self):
        self.client.force_authenticate(user=self.user)
        add_response = self.client.post(
            "/api/carrito/agregar/",
            {"producto_id": self.producto.id, "cantidad": 6},
            format="json",
        )
        self.assertEqual(add_response.status_code, status.HTTP_200_OK)
        item_id = add_response.data["items"][0]["id"]

        # Simula una venta externa (POS) que reduce stock actual debajo de la cantidad en carrito.
        inv = Inventario.objects.get(producto=self.producto)
        inv.stock_actual = 4
        inv.save(update_fields=["stock_actual", "updated_at"])

        # Debe permitir reducir (6 -> 5), aunque 5 siga por encima del stock actual,
        # para que el usuario pueda ajustar su carrito hacia abajo.
        response = self.client.patch(
            f"/api/carrito/items/{item_id}/",
            {"cantidad": 5},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["items"][0]["cantidad"], 5)
