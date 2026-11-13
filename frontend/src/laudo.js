import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { CRITERIO_SUPERFICIE_C, CRITERIO_TEMPO_S } from './config';
import { fmt } from './util';

/**
 * Gera o laudo do lote a partir do resultado REAL do motor.
 * Nada é fixado como "conforme": o parecer vem de resumo.conforme.
 * (A fonte padrão do jsPDF não tem "≥", por isso usamos ">=".)
 */
export async function gerarLaudoPDF({ resultado, comparacao, diametroMm, loteId }) {
  const { entrada, resumo } = resultado;
  const doc = new jsPDF();
  const agora = new Date();
  const conforme = resumo.conforme;

  const dadosQR = JSON.stringify({
    lote: loteId,
    emitido: agora.toISOString(),
    banho_c: entrada.temp_banho_c,
    diametro_mm: diametroMm,
    corte_s: resumo.tempo_corte_s,
    letal_sup_s: resumo.tempo_letal_superficie_s,
    pod_pct: resumo.taxa_inativacao_pct,
    antoc_pct: resumo.retencao_antocianinas_pct,
    conforme,
  });
  const qr = await QRCode.toDataURL(dadosQR, { width: 140, margin: 1 });

  doc.setFillColor(30, 27, 75);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('LAUDO DE SIMULACAO DE BRANQUEAMENTO', 14, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('AçaíThermal Twin - gêmeo digital (resultado de modelo, não de inspeção)', 14, 23);

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9);
  doc.text(`Lote: ${loteId}   |   Emissão: ${agora.toLocaleString('pt-BR')}`, 14, 40);
  doc.text(`Fruto: Ø ${fmt(diametroMm, 1)} mm   |   Banho: ${fmt(entrada.temp_banho_c, 1)} °C   |   ` +
    `Temperatura inicial: ${fmt(entrada.temp_inicial_c, 1)} °C   |   Modo: ${entrada.modo}`, 14, 46);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(conforme ? [5, 150, 105] : [225, 29, 72]));
  doc.text(`Resultado: ${conforme ? 'CONFORME' : 'NAO CONFORME'} ao critério de branqueamento`, 14, 53);
  doc.setFont('helvetica', 'normal');

  const ok = (b) => (b ? 'Atende' : 'Não atende');
  autoTable(doc, {
    startY: 59,
    theme: 'grid',
    headStyles: { fillColor: [109, 40, 217], textColor: 255, fontStyle: 'bold' },
    head: [['Parâmetro', 'Valor simulado', 'Referência', 'Situação']],
    body: [
      ['Tempo com superfície >= 80 °C', `${fmt(resumo.tempo_letal_superficie_s)} s`,
        `>= ${CRITERIO_TEMPO_S} s a ${CRITERIO_SUPERFICIE_C} °C (PA 2012 / AP 2015)`, ok(conforme)],
      ['Tempo de imersão (corte)', `${fmt(resumo.tempo_corte_s)} s`, 'Corte preditivo do gêmeo digital', '-'],
      ['Temperatura da superfície no corte', `${fmt(resumo.temp_superficie_no_corte_c)} °C`, 'r = R (ponto crítico p/ T. cruzi)', '-'],
      ['Temperatura do centro no corte', `${fmt(resumo.temp_centro_no_corte_c)} °C`, 'r = 0 (informativo)', '-'],
      ['Inativação da peroxidase (POD)', `${fmt(resumo.taxa_inativacao_pct)} %`, 'Costa (2019), modelo bifásico D-z', 'Informativo'],
      ['Retenção de antocianinas', `${fmt(resumo.retencao_antocianinas_pct, 2)} %`, 'Anjos et al. (2020), Ea = 42,8 kJ/mol', 'Informativo'],
      ['Energia absorvida pelo fruto', `${fmt(resumo.energia_absorvida_no_corte_kj_kg)} kJ/kg`, 'Calor sensível até o corte', '-'],
    ],
    styles: { fontSize: 8.5, cellPadding: 3 },
  });

  let y = doc.lastAutoTable.finalY + 8;
  if (comparacao?.centro_70 && comparacao?.fixo) {
    const leg = comparacao.centro_70.resumo;
    const fixo = comparacao.fixo.resumo;
    autoTable(doc, {
      startY: y,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] },
      head: [['Estratégia', 'Imersão (s)', 'Energia (kJ/kg)', 'Critério sanitário']],
      body: [
        ['Preditiva (gêmeo digital)', fmt(resumo.tempo_corte_s), fmt(resumo.energia_absorvida_no_corte_kj_kg), ok(resumo.conforme)],
        [`Tempo fixo (${fmt(comparacao.fixo.entrada.tempo_imersao_fixo_s, 0)} s)`, fmt(fixo.tempo_corte_s), fmt(fixo.energia_absorvida_no_corte_kj_kg), ok(fixo.conforme)],
        ['Centro >= 70 °C (versão anterior)', fmt(leg.tempo_corte_s), fmt(leg.energia_absorvida_no_corte_kj_kg), ok(leg.conforme)],
      ],
      styles: { fontSize: 8.5, cellPadding: 2.5 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 27, 75);
  doc.text('PARECER DO MODELO', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const parecer = conforme
    ? `A superfície do fruto permaneceu ${fmt(resumo.tempo_letal_superficie_s)} s acima de ${CRITERIO_SUPERFICIE_C} °C, ` +
      `cumprindo o binômio de branqueamento. O corte em ${fmt(resumo.tempo_corte_s)} s preservou ` +
      `${fmt(resumo.retencao_antocianinas_pct, 2)} % das antocianinas.`
    : `O critério de branqueamento NÃO foi cumprido. ${(resumo.motivos || []).join(' ')} ` +
      'O lote não deve seguir para despolpamento sem novo tratamento.';
  doc.text(doc.splitTextToSize(parecer, 130), 14, y + 6);
  doc.addImage(qr, 'PNG', 156, y - 4, 38, 38);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('QR: dados do lote (JSON)', 158, y + 37);

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(doc.splitTextToSize(
    'Documento gerado por simulação numérica para fins acadêmicos (TCC - IFPA Ananindeua). ' +
    'Não substitui inspeção sanitária nem medição instrumental.', 182), 14, 280);

  doc.save(`Laudo_${loteId}.pdf`);
}
