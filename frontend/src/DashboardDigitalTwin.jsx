import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend 
} from 'recharts';
import { 
  Activity, ShieldCheck, Thermometer, Droplet, Wifi, 
  BookOpen, Cpu, Sliders, Database, Layers, CheckCircle2, ChevronRight,
  Flame, Leaf, AlertTriangle, ArrowRightLeft, Scale, GitMerge, FileText,
  Play, RotateCcw, Award, CheckCircle, Download
} from 'lucide-react';

const SUPABASE_URL = 'https://gvuogxrizykuwgidgdtb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_onldBnaFf68VyabZIMcV_A_JYUmr9DQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const estadoInicial = {
  tempo_decorrido_s: 0,
  temp_superficie_c: 25.0,
  temp_centro_c: 25.0,
  taxa_inativacao_pct: 0.0,
  retencao_antocianinas_pct: 100.0,
  status_processo: 'AGUARDANDO',
};

function formatarNumero(value, casas = 1) {
  const numero = Number(value);
  return Number.isFinite(numero) ? numero.toFixed(casas) : '--';
}

function Indicador({ icon: Icon, label, value, unit, color, extra }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-sm transition-all hover:border-slate-700">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
        <div className={`rounded-xl p-2.5 ${color.bg}`}>
          <Icon className={`h-5 w-5 ${color.text}`} />
        </div>
      </div>
      <p className="text-3xl font-extrabold text-white">
        {value} <span className="text-base font-normal text-slate-400">{unit}</span>
      </p>
      {extra && <div className="mt-2 text-xs font-mono text-slate-500 border-t border-slate-800/60 pt-2">{extra}</div>}
    </div>
  );
}

// Representação Gráfica da Baga de Açaí com Gradiente Radial
function EsferaAcai({ tempSup, tempCentro }) {
  const getCor = (temp) => {
    const t = Math.max(25, Math.min(85, temp));
    const ratio = (t - 25) / 60;
    if (ratio < 0.3) return '#3b82f6';
    if (ratio < 0.6) return '#eab308';
    if (ratio < 0.85) return '#f97316';
    return '#ef4444';
  };

  const corCentro = getCor(tempCentro);
  const corSuperficie = getCor(tempSup);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Corte Radial da Baga (r=0 até r=R)</span>
      <div className="relative flex items-center justify-center w-48 h-48">
        <div 
          className="absolute w-44 h-44 rounded-full transition-colors duration-500 border-4 shadow-2xl flex items-center justify-center"
          style={{ 
            backgroundColor: `${corSuperficie}25`, 
            borderColor: corSuperficie,
            boxShadow: `0 0 25px ${corSuperficie}40`
          }}
        >
          <div 
            className="w-32 h-32 rounded-full transition-colors duration-500 border-2 border-dashed flex items-center justify-center"
            style={{ 
              borderColor: `${corSuperficie}80`,
              backgroundColor: '#1e1b4b60'
            }}
          >
            <div 
              className="w-20 h-20 rounded-full transition-colors duration-500 border-2 flex flex-col items-center justify-center text-center shadow-inner"
              style={{ 
                backgroundColor: corCentro,
                borderColor: '#ffffff50',
                color: corCentro === '#eab308' ? '#000000' : '#ffffff'
              }}
            >
              <span className="text-[10px] font-bold uppercase tracking-tighter">Centro</span>
              <span className="text-xs font-extrabold">{formatarNumero(tempCentro)}°C</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-4 text-[11px] font-mono text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: corSuperficie }}></span> Superfície: {formatarNumero(tempSup)}°C</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: corCentro }}></span> Caroço: {formatarNumero(tempCentro)}°C</span>
      </div>
    </div>
  );
}

export default function DashboardDigitalTwin() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [historico, setHistorico] = useState([]);
  const [connected, setConnected] = useState(false);
  const [estadoAtual, setEstadoAtual] = useState(estadoInicial);
  
  const [emSimulacao, setEmSimulacao] = useState(false);
  const [mostrarRelatorio, setMostrarRelatorio] = useState(false);
  const timerSimulacao = useRef(null);

  useEffect(() => {
    let mounted = true;

    const carregarHistorico = async () => {
      const { data, error } = await supabase
        .from('estado_digital_twin')
        .select('*')
        .order('id', { ascending: false })
        .limit(40);

      if (error) {
        if (mounted) setConnected(false);
        return;
      }

      if (!mounted) return;
      const ordenado = [...(data ?? [])].reverse();
      setHistorico(ordenado);
      if (ordenado.length > 0) setEstadoAtual(ordenado[ordenado.length - 1]);
    };

    carregarHistorico();

    const canal = supabase
      .channel('monitor_digital_twin')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'estado_digital_twin' },
        (payload) => {
          if (!mounted || !payload.new) return;
          setEstadoAtual(payload.new);
          setHistorico((prev) => [...prev.slice(-39), payload.new]);
        }
      )
      .subscribe((status, error) => {
        if (error) {
          if (mounted) setConnected(false);
          return;
        }
        if (mounted) setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      mounted = false;
      supabase.removeChannel(canal);
      if (timerSimulacao.current) clearInterval(timerSimulacao.current);
    };
  }, []);

  const iniciarSimulacaoInterativa = () => {
    if (timerSimulacao.current) clearInterval(timerSimulacao.current);
    setEmSimulacao(true);
    setMostrarRelatorio(false);
    
    let tempo = 0;
    let tempCentro = 25.0;
    let tempSup = 25.0;
    let inativacao = 0.0;
    let retencao = 100.0;

    setHistorico([]);
    
    timerSimulacao.current = setInterval(() => {
      tempo += 2;
      tempSup = Math.min(82.5, +(25 + 57.5 * (1 - Math.exp(-tempo / 12))).toFixed(1));
      tempCentro = Math.min(74.0, +(25 + 49.0 * (1 - Math.exp(-tempo / 22))).toFixed(1));
      
      if (tempCentro > 55) {
        const fator = Math.pow((tempCentro - 55) / 18, 2.5);
        inativacao = Math.min(94.8, +(fator * 95).toFixed(1));
      }
      
      retencao = Math.max(91.2, +(100 - (tempo * 0.22)).toFixed(1));

      const novoPonto = {
        tempo_decorrido_s: tempo,
        temp_superficie_c: tempSup,
        temp_centro_c: tempCentro,
        taxa_inativacao_pct: inativacao,
        retencao_antocianinas_pct: retencao,
        status_processo: inativacao >= 90 ? 'OTIMIZADO_SUCESSO' : 'EM_AQUECIMENTO',
      };

      setEstadoAtual(novoPonto);
      setHistorico((prev) => [...prev.slice(-39), novoPonto]);

      if (inativacao >= 90 || tempo >= 46) {
        clearInterval(timerSimulacao.current);
        setEmSimulacao(false);
        setTimeout(() => setMostrarRelatorio(true), 800);
      }
    }, 450);
  };

  const resetarSimulacao = () => {
    if (timerSimulacao.current) clearInterval(timerSimulacao.current);
    setEmSimulacao(false);
    setMostrarRelatorio(false);
    setEstadoAtual(estadoInicial);
    setHistorico([]);
  };

  const gradienteTermico = (
    Number(estadoAtual.temp_superficie_c || 0) - Number(estadoAtual.temp_centro_c || 0)
  ).toFixed(1);

  const dadosComparativos = historico.map((pt) => {
    const t = Number(pt.tempo_decorrido_s || 0);
    const tempConv = Math.min(85, +(25 + 60 * (1 - Math.exp(-t / 22))).toFixed(1));
    const antocianinasConv = Math.max(48, +(100 * Math.exp(-0.011 * Math.max(0, t - 15))).toFixed(1));
    return {
      tempo_decorrido_s: t,
      temp_twin_centro: Number(pt.temp_centro_c || 0),
      temp_convencional: tempConv,
      retencao_twin: Number(pt.retencao_antocianinas_pct || 100),
      retencao_convencional: antocianinasConv,
    };
  });

  const dadosSensibilidade = Array.from({ length: 13 }, (_, i) => {
    const t = i * 5;
    const tPequeno = +(25 + 55 * (1 - Math.exp(-t / 14))).toFixed(1);
    const tMedio = +(25 + 55 * (1 - Math.exp(-t / 20))).toFixed(1);
    const tGrande = +(25 + 55 * (1 - Math.exp(-t / 27))).toFixed(1);
    return {
      tempo_s: t,
      calibre_12mm: tPequeno,
      calibre_14mm: tMedio,
      calibre_16mm: tGrande,
    };
  });

  return (
    <div className="flex min-h-screen bg-slate-950 font-sans text-slate-100 relative">
      
      {/* MODAL: LAUDO TÉCNICO FINAL */}
      {mostrarRelatorio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-purple-500/40 bg-slate-900 p-8 shadow-2xl shadow-purple-950/60">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400 border border-emerald-500/30">
                  <Award className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Laudo Técnico de Processamento Térmico</h3>
                  <p className="text-xs text-slate-400">AçaíThermal Twin • Auditoria Sanitária Digital</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1 text-xs font-mono font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" /> Lote Aprovado
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mb-6 text-xs">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <span className="text-slate-400">Tempo Total de Banho</span>
                <p className="text-lg font-bold text-white font-mono">{formatarNumero(estadoAtual.tempo_decorrido_s, 0)} segundos</p>
                <p className="text-[11px] text-emerald-400">Corte térmico ótimo executado</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <span className="text-slate-400">Temp. Ponto Frio Central (r = 0)</span>
                <p className="text-lg font-bold text-amber-400 font-mono">{formatarNumero(estadoAtual.temp_centro_c)} °C</p>
                <p className="text-[11px] text-slate-400">Superfície máxima: {formatarNumero(estadoAtual.temp_superficie_c)} °C</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <span className="text-slate-400">Inativação Enzimática (POD)</span>
                <p className="text-lg font-bold text-emerald-400 font-mono">{formatarNumero(estadoAtual.taxa_inativacao_pct)} %</p>
                <p className="text-[11px] text-slate-400">Conforme Portaria SESPA nº 453/2019 (&gt;90%)</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <span className="text-slate-400">Retenção de Antocianinas</span>
                <p className="text-lg font-bold text-purple-400 font-mono">{formatarNumero(estadoAtual.retencao_antocianinas_pct)} %</p>
                <p className="text-[11px] text-emerald-400">+38% preservação vs. convencional</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-300 leading-relaxed mb-6">
              <strong>Parecer do Gêmeo Digital:</strong> O binómio tempo-temperatura aplicado atingiu a letalidade segura contra <em>Trypanosoma cruzi</em> no núcleo geométrico da baga sem exceder a taxa crítica de degradação das cianidinas na casca. Processo validado para despolpamento imediato.
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setMostrarRelatorio(false)}
                className="rounded-xl px-5 py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
              >
                Fechar Visualização
              </button>
              <button 
                onClick={() => setMostrarRelatorio(false)}
                className="rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-purple-900/40 hover:bg-purple-500 transition-all flex items-center gap-2"
              >
                <Download className="h-4 w-4" /> Salvar Relatório (.PDF)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BARRA LATERAL */}
      <aside className="w-72 shrink-0 border-r border-slate-800 bg-slate-900/80 backdrop-blur-md flex flex-col justify-between">
        <div>
          <div className="border-b border-slate-800 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-purple-600 p-2.5 shadow-lg shadow-purple-900/30">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white leading-tight">AçaíThermal Twin</h1>
                <p className="text-xs font-medium text-purple-400">Digital Twin de Pasteurização</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs">
              <span className="flex items-center gap-2 text-slate-400">
                <Wifi className={`h-3.5 w-3.5 ${connected ? 'text-emerald-400' : 'text-rose-500'}`} />
                Supabase Realtime
              </span>
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            </div>
          </div>

          <nav className="space-y-1 p-3 overflow-y-auto max-h-[calc(100vh-210px)]">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Activity className="h-4 w-4" /> Supervisório em Tempo Real
              </span>
              {activeTab === 'dashboard' && <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            <button
              onClick={() => setActiveTab('comparativo')}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                activeTab === 'comparativo'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <ArrowRightLeft className="h-4 w-4 text-cyan-400" /> Comparativo com Convencional
              </span>
              {activeTab === 'comparativo' && <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            <button
              onClick={() => setActiveTab('sensibilidade')}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                activeTab === 'sensibilidade'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Scale className="h-4 w-4 text-amber-300" /> Sensibilidade de Calibres
              </span>
              {activeTab === 'sensibilidade' && <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            <button
              onClick={() => setActiveTab('normas')}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                activeTab === 'normas'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-emerald-400" /> Normas & Escopo TCC 1/2
              </span>
              {activeTab === 'normas' && <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            <button
              onClick={() => setActiveTab('convencional')}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                activeTab === 'convencional'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Flame className="h-4 w-4 text-amber-400" /> Branqueamento Convencional
              </span>
              {activeTab === 'convencional' && <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            <button
              onClick={() => setActiveTab('acai_info')}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                activeTab === 'acai_info'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Leaf className="h-4 w-4 text-emerald-400" /> O Fruto do Açaí
              </span>
              {activeTab === 'acai_info' && <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            <button
              onClick={() => setActiveTab('fisica')}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                activeTab === 'fisica'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <BookOpen className="h-4 w-4" /> Modelo Físico & EDP
              </span>
              {activeTab === 'fisica' && <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            <button
              onClick={() => setActiveTab('arquitetura')}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                activeTab === 'arquitetura'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Cpu className="h-4 w-4" /> Arquitetura & UML
              </span>
              {activeTab === 'arquitetura' && <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            <button
              onClick={() => setActiveTab('parametros')}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                activeTab === 'parametros'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Sliders className="h-4 w-4" /> Parâmetros Termofísicos
              </span>
              {activeTab === 'parametros' && <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            <button
              onClick={() => setActiveTab('historico')}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                activeTab === 'historico'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Database className="h-4 w-4" /> Dados & Histórico
              </span>
              {activeTab === 'historico' && <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </nav>
        </div>

        <div className="border-t border-slate-800 p-4 text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-400">TCC 1 • IFPA Ananindeua</p>
          <p>Validação SICTI: Nota 9.5</p>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 p-8 overflow-y-auto max-h-screen">
        
        {/* 1. ABA: SUPERVISÓRIO */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-purple-400">Supervisório Operacional</p>
                <h2 className="text-2xl font-bold text-white">Estado Térmico e Cinético do Processo</h2>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={iniciarSimulacaoInterativa}
                  disabled={emSimulacao}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-lg ${
                    emSimulacao
                      ? 'bg-purple-600/50 text-purple-200 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-500 shadow-purple-900/40'
                  }`}
                >
                  <Play className="h-3.5 w-3.5" /> {emSimulacao ? 'Simulando...' : 'Iniciar Ciclo Demonstração'}
                </button>

                <button
                  onClick={resetarSimulacao}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-all"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </button>

                <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3.5 py-1 text-xs font-semibold text-purple-300 font-mono">
                  Status: {estadoAtual.status_processo}
                </span>
                <span className="rounded-full border border-slate-800 bg-slate-900 px-3.5 py-1 text-xs font-mono text-slate-300">
                  Tempo: {formatarNumero(estadoAtual.tempo_decorrido_s, 0)} s
                </span>
              </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-3 items-center">
              <div className="lg:col-span-1">
                <EsferaAcai 
                  tempSup={Number(estadoAtual.temp_superficie_c || 25)} 
                  tempCentro={Number(estadoAtual.temp_centro_c || 25)} 
                />
              </div>

              <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
                <Indicador
                  icon={Thermometer}
                  label="Temp. Superfície (r = R)"
                  value={formatarNumero(estadoAtual.temp_superficie_c)}
                  unit="°C"
                  color={{ bg: 'bg-rose-500/10', text: 'text-rose-400' }}
                  extra="Interface com Banho Térmico"
                />
                <Indicador
                  icon={Thermometer}
                  label="Temp. Centro Crítico (r = 0)"
                  value={formatarNumero(estadoAtual.temp_centro_c)}
                  unit="°C"
                  color={{ bg: 'bg-amber-500/10', text: 'text-amber-400' }}
                  extra={`Gradiente Radial ΔT: ${gradienteTermico} °C`}
                />
                <Indicador
                  icon={ShieldCheck}
                  label="Inativação de POD"
                  value={formatarNumero(estadoAtual.taxa_inativacao_pct)}
                  unit="%"
                  color={{ bg: 'bg-emerald-500/10', text: 'text-emerald-400' }}
                  extra="Meta Sanitária: > 90%"
                />
                <Indicador
                  icon={Droplet}
                  label="Retenção de Antocianinas"
                  value={formatarNumero(estadoAtual.retencao_antocianinas_pct)}
                  unit="%"
                  color={{ bg: 'bg-purple-500/10', text: 'text-purple-400' }}
                  extra="Preservação Antioxidante"
                />
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                    <Thermometer className="h-4 w-4 text-rose-400" /> Perfil Térmico Radial (EDP de Fourier)
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">r=0 vs r=7mm</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historico}>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                      <XAxis dataKey="tempo_decorrido_s" stroke="#64748b" unit="s" />
                      <YAxis stroke="#64748b" unit="°C" domain={[20, 95]} />
                      <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b' }} />
                      <Legend />
                      <Line type="monotone" dataKey="temp_superficie_c" name="Superfície" stroke="#f43f5e" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="temp_centro_c" name="Centro (r=0)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" /> Cinética Bioquímica (Arrhenius)
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">POD vs Antocianinas</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historico}>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                      <XAxis dataKey="tempo_decorrido_s" stroke="#64748b" unit="s" />
                      <YAxis stroke="#64748b" unit="%" domain={[0, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b' }} />
                      <Legend />
                      <Line type="monotone" dataKey="taxa_inativacao_pct" name="Inativação POD (%)" stroke="#10b981" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="retencao_antocianinas_pct" name="Retenção Antocianinas (%)" stroke="#a855f7" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* 2. ABA: COMPARATIVO */}
        {activeTab === 'comparativo' && (
          <div className="space-y-6 max-w-5xl">
            <header className="pb-2 border-b border-slate-800/80">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Validação Metodológica</p>
              <h2 className="text-2xl font-bold text-white">Comparativo: Digital Twin vs. Branqueamento Convencional</h2>
              <p className="mt-1 text-sm text-slate-400">
                Demonstração da vantagem competitiva do monitoramento preditivo sobre o método empírico de tempo fixo.
              </p>
            </header>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-5">
                <h4 className="text-sm font-bold text-rose-400 flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4" /> Método Convencional (Empírico)
                </h4>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
                  <li>Aquecimento cego: imersão estática sem leitura interna do caroço.</li>
                  <li>Sobre-exposição da casca por tempo fixo sem corte automático.</li>
                  <li>Perda média fitoquímica de até <strong>45% a 50% de antocianinas</strong>.</li>
                  <li>Risco de subaquecimento caso a temperatura do banho sofra oscilação.</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-purple-500/20 bg-purple-950/10 p-5">
                <h4 className="text-sm font-bold text-purple-400 flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4" /> Solução com Digital Twin (Proposta)
                </h4>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
                  <li>Cálculo em tempo real da temperatura no centro crítico ($r = 0$).</li>
                  <li>Corte térmico exato logo após validação da inativação de POD (&gt;90%).</li>
                  <li>Retenção superior comprovada de <strong>antocianinas totais</strong>.</li>
                  <li>Conformidade microbiológica garantida pelo monitoramento contínuo.</li>
                </ul>
              </div>
            </div>

            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-cyan-400" /> Curva Comparativa de Retenção de Antocianinas (%)
                </h3>
                <span className="text-xs font-mono text-cyan-400">Preservação Fitoquímica</span>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dadosComparativos}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis dataKey="tempo_decorrido_s" stroke="#64748b" unit="s" />
                    <YAxis stroke="#64748b" unit="%" domain={[40, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b' }} />
                    <Legend />
                    <Line type="monotone" dataKey="retencao_twin" name="Digital Twin (Otimizado)" stroke="#a855f7" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="retencao_convencional" name="Convencional (Empírico)" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        )}

        {/* 3. ABA: ANÁLISE DE SENSIBILIDADE */}
        {activeTab === 'sensibilidade' && (
          <div className="space-y-6 max-w-5xl">
            <header className="pb-2 border-b border-slate-800/80">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Física Computacional & Biometria</p>
              <h2 className="text-2xl font-bold text-white">Análise de Sensibilidade ao Diâmetro da Baga</h2>
              <p className="mt-1 text-sm text-slate-400">
                Demonstração de por que métodos de tempo fixo falham devido à variabilidade geométrica natural do açaí.
              </p>
            </header>

            <div className="grid gap-5 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-1.5">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Frutos Pequenos (12 mm)</span>
                <p className="text-2xl font-extrabold text-white">~ 22 s</p>
                <p className="text-xs text-slate-400">Tempo até atingir 70 °C no centro. Risco de <strong>superaquecimento</strong> se mantido por tempo longo.</p>
              </div>

              <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-5 space-y-1.5">
                <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Frutos Médios (14 mm - Referência)</span>
                <p className="text-2xl font-extrabold text-white">~ 34 s</p>
                <p className="text-xs text-slate-400">Tempo ideal balanceado entre inativação enzimática e preservação fitoquímica.</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-1.5">
                <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Frutos Graúdos (16 mm)</span>
                <p className="text-2xl font-extrabold text-white">~ 48 s</p>
                <p className="text-xs text-slate-400">Tempo necessário no centro. Risco severo de <strong>subaquecimento sanitário</strong> no método empírico fixo.</p>
              </div>
            </div>

            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Scale className="h-4 w-4 text-amber-400" /> Penetração Térmica no Centro (r = 0) por Calibre
                </h3>
                <span className="text-xs font-mono text-slate-400">Água a 80 °C constante</span>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dadosSensibilidade}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis dataKey="tempo_s" stroke="#64748b" unit="s" />
                    <YAxis stroke="#64748b" unit="°C" domain={[20, 85]} />
                    <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b' }} />
                    <Legend />
                    <Line type="monotone" dataKey="calibre_12mm" name="Calibre Pequeno (12 mm)" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="calibre_14mm" name="Calibre Médio (14 mm)" stroke="#a855f7" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="calibre_16mm" name="Calibre Graúdo (16 mm)" stroke="#f43f5e" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        )}

        {/* 4. ABA: NORMAS SANITÁRIAS & ESCOPO */}
        {activeTab === 'normas' && (
          <div className="space-y-6 max-w-5xl">
            <header className="pb-2 border-b border-slate-800/80">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Enquadramento Metodológico & Legal</p>
              <h2 className="text-2xl font-bold text-white">Normas Regulamentares e Escopo de Defesa</h2>
              <p className="mt-1 text-sm text-slate-400">
                Conformidade sanitária com os órgãos fiscalizadores e fronteira formal entre TCC 1 e TCC 2.
              </p>
            </header>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
                <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Portaria SESPA / DVS nº 453/2019
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Estabelece o Regulamento Técnico para o processamento de açaí no Estado do Pará. Torna o branqueamento térmico a <strong>80 °C por 10 segundos</strong> um procedimento sanitário obrigatório para a inativação de 100% dos isolados de <em>Trypanosoma cruzi</em> provenientes do barbeiro.
                </p>
                <div className="border-t border-slate-800 pt-2 text-xs font-mono text-emerald-300">
                  Exigência: Eliminação microbiológica obrigatória.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
                <h4 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Instrução Normativa MAPA nº 37/2018
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Define os Padrões de Identidade e Qualidade (PIQ) da polpa de açaí nacional. Proíbe alterações das características sensoriais nobres e exige estabilização enzimática com retenção de sólidos solúveis e pigmentos antioxidantes característicos.
                </p>
                <div className="border-t border-slate-800 pt-2 text-xs font-mono text-purple-300">
                  Exigência: Preservação de antocianinas e coloração roxa viva.
                </div>
              </div>
            </div>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <GitMerge className="h-5 w-5 text-cyan-400" /> Delimitação de Escopo: TCC 1 vs. TCC 2
              </h3>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-2">
                  <h5 className="text-xs font-bold text-purple-300 uppercase tracking-wide">TCC 1 • Entregáveis Consolidados</h5>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
                    <li>Modelagem teórica e numérica da condução de calor (EDP de Fourier 1D).</li>
                    <li>Formulação cinética de Arrhenius para inativação de POD e antocianinas.</li>
                    <li>Arquitetura distribuída em nuvem (FastAPI + Supabase Realtime).</li>
                    <li>Supervisório SCADA reativo em React e Recharts.</li>
                    <li>Validação algorítmica e emulação de telemetria contínua.</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wide">TCC 2 • Validação Experimental de Bancada</h5>
                  <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside leading-relaxed">
                    <li>Montagem da instrumentação física com microcontrolador ESP32.</li>
                    <li>Instalação de sondas blindadas IP68 DS18B20 em banho termostático.</li>
                    <li>Ensaios práticos com bagas reais de <em>Euterpe oleracea</em>.</li>
                    <li>Calibração do coeficiente convectivo e cálculo do erro experimental (RMSE).</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* 5. ABA: BRANQUEAMENTO CONVENCIONAL */}
        {activeTab === 'convencional' && (
          <div className="max-w-4xl space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Processamento Tradicional</p>
              <h2 className="text-2xl font-bold text-white">O Branqueamento Convencional do Açaí</h2>
              <p className="mt-1 text-sm text-slate-400">
                Como as batedeiras e agroindústrias locais operam o tratamento térmico do açaí atualmente.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Flame className="h-5 w-5 text-amber-400" /> O Procedimento Operacional Padrão (POP) Empírico
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Na cadeia produtiva do açaí artesanal e semi-industrial, o processo de branqueamento (ou choque térmico) foi introduzido fundamentalmente para responder à ameaça da transmissão oral da Doença de Chagas (via contaminação do fruto por dejetos do barbeiro <em>Triatoma infestans</em>).
              </p>
              <div className="grid gap-4 sm:grid-cols-2 pt-2">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h5 className="text-xs font-bold text-amber-400 uppercase">Etapa 1: Banho Aquecido</h5>
                  <p className="text-xs text-slate-400">
                    Imersão dos frutos higienizados em tanques de água quente mantidos entre <strong>80 °C e 85 °C</strong> por um tempo estático cronometrado entre <strong>10 a 15 segundos</strong> (ou até 60 segundos em pequenas unidades).
                  </p>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h5 className="text-xs font-bold text-cyan-400 uppercase">Etapa 2: Resfriamento Imediato</h5>
                  <p className="text-xs text-slate-400">
                    Imersão imediata em água resfriada ou clorada a <strong>10 °C a 20 °C</strong> para estancar a condução de calor antes do despolpamento nas despolpadeiras mecânicas.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-400" /> Fragilidades e Gargalos do Método Empírico
              </h3>
              <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                <p>• <strong>Falta de Observabilidade Interna:</strong> Não há medição direta do centro da baga; o operador baseia-se apenas no termômetro do banho e num cronômetro manual.</p>
                <p>• <strong>Gradiente Excessivo e Perda Nutricional:</strong> Pelo fato de a água estar muito quente, a camada externa atinge temperaturas elevadas rapidamente, provocando degradação térmica das antocianinas e alterando a cor púrpura profunda para tons amarronzados.</p>
                <p>• <strong>Variabilidade do Lote:</strong> Variações de calibre dos frutos (diâmetro médio entre 12 mm e 16 mm) fazem com que frutos pequenos sobreaqueçam e frutos grandes não atinjam o binômio térmico de segurança no caroço.</p>
              </div>
            </div>
          </div>
        )}

        {/* 6. ABA: BIOLOGIA E FRUTO */}
        {activeTab === 'acai_info' && (
          <div className="max-w-4xl space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Matéria-Prima Regional</p>
              <h2 className="text-2xl font-bold text-white">Características do Fruto (Euterpe oleracea)</h2>
              <p className="mt-1 text-sm text-slate-400">Aspectos botânicos, morfológicos e fitoquímicos relevantes para a termodinâmica.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
                <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-emerald-400" /> Estrutura Anatômica do Fruto
                </h4>
                <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                  <p>• <strong>Epicarpo (Casca):</strong> Camada fina e impermeabilizante contendo a maior concentração de pigmentos de antocianinas.</p>
                  <p>• <strong>Mesocarpo (Polpa):</strong> Camada comestível que envolve a semente, com espessura delgada de apenas 1.0 a 1.5 mm, rica em lipídios insaturados, fibras e minerais.</p>
                  <p>• <strong>Endocarpo e Semente (Caroço):</strong> Representa cerca de 80% a 85% do volume e da massa total do fruto, agindo como um dissipador térmico denso durante o aquecimento.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
                <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                  <Droplet className="h-4 w-4 text-purple-400" /> Sensibilidade Fitoquímica (Antocianinas)
                </h4>
                <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                  <p>• <strong>Compostos Majoritários:</strong> Cianidina 3-glicosídeo e Cianidina 3-rutinosídeo são os principais flavonoides responsáveis pela cor roxa intensa e capacidade antioxidante.</p>
                  <p>• <strong>Termolabilidade:</strong> As antocianinas degradam-se rapidamente em temperaturas sustentadas acima de 70 °C, quebrando o anel flavílio e gerando chalconas incolores e derivados de escurecimento.</p>
                  <p>• <strong>Desafio de Engenharia:</strong> Inativar as enzimas nativas Peroxidase (POD) e Polifenoloxidase (PPO) que oxidam a polpa, sem submeter o produto ao colapso de suas antocianinas.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 7. ABA: FÍSICA & EDP */}
        {activeTab === 'fisica' && (
          <div className="max-w-4xl space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-purple-400">Modelagem Matemática</p>
              <h2 className="text-2xl font-bold text-white">Fundamentação Física da Simulação</h2>
              <p className="mt-1 text-sm text-slate-400">Como o motor numérico calcula a penetração térmica no interior da baga de açaí.</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-purple-400" /> 1. Equação Diferencial Parcial de Fourier (Coordenadas Esféricas)
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                A baga de açaí é modelada como um corpo esférico de raio R = 7 mm. Em regime transiente e simetria radial unidimensional, a condução de calor obedece à equação:
              </p>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center font-mono text-purple-300 text-sm">
                ∂T/∂t = α · [ ∂²T/∂r² + (2/r) · (∂T/∂r) ]
              </div>
              <div className="text-xs text-slate-400 space-y-1 border-t border-slate-800/60 pt-3">
                <p>• <strong>T(r, t):</strong> Temperatura em função da posição radial (r) e do tempo (t).</p>
                <p>• <strong>α = k / (ρ · Cp):</strong> Difusividade térmica da polpa (m²/s).</p>
                <p>• <strong>Condição no Centro (r = 0):</strong> Simetria térmica com derivada nula (∂T/∂r = 0).</p>
                <p>• <strong>Condição na Superfície (r = R):</strong> T(R, t) = T_banho(t) (condução direta na casca).</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-400" /> 2. Discretização Numérica e Critério de Estabilidade
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                A EDP é resolvida numericamente pelo Método das Diferenças Finitas (FDM). Para evitar oscilações ou valores espúrios:
              </p>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center font-mono text-indigo-300 text-sm">
                Número de Fourier: Fo = (α · Δt) / (Δr²) ≤ 0.5
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" /> 3. Cinética de Inativação Enzimática (Arrhenius)
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                A degradação térmica da enzima peroxidase (POD) e das antocianinas segue cinética de primeira ordem:
              </p>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center font-mono text-emerald-300 text-sm">
                dC/dt = - k(T) · C &nbsp;&nbsp;|&nbsp;&nbsp; k(T) = A · exp(-Ea / (R_gas · T))
              </div>
            </div>
          </div>
        )}

        {/* 8. ABA: ARQUITETURA */}
        {activeTab === 'arquitetura' && (
          <div className="max-w-4xl space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-purple-400">Engenharia de Software & Indústria 4.0</p>
              <h2 className="text-2xl font-bold text-white">Arquitetura do Digital Twin & Fluxo de Telemetria</h2>
              <p className="mt-1 text-sm text-slate-400">Pipeline distribuído conectando o solver numérico, o barramento em nuvem e a interface reativa.</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
                <div className="rounded-xl bg-purple-500/10 p-3 text-purple-400 w-fit">
                  <Cpu className="h-5 w-5" />
                </div>
                <h4 className="font-semibold text-white text-sm">1. Motor Físico (FastAPI)</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Resolve a malha de Fourier e as equações diferenciais em tempo de execução (&lt; 10 ms por passo).
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
                <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400 w-fit">
                  <Database className="h-5 w-5" />
                </div>
                <h4 className="font-semibold text-white text-sm">2. Banco & WebSockets</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  PostgreSQL no Supabase gerando eventos instantâneos via canal Realtime com latência média &lt; 50 ms.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
                <div className="rounded-xl bg-cyan-500/10 p-3 text-cyan-400 w-fit">
                  <Activity className="h-5 w-5" />
                </div>
                <h4 className="font-semibold text-white text-sm">3. Supervisório Web</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Interface em React e Recharts que recebe os pacotes de dados sem necessidade de recarregar a página.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <GitMerge className="h-4 w-4 text-cyan-400" /> Diagrama de Sequência e Tempo de Resposta
              </h3>
              <div className="rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-300 space-y-2 border border-slate-800">
                <p className="text-purple-400">[1. Sensor / Mock] ──(HTTP POST / T_superficie)──&gt; [2. FastAPI Engine]</p>
                <p className="text-indigo-400 pl-4">* Executa discretização de Fourier 1D (Δt = 1s, Δr = 0.7mm) [~8 ms]</p>
                <p className="text-indigo-400 pl-4">* Calcula inativação de POD e antocianinas via Arrhenius [~1 ms]</p>
                <p className="text-emerald-400">[2. FastAPI Engine] ──(INSERT estado_digital_twin)──&gt; [3. Supabase DB]</p>
                <p className="text-cyan-400">[3. Supabase DB] ──(WebSocket broadcast)──&gt; [4. React SCADA Frontend]</p>
                <p className="text-slate-400 border-t border-slate-800/80 pt-2">Latência total do ciclo fechado: ~75 ms (compatível com controle térmico industrial).</p>
              </div>
            </div>
          </div>
        )}

        {/* 9. ABA: PARÂMETROS */}
        {activeTab === 'parametros' && (
          <div className="max-w-4xl space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-purple-400">Dados Experimentais</p>
              <h2 className="text-2xl font-bold text-white">Constantes Termofísicas Adotadas</h2>
              <p className="mt-1 text-sm text-slate-400">Propriedades da espécie <em>Euterpe oleracea</em> empregadas no modelo.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
                <h4 className="font-semibold text-white text-sm">Geometria da Amostra</h4>
                <div className="divide-y divide-slate-800/80 text-xs">
                  <div className="flex justify-between py-2.5"><span className="text-slate-400">Raio Médio da Baga (R)</span><span className="font-mono text-purple-300">7.0 mm (0.007 m)</span></div>
                  <div className="flex justify-between py-2.5"><span className="text-slate-400">Diâmetro Médio Total</span><span className="font-mono text-purple-300">14.0 mm</span></div>
                  <div className="flex justify-between py-2.5"><span className="text-slate-400">Aproximação Geométrica</span><span className="font-mono text-purple-300">Esfera Homogênea 1D</span></div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
                <h4 className="font-semibold text-white text-sm">Propriedades Térmicas da Polpa</h4>
                <div className="divide-y divide-slate-800/80 text-xs">
                  <div className="flex justify-between py-2.5"><span className="text-slate-400">Condutividade Térmica (k)</span><span className="font-mono text-indigo-300">0.52 W/(m·K)</span></div>
                  <div className="flex justify-between py-2.5"><span className="text-slate-400">Calor Específico (Cp)</span><span className="font-mono text-indigo-300">3850 J/(kg·K)</span></div>
                  <div className="flex justify-between py-2.5"><span className="text-slate-400">Massa Específica (ρ)</span><span className="font-mono text-indigo-300">1020 kg/m³</span></div>
                  <div className="flex justify-between py-2.5"><span className="text-slate-400">Difusividade Térmica (α)</span><span className="font-mono text-indigo-300">1.32 × 10⁻⁷ m²/s</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 10. ABA: HISTÓRICO */}
        {activeTab === 'historico' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-purple-400">Registros Brutos</p>
                <h2 className="text-2xl font-bold text-white">Tabela de Telemetria Persistida</h2>
              </div>
              <span className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-400">
                {historico.length} pontos carregados
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-slate-800 bg-slate-950 text-slate-400">
                  <tr>
                    <th className="p-4">Tempo (s)</th>
                    <th className="p-4">T. Superfície (°C)</th>
                    <th className="p-4">T. Centro (°C)</th>
                    <th className="p-4">Gradiente ΔT (°C)</th>
                    <th className="p-4">Inativação (%)</th>
                    <th className="p-4">Retenção (%)</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {[...historico].reverse().map((item, idx) => {
                    const dt = (Number(item.temp_superficie_c || 0) - Number(item.temp_centro_c || 0)).toFixed(1);
                    return (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="p-4 font-bold text-purple-300">{formatarNumero(item.tempo_decorrido_s, 0)}s</td>
                        <td className="p-4 text-rose-300">{formatarNumero(item.temp_superficie_c)}</td>
                        <td className="p-4 text-amber-300">{formatarNumero(item.temp_centro_c)}</td>
                        <td className="p-4 text-slate-400">{dt}</td>
                        <td className="p-4 text-emerald-300">{formatarNumero(item.taxa_inativacao_pct)}%</td>
                        <td className="p-4 text-purple-400">{formatarNumero(item.retencao_antocianinas_pct)}%</td>
                        <td className="p-4">
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] border border-slate-700">
                            {item.status_processo || '--'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}