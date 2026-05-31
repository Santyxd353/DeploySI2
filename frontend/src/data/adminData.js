export const dashboardKpis = [
  { label: "Ventas hoy", value: "Bs 12.430", trend: "+8.2%" },
  { label: "Pedidos pendientes", value: "24", trend: "-3.1%" },
  { label: "Stock critico", value: "17", trend: "+2 alertas" },
  { label: "Clientes activos", value: "1.284", trend: "+5.4%" },
];

export const recentOrders = [
  { id: "ORD-3021", customer: "Ana Rojas", total: "Bs 188.50", status: "Preparando" },
  { id: "ORD-3020", customer: "Carlos Tola", total: "Bs 76.00", status: "Despachado" },
  { id: "ORD-3019", customer: "Lucia Perez", total: "Bs 240.20", status: "Pendiente" },
  { id: "ORD-3018", customer: "Marta Ruiz", total: "Bs 98.30", status: "Entregado" },
];

export const adminProducts = [
  { sku: "MED-001", name: "Ibuprofeno 400mg x20", category: "Medicamentos", stock: 112, price: "Bs 18.50", status: "Activo" },
  { sku: "VIT-010", name: "Multivitaminico x60", category: "Vitaminas", stock: 43, price: "Bs 79.90", status: "Activo" },
  { sku: "DER-027", name: "Protector solar FPS 50", category: "Dermocosmetica", stock: 9, price: "Bs 92.00", status: "Stock bajo" },
  { sku: "HIG-212", name: "Jabon antibacterial 500ml", category: "Higiene", stock: 67, price: "Bs 26.40", status: "Activo" },
  { sku: "BEB-055", name: "Panal talla M x40", category: "Mama y Bebe", stock: 0, price: "Bs 58.90", status: "Sin stock" },
];

export const adminSections = [
  { id: "overview", label: "Resumen", icon: "dashboard", path: "/admin/resumen", requiredPermission: null },
  { id: "products", label: "Productos", icon: "products", path: "/admin/productos", requiredPermission: "productos.ver" },
  { id: "labs", label: "Laboratorios", icon: "products", path: "/admin/laboratorios", requiredPermission: "laboratorios.ver" },
  { id: "categories", label: "Categorias", icon: "products", path: "/admin/categorias", requiredPermission: "categorias.ver" },
  { id: "users", label: "Usuarios", icon: "users", path: "/admin/usuarios", requiredPermission: "usuarios.ver" },
  { id: "pos", label: "POS", icon: "pos", path: "/pos", requiredPermission: "ventas.gestionar" },
  { id: "inventory", label: "Inventario", icon: "inventory", path: "/admin/inventarios", requiredPermission: "inventario.ver" },
  { id: "customers", label: "Clientes", icon: "customers", path: "/admin/clientes", requiredPermission: "clientes.ver" },
  { id: "puntos", label: "Puntos", icon: "spark", path: "/admin/puntos", requiredPermission: "clientes.ver" },
  { id: "treatments", label: "Tratamientos", icon: "products", path: "/admin/tratamientos", requiredPermission: "tratamientos.ver" },
  { id: "reports", label: "Reportes", icon: "reports", path: "/admin/reportes", requiredPermission: "reportes.ver" },
  { id: "bitacora", label: "Bitácora", icon: "reports", path: "/admin/bitacora", requiredPermission: "usuarios.gestionar" },
  { id: "roles-permisos", label: "Roles y permisos", icon: "settings", path: "/admin/roles-permisos", requiredPermission: "usuarios.gestionar" },
  { id: "backups", label: "Backups", icon: "save", path: "/admin/backups", requiredPermission: null },
  { id: "predicciones", label: "Predicciones", icon: "reports", path: "/admin/predicciones", requiredPermission: "predicciones.ver" },
];