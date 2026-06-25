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
import traceback

predictor = SalesPredictor()
predictor.load_model()

# Función auxiliar para obtener estación (misma que en SalesDataService)
def get_estacion(mes):
    if mes in [12, 1, 2]:
        return 0
    elif mes in [3, 4, 5]:
        return 1
    elif mes in [6, 7, 8]:
        return 2
    else:
        return 3

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
    
    # ============ CONSTRUCCIÓN DE FEATURES FUTURAS CON RECURSIÓN ============
    # 1. Datos históricos más recientes (última fila por producto)
    last_row = df_hist[df_hist['fecha'] == ultima_fecha].iloc[-1]

    # 2. Valores iniciales para la recursión
    lag1 = last_row['unidades']
    prom_movil_7 = last_row['promedio_movil_7']
    tendencia = last_row['tendencia']

    # Intentar obtener lag7 del dato de hace 7 días (si existe)
    dato_lag7 = df_hist[df_hist['fecha'] == ultima_fecha - timedelta(days=7)]
    lag7 = dato_lag7['unidades'].values[0] if not dato_lag7.empty else lag1

    # Buffer circular para simular lags
    buffer = df_hist['unidades'].values[-7:].tolist()  # últimos 7 valores reales

    # Variables para el modelo
    modelo_activo = True
    media_base = df_hist['unidades'].mean()
    desviacion = df_hist['unidades'].std()
    if pd.isna(desviacion) or desviacion == 0:
        desviacion = media_base * 0.1

    future_data = []
    predicciones = []

    for i, fecha in enumerate(fechas_futuras):
        # Construir fila con los valores actualizados
        row = {
            'fecha': fecha,
            'producto_id': producto_id,
            'dia_semana': fecha.weekday(),
            'mes': fecha.month,
            'fin_semana': 1 if fecha.weekday() >= 5 else 0,
            'estacion': get_estacion(fecha.month),
            'promedio_movil_7': prom_movil_7,
            'tendencia': tendencia,
            'unidades_lag1': lag1,
            'unidades_lag7': lag7,
        }
        future_data.append(row)

        # Predecir el día actual
        X_single = pd.DataFrame([row])
        X_single = X_single[['producto_id', 'dia_semana', 'mes', 'estacion', 'fin_semana',
                             'promedio_movil_7', 'tendencia', 'unidades_lag1', 'unidades_lag7']]

        try:
            pred_single = predictor.predict(producto_id, X_single)[0]
        except Exception as e:
            # Si el modelo falla en un día, usamos la media histórica con ruido
            print(f"Error en predicción diaria (usando simulación): {e}")
            modelo_activo = False
            pred_single = media_base + np.random.normal(0, desviacion * 0.3)
            pred_single = max(0, pred_single)

        predicciones.append(pred_single)

        # Actualizar variables para el siguiente día
        buffer.pop(0)
        buffer.append(pred_single)

        lag1 = pred_single
        lag7 = buffer[0] if len(buffer) >= 7 else lag1

        prom_movil_7 = np.mean(buffer)

        if len(buffer) >= 8:
            tendencia = np.mean(buffer[-3:]) - np.mean(buffer[-8:-3])
        else:
            tendencia = last_row['tendencia']

    # Fuera del bucle, construimos df_future para compatibilidad
    df_future = pd.DataFrame(future_data)

    # Si el modelo falló en todas las iteraciones, generamos predicción simulada global
    if not modelo_activo:
        # Calcular promedio y desviación de los últimos 7 días
        ultimos_7_df = df_hist[df_hist['fecha'] >= ultima_fecha - timedelta(days=7)]
        if not ultimos_7_df.empty:
            media_base = ultimos_7_df['unidades'].mean()
            desviacion = ultimos_7_df['unidades'].std()
        else:
            media_base = df_hist['unidades'].mean()
            desviacion = df_hist['unidades'].std()

        if pd.isna(desviacion) or desviacion == 0:
            desviacion = media_base * 0.1

        predicciones = []
        tendencia_diaria = df_future['tendencia'].values[0] if not df_future.empty else 0
        
        for i in range(dias):
            valor = media_base + (tendencia_diaria * i) + np.random.normal(0, desviacion * 0.3)
            predicciones.append(max(0, valor))
    # ============ FIN CONSTRUCCIÓN DE FEATURES FUTURAS ============

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
    from django.db.models import Count
    from collections import defaultdict

    # Obtener el tenant actual de la petición
    tenant = request.tenant
    if not tenant:
        return Response({"error": "No se pudo determinar el tenant"}, status=400)

    hace_un_ano = timezone.now() - timedelta(days=365)

    # Filtrar explícitamente por tenant
    ventas_por_mes = DetalleVenta.objects.filter(
        venta__estado__in=['pagada', 'entregada'],
        venta__created_at__gte=hace_un_ano,
        tenant=tenant  # <--- filtro forzado
    ).annotate(
        mes=ExtractMonth('venta__created_at')
    ).values(
        'producto__categoria__nombre',
        'mes'
    ).annotate(
        total_vendido=Sum('cantidad')
    ).order_by('producto__categoria__nombre', 'mes')

    # Debug en consola
    print(f"Tenant: {tenant.schema_name}, Ventas encontradas: {len(ventas_por_mes)}")

    # Agrupar por categoría
    resumen = defaultdict(lambda: {'total_anual': 0, 'meses': {}})
    for item in ventas_por_mes:
        cat = item['producto__categoria__nombre'] or "Sin categoría"
        mes = item['mes']
        total = item['total_vendido']
        resumen[cat]['meses'][mes] = total
        resumen[cat]['total_anual'] += total

    resultado = []
    for cat, data in resumen.items():
        num_meses_con_datos = len(data['meses'])
        promedio_mensual = data['total_anual'] / max(num_meses_con_datos, 1)
        for mes in range(1, 13):
            total = data['meses'].get(mes, 0)
            if total > 0:
                porcentaje = (total / promedio_mensual) * 100 if promedio_mensual else 0
                resultado.append({
                    "categoria_nombre": cat,
                    "mes": mes,
                    "promedio_ventas": float(total),
                    "porcentaje_vs_anual": round(porcentaje, 1)
                })

    return Response(resultado)