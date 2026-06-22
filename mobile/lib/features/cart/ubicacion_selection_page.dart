import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

/// Retorna `{'lat': double, 'lon': double, 'direccion': String}` o null si cancela.
class UbicacionSelectionPage extends StatefulWidget {
  const UbicacionSelectionPage({super.key});

  @override
  State<UbicacionSelectionPage> createState() => _UbicacionSelectionPageState();
}

class _UbicacionSelectionPageState extends State<UbicacionSelectionPage> {
  // Centro de Santa Cruz de la Sierra, Bolivia
  static const _scz = LatLng(-17.7833, -63.1821);

  final _mapController = MapController();

  LatLng _center = _scz;
  String _addressText = 'Mueve el mapa para elegir el punto de entrega';
  bool _geocoding = false;
  bool _gettingGps = false;
  Timer? _debounceTimer;

  @override
  void initState() {
    super.initState();
    // Geocodificar el punto inicial
    _geocodeAddress(_scz);
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _mapController.dispose();
    super.dispose();
  }

  // ── Geocodificación inversa ───────────────────────────────────────────────────

  void _onMapMoved(LatLng center) {
    setState(() {
      _center = center;
      _addressText = 'Buscando dirección...';
      _geocoding = true;
    });
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 700), () {
      _geocodeAddress(center);
    });
  }

  Future<void> _geocodeAddress(LatLng pos) async {
    try {
      final uri = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse'
        '?lat=${pos.latitude}&lon=${pos.longitude}'
        '&format=json&accept-language=es&zoom=18',
      );
      final resp = await http
          .get(uri, headers: {'User-Agent': 'FarmaciaBibosi/1.0'})
          .timeout(const Duration(seconds: 6));

      if (!mounted) return;

      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body) as Map<String, dynamic>;
        final address = data['address'] as Map<String, dynamic>? ?? {};

        final road = (address['road'] ??
                address['pedestrian'] ??
                address['path'] ??
                address['footway'] ??
                '') as String;
        final suburb = (address['suburb'] ??
                address['neighbourhood'] ??
                address['quarter'] ??
                '') as String;
        final city = (address['city'] ??
                address['town'] ??
                address['municipality'] ??
                'Santa Cruz de la Sierra') as String;

        final parts = [road, suburb, city].where((s) => s.isNotEmpty).toList();
        final text = parts.isNotEmpty ? parts.join(', ') : (data['display_name'] as String? ?? 'Dirección seleccionada');

        setState(() {
          _addressText = text;
          _geocoding = false;
        });
      } else {
        setState(() {
          _addressText = 'Dirección seleccionada';
          _geocoding = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _addressText = 'Sin conexión — dirección no resuelta';
          _geocoding = false;
        });
      }
    }
  }

  // ── GPS ───────────────────────────────────────────────────────────────────────

  Future<void> _usarMiUbicacion() async {
    setState(() => _gettingGps = true);
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Permiso de ubicación denegado. Mueve el mapa manualmente.'),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );

      if (!mounted) return;
      final latLng = LatLng(pos.latitude, pos.longitude);
      _mapController.move(latLng, 16);
      setState(() => _center = latLng);
      _geocodeAddress(latLng);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No se pudo obtener tu ubicación.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _gettingGps = false);
    }
  }

  // ── Confirmar ─────────────────────────────────────────────────────────────────

  void _confirmar() {
    Navigator.of(context).pop({
      'lat': _center.latitude,
      'lon': _center.longitude,
      'direccion': _addressText,
    });
  }

  // ── UI ────────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAF9),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF191C1C)),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          '¿Dónde entregamos?',
          style: GoogleFonts.manrope(
            fontWeight: FontWeight.w800,
            fontSize: 18,
            color: const Color(0xFF191C1C),
          ),
        ),
        centerTitle: false,
      ),
      body: Column(
        children: [
          // ── Mapa con pin central ──────────────────────────────────────────────
          Expanded(
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: _scz,
                    initialZoom: 14,
                    onPositionChanged: (position, hasGesture) {
                      if (hasGesture) _onMapMoved(position.center);
                    },
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.farmacia.bibosi',
                    ),
                  ],
                ),

                // Pin fijo en el centro (el mapa se mueve debajo)
                IgnorePointer(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Sombra del pin
                        Container(
                          width: 14,
                          height: 14,
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.2),
                            shape: BoxShape.circle,
                          ),
                        ),
                        Transform.translate(
                          offset: const Offset(0, -7),
                          child: const Icon(
                            Icons.location_on_rounded,
                            color: Color(0xFFBA1A1A),
                            size: 46,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Botón "Mi ubicación" (esquina inferior derecha)
                Positioned(
                  bottom: 16,
                  right: 16,
                  child: FloatingActionButton.small(
                    onPressed: _gettingGps ? null : _usarMiUbicacion,
                    backgroundColor: Colors.white,
                    foregroundColor: const Color(0xFF006A5E),
                    elevation: 4,
                    tooltip: 'Usar mi ubicación',
                    child: _gettingGps
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Color(0xFF006A5E),
                            ),
                          )
                        : const Icon(Icons.my_location_rounded),
                  ),
                ),

                // Instrucción overlay superior
                Positioned(
                  top: 12,
                  left: 16,
                  right: 16,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 8,
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.touch_app_rounded, size: 16, color: Color(0xFF006A5E)),
                        const SizedBox(width: 8),
                        Text(
                          'Mueve el mapa para colocar el pin',
                          style: GoogleFonts.manrope(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF3E4946),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // ── Card inferior con dirección + botón ───────────────────────────────
          Container(
            width: double.infinity,
            padding: EdgeInsets.fromLTRB(
              20, 20, 20, MediaQuery.of(context).padding.bottom + 20,
            ),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.06),
                  blurRadius: 20,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Dirección resuelta
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFEBEE),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.location_on_rounded,
                        color: Color(0xFFBA1A1A),
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Punto de entrega',
                            style: GoogleFonts.manrope(
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                              color: const Color(0xFF6F7977),
                            ),
                          ),
                          const SizedBox(height: 2),
                          if (_geocoding)
                            Row(
                              children: [
                                const SizedBox(
                                  width: 12,
                                  height: 12,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 1.5,
                                    color: Color(0xFF006A5E),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Buscando dirección...',
                                  style: GoogleFonts.manrope(
                                    color: const Color(0xFF6F7977),
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            )
                          else
                            Text(
                              _addressText,
                              style: GoogleFonts.manrope(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                                color: const Color(0xFF191C1C),
                              ),
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                            ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 18),

                // Coordenadas (info extra)
                Text(
                  '${_center.latitude.toStringAsFixed(5)}, ${_center.longitude.toStringAsFixed(5)}',
                  style: const TextStyle(
                    color: Color(0xFFBDC9C5),
                    fontSize: 11,
                    fontFamily: 'monospace',
                  ),
                ),

                const SizedBox(height: 14),

                // Botón confirmar
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton.icon(
                    onPressed: _geocoding ? null : _confirmar,
                    icon: const Icon(Icons.check_circle_rounded, size: 20),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF006A5E),
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: const Color(0xFFE0E3E1),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    label: Text(
                      'Confirmar punto de entrega',
                      style: GoogleFonts.manrope(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
