from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.views.decorators.csrf import csrf_exempt
from .services import SalesDataService
from .ml_model import SalesPredictor
from inventarios.models import Producto, Inventario
from ventas.models import DetalleVenta
from django.db.models import Sum
from django.db.models.functions import ExtractMonth
from django.utils import timezone
from datetime import timedelta
import pandas as pd
import numpy as np
import traceback       # ← para depurar errores del modelo

predictor = SalesPredictor()
predictor.load_model()

@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def predecir_demanda(request):
    producto_id = request.data.get('producto_id')
    dias = request.data.get('dias', 7)
    if not producto_id:
        return Response({"error": "Se requiere producto_id"}, status=400)
    
    df_hist = SalesDataService.get_training_data(producto_id=producto_id)
    if df_hist.empty:
        return Response({"error": "No hay datos históricos para este producto"}, status=400)
    
    ultima_fecha = df_hist['fecha'].max()
    fechas_futuras = [ultima_fecha + timedelta(days=i+1) for i in range(dias)]
    
    future_data = []
    for fecha in fechas_futuras:
        ultimos_7 = df_hist[df_hist['fecha'] >= ultima_fecha - timedelta(days=7)]
        lag1 = ultimos_7['unidades'].iloc[-1] if len(ultimos_7) > 0 else 0
        lag7 = ultimos_7['unidades'].iloc[-7] if len(ultimos_7) >= 7 else lag1
        promedio_movil = ultimos_7['unidades'].mean() if len(ultimos_7) > 0 else 0
        ultimos_30 = df_hist[df_hist['fecha'] >= ultima_fecha - timedelta(days=30)]
        if len(ultimos_30) > 1:
            x = np.arange(len(ultimos_30))
            y = ultimos_30['unidades'].values
            tendencia = np.polyfit(x, y, 1)[0]
        else:
            tendencia = 0
        future_data.append({
            'fecha': fecha,
            'producto_id': producto_id,
            'dia_semana': fecha.weekday(),
            'mes': fecha.month,
            'fin_semana': 1 if fecha.weekday() >= 5 else 0,
            'estacion': ((fecha.month % 12) // 3),
            'promedio_movil_7': promedio_movil,
            'tendencia': tendencia,
            'unidades_lag1': lag1,
            'unidades_lag7': lag7
        })
    
        df_future = pd.DataFrame(future_data)

    try:
        predicciones = predictor.predict(producto_id, df_future)
        modelo_activo = True
    except Exception as e:
        # Si el modelo falla, generamos una predicción simulada basada en el promedio
        # y la tendencia de los datos históricos recientes
        print(f"Error en predicción (usando simulación): {e}")
        traceback.print_exc()
        modelo_activo = False

        # Calcular promedio y desviación de los últimos 7 días
        ultimos_7_df = df_hist[df_hist['fecha'] >= ultima_fecha - timedelta(days=7)]
        if not ultimos_7_df.empty:
            media_base = ultimos_7_df['unidades'].mean()
            desviacion = ultimos_7_df['unidades'].std()
        else:
            media_base = df_hist['unidades'].mean()
            desviacion = df_hist['unidades'].std()

        if pd.isna(desviacion) or desviacion == 0:
            desviacion = media_base * 0.1  # 10% de variación si no hay desviación

        # Generar predicciones con tendencia y algo de ruido
        predicciones = []
        tendencia_diaria = df_future['tendencia'].values[0] if not df_future.empty else 0
        
        for i in range(dias):
            # Base: media + tendencia + ruido aleatorio
            valor = media_base + (tendencia_diaria * i) + np.random.normal(0, desviacion * 0.3)
            valor = max(0, valor)  # No puede ser negativo
            predicciones.append(valor)

    predicciones_list = [
        {"fecha": df_future.iloc[i]['fecha'].date(), "unidades": round(float(pred), 2)}
        for i, pred in enumerate(predicciones)
    ]

    try:
        inventario = Inventario.objects.select_related('producto').get(producto_id=producto_id)
        stock_actual = inventario.stock_actual
        stock_minimo = inventario.stock_minimo or inventario.producto.stock_minimo or 0
    except Inventario.DoesNotExist:
        stock_actual = None
        stock_minimo = None

    media_historica = df_hist['unidades'].mean()
    prediccion_diaria = float(np.mean(predicciones)) if len(predicciones) else 0.0
    cobertura_dias = None
    alerta_predictiva = None
    if stock_actual is not None and prediccion_diaria > 0:
        cobertura_dias = float(stock_actual / prediccion_diaria)
        variacion_demanda = 0.0
        if media_historica > 0:
            variacion_demanda = round(((prediccion_diaria - media_historica) / media_historica) * 100, 1)

        if cobertura_dias <= 5:
            nivel = "Crítica"
            color = "rojo"
            condicion = "El stock se agotará antes de que llegue el proveedor."
            accion = f"Desabastecimiento inminente en {max(1, int(round(cobertura_dias)))} días. Crear orden de compra urgente."
        elif cobertura_dias <= 10:
            nivel = "Preventiva"
            color = "amarillo"
            condicion = "El stock está justo en el límite para hacer el pedido a tiempo."
            if variacion_demanda > 0:
                accion = f"Sugerencia de reabastecimiento. La demanda subirá un {abs(variacion_demanda)}% la próxima semana."
            else:
                accion = "Sugerencia de reabastecimiento. La demanda se mantiene estable, pero la cobertura es limitada."
        else:
            nivel = "Estable"
            color = "verde"
            condicion = "Stock suficiente para cubrir la demanda proyectada."
            accion = "Inventario óptimo."

        alerta_predictiva = {
            "nivel": nivel,
            "color": color,
            "condicion": condicion,
            "accion": accion,
            "stock_actual": stock_actual,
            "stock_minimo": stock_minimo,
            "cobertura_dias": round(cobertura_dias, 1),
            "prediccion_diaria": round(prediccion_diaria, 2),
            "variacion_demanda": round(variacion_demanda, 1),
        }

    tendencia_valor = df_future['tendencia'].iloc[-1] if not df_future.empty else 0
    if tendencia_valor > 0.5:
        tendencia = "creciente"
    elif tendencia_valor < -0.5:
        tendencia = "decreciente"
    else:
        tendencia = "estable"

    if np.array(predicciones).mean() > media_historica * 1.2:
        estacionalidad = "temporada_alta"
    elif np.array(predicciones).mean() < media_historica * 0.8:
        estacionalidad = "temporada_baja"
    else:
        estacionalidad = "normal"

    respuesta = {
        "producto_id": producto_id,
        "predicciones": predicciones_list,
        "tendencia": tendencia,
        "estacionalidad": estacionalidad,
        "alerta_predictiva": alerta_predictiva,
    }
    if not modelo_activo:
        respuesta["aviso"] = "Predicción simulada (modelo IA no disponible)"
    return Response(respuesta)


@api_view(['GET'])
@permission_classes([AllowAny])
@csrf_exempt
def recomendaciones_compra(request):
    recomendaciones = []
    inventarios = Inventario.objects.select_related('producto').filter(producto__estado=True)
    for inv in inventarios:
        df_hist = SalesDataService.get_daily_sales(producto_id=inv.producto.id, months_back=1)
        if not df_hist.empty:
            ultimos_7 = df_hist.nlargest(7, 'fecha')
            prediccion_semana = ultimos_7['unidades'].mean()
        else:
            prediccion_semana = 0
        stock_actual = inv.stock_actual
        stock_minimo = inv.stock_minimo or inv.producto.stock_minimo
        if stock_actual < (prediccion_semana + stock_minimo):
            cantidad_necesaria = int(prediccion_semana + stock_minimo - stock_actual)
            urgencia = "alta" if stock_actual <= stock_minimo else "media" if stock_actual <= prediccion_semana else "baja"
            recomendaciones.append({
                "producto_id": inv.producto.id,
                "nombre_producto": inv.producto.nombre_comercial,
                "stock_actual": stock_actual,
                "stock_minimo": stock_minimo,
                "prediccion_semana": round(prediccion_semana, 2),
                "cantidad_recomendada": cantidad_necesaria,
                "urgencia": urgencia,
            })
    return Response(recomendaciones)


@api_view(['GET'])
@permission_classes([AllowAny])
@csrf_exempt
def tendencias_consumo(request):
    hoy = timezone.now().date()
    periodo1_inicio = hoy - timedelta(days=60)
    periodo1_fin = hoy - timedelta(days=31)
    periodo2_inicio = hoy - timedelta(days=30)
    periodo2_fin = hoy

    def get_avg_sales(producto_id, start, end):
        total = DetalleVenta.objects.filter(
            producto_id=producto_id,
            venta__estado__in=['pagada', 'entregada'],
            venta__created_at__date__range=[start, end]
        ).aggregate(total=Sum('cantidad'))['total'] or 0
        return total / 30

    productos = Producto.objects.filter(estado=True)
    tendencias = []
    for prod in productos:
        avg1 = get_avg_sales(prod.id, periodo1_inicio, periodo1_fin)
        avg2 = get_avg_sales(prod.id, periodo2_inicio, periodo2_fin)
        if avg1 > 0:
            cambio = (avg2 - avg1) / avg1 * 100
        else:
            cambio = 0 if avg2 == 0 else 100
        if abs(cambio) >= 10:
            tendencias.append({
                "producto_id": prod.id,
                "nombre_producto": prod.nombre_comercial,
                "ventas_promedio_anterior": round(avg1, 2),
                "ventas_promedio_actual": round(avg2, 2),
                "variacion_porcentual": round(cambio, 1),
                "tendencia": "creciente" if cambio > 0 else "decreciente"
            })
    return Response(tendencias)


@api_view(['GET'])
@permission_classes([AllowAny])
@csrf_exempt
def patrones_estacionales(request):
    ventas_por_mes = DetalleVenta.objects.filter(
        venta__estado__in=['pagada', 'entregada'],
        venta__created_at__gte=timezone.now() - timedelta(days=365)
    ).values(
        'producto__categoria__nombre',
        mes=ExtractMonth('venta__created_at')
    ).annotate(
        total_vendido=Sum('cantidad')
    ).order_by('producto__categoria__nombre', 'mes')

    from collections import defaultdict
    resumen = defaultdict(lambda: {'total_anual': 0, 'meses': []})
    for item in ventas_por_mes:
        cat = item['producto__categoria__nombre'] or "Sin categoría"
        mes = item['mes']
        total = item['total_vendido']
        resumen[cat]['meses'].append((mes, total))
        resumen[cat]['total_anual'] += total

    resultado = []
    for cat, data in resumen.items():
        promedio_mensual = data['total_anual'] / 12 if data['total_anual'] else 1
        for mes, total in data['meses']:
            porcentaje = (total / promedio_mensual) * 100 if promedio_mensual else 0
            resultado.append({
                "categoria_nombre": cat,
                "mes": mes,
                "promedio_ventas": float(total),
                "porcentaje_vs_anual": round(porcentaje, 1)
            })
    return Response(resultado)