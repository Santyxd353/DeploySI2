import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../cart/data/cart_service.dart';
import '../../core/auth/auth_session_manager.dart';

class ProductDetailsPage extends StatefulWidget {
  final Map<String, dynamic> producto;

  const ProductDetailsPage({super.key, required this.producto});

  @override
  State<ProductDetailsPage> createState() => _ProductDetailsPageState();
}

class _ProductDetailsPageState extends State<ProductDetailsPage> {
  int _cantidad = 1;
  bool _isLoading = false;
  final CartService _cartService = CartService();

  @override
  Widget build(BuildContext context) {
    final p = widget.producto;
    final int stock = p['inventario']?['stock_disponible'] ?? 0;
    final bool hasStock = stock > 0;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF191C1C), size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        centerTitle: true,
        title: Text(
          'Detalle del Producto',
          style: GoogleFonts.manrope(color: const Color(0xFF191C1C), fontWeight: FontWeight.w700, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.favorite_border, color: Color(0xFF191C1C)),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.share_outlined, color: Color(0xFF191C1C)),
            onPressed: () {},
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.only(bottom: 24),
              children: [
                // 1. Imagen Protagonista (Hero) con fondo suave
                Container(
                  width: double.infinity,
                  height: 280,
                  margin: const EdgeInsets.fromLTRB(20, 10, 20, 24),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAF9), // Fondo suave
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Stack(
                    children: [
                      Center(
                        child: Padding(
                          padding: const EdgeInsets.all(30),
                          child: p['imagen'] != null
                              ? Image.network(
                                  p['imagen'],
                                  fit: BoxFit.contain,
                                  errorBuilder: (context, error, stackTrace) => const Icon(
                                    Icons.image_not_supported,
                                    size: 80,
                                    color: Color(0xFFBDC9C5),
                                  ),
                                )
                              : const Icon(Icons.medication, size: 80, color: Color(0xFFBDC9C5)),
                        ),
                      ),
                      if (!hasStock)
                        Positioned(
                          top: 16,
                          left: 16,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(color: const Color(0xFFBA1A1A), borderRadius: BorderRadius.circular(8)),
                            child: const Text('Agotado', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                          ),
                        ),
                    ],
                  ),
                ),

                // 2. Información del Producto
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Etiqueta de Laboratorio estilo "Píldora"
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEAF8F4), // Verde muy clarito
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          (p['laboratorio_nombre'] ?? 'GENÉRICO').toString().toUpperCase(),
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF006A5E), letterSpacing: 0.5),
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Título del Producto
                      Text(
                        p['nombre_comercial'] ?? 'Producto sin nombre',
                        style: GoogleFonts.manrope(fontSize: 26, fontWeight: FontWeight.w800, color: const Color(0xFF191C1C), height: 1.2),
                      ),
                      const SizedBox(height: 16),

                      // Precio y Unidad
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text(
                            'Bs ${p['precio_venta']}',
                            style: GoogleFonts.manrope(fontSize: 34, fontWeight: FontWeight.w800, color: const Color(0xFF006A5E)),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '/ ${p['unidad_medida'] ?? 'unidad'}',
                            style: const TextStyle(fontSize: 14, color: Color(0xFF6F7977), fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      
                      const Divider(color: Color(0xFFF0F2F1), thickness: 1.5),
                      const SizedBox(height: 24),

                      // Descripción
                      const Text(
                        'Descripción del producto',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF191C1C)),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        (p['descripcion']?.toString().isEmpty ?? true) 
                            ? 'No hay descripción detallada disponible para este producto en este momento.' 
                            : p['descripcion'],
                        style: const TextStyle(fontSize: 15, height: 1.6, color: Color(0xFF3E4946)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          
          // 3. Barra Inferior de Acción (Premium)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 20, offset: const Offset(0, -5))],
            ),
            child: SafeArea(
              child: Row(
                children: [
                  // Selector de Cantidad
                  Container(
                    height: 54,
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xFFE0E3E1)),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove, size: 20),
                          onPressed: _cantidad > 1 ? () => setState(() => _cantidad--) : null,
                          color: const Color(0xFF006A5E),
                        ),
                        SizedBox(
                          width: 30,
                          child: Text(
                            '$_cantidad', 
                            textAlign: TextAlign.center,
                            style: GoogleFonts.manrope(fontSize: 18, fontWeight: FontWeight.w700)
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add, size: 20),
                          onPressed: (hasStock && _cantidad < stock) ? () => setState(() => _cantidad++) : null,
                          color: const Color(0xFF006A5E),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  
                  // Botón Agregar al Carrito
                  Expanded(
                    child: SizedBox(
                      height: 54,
                      child: ElevatedButton(
                        onPressed: hasStock && !_isLoading ? () async {
                          setState(() => _isLoading = true);
                          
                          try {
                            final accessToken = await AuthSessionManager.getAccessToken();
                            
                            // Si accessToken es null se trabaja como invitado.
                            // CartService guarda y envía X-Carrito-Token automáticamente.
                            if (accessToken != null && accessToken.isNotEmpty) {
                              print('Token de acceso: ${accessToken.substring(0, 10)}...');
                            } else {
                              print('Compra como invitado: sin access token');
                            }
                            print('Producto ID: ${p['id']}, Cantidad: $_cantidad');
                            
                            final result = await _cartService.agregarItem(
                              productoId: p['id'],
                              cantidad: _cantidad,
                              accessToken: accessToken,
                            );
                            
                            print('Respuesta del backend: $result');
                            
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('$_cantidad x ${p['nombre_comercial']} añadidos al carrito ✅'),
                                  backgroundColor: const Color(0xFF006A5E),
                                  behavior: SnackBarBehavior.floating,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                              );
                              Navigator.pop(context);
                            }
                          } catch (e) {
                            print('Error al agregar al carrito: $e');
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Error: ${e.toString()}'),
                                  backgroundColor: const Color(0xFFBA1A1A),
                                  behavior: SnackBarBehavior.floating,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                              );
                            }
                          } finally {
                            if (mounted) {
                              setState(() => _isLoading = false);
                            }
                          }
                        } : null,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF006A5E),
                          disabledBackgroundColor: const Color(0xFFE0E3E1),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 0,
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                ),
                              )
                            : Text(
                                hasStock ? 'Agregar al carrito' : 'Agotado',
                                style: GoogleFonts.manrope(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white),
                              ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}