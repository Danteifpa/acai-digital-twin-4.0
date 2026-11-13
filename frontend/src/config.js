// Configure em frontend/.env.local (veja .env.example).
export const ENGINE_URL = (import.meta.env.VITE_ENGINE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

export const CRITERIO_SUPERFICIE_C = 80;
export const CRITERIO_TEMPO_S = 10;
