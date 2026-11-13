import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRightLeft, Award, BookOpen, ChevronRight, Cpu, Database, Download,
  Download as Baixar, FileText, Flame, Leaf, Play, RotateCcw, Scale, Settings2, Sliders, Wifi, XCircle,
} from 'lucide-react';
import { api } from './api';
import { fmt } from './util';
import Supervisorio from './abas/Supervisorio';
import Comparativo from './abas/Comparativo';
import Sensibilidade from './abas/Sensibilidade';
import Historico from './abas/Historico';
import { Arquitetura, Convencional, Fisica, Fruto, Normas, Parametros } from './abas/Conteudo';

const ABAS = [
  { id: 'dashboard', rotulo: 'Supervisório', icon: Activity },
  { id: 'comparativo', rotulo: 'Comparativo de estratégias', icon: ArrowRightLeft },
  { id: 'sensibilidade', rotulo: 'Sensibilidade', icon: Scale },
  { id: 'normas', rotulo: 'Critério sanitário', icon: FileText },
  { id: 'convencional', rotulo: 'Branqueamento convencional', icon: Flame },
  { id: 'acai_info', rotulo: 'O fruto do açaí', icon: Leaf },
  { id: 'fisica', rotulo: 'Modelo físico', icon: BookOpen },
  { id: 'arquitetura', rotulo: 'Arquitetura', icon: Cpu },
  { id: 'parametros', rotulo: 'Parâmetros', icon: Sliders },
  { id: 'historico', rotulo: 'Dados & histórico', icon: Database },
];

const FRACAO_CAROCO = 0.85;
const malhaPadrao = (n, diametroMm) => {
  const R = diametroMm / 2;
  return {
    raios: n > 1 ? Array.from({ length: n }, (_, i) => (R * i) / (n - 1)) : null,
    raioCaroco: R * Math.cbrt(FRACAO_CAROCO),
  };
};

export default function DashboardDigitalTwin() {
  const [aba, setAba] = useState('dashboard');
  const [modo, setModo] = useState('simulacao'); // 'simulacao' | 'tempo_real'

  const [diametroMm, setDiametroMm] = useState(14);
  const [tempBanho, setTempBanho] = useState(88);
  const [tempInicial, setTempInicial] = useState(25);
  const [tempoFixo, setTempoFixo] = useState(10);

  const [estado, setEstado] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [malha, setMalha] = useState(malhaPadrao(0, 14));
  const [comparacao, setComparacao] = useState(null);
  const [loteId, setLoteId] = useState(null);

  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState(null);
  const [motorOnline, setMotorOnline] = useState(null);
  const [realtimeOk, setRealtimeOk] = useState(false);
  const [mostrarLaudo, setMostrarLaudo] = useState(false);
  const timer = useRef(null);
  const loteRef = useRef(null);

  useEffect(() => {
    api.saude().then(() => setMotorOnline(true)).catch(() => setMotorOnline(false));
  }, []);

  const parar = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => parar, []);

  // ------------------------------------------------------------ modo simulação
  const iniciarCiclo = async () => {
    parar();
    setErro(null);
    setMostrarLaudo(false);
    setRodando(true);
    try {
      const c = await api.comparar({
        diametro_mm: diametroMm, temp_banho_c: tempBanho, temp_inicial_c: tempInicial,
        tempo_imersao_fixo_s: tempoFixo, tempo_resfriamento_s: 45,
      });
      setMotorOnline(true);
      setComparacao(c);
      setLoteId(`SIM-${Date.now().toString().slice(-6)}`);
      setMalha({ raios: c.preditivo.raio_nos_mm, raioCaroco: c.preditivo.raio_caroco_mm });
      const serie = c.preditivo.serie;
      setHistorico([]);
      let i = 0;
      timer.current = setInterval(() => {
        const ponto = serie[i];
        setEstado(ponto);
        setHistorico((h) => [...h, ponto]);
        i += 1;
        if (i >= serie.length) {
          parar();
          setRodando(false);
          setTimeout(() => setMostrarLaudo(true), 500);
        }
      }, 120);
    } catch (e) {
      setErro(`Não foi possível falar com o motor: ${e.message}`);
      setMotorOnline(false);
      setRodando(false);
    }
  };

  const resetar = () => {
    parar();
    setRodando(false);
    setMostrarLaudo(false);
    setEstado(null);
    setHistorico([]);
    setComparacao(null);
  };

  // ------------------------------------------------------------ modo tempo real
  const [lotesGravados, setLotesGravados] = useState([]);

  const carregarLote = useCallback(async (id) => {
    const dados = await api.serie(id);
    loteRef.current = id;
    setLoteId(id);
    setHistorico(dados);
    const ultimo = dados[dados.length - 1];
    setEstado(ultimo ?? null);
    if (ultimo) setMalha(malhaPadrao(ultimo.perfil_radial_c?.length ?? 0, 14));
  }, []);

  useEffect(() => {
    if (modo !== 'tempo_real') return undefined;
    let ativo = true;

    api.lotes()
      .then((lista) => {
        if (!ativo) return;
        setLotesGravados(lista);
        if (lista.length) return carregarLote(lista[0].lote_id);
        return undefined;
      })
      .catch((e) => ativo && setErro(`Motor: ${e.message}`));

    const cancelar = api.assinar((novo) => {
      if (!ativo || !novo) return;
      if (loteRef.current !== novo.lote_id) {
        loteRef.current = novo.lote_id;
        setLoteId(novo.lote_id);
        setHistorico([novo]);
        setLotesGravados((ls) => (ls.some((l) => l.lote_id === novo.lote_id) ? ls : [{ lote_id: novo.lote_id }, ...ls]));
      } else {
        setHistorico((h) => [...h, novo]);
      }
      setEstado(novo);
      setMalha(malhaPadrao(novo.perfil_radial_c?.length ?? 0, 14));
    }, (ok) => ativo && setRealtimeOk(ok));

    return () => {
      ativo = false;
      cancelar();
      setRealtimeOk(false);
    };
  }, [modo, carregarLote]);

  const trocarModo = (novo) => {
    parar();
    setRodando(false);
    setMostrarLaudo(false);
    setComparacao(null);
    setEstado(null);
    setHistorico([]);
    setErro(null);
    if (novo === 'tempo_real') setDiametroMm(14);
    setModo(novo);
  };

  const resultado = comparacao?.preditivo;
  const ocupado = rodando || modo === 'tempo_real';

  return (
    <div className="relative flex min-h-screen bg-slate-950 font-sans text-slate-100">
      {mostrarLaudo && resultado && (
        <ModalLaudo resultado={resultado} comparacao={comparacao} diametroMm={diametroMm} loteId={loteId}
          fechar={() => setMostrarLaudo(false)} />
      )}

      <aside className="flex w-72 shrink-0 flex-col justify-between border-r border-slate-800 bg-slate-900/80 backdrop-blur-md">
        <div>
          <div className="border-b border-slate-800 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-purple-600 p-2.5 shadow-lg shadow-purple-900/30">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold leading-tight text-white">AçaíThermal Twin</h1>
                <p className="text-xs font-medium text-purple-400">Gêmeo digital do branqueamento</p>
              </div>
            </div>

            <div className="mt-4 space-y-1.5 text-xs">
              <Conexao rotulo="Motor numérico" ok={motorOnline} />
              <Conexao rotulo="Stream em tempo real" ok={modo === 'tempo_real' ? realtimeOk : null}
                dica={modo === 'tempo_real' ? undefined : 'inativo'} />
            </div>

            <div className="mt-3 flex rounded-xl border border-slate-800 bg-slate-950 p-1 text-[10px] font-mono">
              {[['simulacao', 'Simulação'], ['tempo_real', 'Tempo real']].map(([id, rot]) => (
                <button key={id} onClick={() => trocarModo(id)} className={`flex-1 rounded-lg py-1 text-center transition-all disabled:opacity-40 ${modo === id ? 'bg-purple-600 font-bold text-white' : 'text-slate-400 hover:text-white'}`}>
                  {rot}
                </button>
              ))}
            </div>
          </div>

          <nav className="max-h-[calc(100vh-270px)] space-y-1 overflow-y-auto p-3">
            {ABAS.map(({ id, rotulo, icon: Icon }) => (
              <button key={id} onClick={() => setAba(id)}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all ${aba === id ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <span className="flex items-center gap-2.5"><Icon className="h-4 w-4" /> {rotulo}</span>
                {aba === id && <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ))}
          </nav>
        </div>
        <div className="space-y-1 border-t border-slate-800 p-4 text-xs text-slate-500">
          <p className="font-semibold text-slate-400">TCC • IFPA Campus Ananindeua</p>
          <p>Bacharelado em Ciência e Tecnologia</p>
        </div>
      </aside>

      <main className="max-h-screen flex-1 space-y-6 overflow-y-auto p-6">
        <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-purple-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                {modo === 'simulacao' ? 'Condições do ciclo' : `Acompanhando lote ${loteId || '—'}`}
              </span>
            </div>
            {modo === 'tempo_real' && (
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="text-slate-400">Lote:</span>
                <select value={loteId || ''} onChange={(e) => carregarLote(e.target.value).catch((er) => setErro(er.message))}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 font-mono text-slate-200">
                  {!loteId && <option value="">nenhum lote gravado</option>}
                  {lotesGravados.map((l) => <option key={l.lote_id} value={l.lote_id}>{l.lote_id}</option>)}
                </select>
                {loteId && (
                  <a href={api.urlCsv(loteId)}
                    className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 font-semibold text-slate-300 hover:bg-slate-800">
                    <Baixar className="h-3.5 w-3.5" /> Exportar CSV
                  </a>
                )}
                <span className="text-slate-500">Envie leituras com <code className="text-purple-300">python simulator/mock_sensor.py</code></span>
              </div>
            )}
            {modo === 'simulacao' && (
              <div className="flex flex-wrap items-center gap-5 text-xs">
                <label className="flex items-center gap-2">
                  <span className="text-slate-400">Diâmetro:</span>
                  {[12, 14, 16].map((d) => (
                    <button key={d} disabled={ocupado} onClick={() => setDiametroMm(d)}
                      className={`rounded-lg px-2.5 py-1 font-mono font-bold ${diametroMm === d ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
                      {d} mm
                    </button>
                  ))}
                </label>
                <Deslizante rotulo="Banho" valor={tempBanho} setValor={setTempBanho} min={78} max={95} passo={0.5} unidade="°C" disabled={ocupado} />
                <Deslizante rotulo="Fruto inicial" valor={tempInicial} setValor={setTempInicial} min={20} max={32} passo={0.5} unidade="°C" disabled={ocupado} />
                <Deslizante rotulo="Tempo fixo (comparação)" valor={tempoFixo} setValor={setTempoFixo} min={5} max={60} passo={1} unidade="s" disabled={ocupado} />
                <div className="flex items-center gap-2">
                  <button onClick={iniciarCiclo} disabled={rodando}
                    className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:bg-purple-500 disabled:opacity-50">
                    <Play className="h-3.5 w-3.5" /> {rodando ? 'Processando…' : 'Iniciar ciclo'}
                  </button>
                  <button onClick={resetar}
                    className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                </div>
              </div>
            )}
          </div>
          {erro && (
            <p className="mt-3 flex items-center gap-2 text-xs text-rose-400">
              <AlertTriangle className="h-3.5 w-3.5" /> {erro}
            </p>
          )}
        </div>

        {aba === 'dashboard' && (
          <Supervisorio estado={estado} historico={historico} malha={malha} diametroMm={diametroMm} modo={modo} />
        )}
        {aba === 'comparativo' && <Comparativo comparacao={comparacao} />}
        {aba === 'sensibilidade' && <Sensibilidade tempBanho={tempBanho} tempInicial={tempInicial} diametroMm={diametroMm} />}
        {aba === 'normas' && <Normas />}
        {aba === 'convencional' && <Convencional />}
        {aba === 'acai_info' && <Fruto />}
        {aba === 'fisica' && <Fisica />}
        {aba === 'arquitetura' && <Arquitetura />}
        {aba === 'parametros' && <Parametros />}
        {aba === 'historico' && <Historico historico={historico} loteId={loteId} />}
      </main>
    </div>
  );
}

function Conexao({ rotulo, ok, dica }) {
  const cor = ok === true ? 'text-emerald-400' : ok === false ? 'text-rose-500' : 'text-slate-500';
  const bola = ok === true ? 'bg-emerald-400 animate-pulse' : ok === false ? 'bg-rose-500' : 'bg-slate-600';
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2">
      <span className="flex items-center gap-2 text-slate-400"><Wifi className={`h-3.5 w-3.5 ${cor}`} /> {rotulo}</span>
      <span className="flex items-center gap-2 text-[10px] text-slate-500">{dica}<span className={`h-2 w-2 rounded-full ${bola}`} /></span>
    </div>
  );
}

function Deslizante({ rotulo, valor, setValor, min, max, passo, unidade, disabled }) {
  return (
    <label className="flex items-center gap-2.5">
      <span className="text-slate-400">{rotulo}:</span>
      <input type="range" min={min} max={max} step={passo} value={valor} disabled={disabled}
        onChange={(e) => setValor(Number(e.target.value))} className="w-24 cursor-pointer accent-purple-500" />
      <span className="w-14 font-mono font-bold text-purple-300">{fmt(valor, passo < 1 ? 1 : 0)} {unidade}</span>
    </label>
  );
}

function ModalLaudo({ resultado, comparacao, diametroMm, loteId, fechar }) {
  const { resumo } = resultado;
  const ok = resumo.conforme;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-3xl border border-purple-500/40 bg-slate-900 p-8 shadow-2xl shadow-purple-950/60">
        <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className={`rounded-xl border p-3 ${ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-rose-500/30 bg-rose-500/10 text-rose-400'}`}>
              {ok ? <Award className="h-7 w-7" /> : <XCircle className="h-7 w-7" />}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Resultado do ciclo</h3>
              <p className="text-xs text-slate-400">Lote {loteId} · Ø {diametroMm} mm · banho {fmt(resultado.entrada.temp_banho_c)} °C</p>
            </div>
          </div>
          <span className={`rounded-full border px-3.5 py-1 font-mono text-xs font-semibold ${ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-rose-500/30 bg-rose-500/10 text-rose-400'}`}>
            {ok ? 'Conforme' : 'Não conforme'}
          </span>
        </div>

        <div className="mb-6 grid gap-3 text-xs sm:grid-cols-3">
          <Bloco titulo="Imersão até o corte" valor={`${fmt(resumo.tempo_corte_s)} s`} rodape={`Superfície ≥ 80 °C por ${fmt(resumo.tempo_letal_superficie_s)} s`} />
          <Bloco titulo="Superfície no corte" valor={`${fmt(resumo.temp_superficie_no_corte_c)} °C`} rodape={`Centro: ${fmt(resumo.temp_centro_no_corte_c)} °C`} />
          <Bloco titulo="Energia absorvida" valor={`${fmt(resumo.energia_absorvida_no_corte_kj_kg)} kJ/kg`} rodape={`Antocianinas: ${fmt(resumo.retencao_antocianinas_pct, 2)} %`} />
        </div>

        {!ok && (
          <div className="mb-6 rounded-xl border border-rose-800/60 bg-rose-950/30 p-4 text-xs text-rose-200">
            {(resumo.motivos || []).join(' ')}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={fechar} className="rounded-xl px-5 py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white">
            Fechar
          </button>
          <button onClick={async () => {
            // jsPDF só é baixado quando o usuário pede o laudo (bundle inicial menor)
            const { gerarLaudoPDF } = await import('./laudo');
            await gerarLaudoPDF({ resultado, comparacao, diametroMm, loteId });
          }}
            className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-purple-900/40 hover:bg-purple-500">
            <Download className="h-4 w-4" /> Baixar laudo (PDF)
          </button>
        </div>
      </div>
    </div>
  );
}

function Bloco({ titulo, valor, rodape }) {
  return (
    <div className="space-y-1 rounded-xl border border-slate-800 bg-slate-950 p-3">
      <span className="text-slate-400">{titulo}</span>
      <p className="font-mono text-lg font-bold text-white">{valor}</p>
      <p className="text-[10px] text-slate-400">{rodape}</p>
    </div>
  );
}
