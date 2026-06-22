import pandas as pd
import numpy as np
from django.utils import timezone
from datetime import timedelta
from django.db.models import Sum
from ventas.models import Venta, DetalleVenta

class SalesDataService:
    """Servicio para agregar datos históricos de ventas"""

    @staticmethod
    def get_daily_sales(producto_id=None, months_back=12):
        """Retorna DataFrame con ventas diarias por producto"""
        fecha_corte = timezone.now() - timedelta(days=months_back*30)

        detalles = DetalleVenta.objects.filter(
            venta__estado__in=['pagada', 'entregada'],
            venta__created_at__gte=fecha_corte
        ).select_related('producto', 'venta')

        if producto_id:
            detalles = detalles.filter(producto_id=producto_id)

        data = []
        for det in detalles:
            fecha = det.venta.created_at.date()
            data.append({
                'fecha': fecha,
                'producto_id': det.producto.id,
                'nombre_comercial': det.producto.nombre_comercial,
                'unidades': det.cantidad
            })

        if not data:
            return pd.DataFrame(columns=['fecha', 'producto_id', 'nombre_comercial', 'unidades'])

        df = pd.DataFrame(data)
        df = df.groupby(['fecha', 'producto_id', 'nombre_comercial'], as_index=False)['unidades'].sum()
        df['fecha'] = pd.to_datetime(df['fecha'])
        return df

    @staticmethod
    def build_features(df):
        """Construye features para ML a partir del DataFrame de ventas diarias"""
        if df.empty:
            return pd.DataFrame()

        productos = df['producto_id'].unique()
        fechas = pd.date_range(df['fecha'].min(), df['fecha'].max(), freq='D')

        df_completo = []
        for prod in productos:
            prod_df = df[df['producto_id'] == prod].copy()
            nombre = prod_df['nombre_comercial'].iloc[0] if not prod_df.empty else ''
            prod_df = prod_df.set_index('fecha').reindex(fechas, fill_value=0).reset_index()
            prod_df.rename(columns={'index': 'fecha'}, inplace=True)
            prod_df['producto_id'] = prod
            prod_df['nombre_comercial'] = nombre
            prod_df['unidades'] = prod_df['unidades'].fillna(0)
            df_completo.append(prod_df)

        df = pd.concat(df_completo, ignore_index=True)

        # Features temporales
        df['dia_semana'] = df['fecha'].dt.dayofweek
        df['mes'] = df['fecha'].dt.month
        df['fin_semana'] = (df['dia_semana'] >= 5).astype(int)

        def get_estacion(mes):
            if mes in [12, 1, 2]:
                return 0
            elif mes in [3, 4, 5]:
                return 1
            elif mes in [6, 7, 8]:
                return 2
            else:
                return 3
        df['estacion'] = df['mes'].apply(get_estacion)

        # Promedio móvil 7 días
        df['promedio_movil_7'] = df.groupby('producto_id')['unidades'].transform(
            lambda x: x.rolling(7, min_periods=1).mean()
        )

        # Tendencia (cálculo simple sin groupby complejo)
        def calc_tendencia_por_grupo(grupo):
            if len(grupo) < 7:
                return 0
            y = grupo['unidades'].values[-30:]
            x = np.arange(len(y))
            if len(y) > 1:
                return np.polyfit(x, y, 1)[0]
            return 0

        df['tendencia'] = 0.0
        for prod_id, grupo in df.groupby('producto_id'):
            tend_val = calc_tendencia_por_grupo(grupo)
            df.loc[df['producto_id'] == prod_id, 'tendencia'] = tend_val

        # Lags
        df['unidades_lag1'] = df.groupby('producto_id')['unidades'].shift(1).fillna(0)
        df['unidades_lag7'] = df.groupby('producto_id')['unidades'].shift(7).fillna(0)

        # Eliminar filas con NaN en features críticas
        df = df.dropna(subset=['promedio_movil_7', 'unidades_lag1', 'unidades_lag7'])
        return df

    @staticmethod
    def get_training_data(producto_id=None, months_back=12):
        df_raw = SalesDataService.get_daily_sales(producto_id, months_back)
        if df_raw.empty:
            return pd.DataFrame()
        df_features = SalesDataService.build_features(df_raw)
        return df_features