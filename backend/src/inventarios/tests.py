from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.rbac import ROLE_CLIENTE, ROLE_FARMACEUTICO, asignar_rol_usuario, seed_roles_y_permisos
from inventarios.models import InventarioProducto


class InventarioStockApiTests(APITestCase):
    def setUp(self):
        seed_roles_y_permisos()
        self.url = reverse("inventario-stock-list")
        InventarioProducto.objects.all().delete()
        InventarioProducto.objects.bulk_create(
            [
                InventarioProducto(
                    sku="MED-001",
                    nombre="Ibuprofeno 400mg x20",
                    categoria="Medicamentos",
                    stock_actual=112,
                    stock_minimo=15,
                ),
                InventarioProducto(
                    sku="DER-027",
                    nombre="Protector solar FPS 50",
                    categoria="Dermocosmetica",
                    stock_actual=9,
                    stock_minimo=10,
                ),
                InventarioProducto(
                    sku="BEB-055",
                    nombre="Panal talla M x40",
                    categoria="Mama y Bebe",
                    stock_actual=0,
                    stock_minimo=12,
                ),
            ]
        )

        user_model = get_user_model()
        self.farmaceutico = user_model.objects.create_user(
            username="farmaceutico.stock",
            email="farmaceutico.stock@saludplus.com",
            password="SaludPlus2026*",
        )
        asignar_rol_usuario(self.farmaceutico, ROLE_FARMACEUTICO)
        self.farmaceutico.save()

        self.cliente = user_model.objects.create_user(
            username="cliente.stock",
            email="cliente.stock@saludplus.com",
            password="SaludPlus2026*",
        )
        asignar_rol_usuario(self.cliente, ROLE_CLIENTE)
        self.cliente.save()

    def test_requires_authentication(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_returns_forbidden_without_inventory_permission(self):
        self.client.force_authenticate(user=self.cliente)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["detail"], "No tienes permisos para ver inventario.")

    def test_returns_inventory_summary_for_farmaceutico(self):
        self.client.force_authenticate(user=self.farmaceutico)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total_productos"], 3)
        self.assertEqual(response.data["summary"]["stock_total_unidades"], 121)
        self.assertEqual(response.data["summary"]["productos_stock_bajo"], 1)
        self.assertEqual(response.data["summary"]["productos_sin_stock"], 1)
        self.assertEqual(len(response.data["results"]), 3)

    def test_applies_search_and_status_filters(self):
        self.client.force_authenticate(user=self.farmaceutico)

        response = self.client.get(self.url, {"search": "protector", "status": "stock_bajo"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["total_productos"], 1)
        self.assertEqual(response.data["results"][0]["sku"], "DER-027")
