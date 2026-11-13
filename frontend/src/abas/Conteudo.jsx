import { useEffect, useState } from 'react';
import { BookOpen, Cpu, FileText, Flame, Leaf, Sliders } from 'lucide-react';
import { api } from '../api';
import { Cabecalho, Cartao } from '../componentes';
import { fmt } from '../util';

const p = 'text-sm leading-relaxed text-slate-300';
const eq = 'overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-purple-200';

export function Normas() {
  return (
    <div className="max-w-5xl space-y-6">
      <Cabecalho sobretitulo="Enquadramento legal" titulo="Critério sanitário adotado" cor="text-emerald-400" />
      <div className="grid gap-5 sm:grid-cols-2">
        <Cartao titulo="Branqueamento contra T. cruzi" icon={FileText}>
          <p className={p}>
            Os estados do Pará (2012) e do Amapá (2015) estabeleceram o branqueamento dos frutos em água a
            <strong> 80 °C por 10 s</strong>, seguido de resfriamento (Embrapa, Comunicado Técnico 151/2017).
          </p>
          <p className={p}>
            O protozoário chega ao fruto por fezes ou fragmentos de barbeiro <strong>aderidos à casca</strong>.
            Por isso o ponto crítico do modelo é a <strong>superfície (r = R)</strong>, e o critério é:
            superfície ≥ 80 °C acumulada por ≥ 10 s.
          </p>
        </Cartao>
        <Cartao titulo="Pontos a confirmar no texto do TCC" icon={FileText}>
          <ul className="list-inside list-disc space-y-1.5 text-xs text-slate-300">
            <li>Número e data exatos da norma estadual do Pará (2012) e se a Portaria SESPA citada na versão anterior a substitui.</li>
            <li>Se a IN MAPA citada fixa algum limite de antocianinas (a versão anterior afirmava &gt; 90 %; não localizamos esse limite).</li>
            <li>A meta de “POD &gt; 90 %” não é critério do branqueamento; a POD é indicador da pasteurização da polpa.</li>
          </ul>
        </Cartao>
      </div>
    </div>
  );
}

export function Convencional() {
  return (
    <div className="max-w-4xl space-y-6">
      <Cabecalho sobretitulo="Processamento tradicional" titulo="O branqueamento convencional" cor="text-amber-400" />
      <Cartao titulo="Procedimento usual" icon={Flame}>
        <p className={p}>
          Após seleção, lavagem e sanitização, os frutos são imersos em água quente por um tempo fixo e depois resfriados
          antes do despolpamento. O operador controla, quando muito, a temperatura da água — não a do fruto.
        </p>
        <p className={p}>
          Medições da Embrapa mostram que, com água a ~80 °C, a superfície do fruto fica em 77,8–78,8 °C nos primeiros
          10 s: o binômio nominal não garante 80 °C no fruto. É essa lacuna que o gêmeo digital resolve, estimando a
          temperatura da superfície a partir da leitura do banho e indicando o momento de retirar.
        </p>
      </Cartao>
    </div>
  );
}

export function Fruto() {
  return (
    <div className="max-w-4xl space-y-6">
      <Cabecalho sobretitulo="Matéria-prima" titulo="O fruto do açaí (Euterpe oleracea)" cor="text-emerald-400" />
      <Cartao titulo="Morfologia relevante para o modelo" icon={Leaf}>
        <ul className="list-inside list-disc space-y-1.5 text-sm text-slate-300">
          <li>Drupa quase esférica, 10–20 mm de diâmetro, 2,6–3,0 g.</li>
          <li>Caroço lignocelulósico ocupa ~85 % do volume; a parte comestível (polpa + casca) é uma camada fina.</li>
          <li>Por isso o modelo usa uma <strong>esfera composta</strong>: núcleo de caroço + casca de polpa, com propriedades distintas.</li>
          <li>As antocianinas e a POD estão na polpa — a cinética é integrada só nos nós de polpa, ponderada pela massa.</li>
        </ul>
      </Cartao>
    </div>
  );
}

export function Fisica() {
  return (
    <div className="max-w-4xl space-y-6">
      <Cabecalho sobretitulo="Modelagem matemática" titulo="Modelo físico e numérico" />
      <Cartao titulo="Condução transiente em esfera composta" icon={BookOpen}>
        <pre className={eq}>{`ρc ∂T/∂t = (1/r²) ∂/∂r ( k r² ∂T/∂r ),   0 < r < R
∂T/∂r = 0                         em r = 0 (simetria)
−k ∂T/∂r = h (T − T∞)             em r = R (convecção)
k, ρ, c = caroço  se r < r_c ;  polpa  se r ≥ r_c`}</pre>
        <p className={p}>
          Discretização em <strong>volumes finitos</strong> (conservativa), com condutância harmônica na interface
          caroço/polpa e passo explícito subdividido automaticamente para respeitar Δt ≤ C<sub>i</sub>/ΣG<sub>i</sub>.
          O coeficiente h foi calibrado contra medições de superfície da Embrapa (RMSE ≈ 0,5 °C).
        </p>
      </Cartao>
      <Cartao titulo="Cinética integrada no tempo" icon={BookOpen}>
        <pre className={eq}>{`Antocianinas:  dC/dt = −k(T)·C,   k = k₀·exp(−Ea/RT),   Ea = 42,8 kJ/mol
POD (bifásica): A/A₀ = f·e^(−k₁t) + (1−f)·e^(−k₂t),   kᵢ = ln10 / Dᵢ(T)
                Dᵢ(T) = Dᵢ,ref · 10^((T_ref − T)/zᵢ)`}</pre>
        <p className={p}>
          Cada nó acumula sua própria história térmica; a inativação nunca “regride” quando o fruto esfria.
        </p>
      </Cartao>
      <Cartao titulo="Verificação" icon={BookOpen}>
        <ul className="list-inside list-disc space-y-1.5 text-sm text-slate-300">
          <li>Centro da esfera homogênea comparado à solução analítica em série (Bi = 2,6 a 61): erro &lt; 0,5 °C.</li>
          <li>Conservação de energia e princípio do máximo verificados em teste automatizado.</li>
          <li>k(T) das antocianinas reproduz os valores experimentais de Anjos et al. (2020).</li>
        </ul>
      </Cartao>
    </div>
  );
}

export function Arquitetura() {
  return (
    <div className="max-w-4xl space-y-6">
      <Cabecalho sobretitulo="Engenharia de software" titulo="Arquitetura do gêmeo digital" cor="text-indigo-400" />
      <Cartao titulo="Fluxo de dados" icon={Cpu}>
        <pre className={eq}>{`Sensor do banho (ESP32 / simulator/mock_sensor.py)
        │  POST /api/v1/lotes/{id}/leituras   (T_banho a cada 1 s)
        ▼
Motor numérico (FastAPI, engine/)
   ├─ avança T(r,t) e a cinética do lote
   ├─ prevê o tempo até cumprir o critério → ação: MANTER / RETIRAR
   ├─ grava em SQLite (arquivo local, exportável em CSV)
   └─ transmite cada estado por Server-Sent Events (/api/v1/stream)
        ▼
Painel React (este app, publicado no GitHub Pages)
   ├─ modo Tempo real: escuta o stream do motor
   └─ modo Simulação: POST /api/v1/comparar → reproduz a série`}</pre>
        <p className="text-sm leading-relaxed text-slate-300">
          Nenhum serviço de banco de dados externo: o GitHub guarda o código, roda os testes a cada envio
          (GitHub Actions) e publica o painel; só o motor precisa de um servidor (Render ou o próprio computador).
        </p>
      </Cartao>
    </div>
  );
}

export function Parametros() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  useEffect(() => {
    api.parametros().then(setDados).catch((e) => setErro(e.message));
  }, []);

  if (erro) return <p className="text-sm text-rose-400">Motor indisponível: {erro}</p>;
  if (!dados) return <p className="text-sm text-slate-400">Carregando parâmetros do motor…</p>;

  const linhas = [
    ['Diâmetro do fruto', `${fmt(dados.geometria.raio_m * 2000, 1)} mm`, 'preprints.org 202504.2415 (10–20 mm)'],
    ['Fração de volume do caroço', fmt(dados.geometria.fracao_volume_caroco, 2), 'preprints.org 202504.2415 (~85 %)'],
    ['Espessura de polpa resultante', `${fmt(dados.derivados.espessura_polpa_mm, 2)} mm`, 'derivado'],
    ['Polpa: k / ρ / cp', `${dados.polpa.k} W/m·K / ${dados.polpa.rho} kg/m³ / ${dados.polpa.cp} J/kg·K`, 'UFCG (riufcg/2218)'],
    ['Polpa: α', `${dados.derivados.alpha_polpa_m2_s.toExponential(3)} m²/s`, 'medido: 1,432e-7 m²/s'],
    ['Caroço: k / ρ / cp', `${dados.caroco.k} / ${dados.caroco.rho} / ${dados.caroco.cp}`, 'HIPÓTESE — calibrar'],
    ['h imersão', `${dados.conveccao.h_imersao} W/m²·K`, 'calibrado (Embrapa doc/1070158)'],
    ['Biot (imersão)', fmt(dados.derivados.biot_imersao, 1), 'derivado'],
    ['Antocianinas: k₀ / Ea', `${dados.antocianinas.k0_s} s⁻¹ / ${dados.antocianinas.ea_j_mol / 1000} kJ/mol`, 'Anjos et al. (2020)'],
    ['POD lábil: D₈₉ / z', `${dados.pod.d1_ref_s} s / ${dados.pod.z1_c} °C`, 'Costa (2019), UFU'],
    ['POD resistente: D₈₉ / z', `${dados.pod.d2_ref_s} s / ${dados.pod.z2_c} °C`, 'Costa (2019), UFU'],
    ['POD: fração lábil', fmt(dados.pod.fracao_labil, 2), 'HIPÓTESE — conferir na dissertação'],
    ['Critério sanitário', `${dados.criterio.temp_superficie_min_c} °C por ${dados.criterio.tempo_minimo_s} s na superfície`, 'PA 2012 / AP 2015'],
  ];
  return (
    <div className="max-w-5xl space-y-6">
      <Cabecalho sobretitulo="Dados de entrada" titulo="Parâmetros do modelo (lidos do motor)" />
      <Cartao titulo="Tabela de parâmetros e fontes" icon={Sliders}>
        <table className="w-full text-left text-xs">
          <tbody className="divide-y divide-slate-800/60">
            {linhas.map(([a, b, c]) => (
              <tr key={a}>
                <td className="py-2 pr-4 text-slate-400">{a}</td>
                <td className="py-2 pr-4 font-mono text-white">{b}</td>
                <td className={`py-2 ${c.startsWith('HIPÓTESE') ? 'text-amber-400' : 'text-slate-500'}`}>{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Cartao>
    </div>
  );
}
