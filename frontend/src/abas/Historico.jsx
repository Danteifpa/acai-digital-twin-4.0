import { Status } from '../componentes';
import { fmt } from '../util';

export default function Historico({ historico, loteId }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-400">Registros</p>
          <h2 className="text-2xl font-bold text-white">Série do lote {loteId || '—'}</h2>
        </div>
        <span className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-400">
          {historico.length} pontos
        </span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
        <table className="w-full text-left text-xs font-mono">
          <thead className="border-b border-slate-800 bg-slate-950 text-slate-400">
            <tr>
              <th className="p-3">t (s)</th><th className="p-3">Banho (°C)</th><th className="p-3">Superfície (°C)</th>
              <th className="p-3">Centro (°C)</th><th className="p-3">Sup. ≥ 80 °C (s)</th>
              <th className="p-3">POD (%)</th><th className="p-3">Antoc. (%)</th><th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {[...historico].reverse().map((item, i) => (
              <tr key={i} className="hover:bg-slate-800/30">
                <td className="p-3 font-bold text-purple-300">{fmt(item.tempo_decorrido_s)}</td>
                <td className="p-3 text-slate-400">{fmt(item.temp_banho_c)}</td>
                <td className="p-3 text-rose-300">{fmt(item.temp_superficie_c)}</td>
                <td className="p-3 text-amber-300">{fmt(item.temp_centro_c)}</td>
                <td className="p-3 text-emerald-300">{fmt(item.tempo_letal_superficie_s)}</td>
                <td className="p-3">{fmt(item.taxa_inativacao_pct)}</td>
                <td className="p-3 text-purple-400">{fmt(item.retencao_antocianinas_pct, 2)}</td>
                <td className="p-3"><Status valor={item.status_processo} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
