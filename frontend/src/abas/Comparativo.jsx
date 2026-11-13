import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRightLeft } from 'lucide-react';
import { Cabecalho, Cartao } from '../componentes';
import { CRITERIO_SUPERFICIE_C } from '../config';
import { estiloTooltip, fmt } from '../util';

const NOMES = {
  preditivo: 'Preditivo (gêmeo digital)',
  fixo: 'Tempo fixo (empírico)',
  centro_70: 'Centro ≥ 70 °C (versão anterior)',
};
const CORES = { preditivo: '#a855f7', fixo: '#f59e0b', centro_70: '#64748b' };

export default function Comparativo({ comparacao }) {
  if (!comparacao) {
    return (
      <div className="max-w-5xl space-y-6">
        <Cabecalho sobretitulo="Validação" titulo="Comparativo de estratégias de corte" cor="text-cyan-400" />
        <p className="text-sm text-slate-400">Rode um ciclo (botão “Iniciar ciclo”) para gerar a comparação.</p>
      </div>
    );
  }
  const modos = Object.keys(NOMES).filter((m) => comparacao[m]);
  const barras = modos.map((m) => ({
    nome: NOMES[m],
    tempo: comparacao[m].resumo.tempo_corte_s,
    energia: comparacao[m].resumo.energia_absorvida_no_corte_kj_kg,
  }));
  // série de superfície das três estratégias, alinhada pelo tempo
  const mapa = new Map();
  modos.forEach((m) => comparacao[m].serie.forEach((p) => {
    const k = p.tempo_decorrido_s;
    mapa.set(k, { ...(mapa.get(k) || { t: k }), [m]: p.temp_superficie_c });
  }));
  const curvas = [...mapa.values()].sort((a, b) => a.t - b.t).filter((p) => p.t <= 140);
  const pred = comparacao.preditivo?.resumo;
  const leg = comparacao.centro_70?.resumo;
  const economia = pred && leg ? leg.energia_absorvida_no_corte_kj_kg - pred.energia_absorvida_no_corte_kj_kg : null;

  return (
    <div className="max-w-6xl space-y-6">
      <Cabecalho sobretitulo="Validação" titulo="Comparativo de estratégias de corte" cor="text-cyan-400"
        descricao={`Mesmo fruto e mesmo banho (${fmt(comparacao.preditivo.entrada.temp_banho_c)} °C); muda só o momento de retirar do banho.`} />

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950 text-slate-400">
            <tr>
              <th className="p-3">Estratégia</th><th className="p-3">Imersão (s)</th>
              <th className="p-3">Superfície ≥ {CRITERIO_SUPERFICIE_C} °C (s)</th><th className="p-3">Centro máx. (°C)</th>
              <th className="p-3">Energia (kJ/kg)</th><th className="p-3">POD inativada (%)</th>
              <th className="p-3">Antocianinas (%)</th><th className="p-3">Critério sanitário</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
            {modos.map((m) => {
              const r = comparacao[m].resumo;
              return (
                <tr key={m}>
                  <td className="p-3 font-sans font-semibold" style={{ color: CORES[m] }}>{NOMES[m]}</td>
                  <td className="p-3">{fmt(r.tempo_corte_s)}</td>
                  <td className="p-3">{fmt(r.tempo_letal_superficie_s)}</td>
                  <td className="p-3">{fmt(r.temp_centro_max_c)}</td>
                  <td className="p-3">{fmt(r.energia_absorvida_no_corte_kj_kg)}</td>
                  <td className="p-3">{fmt(r.taxa_inativacao_pct)}</td>
                  <td className="p-3">{fmt(r.retencao_antocianinas_pct, 2)}</td>
                  <td className={`p-3 font-sans font-semibold ${r.conforme ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {r.conforme ? 'Atende' : 'Não atende'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {economia != null && (
        <p className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-4 text-sm text-slate-300">
          Retirar o fruto quando a <strong>superfície</strong> cumpre o critério, em vez de esperar o <strong>centro</strong> chegar a 70 °C,
          reduz a imersão de {fmt(leg.tempo_corte_s)} s para {fmt(pred.tempo_corte_s)} s e o calor absorvido em{' '}
          <strong>{fmt(economia)} kJ/kg</strong> ({fmt((100 * economia) / leg.energia_absorvida_no_corte_kj_kg, 0)} %).
          {!comparacao.fixo.resumo.conforme && ` O tempo fixo de ${fmt(comparacao.fixo.entrada.tempo_imersao_fixo_s, 0)} s não cumpre o critério nesta condição.`}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Tempo de imersão e energia" icon={ArrowRightLeft}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barras}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="nome" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={estiloTooltip} formatter={(v) => fmt(v)} />
                <Legend />
                <Bar dataKey="tempo" name="Imersão (s)" fill="#a855f7" />
                <Bar dataKey="energia" name="Energia (kJ/kg)" fill="#22d3ee" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Cartao>
        <Cartao titulo="Temperatura da superfície" icon={ArrowRightLeft}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curvas}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="t" type="number" stroke="#64748b" unit="s" fontSize={11} />
                <YAxis stroke="#64748b" unit="°C" domain={[20, 100]} fontSize={11} />
                <Tooltip contentStyle={estiloTooltip} formatter={(v) => `${fmt(v)} °C`} />
                <Legend />
                <ReferenceLine y={CRITERIO_SUPERFICIE_C} stroke="#10b981" strokeDasharray="4 4" />
                {modos.map((m) => (
                  <Line key={m} dataKey={m} name={NOMES[m]} stroke={CORES[m]} dot={false} connectNulls isAnimationActive={false} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Cartao>
      </div>
    </div>
  );
}
