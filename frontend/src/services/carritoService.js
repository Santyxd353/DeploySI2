import { requestJson, requestJsonWithAuthRetry } from './apiClient';

const buildQuery = (params) => {
  if (!params) return '';
  return '?' + new URLSearchParams(params).toString();
};

const buildBodyAndHeaders = (data) => {
  if (data instanceof FormData) {
    return { body: data };
  }

  return {
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  };
};

// Manejo del token de invitado en localStorage
const getCarritoToken = () => {
  const token = localStorage.getItem('carrito_token');
  console.log("🔍 getCarritoToken:", token);
  return token;
};

const setCarritoToken = (token) => {
  if (token) {
    console.log("💾 setCarritoToken: guardando token:", token);
    localStorage.setItem('carrito_token', token);
    // Verificar que se guardó
    const saved = localStorage.getItem('carrito_token');
    console.log("✅ Verificación: token guardado correctamente:", saved === token);
  } else {
    console.warn("⚠️ setCarritoToken: token vacío, no se guarda");
  }
};

const clearCarritoToken = () => {
  console.log("🗑️ clearCarritoToken: eliminando token");
  localStorage.removeItem('carrito_token');
};

const isUsuarioAutenticado = () => Boolean(localStorage.getItem('current_user'));

// Headers con token de carrito (para invitados)
const getCarritoHeaders = () => {
  const token = getCarritoToken();
  const headers = token ? { 'X-Carrito-Token': token } : {};
  console.log("📨 getCarritoHeaders:", headers);
  return headers;
};

export const carritoService = {
  // Agregar item al carrito
  agregar: async (data) => {
    console.log("🛒 agregar: enviando request con data:", data);
    const response = await requestJsonWithAuthRetry('/api/carrito/agregar/', {
      method: 'POST',
      ...buildBodyAndHeaders(data),
      headers: {
        ...getCarritoHeaders(),
        ...(buildBodyAndHeaders(data).headers || {}),
      },
    });
    
    console.log("📦 agregar - respuesta completa:", response);
    console.log("🔑 agregar - invitado_token en respuesta:", response?.invitado_token);
    
    // Guardar token si viene en la respuesta
    if (response?.invitado_token) {
      setCarritoToken(response.invitado_token);
    } else if (!isUsuarioAutenticado()) {
      console.warn("⚠️ agregar: No se recibió invitado_token en la respuesta");
    }
    
    return response;
  },

  // Listar carrito actual
  listar: async () => {
    console.log("🔄 listar: obteniendo carrito");
    const response = await requestJsonWithAuthRetry('/api/carrito/', {
      method: 'GET',
      headers: getCarritoHeaders(),
    });
    
    console.log("📦 listar - respuesta completa:", response);
    console.log("🔑 listar - invitado_token en respuesta:", response?.invitado_token);
    
    // Guardar token si viene en la respuesta
    if (response?.invitado_token) {
      setCarritoToken(response.invitado_token);
    } else if (!isUsuarioAutenticado()) {
      console.warn("⚠️ listar: No se recibió invitado_token en la respuesta");
    }
    
    return response;
  },

  // Actualizar item del carrito
  actualizarItem: async (itemId, data) => {
    console.log(`✏️ actualizarItem: itemId ${itemId}, data:`, data);
    const response = await requestJsonWithAuthRetry(`/api/carrito/items/${itemId}/`, {
      method: 'PATCH',
      ...buildBodyAndHeaders(data),
      headers: {
        ...getCarritoHeaders(),
        ...(buildBodyAndHeaders(data).headers || {}),
      },
    });
    
    console.log("📦 actualizarItem - respuesta:", response);
    
    if (response?.invitado_token) {
      setCarritoToken(response.invitado_token);
    }
    
    return response;
  },

  // Eliminar item del carrito
  eliminarItem: async (itemId) => {
    console.log(`🗑️ eliminarItem: itemId ${itemId}`);
    const response = await requestJsonWithAuthRetry(`/api/carrito/items/${itemId}/`, {
      method: 'DELETE',
      headers: getCarritoHeaders(),
    });
    
    console.log("📦 eliminarItem - respuesta:", response);
    return response;
  },

  // Confirmar carrito (crear venta) - endpoint original
  confirmar: async (data) => {
    console.log("✅ confirmar: data:", data);
    const response = await requestJsonWithAuthRetry('/api/carrito/confirmar/', {
      method: 'POST',
      ...buildBodyAndHeaders(data),
      headers: {
        ...getCarritoHeaders(),
        ...(buildBodyAndHeaders(data).headers || {}),
      },
    });
    
    console.log("📦 confirmar - respuesta:", response);
    
    if (response?.invitado_token) {
      setCarritoToken(response.invitado_token);
    }
    
    return response;
  },

  // Vaciar carrito (limpiar token local)
  vaciar: () => {
    console.log("🧹 vaciar: limpiando carrito");
    clearCarritoToken();
  },

  // Obtener token actual
  getToken: () => {
    const token = getCarritoToken();
    console.log("🔑 getToken:", token);
    return token;
  },
  
  // Limpiar token
  clearToken: () => {
    console.log("🗑️ clearToken: limpiando token");
    clearCarritoToken();
  },
};

// Servicio de pagos (Stripe)
export const pagosService = {
  // Crear PaymentIntent
  crearIntent: async (total) => {
    console.log("💳 crearIntent: total =", total);
    const response = await requestJsonWithAuthRetry('/api/ventas/intent-pago/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total }),
    });
    console.log("📦 crearIntent - respuesta:", response);
    return response;
  },

  // Confirmar pago y crear venta
  confirmarPago: async (paymentIntentId, carritoToken, datosFactura) => {
    console.log("💳 confirmarPago: paymentIntentId =", paymentIntentId);
    console.log("💳 confirmarPago: carritoToken =", carritoToken);
    console.log("💳 confirmarPago: datosFactura =", datosFactura);
    
    // Construir body dinámicamente - solo incluir carrito_token si existe
    const body = {
      payment_intent_id: paymentIntentId,
      datos_factura: datosFactura,
    };
    
    // Solo agregar carrito_token si tiene valor (para invitados)
    if (carritoToken) {
      body.carrito_token = carritoToken;
    }
    
    const response = await requestJsonWithAuthRetry('/api/ventas/confirmar-pago/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    console.log("📦 confirmarPago - respuesta:", response);
    return response;
  },

  // Obtener factura por número
  obtenerFactura: async (numeroFactura) => {
    console.log("📄 obtenerFactura: numero =", numeroFactura);
    const response = await requestJsonWithAuthRetry(`/api/ventas/factura/${numeroFactura}/`, {
      method: 'GET',
    });
    console.log("📦 obtenerFactura - respuesta:", response);
    return response;
  },
};