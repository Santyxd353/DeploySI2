import joblib
import os
from django.conf import settings
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import pandas as pd
import numpy as np

class SalesPredictor:
    """Predictor de ventas con Random Forest (simplificado)"""

    MODEL_PATH = os.path.join(settings.MEDIA_ROOT, 'ml_models', 'random_forest_sales.pkl')

    def __init__(self):
        self.model = None
        self.feature_columns = [
            'producto_id', 'dia_semana', 'mes', 'estacion', 'fin_semana',
            'promedio_movil_7', 'tendencia', 'unidades_lag1', 'unidades_lag7'
        ]

    def train(self, df):
        """Entrena el modelo Random Forest"""
        if df.empty:
            raise ValueError("No hay datos para entrenar")

        missing = [col for col in self.feature_columns if col not in df.columns]
        if missing:
            raise ValueError(f"Faltan columnas: {missing}")

        X = df[self.feature_columns].copy()
        y = df['unidades'].values

        X['producto_id'] = X['producto_id'].astype(int)

        self.model = Pipeline(steps=[
            ('scaler', StandardScaler()),
            ('regressor', RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
                n_jobs=-1
            ))
        ])

        self.model.fit(X, y)
        self.save_model()
        return self.model

    def predict(self, producto_id, future_features_df):
        if self.model is None:
            if not self.load_model():
                raise ValueError("Modelo no entrenado")
        missing = [col for col in self.feature_columns if col not in future_features_df.columns]
        if missing:
            raise ValueError(f"Faltan columnas: {missing}")
        X_pred = future_features_df[self.feature_columns].copy()
        X_pred['producto_id'] = X_pred['producto_id'].astype(int)
        predicciones = self.model.predict(X_pred)
        return np.maximum(predicciones, 0)

    def save_model(self):
        os.makedirs(os.path.dirname(self.MODEL_PATH), exist_ok=True)
        joblib.dump({
            'model': self.model,
            'feature_columns': self.feature_columns
        }, self.MODEL_PATH)

    def load_model(self):
        if os.path.exists(self.MODEL_PATH):
            data = joblib.load(self.MODEL_PATH)
            self.model = data['model']
            self.feature_columns = data['feature_columns']
            return True
        return False

# Instancia global para usar en vistas
predictor = SalesPredictor()