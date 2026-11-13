export function fmt(valor, casas = 1) {
  const n = Number(valor);
  return Number.isFinite(n) ? n.toFixed(casas).replace('.', ',') : '--';
}

export const ROTULO_STATUS = {
  AGUARDANDO: { texto: 'Aguardando', cor: 'text-slate-300 border-slate-700 bg-slate-800' },
  EM_AQUECIMENTO: { texto: 'Em aquecimento', cor: 'text-amber-300 border-amber-700/50 bg-amber-950/40' },
  CONFORMIDADE_ATINGIDA: { texto: 'Critério cumprido', cor: 'text-emerald-300 border-emerald-700/50 bg-emerald-950/40' },
  RESFRIAMENTO: { texto: 'Resfriando (conforme)', cor: 'text-cyan-300 border-cyan-700/50 bg-cyan-950/40' },
  BANHO_INSUFICIENTE: { texto: 'Banho insuficiente', cor: 'text-rose-300 border-rose-700/50 bg-rose-950/40' },
  NAO_CONFORME: { texto: 'Não conforme', cor: 'text-rose-300 border-rose-700/50 bg-rose-950/40' },
};

// Escala de cor 20 °C (azul) → 90 °C (vermelho)
export function corTemperatura(t) {
  const x = Math.max(0, Math.min(1, (t - 20) / 70));
  const paradas = [
    [0, [59, 130, 246]], [0.45, [234, 179, 8]], [0.75, [249, 115, 22]], [1, [239, 68, 68]],
  ];
  for (let i = 1; i < paradas.length; i++) {
    const [p1, c1] = paradas[i];
    const [p0, c0] = paradas[i - 1];
    if (x <= p1) {
      const f = (x - p0) / (p1 - p0);
      const c = c0.map((v, k) => Math.round(v + f * (c1[k] - v)));
      return `rgb(${c.join(',')})`;
    }
  }
  return 'rgb(239,68,68)';
}

export const estiloTooltip = { backgroundColor: '#090d16', borderColor: '#1e293b', fontSize: 12 };
