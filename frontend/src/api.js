import { ENGINE_URL } from './config';

async function post(caminho, corpo) {
  const r = await fetch(`${ENGINE_URL}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`Motor respondeu ${r.status}: ${await r.text()}`);
  return r.json();
}

async function get(caminho) {
  const r = await fetch(`${ENGINE_URL}${caminho}`);
  if (!r.ok) throw new Error(`Motor respondeu ${r.status}`);
  return r.json();
}

export const api = {
  saude: () => get('/'),
  parametros: () => get('/api/v1/parametros'),
  simular: (dados) => post('/api/v1/simular', dados),
  comparar: (dados) => post('/api/v1/comparar', dados),
  lotes: () => get('/api/v1/lotes'),
  serie: (loteId) => get(`/api/v1/lotes/${encodeURIComponent(loteId)}/serie`),
  urlCsv: (loteId) => `${ENGINE_URL}/api/v1/lotes/${encodeURIComponent(loteId)}/csv`,
  /** Assina o stream SSE do motor. Devolve uma função para cancelar. */
  assinar: (aoReceber, aoMudarConexao) => {
    const fonte = new EventSource(`${ENGINE_URL}/api/v1/stream`);
    fonte.onopen = () => aoMudarConexao(true);
    fonte.onerror = () => aoMudarConexao(false); // o navegador reconecta sozinho
    fonte.onmessage = (ev) => {
      try { aoReceber(JSON.parse(ev.data)); } catch { /* evento malformado: ignora */ }
    };
    return () => fonte.close();
  },
};
