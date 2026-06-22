import { useState } from 'react';
import {
  predecirDemanda,
  getRecomendacionesCompra,
  getTendencias,
  getPatronesEstacionales,
} from '../services/prediccionesService';

export const usePrediccionDemanda = () => {
  const [loading, setLoading] = useState(false);
  const [prediccion, setPrediccion] = useState(null);
  const [error, setError] = useState(null);

  const fetchPrediccion = async (productoId, dias = 7) => {
    setLoading(true);
    setError(null);
    try {
      const data = await predecirDemanda(productoId, dias);
      setPrediccion(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return { prediccion, loading, error, fetchPrediccion };
};

export const useRecomendaciones = () => {
  const [recomendaciones, setRecomendaciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadRecomendaciones = async () => {
    setLoading(true);
    try {
      const data = await getRecomendacionesCompra();
      setRecomendaciones(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { recomendaciones, loading, error, loadRecomendaciones };
};

export const useTendencias = () => {
  const [tendencias, setTendencias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadTendencias = async () => {
    setLoading(true);
    try {
      const data = await getTendencias();
      setTendencias(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { tendencias, loading, error, loadTendencias };
};

export const usePatronesEstacionales = () => {
  const [patrones, setPatrones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadPatrones = async () => {
    setLoading(true);
    try {
      const data = await getPatronesEstacionales();
      setPatrones(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { patrones, loading, error, loadPatrones };
};