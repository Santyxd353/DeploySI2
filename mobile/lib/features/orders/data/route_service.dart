import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

/// Obtiene la ruta de conducción entre dos puntos usando OSRM (gratuito, sin API key).
/// Cubre Bolivia correctamente. Devuelve lista vacía si falla o no hay conexión.
class RouteService {
  static const _osrmBase = 'http://router.project-osrm.org';
  static const _threshold = 200.0; // metros mínimos para re-calcular ruta

  /// Calcula si vale la pena re-fetchear según distancia recorrida desde último cálculo.
  static bool debeActualizar(LatLng nueva, LatLng? ultima) {
    if (ultima == null) return true;
    return const Distance()(nueva, ultima) > _threshold;
  }

  /// Devuelve true si el estado del pedido requiere mostrar ruta.
  static bool estadoRequiereRuta(String estado) =>
      estado == 'en_camino' || estado == 'cerca';

  /// Llama a OSRM y retorna la lista de puntos de la ruta conducida.
  /// Retorna [] silenciosamente en caso de error.
  static Future<List<LatLng>> fetchRuta(LatLng desde, LatLng hasta) async {
    try {
      final uri = Uri.parse(
        '$_osrmBase/route/v1/driving/'
        '${desde.longitude},${desde.latitude};'
        '${hasta.longitude},${hasta.latitude}'
        '?overview=full&geometries=geojson',
      );
      final resp = await http
          .get(uri, headers: {'User-Agent': 'FarmaciaBibosi/1.0'})
          .timeout(const Duration(seconds: 8));

      if (resp.statusCode != 200) return [];

      final data = jsonDecode(resp.body) as Map<String, dynamic>;
      final routes = data['routes'] as List?;
      if (routes == null || routes.isEmpty) return [];

      final geometry = routes[0]['geometry'] as Map<String, dynamic>;
      final coords = geometry['coordinates'] as List;

      // GeoJSON usa [lon, lat] — invertimos a LatLng(lat, lon)
      return coords
          .map((c) => LatLng(
                (c[1] as num).toDouble(),
                (c[0] as num).toDouble(),
              ))
          .toList();
    } catch (_) {
      return [];
    }
  }

  /// Distancia en km y tiempo estimado a partir de la respuesta OSRM.
  static Future<({double km, int minutos})?> fetchInfo(
      LatLng desde, LatLng hasta) async {
    try {
      final uri = Uri.parse(
        '$_osrmBase/route/v1/driving/'
        '${desde.longitude},${desde.latitude};'
        '${hasta.longitude},${hasta.latitude}'
        '?overview=false',
      );
      final resp = await http
          .get(uri, headers: {'User-Agent': 'FarmaciaBibosi/1.0'})
          .timeout(const Duration(seconds: 8));

      if (resp.statusCode != 200) return null;

      final data = jsonDecode(resp.body) as Map<String, dynamic>;
      final routes = data['routes'] as List?;
      if (routes == null || routes.isEmpty) return null;

      final distM = (routes[0]['distance'] as num).toDouble();
      final durS = (routes[0]['duration'] as num).toDouble();

      return (km: distM / 1000, minutos: (durS / 60).ceil());
    } catch (_) {
      return null;
    }
  }
}
