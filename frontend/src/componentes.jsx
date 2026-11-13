import { ROTULO_STATUS, corTemperatura, fmt } from './util';

export function Status({ valor }) {
  const s = ROTULO_STATUS[valor] || { texto: valor || '--', cor: 'text-slate-300 border-slate-700 bg-slate-800' };
  return <span className={`rounded-full border px-3 py-1 text-xs font-mono font-semibold ${s.cor}`}>{s.texto}</span>;
}

export function Indicador({ icon: Icon, label, value, unit, color, extra }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-sm transition-all hover:border-slate-700">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</span>
        <div className={`rounded-xl p-2 ${color.bg}`}>
          <Icon className={`h-4 w-4 ${color.text}`} />
        </div>
      </div>
      <p className="text-2xl font-extrabold text-white">
        {value} <span className="text-sm font-normal text-slate-400">{unit}</span>
      </p>
      {extra && <div className="mt-2 border-t border-slate-800/60 pt-1.5 text-[10px] font-mono text-slate-500">{extra}</div>}
    </div>
  );
}

export function Cabecalho({ sobretitulo, titulo, descricao, cor = 'text-purple-400' }) {
  return (
    <header className="border-b border-slate-800/80 pb-2">
      <p className={`text-xs font-semibold uppercase tracking-wider ${cor}`}>{sobretitulo}</p>
      <h2 className="text-2xl font-bold text-white">{titulo}</h2>
      {descricao && <p className="mt-1 text-sm text-slate-400">{descricao}</p>}
    </header>
  );
}

export function Cartao({ titulo, icon: Icon, children, className = '' }) {
  return (
    <section className={`space-y-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 ${className}`}>
      {titulo && (
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          {Icon && <Icon className="h-4 w-4 text-purple-400" />} {titulo}
        </h3>
      )}
      {children}
    </section>
  );
}

/** Corte radial do fruto desenhado a partir do perfil T(r) calculado pelo motor. */
export function EsferaAcai({ perfil, raiosMm, raioCarocoMm, diametroMm }) {
  const R = diametroMm / 2;
  const tamanho = 176;
  const escala = (tamanho / 2 - 6) / R;
  const temCampo = Array.isArray(perfil) && perfil.length > 1 && Array.isArray(raiosMm);
  const aneis = temCampo
    ? perfil.map((t, i) => ({ r: raiosMm[i], t })).reverse()
    : [{ r: R, t: 25 }];
  const tCentro = temCampo ? perfil[0] : 25;
  const tSup = temCampo ? perfil[perfil.length - 1] : 25;

  return (
    <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Corte radial T(r)</span>
      <span className="mt-0.5 block text-[11px] font-mono text-purple-400">
        Ø {fmt(diametroMm, 1)} mm · caroço até r = {fmt(raioCarocoMm, 2)} mm
      </span>
      <svg width={tamanho} height={tamanho} className="my-3" role="img" aria-label="Distribuição radial de temperatura">
        {aneis.map(({ r, t }, i) => (
          <circle key={i} cx={tamanho / 2} cy={tamanho / 2} r={Math.max(r, 0.05) * escala} fill={corTemperatura(t)} />
        ))}
        <circle cx={tamanho / 2} cy={tamanho / 2} r={raioCarocoMm * escala} fill="none"
          stroke="#ffffff" strokeOpacity="0.55" strokeDasharray="4 3" strokeWidth="1.2" />
        <circle cx={tamanho / 2} cy={tamanho / 2} r={R * escala} fill="none" stroke="#ffffff" strokeOpacity="0.35" />
      </svg>
      <div className="flex gap-4 text-[10px] font-mono text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: corTemperatura(tSup) }} /> Superfície {fmt(tSup)} °C
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: corTemperatura(tCentro) }} /> Centro {fmt(tCentro)} °C
        </span>
      </div>
      <span className="mt-1 text-[10px] text-slate-500">tracejado = interface caroço / polpa</span>
    </div>
  );
}
