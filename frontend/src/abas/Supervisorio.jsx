import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Droplet, Layers, ShieldCheck, Thermometer, Timer, Zap } from 'lucide-react';
import { Cartao, EsferaAcai, Indicador, Status } from '../componentes';
import { CRITERIO_SUPERFICIE_C, CRITERIO_TEMPO_S } from '../config';
import { estiloTooltip, fmt } from '../util';

export default function Supervisorio({ estado, historico, malha, diametroMm, modo }) {
  const perfil = estado?.perfil_radial_c;
  const dadosPerfil = Array.isArray(perfil) && malha.raios
    ? perfil.map((t, i) => ({ r: malha.raios[i], t }))
    : [];
  const letal = Number(estado?.tempo_letal_superficie_s || 0);
  // a linha do banho só faz sentido enquanto o fruto está imerso
  const serie = historico.map((p) => ({ ...p, banho_ativo: (p.imerso === false || ['RESFRIAMENTO', 'NAO_CONFORME'].includes(p.status_processo)) ? null : p.temp_banho_c }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-400">Supervisório do gêmeo digital</p>
          <h2 className="text-2xl font-bold text-white">Penetração térmica e cinética no fruto</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3.5 py-1 text-xs font-mono font-semibold text-purple-300">
            {modo === 'simulacao' ? 'Simulação (motor numérico)' : 'Tempo real (sensor → motor → painel)'}
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-900 px-3.5 py-1 text-xs font-mono text-slate-300">
            t = {fmt(estado?.tempo_decorrido_s, 1)} s
          </span>
          <Status valor={estado?.status_processo} />
        </div>
      </header>

      <div className="grid items-stretch gap-6 lg:grid-cols-4">
        <EsferaAcai perfil={perfil} raiosMm={malha.raios} raioCarocoMm={malha.raioCaroco} diametroMm={diametroMm} />
        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-3">
          <Indicador icon={Thermometer} label="Superfície (r = R)" value={fmt(estado?.temp_superficie_c)} unit="°C"
            color={{ bg: 'bg-rose-500/10', text: 'text-rose-400' }}
            extra={`Banho: ${fmt(estado?.temp_banho_c)} °C · ponto crítico p/ T. cruzi`} />
          <Indicador icon={Timer} label={`Tempo ≥ ${CRITERIO_SUPERFICIE_C} °C na superfície`} value={fmt(letal)} unit="s"
            color={{ bg: letal >= CRITERIO_TEMPO_S ? 'bg-emerald-500/10' : 'bg-amber-500/10', text: letal >= CRITERIO_TEMPO_S ? 'text-emerald-400' : 'text-amber-400' }}
            extra={`Meta: ${CRITERIO_TEMPO_S} s${estado?.previsao_corte_s != null ? ` · previsão de corte em ${fmt(estado.previsao_corte_s)} s` : ''}`} />
          <Indicador icon={Thermometer} label="Centro (r = 0)" value={fmt(estado?.temp_centro_c)} unit="°C"
            color={{ bg: 'bg-amber-500/10', text: 'text-amber-400' }}
            extra={`ΔT superfície − centro: ${fmt((estado?.temp_superficie_c ?? 0) - (estado?.temp_centro_c ?? 0))} °C`} />
          <Indicador icon={ShieldCheck} label="Inativação POD (polpa)" value={fmt(estado?.taxa_inativacao_pct)} unit="%"
            color={{ bg: 'bg-emerald-500/10', text: 'text-emerald-400' }} extra="Bifásico D–z (Costa, 2019)" />
          <Indicador icon={Droplet} label="Retenção de antocianinas" value={fmt(estado?.retencao_antocianinas_pct, 2)} unit="%"
            color={{ bg: 'bg-purple-500/10', text: 'text-purple-400' }} extra="Arrhenius, Ea 42,8 kJ/mol (Anjos, 2020)" />
          <Indicador icon={Zap} label="Energia absorvida" value={fmt(estado?.energia_absorvida_kj_kg)} unit="kJ/kg"
            color={{ bg: 'bg-cyan-500/10', text: 'text-cyan-400' }} extra="Calor sensível acumulado no fruto" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Temperatura × tempo" icon={Thermometer}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="tempo_decorrido_s" stroke="#64748b" unit="s" fontSize={11} type="number" domain={[0, 'dataMax']} />
                <YAxis stroke="#64748b" unit="°C" domain={[20, 100]} fontSize={11} />
                <Tooltip contentStyle={estiloTooltip} formatter={(v) => `${fmt(v)} °C`} labelFormatter={(l) => `t = ${fmt(l)} s`} />
                <Legend />
                <ReferenceLine y={CRITERIO_SUPERFICIE_C} stroke="#10b981" strokeDasharray="4 4"
                  label={{ value: `Critério superfície: ${CRITERIO_SUPERFICIE_C} °C`, fill: '#34d399', fontSize: 10, position: 'insideTopLeft' }} />
                <Line type="monotone" dataKey="banho_ativo" name="Banho (imersão)" stroke="#64748b" strokeDasharray="2 4" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="temp_superficie_c" name="Superfície" stroke="#f43f5e" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="temp_centro_c" name="Centro (r = 0)" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Cartao>

        <Cartao titulo="Cinética integrada na polpa" icon={ShieldCheck}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historico}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="tempo_decorrido_s" stroke="#64748b" unit="s" fontSize={11} type="number" domain={[0, 'dataMax']} />
                <YAxis stroke="#64748b" unit="%" domain={[0, 100]} fontSize={11} />
                <Tooltip contentStyle={estiloTooltip} formatter={(v) => `${fmt(v, 2)} %`} labelFormatter={(l) => `t = ${fmt(l)} s`} />
                <Legend />
                <Line type="monotone" dataKey="taxa_inativacao_pct" name="Inativação POD" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="retencao_antocianinas_pct" name="Antocianinas retidas" stroke="#a855f7" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-slate-500">
            Branqueamento de segundos degrada pouquíssimo as antocianinas (k ≈ 0,002 min⁻¹ a 90 °C) e inativa pouco a POD,
            que é alvo da pasteurização da polpa, não do branqueamento do fruto.
          </p>
        </Cartao>
      </div>

      <Cartao titulo="Distribuição espacial T(r) calculada pelo motor" icon={Layers}>
        <p className="text-[11px] text-slate-400">
          {malha.raios?.length ?? 0} nós em volumes finitos · faixa sombreada = polpa (r &gt; {fmt(malha.raioCaroco, 2)} mm)
        </p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dadosPerfil}>
              <defs>
                <linearGradient id="gradRadial" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="r" type="number" stroke="#64748b" fontSize={11} unit=" mm" domain={[0, diametroMm / 2]} tickFormatter={(v) => fmt(v, 1)} />
              <YAxis stroke="#64748b" unit="°C" domain={[20, 100]} fontSize={11} />
              {malha.raioCaroco && (
                <ReferenceArea x1={malha.raioCaroco} x2={diametroMm / 2} fill="#a855f7" fillOpacity={0.12} />
              )}
              <Tooltip contentStyle={estiloTooltip} formatter={(v) => `${fmt(v)} °C`} labelFormatter={(l) => `r = ${fmt(l, 2)} mm`} />
              <Area type="monotone" dataKey="t" name="T(r)" stroke="#818cf8" strokeWidth={2.5} fill="url(#gradRadial)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Cartao>
    </div>
  );
}
