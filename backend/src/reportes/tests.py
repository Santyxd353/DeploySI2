from decimal import Decimal
from unittest.mock import patch

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


class ReportesApiTests(APITestCase):
    def setUp(self):
        connection.set_schema_to_public()

        self.tenant = Tenant.objects.create(
            schema_name="testtenant_reportes",
            name="Test Tenant Reportes",
            subdomain="testtenant-reportes",
            contact_email="tenant-reportes@test.com",
        )
        Domain.objects.create(
            domain="testtenant-reportes.localhost",
            tenant=self.tenant,
            is_primary=True,
        )

        connection.set_tenant(self.tenant)
        set_current_tenant(self.tenant)
        self.client.defaults["HTTP_X_TENANT_SUBDOMAIN"] = self.tenant.subdomain

        user_model = get_user_model()
        with schema_context(self.tenant.schema_name):
            self.user = user_model.objects.create_user(
                username="farm",
                email="farm@test.com",
                password="pass1234",
                is_staff=True,
                is_superuser=True,
            )

            self.sin_permiso = user_model.objects.create_user(
                username="cliente",
                email="cliente@test.com",
                password="pass1234",
            )

            categoria = Categoria.objects.create(nombre="Medicamentos")
            laboratorio = Laboratorio.objects.create(nombre="Lab Test")
            self.producto = Producto.objects.create(
                sku="MED-1",
                nombre_comercial="Paracetamol",
                categoria=categoria,
                laboratorio=laboratorio,
                forma_farmaceutica="tableta",
                presentacion="Caja x 10",
                unidad_medida="caja",
                precio_compra=Decimal("5.00"),
                precio_venta=Decimal("10.00"),
                stock_minimo=5,
                estado=True,
            )
            inventario = Inventario.objects.get(producto=self.producto)
            inventario.stock_actual = 3
            inventario.save(update_fields=["stock_actual", "updated_at"])
            self.producto_alto = Producto.objects.create(
                sku="MED-2",
                nombre_comercial="Vitamina C",
                categoria=categoria,
                laboratorio=laboratorio,
                forma_farmaceutica="tableta",
                presentacion="Frasco x 60",
                unidad_medida="frasco",
                precio_compra=Decimal("12.00"),
                precio_venta=Decimal("25.00"),
                stock_minimo=5,
                estado=True,
            )
            inventario_alto = Inventario.objects.get(producto=self.producto_alto)
            inventario_alto.stock_actual = 30
            inventario_alto.save(update_fields=["stock_actual", "updated_at"])

            cliente = Cliente.objects.create(tipo="registrado", nombres="Cliente", email="cliente-r@test.com", estado=True)
            venta = Venta.objects.create(cliente=cliente, origen="fisica", estado="pagada", subtotal=20, descuento=0, impuesto=0, total=20)
            DetalleVenta.objects.create(venta=venta, producto=self.producto, cantidad=2, precio_unitario=10, subtotal=20)
            venta_alta = Venta.objects.create(cliente=cliente, origen="fisica", estado="pagada", subtotal=125, descuento=0, impuesto=0, total=125)
            DetalleVenta.objects.create(venta=venta_alta, producto=self.producto_alto, cantidad=5, precio_unitario=25, subtotal=125)

    def tearDown(self):
        connection.set_schema_to_public()
        clear_current_tenant()
        super().tearDown()

    def test_catalogo_requiere_permiso_reportes(self):
        self.client.force_authenticate(user=self.sin_permiso)
        response = self.client.get("/api/reportes/catalogo/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_catalogo_reportes(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/reportes/catalogo/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("reportes", response.data)
        self.assertIn("ordenar_por", [item["id"] for item in response.data["filtros"]])
        for reporte in response.data["reportes"]:
            self.assertIn("ordenar_por", reporte["filtros"])

    def test_generar_stock_bajo(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/reportes/generar/",
            {"tipo_reporte": "stock_bajo", "filtros": {}},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tipo_reporte"], "stock_bajo")
        self.assertEqual(len(response.data["filas"]), 1)

    def test_stock_actual_permite_ordenar_por_stock(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/reportes/generar/",
            {"tipo_reporte": "stock_actual", "filtros": {"ordenar_por": "stock_desc", "top": 2}},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["filas"]), 2)
        self.assertEqual(response.data["filas"][0]["sku"], "MED-2")

    def test_productos_menos_vendidos(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/reportes/generar/",
            {"tipo_reporte": "productos_menos_vendidos", "filtros": {"periodo": "todo", "top": 2}},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["filas"][0]["sku"], "MED-1")

    @patch("reportes.services._gemini_generate_content")
    def test_ia_texto_con_gemini_mockeado(self, mocked_gemini):
        mocked_gemini.return_value = (
            '{"tipo_reporte":"medicamentos_mas_vendidos","periodo":"todo",'
            '"fecha_inicio":null,"fecha_fin":null,"top":10,"origen":null,'
            '"estado":null,"stock_estado":null,"tipo_cliente":null,'
            '"estado_receta":null,"categoria_texto":null,"laboratorio_texto":null,'
            '"producto_texto":null,"sku":null,"resultado":"ok","mensaje":"ok"}'
        )
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/reportes/ia/interpretar/",
            {"texto": "medicamentos mas vendidos"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["reporte"]["tipo_reporte"], "medicamentos_mas_vendidos")
