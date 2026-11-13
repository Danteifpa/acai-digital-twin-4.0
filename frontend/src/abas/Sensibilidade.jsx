import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Play, Scale } from 'lucide-react';
import { api } from '../api';
import { Cabecalho, Cartao } from '../componentes';
import { estiloTooltip, fmt } from '../util';

const DIAMETROS = [10, 12, 14, 16, 18, 20];
const BANHOS = [80, 81, 82, 84, 86, 88, 90, 92, 95];

export default function Sensibilidade({ tempBanho, tempInicial, diametroMm }) {
  const [porDiametro, setPorDiametro] = useState(null);
  const [porBanho, setPorBanho] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  const rodar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const d = await Promise.all(DIAMETROS.map((diam) =>
        api.comparar({ diametro_mm: diam, temp_banho_c: tempBanho, temp_inicial_c: tempInicial, tempo_resfriamento_s: 0 })
          .then((c) => ({
            diametro: diam,
            preditivo: c.preditivo.resumo.tempo_corte_s,
            centro_70: c.centro_70.resumo.tempo_corte_s,
            e_pred: c.preditivo.resumo.energia_absorvida_no_corte_kj_kg,
            e_leg: c.centro_70.resumo.energia_absorvida_no_corte_kj_kg,
          }))));
      const b = await Promise.all(BANHOS.map((tb) =>
        api.simular({ diametro_mm: diametroMm, temp_banho_c: tb, temp_inicial_c: tempInicial, modo: 'preditivo', tempo_resfriamento_s: 0, intervalo_saida_s: 5 })
          .then((r) => ({
            banho: tb,
            corte: r.resumo.conforme ? r.resumo.tempo_corte_s : null,
            antoc: r.resumo.retencao_antocianinas_pct,
            pod: r.resumo.taxa_inativacao_pct,
          }))));
      setPorDiametro(d);
      setPorBanho(b);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <Cabecalho sobretitulo="Análise paramétrica" titulo="Sensibilidade ao tamanho do fruto e à temperatura do banho" cor="text-amber-400"
        descricao="Todas as curvas são calculadas agora pelo motor numérico (nenhum valor fixo)." />
      <button onClick={rodar} disabled={carregando}
        className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50">
        <Play className="h-3.5 w-3.5" /> {carregando ? 'Calculando…' : `Rodar varredura (banho ${fmt(tempBanho)} °C, Ø ${diametroMm} mm)`}
      </button>
      {erro && <p className="text-sm text-rose-400">Erro: {erro}</p>}

      {porDiametro && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Cartao titulo="Tempo de imersão × diâmetro" icon={Scale}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={porDiametro}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="diametro" stroke="#64748b" unit=" mm" fontSize={11} />
                  <YAxis stroke="#64748b" unit="s" fontSize={11} />
                  <Tooltip contentStyle={estiloTooltip} formatter={(v) => `${fmt(v)} s`} />
                  <Legend />
                  <Line dataKey="preditivo" name="Critério superfície (proposto)" stroke="#a855f7" strokeWidth={2.5} isAnimationActive={false} />
                  <Line dataKey="centro_70" name="Centro ≥ 70 °C (anterior)" stroke="#64748b" strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-slate-500">
              Como o risco está na superfície, o tempo necessário quase não depende do tamanho do fruto.
              O critério no centro cresce aproximadamente com R².
            </p>
          </Cartao>
          <Cartao titulo="Antocianinas e POD × temperatura do banho (corte preditivo)" icon={Scale}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={porBanho}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="banho" type="number" domain={[80, 95]} stroke="#64748b" unit="°C" fontSize={11} />
                  <YAxis yAxisId="t" stroke="#64748b" unit="s" fontSize={11} />
                  <YAxis yAxisId="p" orientation="right" stroke="#64748b" unit="%" fontSize={11} domain={[0, 100]} />
                  <Tooltip contentStyle={estiloTooltip} formatter={(v) => fmt(v, 2)} />
                  <Legend />
                  <Line yAxisId="t" dataKey="corte" name="Corte (s) — vazio = não cumpre" stroke="#a855f7" strokeWidth={2.5} isAnimationActive={false} />
                  <Line yAxisId="p" dataKey="pod" name="POD inativada (%)" stroke="#10b981" isAnimationActive={false} />
                  <Line yAxisId="p" dataKey="antoc" name="Antocianinas (%)" stroke="#f43f5e" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-slate-500">
              Com banho a 80 °C a superfície só tende assintoticamente a 80 °C e o critério não é cumprido —
              coerente com as medições de Bezerra et al. (Embrapa). Nesse ponto a POD aparece maior porque o
              fruto fica imerso até o tempo máximo (180 s) sem atingir o critério.
            </p>
          </Cartao>
        </div>
      )}
    </div>
  );
}
