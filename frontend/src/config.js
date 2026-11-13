import { createClient } from '@supabase/supabase-js';

// Configure em frontend/.env (veja .env.example). Nada de chaves no código.
export const ENGINE_URL = (import.meta.env.VITE_ENGINE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// A chave anon/publishable só consegue LER (RLS em supabase/schema.sql).
export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export const CRITERIO_SUPERFICIE_C = 80;
export const CRITERIO_TEMPO_S = 10;
