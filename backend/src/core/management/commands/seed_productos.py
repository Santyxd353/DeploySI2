from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.core.files import File
from django_tenants.utils import schema_context
from tenants.context import set_current_tenant, clear_current_tenant
from inventarios.models import (
    Categoria,
    Subcategoria,
    Laboratorio,
    Producto,
    Inventario,
    MovimientoInventario,
)
from decimal import Decimal
from pathlib import Path
from random import randint

User = get_user_model()


class Command(BaseCommand):
    help = "Pobla la base de datos con catalogo de productos bolivianos e imagenes de ejemplo"

    def _seed_media_root(self):
        # backend/src/core/management/seed_media/productos
        return Path(__file__).resolve().parent.parent / "seed_media" / "productos"

    def _attach_image_if_exists(self, producto, image_name):
        if not image_name:
            return

        image_path = self._seed_media_root() / image_name
        if not image_path.exists():
            self.stdout.write(self.style.WARNING(f"  ! Imagen no encontrada para {producto.sku}: {image_path.name}"))
            return

        with image_path.open("rb") as file_obj:
            producto.imagen.save(image_path.name, File(file_obj), save=False)
        producto.save(update_fields=["imagen", "updated_at"])

    def add_arguments(self, parser):
        parser.add_argument(
            "--schema",
            type=str,
            help="Schema del tenant donde se sembraran los productos (ej: farmacia1)",
        )
        parser.add_argument(
            "--all-tenants",
            action="store_true",
            help="Ejecuta el seed en todos los tenants activos.",
        )

    def _resolve_tenants(self, schema_name=None, all_tenants=False):
        from tenants.models import Tenant

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

    def handle(self, *args, **options):
        tenants = self._resolve_tenants(options.get("schema"), options.get("all_tenants", False))
        for tenant_obj in tenants:
            schema = tenant_obj.schema_name
            self.stdout.write(f"Sembrando catalogo de productos bolivianos en schema '{schema}'...")
            with schema_context(schema):
                set_current_tenant(tenant_obj)
                try:
                    self._do_seed()
                finally:
                    clear_current_tenant()

    def _do_seed(self):
        # 1. Categorías y Subcategorías
        categorias_data = [
            {"nombre": "Medicamentos", "descripcion": "Medicamentos de uso humano"},
            {"nombre": "Suplementos", "descripcion": "Vitaminas y suplementos nutricionales"},
            {"nombre": "Cuidado Personal", "descripcion": "Productos de higiene y cuidado diario"},
            {"nombre": "Dispositivos", "descripcion": "Dispositivos y apoyo al tratamiento"},
        ]

        categorias = {}
        for cat_data in categorias_data:
            cat, _ = Categoria.objects.update_or_create(
                nombre=cat_data["nombre"],
                defaults={"descripcion": cat_data["descripcion"], "estado": True},
            )
            categorias[cat.nombre] = cat
            self.stdout.write(f"  - Categoria: {cat.nombre}")

        subcategorias_data = [
            ("Medicamentos", "Analgesicos", "Alivio del dolor y fiebre"),
            ("Medicamentos", "Antiinflamatorios", "Manejo de dolor e inflamacion"),
            ("Medicamentos", "Antibioticos", "Tratamiento de infecciones"),
            ("Medicamentos", "Gastrointestinal", "Acidez y proteccion gastrica"),
            ("Medicamentos", "Antialergicos", "Manejo de alergias y rinitis"),
            ("Medicamentos", "Otros", "Otros medicamentos"),
            ("Suplementos", "Vitaminas", "Complejos vitaminicos"),
            ("Cuidado Personal", "Dermocuidado", "Cuidado de la piel"),
        ]

        for cat_nombre, sub_nombre, sub_desc in subcategorias_data:
            cat = categorias.get(cat_nombre)
            if cat:
                sub, _ = Subcategoria.objects.update_or_create(
                    categoria=cat,
                    nombre=sub_nombre,
                    defaults={"descripcion": sub_desc, "estado": True},
                )
                self.stdout.write(f"  - Subcategoria: {cat.nombre} / {sub.nombre}")

        # 2. Laboratorios
        laboratorios_data = [
            {"nombre": "INTI", "pais": "Bolivia", "telefono": "+591-2-2200001", "email": "contacto@inti.bo"},
            {"nombre": "IFA", "pais": "Bolivia", "telefono": "+591-3-3300002", "email": "contacto@ifa.bo"},
            {"nombre": "VITA", "pais": "Bolivia", "telefono": "+591-2-2200003", "email": "contacto@vita.bo"},
            {"nombre": "COFAR", "pais": "Bolivia", "telefono": "+591-3-3300004", "email": "contacto@cofar.bo"},
            {"nombre": "LAFAR", "pais": "Bolivia", "telefono": "+591-2-2200005", "email": "contacto@lafar.bo"},
        ]

        laboratorios = {}
        for lab_data in laboratorios_data:
            lab, _ = Laboratorio.objects.update_or_create(
                nombre=lab_data["nombre"],
                defaults={
                    "pais": lab_data["pais"],
                    "telefono": lab_data["telefono"],
                    "email": lab_data["email"],
                    "estado": True,
                }
            )
            laboratorios[lab.nombre] = lab
            self.stdout.write(f"  - Laboratorio: {lab.nombre}")

        # 3. Productos
        productos_data = [
            {
                "sku": "BOL-INTI-PARA500",
                "nombre_comercial": "Paracetamol INTI 500 mg",
                "nombre_generico": "Paracetamol",
                "categoria": "Medicamentos",
                "subcategoria": "Analgesicos",
                "laboratorio": "INTI",
                "forma_farmaceutica": "tableta",
                "concentracion": "500 mg",
                "presentacion": "Caja x 20 tabletas",
                "unidad_medida": "caja",
                "precio_compra": 4.80,
                "precio_venta": 9.90,
                "stock_minimo": 25,
                "requiere_receta": False,
                "es_controlado": False,
                "descripcion": "Analgésico y antipirético de uso frecuente.",
                "imagen": "paracetamol-inti.svg",
            },
            {
                "sku": "BOL-IFA-IBU400",
                "nombre_comercial": "Ibuprofeno IFA 400 mg",
                "nombre_generico": "Ibuprofeno",
                "categoria": "Medicamentos",
                "subcategoria": "Antiinflamatorios",
                "laboratorio": "IFA",
                "forma_farmaceutica": "tableta",
                "concentracion": "400 mg",
                "presentacion": "Caja x 30 tabletas",
                "unidad_medida": "caja",
                "precio_compra": 6.10,
                "precio_venta": 13.50,
                "stock_minimo": 20,
                "requiere_receta": False,
                "es_controlado": False,
                "descripcion": "Antiinflamatorio no esteroideo para dolor moderado.",
                "imagen": "ibuprofeno-ifa.svg",
            },
            {
                "sku": "BOL-VITA-AMOX500",
                "nombre_comercial": "Amoxicilina VITA 500 mg",
                "nombre_generico": "Amoxicilina",
                "categoria": "Medicamentos",
                "subcategoria": "Antibioticos",
                "laboratorio": "VITA",
                "forma_farmaceutica": "capsula",
                "concentracion": "500 mg",
                "presentacion": "Caja x 12 capsulas",
                "unidad_medida": "caja",
                "precio_compra": 10.50,
                "precio_venta": 21.00,
                "stock_minimo": 18,
                "requiere_receta": True,
                "es_controlado": False,
                "descripcion": "Antibiotico de amplio espectro.",
                "imagen": "amoxicilina-vita.svg",
            },
            {
                "sku": "BOL-COFAR-OMEP20",
                "nombre_comercial": "Omeprazol COFAR 20 mg",
                "nombre_generico": "Omeprazol",
                "categoria": "Medicamentos",
                "subcategoria": "Gastrointestinal",
                "laboratorio": "COFAR",
                "forma_farmaceutica": "capsula",
                "concentracion": "20 mg",
                "presentacion": "Caja x 14 capsulas",
                "unidad_medida": "caja",
                "precio_compra": 7.40,
                "precio_venta": 15.90,
                "stock_minimo": 20,
                "requiere_receta": False,
                "es_controlado": False,
                "descripcion": "Inhibidor de bomba de protones para acidez y gastritis.",
                "imagen": "omeprazol-cofar.svg",
            },
            {
                "sku": "BOL-LAFAR-LORA10",
                "nombre_comercial": "Loratadina LAFAR 10 mg",
                "nombre_generico": "Loratadina",
                "categoria": "Medicamentos",
                "subcategoria": "Antialergicos",
                "laboratorio": "LAFAR",
                "forma_farmaceutica": "tableta",
                "concentracion": "10 mg",
                "presentacion": "Caja x 10 tabletas",
                "unidad_medida": "caja",
                "precio_compra": 5.20,
                "precio_venta": 11.50,
                "stock_minimo": 14,
                "requiere_receta": False,
                "es_controlado": False,
                "descripcion": "Antihistaminico para alergias estacionales.",
                "imagen": "loratadina-lafar.svg",
            },
            {
                "sku": "BOL-INTI-DICLO50",
                "nombre_comercial": "Diclofenaco INTI 50 mg",
                "nombre_generico": "Diclofenaco sodico",
                "categoria": "Medicamentos",
                "subcategoria": "Antiinflamatorios",
                "laboratorio": "INTI",
                "forma_farmaceutica": "tableta",
                "concentracion": "50 mg",
                "presentacion": "Caja x 20 tabletas",
                "unidad_medida": "caja",
                "precio_compra": 6.70,
                "precio_venta": 14.20,
                "stock_minimo": 16,
                "requiere_receta": False,
                "es_controlado": False,
                "descripcion": "Antiinflamatorio para dolor muscular y articular.",
                "imagen": "diclofenaco-inti.svg",
            },
            {
                "sku": "BOL-VITA-VITC1000",
                "nombre_comercial": "Vitamina C VITA 1000 mg",
                "nombre_generico": "Acido ascorbico",
                "categoria": "Suplementos",
                "subcategoria": "Vitaminas",
                "laboratorio": "VITA",
                "forma_farmaceutica": "tableta",
                "concentracion": "1000 mg",
                "presentacion": "Frasco x 60 tabletas",
                "unidad_medida": "frasco",
                "precio_compra": 13.80,
                "precio_venta": 28.50,
                "stock_minimo": 10,
                "requiere_receta": False,
                "es_controlado": False,
                "descripcion": "Suplemento para apoyo inmune.",
                "imagen": "vitamina-c-vita.svg",
            },
            {
                "sku": "BOL-COFAR-CREMA60",
                "nombre_comercial": "Crema Dermoprotectora COFAR",
                "nombre_generico": "Crema hidratante",
                "categoria": "Cuidado Personal",
                "subcategoria": "Dermocuidado",
                "laboratorio": "COFAR",
                "forma_farmaceutica": "crema",
                "concentracion": "60 g",
                "presentacion": "Tubo x 60 g",
                "unidad_medida": "unidad",
                "precio_compra": 12.00,
                "precio_venta": 24.90,
                "stock_minimo": 12,
                "requiere_receta": False,
                "es_controlado": False,
                "descripcion": "Crema de cuidado diario para piel sensible.",
                "imagen": "crema-cofar.svg",
            },
            {
                "sku": "BOL-IFA-CIPRO500",
                "nombre_comercial": "Ciprofloxacino IFA 500 mg",
                "nombre_generico": "Ciprofloxacino",
                "categoria": "Medicamentos",
                "subcategoria": "Antibioticos",
                "laboratorio": "IFA",
                "forma_farmaceutica": "tableta",
                "concentracion": "500 mg",
                "presentacion": "Caja x 10 tabletas",
                "unidad_medida": "caja",
                "precio_compra": 11.50,
                "precio_venta": 24.90,
                "stock_minimo": 15,
                "requiere_receta": True,
                "es_controlado": False,
                "descripcion": "Fluoroquinolona para infecciones bacterianas.",
                "imagen": "ciprofloxacino-ifa.svg",
            },
            {
                "sku": "BOL-LAFAR-RANTHI150",
                "nombre_comercial": "Ranitidina LAFAR 150 mg",
                "nombre_generico": "Ranitidina",
                "categoria": "Medicamentos",
                "subcategoria": "Gastrointestinal",
                "laboratorio": "LAFAR",
                "forma_farmaceutica": "tableta",
                "concentracion": "150 mg",
                "presentacion": "Caja x 20 tabletas",
                "unidad_medida": "caja",
                "precio_compra": 6.85,
                "precio_venta": 14.50,
                "stock_minimo": 18,
                "requiere_receta": False,
                "es_controlado": False,
                "descripcion": "Antagonista H2 para acidez y esofagitis.",
                "imagen": "ranitidina-lafar.svg",
            },
            {
                "sku": "BOL-VITA-METFOR500",
                "nombre_comercial": "Metformina VITA 500 mg",
                "nombre_generico": "Metformina",
                "categoria": "Medicamentos",
                "subcategoria": "Otros",
                "laboratorio": "VITA",
                "forma_farmaceutica": "tableta",
                "concentracion": "500 mg",
                "presentacion": "Caja x 30 tabletas",
                "unidad_medida": "caja",
                "precio_compra": 5.50,
                "precio_venta": 11.90,
                "stock_minimo": 20,
                "requiere_receta": True,
                "es_controlado": False,
                "descripcion": "Antidiabetico oral para control glucemico.",
                "imagen": "metformina-vita.svg",
            },
            {
                "sku": "BOL-INTI-NAPA500",
                "nombre_comercial": "Naprosodeno INTI 500 mg",
                "nombre_generico": "Naproxeno sodico",
                "categoria": "Medicamentos",
                "subcategoria": "Antiinflamatorios",
                "laboratorio": "INTI",
                "forma_farmaceutica": "tableta",
                "concentracion": "500 mg",
                "presentacion": "Caja x 15 tabletas",
                "unidad_medida": "caja",
                "precio_compra": 7.20,
                "precio_venta": 15.90,
                "stock_minimo": 16,
                "requiere_receta": False,
                "es_controlado": False,
                "descripcion": "AINE para dolor e inflamacion prolongada.",
                "imagen": "naproxeno-inti.svg",
            },
            {
                "sku": "BOL-COFAR-VITB12",
                "nombre_comercial": "Vitamina B12 COFAR 1000 mcg",
                "nombre_generico": "Cianocobalamina",
                "categoria": "Suplementos",
                "subcategoria": "Vitaminas",
                "laboratorio": "COFAR",
                "forma_farmaceutica": "inyectable",
                "concentracion": "1000 mcg",
                "presentacion": "Caja x 3 inyecciones",
                "unidad_medida": "caja",
                "precio_compra": 15.40,
                "precio_venta": 32.90,
                "stock_minimo": 8,
                "requiere_receta": False,
                "es_controlado": False,
                "descripcion": "Suplemento para energia y metabolismo.",
                "imagen": "vitamina-b12-cofar.svg",
            },
            {
                "sku": "BOL-LAFAR-CETRIZ10",
                "nombre_comercial": "Cetirizina LAFAR 10 mg",
                "nombre_generico": "Cetirizina",
                "categoria": "Medicamentos",
                "subcategoria": "Antialergicos",
                "laboratorio": "LAFAR",
                "forma_farmaceutica": "tableta",
                "concentracion": "10 mg",
                "presentacion": "Caja x 14 tabletas",
                "unidad_medida": "caja",
                "precio_compra": 5.80,
                "precio_venta": 12.50,
                "stock_minimo": 16,
                "requiere_receta": False,
                "es_controlado": False,
                "descripcion": "Antihistaminico para alergias y urticaria.",
                "imagen": "cetirizina-lafar.svg",
            },
            {
                "sku": "BOL-IFA-DOLO",
                "nombre_comercial": "Dolo PLUS IFA",
                "nombre_generico": "Paracetamol + Cafeina",
                "categoria": "Medicamentos",
                "subcategoria": "Analgesicos",
                "laboratorio": "IFA",
                "forma_farmaceutica": "tableta",
                "concentracion": "500 mg + 65 mg",
                "presentacion": "Caja x 20 tabletas",
                "unidad_medida": "caja",
                "precio_compra": 5.40,
                "precio_venta": 11.50,
                "stock_minimo": 22,
                "requiere_receta": False,
                "es_controlado": False,
                "descripcion": "Analgesico combinado de rapida accion.",
                "imagen": "dolo-plus-ifa.svg",
            },
            {
                "sku": "BOL-VITA-MULTI",
                "nombre_comercial": "Complejo Vitamínico VITA",
                "nombre_generico": "Complejo multivitaminico",
                "categoria": "Suplementos",
                "subcategoria": "Vitaminas",
                "laboratorio": "VITA",
                "forma_farmaceutica": "capsula",
                "concentracion": "Complejo",
                "presentacion": "Frasco x 60 capsulas",
                "unidad_medida": "frasco",
                "precio_compra": 14.20,
                "precio_venta": 29.90,
                "stock_minimo": 10,
                "requiere_receta": False,
                "es_controlado": False,
                "descripcion": "Suplemento multivitaminico completo.",
                "imagen": "complejo-vita.svg",
            },
            {
                "sku": "BOL-INTI-LOCAT100",
                "nombre_comercial": "Loción Corporal INTI",
                "nombre_generico": "Locion hidratante",
                "categoria": "Cuidado Personal",
                "subcategoria": "Dermocuidado",
                "laboratorio": "INTI",
                "forma_farmaceutica": "locion",
                "concentracion": "100 ml",
                "presentacion": "Botella x 100 ml",
                "unidad_medida": "botella",
                "precio_compra": 10.50,
                "precio_venta": 22.50,
                "stock_minimo": 10,
                "requiere_receta": False,
                "es_controlado": False,
                "descripcion": "Locion corporal para piel seca.",
                "imagen": "locion-inti.svg",
            },
            {
                "sku": "BOL-COFAR-ESPARADRAPO",
                "nombre_comercial": "Esparadrapo COFAR 5m x 2cm",
                "nombre_generico": "Cinta adhesiva",
                "categoria": "Dispositivos",
                "subcategoria": None,
                "laboratorio": "COFAR",
                "forma_farmaceutica": "cinta",
                "concentracion": "5m",
                "presentacion": "Rollo 5m x 2cm",
                "unidad_medida": "rollo",
                "precio_compra": 2.30,
                "precio_venta": 4.90,
                "stock_minimo": 30,
                "requiere_receta": False,
                "es_controlado": False,
                "descripcion": "Cinta adhesiva para sujeciones medicas.",
                "imagen": "esparadrapo-cofar.svg",
            },
        ]

        productos_creados = []
        for prod_data in productos_data:
            categoria = Categoria.objects.get(nombre=prod_data["categoria"])
            subcategoria = None
            subcategoria_nombre = prod_data.get("subcategoria")
            if subcategoria_nombre:
                subcategoria = Subcategoria.objects.get(categoria=categoria, nombre=subcategoria_nombre)
            laboratorio = Laboratorio.objects.get(nombre=prod_data["laboratorio"])

            producto, created = Producto.objects.update_or_create(
                sku=prod_data["sku"],
                defaults={
                    "nombre_comercial": prod_data["nombre_comercial"],
                    "nombre_generico": prod_data["nombre_generico"],
                    "categoria": categoria,
                    "subcategoria": subcategoria,
                    "laboratorio": laboratorio,
                    "forma_farmaceutica": prod_data["forma_farmaceutica"],
                    "concentracion": prod_data["concentracion"],
                    "presentacion": prod_data["presentacion"],
                    "unidad_medida": prod_data["unidad_medida"],
                    "precio_compra": Decimal(str(prod_data["precio_compra"])),
                    "precio_venta": Decimal(str(prod_data["precio_venta"])),
                    "stock_minimo": prod_data["stock_minimo"],
                    "requiere_receta": prod_data["requiere_receta"],
                    "es_controlado": prod_data["es_controlado"],
                    "descripcion": prod_data["descripcion"],
                    "estado": True,
                }
            )
            self._attach_image_if_exists(producto, prod_data.get("imagen"))

            if created:
                self.stdout.write(f"  + Producto creado: {producto.nombre_comercial} ({producto.sku})")
                productos_creados.append(producto)
            else:
                self.stdout.write(f"  * Producto actualizado: {producto.nombre_comercial} ({producto.sku})")

        # 4. Inventario y movimientos (si no existen)
        admin_user = User.objects.filter(is_superuser=True).first()
        if not admin_user:
            admin_user = User.objects.create_superuser("admin", "admin@example.com", "admin123")
            self.stdout.write("  ! Usuario admin creado para seed (admin/admin123)")

        for producto in Producto.objects.filter(sku__startswith="BOL-"):
            inventario, _ = Inventario.objects.get_or_create(producto=producto)

            if inventario.stock_actual == 0:
                cantidad_entrada = randint(50, 200)
                MovimientoInventario.objects.create(
                    producto=producto,
                    tipo_movimiento="entrada",
                    cantidad=cantidad_entrada,
                    motivo="compra",
                    referencia=f"FACT-{randint(1000, 9999)}",
                    usuario=admin_user,
                    observacion="Stock inicial por seed de catalogo boliviano",
                )
                self.stdout.write(f"  + Stock inicial para {producto.nombre_comercial}: +{cantidad_entrada}")

        # 5. Crear un par de movimientos de salida para algunos productos
        for producto in Producto.objects.filter(sku__startswith="BOL-")[:3]:
            if producto.inventario.stock_actual > 10:
                cantidad_salida = randint(5, 20)
                MovimientoInventario.objects.create(
                    producto=producto,
                    tipo_movimiento="salida",
                    cantidad=cantidad_salida,
                    motivo="venta",
                    referencia=f"VENTA-{randint(100, 999)}",
                    usuario=admin_user,
                    observacion="Venta de prueba",
                )
                self.stdout.write(f"  - Venta de prueba para {producto.nombre_comercial}: -{cantidad_salida}")

        self.stdout.write(self.style.SUCCESS("Catalogo boliviano sembrado correctamente."))