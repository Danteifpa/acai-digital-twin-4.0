"""
Gêmeo digital de um lote de branqueamento.

Dois modos de uso:
  * Tempo real (Lote.passo): a cada leitura do sensor de temperatura do banho,
    o estado térmico e cinético do fruto é avançado e uma previsão do instante
    de corte é recalculada (o "corte térmico preditivo").
  * Simulação completa (simular_processo): roda um ciclo inteiro, para o modo
    preditivo (corta ao atingir o critério sanitário) ou tempo fixo (empírico).
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field

import numpy as np

from .cinetica import EstadoCinetico
from .parametros import ParametrosModelo
from .termico import Malha, avancar, construir_malha, energia_absorvida_j

AGUARDANDO = "AGUARDANDO"
EM_AQUECIMENTO = "EM_AQUECIMENTO"
CONFORMIDADE_ATINGIDA = "CONFORMIDADE_ATINGIDA"
RESFRIAMENTO = "RESFRIAMENTO"
BANHO_INSUFICIENTE = "BANHO_INSUFICIENTE"
NAO_CONFORME = "NAO_CONFORME"

MODOS = ("preditivo", "fixo", "centro_70")
TEMP_CENTRO_LEGADO_C = 70.0


@dataclass
class Lote:
    lote_id: str
    temp_inicial_c: float = 25.0
    p: ParametrosModelo = field(default_factory=ParametrosModelo)

    def __post_init__(self):
        self.malha: Malha = construir_malha(self.p)
        self.peso_polpa = self.malha.massa * self.malha.e_polpa
        self.massa_total = float(np.sum(self.malha.massa))
        self.reset()

    # ------------------------------------------------------------------ estado
    def reset(self) -> None:
        self.tempo_s = 0.0
        self.T = np.full(self.malha.n, float(self.temp_inicial_c))
        self.cin = EstadoCinetico(self.malha.n, self.p.antocianinas, self.p.pod)
        self.tempo_letal_s = 0.0  # tempo acumulado com superfície ≥ critério
        self.temp_banho_c = float(self.temp_inicial_c)
        self.imerso = False
        self.cortado = False
        self.status = AGUARDANDO

    @property
    def temp_centro_c(self) -> float:
        return float(self.T[0])

    @property
    def temp_superficie_c(self) -> float:
        return float(self.T[-1])

    @property
    def criterio_atingido(self) -> bool:
        return bool(self.tempo_letal_s >= self.p.criterio.tempo_minimo_s)

    def energia_kj_kg(self) -> float:
        return energia_absorvida_j(self.T, self.temp_inicial_c, self.malha) / self.massa_total / 1000.0

    # ------------------------------------------------------------------ dinâmica
    def passo(self, temp_banho_c: float, dt: float = 1.0, imerso: bool = True) -> None:
        """Avança dt segundos com o fruto imerso no banho (ou resfriando)."""
        h = self.p.conveccao.h_imersao if imerso else self.p.conveccao.h_resfriamento
        t_inf = temp_banho_c if imerso else self.temp_inicial_c
        T_ini = self.T
        T_fim = avancar(T_ini, self.malha, t_inf, h, dt)

        # tempo letal na superfície (fração do passo acima do limite, interpolada)
        lim = self.p.criterio.temp_superficie_min_c
        s0, s1 = T_ini[-1], T_fim[-1]
        if s0 >= lim and s1 >= lim:
            self.tempo_letal_s += dt
        elif s0 < lim <= s1:
            self.tempo_letal_s += float(dt * (s1 - lim) / (s1 - s0))
        elif s1 < lim <= s0:
            self.tempo_letal_s += float(dt * (s0 - lim) / (s0 - s1))

        self.cin.avancar(T_ini, T_fim, dt)
        self.T = T_fim
        self.tempo_s += dt
        self.temp_banho_c = temp_banho_c
        self.imerso = imerso
        self._atualizar_status()

    def _atualizar_status(self) -> None:
        if self.criterio_atingido:
            self.status = CONFORMIDADE_ATINGIDA if self.imerso else RESFRIAMENTO
        elif not self.imerso and self.tempo_s > 0:
            self.status = NAO_CONFORME
        elif self.temp_banho_c < self.p.criterio.temp_superficie_min_c + 0.5:
            self.status = BANHO_INSUFICIENTE
        else:
            self.status = EM_AQUECIMENTO

    # ------------------------------------------------------------------ previsão
    def prever_tempo_corte(
        self, temp_banho_c: float, horizonte_s: float = 180.0, dt: float = 0.5
    ) -> float | None:
        """Quantos segundos (a partir de agora) até cumprir o critério sanitário,
        mantendo o banho em temp_banho_c. None se não cumprir no horizonte."""
        if self.criterio_atingido:
            return 0.0
        sombra = copy.deepcopy(self)
        t = 0.0
        while t < horizonte_s:
            sombra.passo(temp_banho_c, dt, imerso=True)
            t += dt
            if sombra.criterio_atingido:
                return t
        return None

    # ------------------------------------------------------------------ saída
    def registro(self) -> dict:
        perfil = [round(float(x), 2) for x in self.T]
        return {
            "lote_id": self.lote_id,
            "tempo_decorrido_s": round(self.tempo_s, 2),
            "temp_banho_c": round(self.temp_banho_c, 2),
            "temp_superficie_c": round(self.temp_superficie_c, 2),
            "temp_centro_c": round(self.temp_centro_c, 2),
            "tempo_letal_superficie_s": round(self.tempo_letal_s, 2),
            "taxa_inativacao_pct": round(100.0 * (1 - self.cin.atividade_pod(self.peso_polpa)), 2),
            "retencao_antocianinas_pct": round(100.0 * self.cin.retencao_antocianinas(self.peso_polpa), 3),
            "energia_absorvida_kj_kg": round(self.energia_kj_kg(), 3),
            "imerso": self.imerso,
            "status_processo": self.status,
            "perfil_radial_c": perfil,
        }


def simular_processo(
    temp_banho_c: float = 85.0,
    temp_inicial_c: float = 25.0,
    modo: str = "preditivo",
    tempo_imersao_fixo_s: float = 10.0,
    tempo_max_imersao_s: float = 180.0,
    tempo_resfriamento_s: float = 60.0,
    dt: float = 0.5,
    intervalo_saida_s: float = 1.0,
    p: ParametrosModelo | None = None,
    lote_id: str = "SIMULACAO",
) -> dict:
    """Roda um ciclo completo: imersão → resfriamento.

    modo="preditivo": corta assim que o critério sanitário é cumprido
                      (ou em tempo_max_imersao_s, se nunca cumprir).
    modo="fixo":      imersão por tempo_imersao_fixo_s (prática empírica).
    modo="centro_70": critério da versão anterior do projeto (centro ≥ 70 °C),
                      mantido só para comparação de custo energético.
    """
    if modo not in MODOS:
        raise ValueError(f"modo deve ser um de {MODOS}")
    lote = Lote(lote_id=lote_id, temp_inicial_c=temp_inicial_c, p=p or ParametrosModelo())
    serie: list[dict] = [lote.registro()]
    proxima_saida = intervalo_saida_s
    tempo_corte = None

    def gravar(forcar=False):
        nonlocal proxima_saida
        if forcar or lote.tempo_s + 1e-9 >= proxima_saida:
            serie.append(lote.registro())
            proxima_saida += intervalo_saida_s

    limite = tempo_imersao_fixo_s if modo == "fixo" else tempo_max_imersao_s
    while lote.tempo_s < limite - 1e-9:
        lote.passo(temp_banho_c, min(dt, limite - lote.tempo_s), imerso=True)
        gravar()
        if modo == "preditivo" and lote.criterio_atingido:
            break
        if modo == "centro_70" and lote.temp_centro_c >= TEMP_CENTRO_LEGADO_C:
            break
    tempo_corte = lote.tempo_s
    gravar(forcar=serie[-1]["tempo_decorrido_s"] != round(lote.tempo_s, 2))
    resumo_corte = lote.registro()

    fim = lote.tempo_s + tempo_resfriamento_s
    while lote.tempo_s < fim - 1e-9:
        lote.passo(temp_banho_c, min(dt, fim - lote.tempo_s), imerso=False)
        gravar()

    final = lote.registro()
    conforme = lote.criterio_atingido
    motivos = []
    if not conforme:
        motivos.append(
            f"Superfície ficou {lote.tempo_letal_s:.1f} s ≥ "
            f"{lote.p.criterio.temp_superficie_min_c:.0f} °C "
            f"(mínimo {lote.p.criterio.tempo_minimo_s:.0f} s)."
        )
        if temp_banho_c < lote.p.criterio.temp_superficie_min_c + 0.5:
            motivos.append("Temperatura do banho insuficiente para a superfície atingir o critério.")

    return {
        "entrada": {
            "temp_banho_c": temp_banho_c,
            "temp_inicial_c": temp_inicial_c,
            "modo": modo,
            "tempo_imersao_fixo_s": tempo_imersao_fixo_s,
            "tempo_resfriamento_s": tempo_resfriamento_s,
        },
        "resumo": {
            "conforme": conforme,
            "motivos": motivos,
            "tempo_corte_s": round(tempo_corte, 2),
            "tempo_letal_superficie_s": round(lote.tempo_letal_s, 2),
            "temp_superficie_no_corte_c": resumo_corte["temp_superficie_c"],
            "temp_centro_no_corte_c": resumo_corte["temp_centro_c"],
            "temp_centro_max_c": round(max(r["temp_centro_c"] for r in serie), 2),
            "taxa_inativacao_pct": final["taxa_inativacao_pct"],
            "retencao_antocianinas_pct": final["retencao_antocianinas_pct"],
            "energia_absorvida_no_corte_kj_kg": resumo_corte["energia_absorvida_kj_kg"],
        },
        "raio_nos_mm": [round(float(r) * 1000, 4) for r in lote.malha.r],
        "raio_caroco_mm": round(lote.p.geometria.raio_caroco_m * 1000, 4),
        "serie": serie,
    }
