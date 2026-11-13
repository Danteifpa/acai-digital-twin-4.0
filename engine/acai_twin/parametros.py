"""
Parâmetros físicos, cinéticos e sanitários do AçaíThermal Twin.

Cada valor traz a fonte. Os marcados com [HIPÓTESE] não foram encontrados
na literatura para o açaí e precisam ser calibrados/justificados no TCC.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field


@dataclass(frozen=True)
class Material:
    """Propriedades termofísicas de uma camada do fruto."""

    nome: str
    k: float  # condutividade térmica [W/(m·K)]
    rho: float  # massa específica [kg/m³]
    cp: float  # calor específico [J/(kg·K)]

    @property
    def alpha(self) -> float:
        """Difusividade térmica [m²/s]."""
        return self.k / (self.rho * self.cp)


# Polpa (mesocarpo + epicarpo).
# Fonte: caracterização termofísica da polpa de açaí (UFCG, bdtd riufcg/2218):
#   k = 0,54 W/m·°C ; cp = 3,684 kJ/kg·°C ; rho ≈ 1007–1025 kg/m³ ;
#   α medido ≈ 1,432e-7 m²/s (23–60 °C). Com os valores abaixo α ≈ 1,44e-7.
POLPA = Material(nome="polpa", k=0.54, rho=1015.0, cp=3684.0)

# Caroço (endocarpo lignocelulósico).
# [HIPÓTESE] Não há medição publicada de k/cp do caroço fresco de açaí.
# Valores típicos de sementes lignocelulósicas úmidas (k 0,2–0,35 W/m·K;
# cp 1,8–2,5 kJ/kg·K; rho 1100–1300 kg/m³). Calibrar com termopar no centro.
CAROCO = Material(nome="caroco", k=0.30, rho=1200.0, cp=2200.0)


@dataclass(frozen=True)
class Geometria:
    # Diâmetro do fruto: 10–20 mm (preprints.org 202504.2415). Padrão: 14 mm.
    raio_m: float = 0.007
    # O caroço ocupa ~85 % do volume do fruto (preprints.org 202504.2415).
    fracao_volume_caroco: float = 0.85
    # Número de nós radiais (r = 0 … R).
    n_nos: int = 71

    @property
    def raio_caroco_m(self) -> float:
        return self.raio_m * self.fracao_volume_caroco ** (1.0 / 3.0)


@dataclass(frozen=True)
class Conveccao:
    # Coeficiente convectivo água → fruto durante a imersão [W/(m²·K)].
    # Calibrado (scripts/calibrar_h.py) contra Bezerra et al., Embrapa
    # (alice doc/1070158): banho a 80,2 °C → superfície 77,8–78,8 °C em 2–10 s.
    # Resultado: h ≈ 4700 W/m²K (RMSE 0,5 °C). Faixa típica de imersão em água.
    h_imersao: float = 4700.0
    # Resfriamento ao ar/água ambiente após o corte [HIPÓTESE].
    h_resfriamento: float = 300.0


@dataclass(frozen=True)
class CineticaAntocianinas:
    """1ª ordem, k(T) = k0·exp(−Ea/RT).
    Fonte: Anjos et al. (2020), SN Applied Sciences 2:523,
    doi:10.1007/s42452-020-2340-0 — Ea = 42,8 kJ/mol; k0 = 36,6 s⁻¹
    (ensaios a 60–90 °C, antocianinas totais da polpa).
    """

    k0_s: float = 36.6
    ea_j_mol: float = 42_800.0


@dataclass(frozen=True)
class CineticaPOD:
    """Inativação bifásica de 1ª ordem (duas isoenzimas), modelo D–z.
    Fonte: Costa, H. C. B. (2019), dissertação UFU (repositorio 123456789/24659):
      fração lábil:     D(89 °C) = 7,10 s, z = 4,3 °C
      fração resistente: D(89 °C) = 254 s, z = 2,4 °C
    """

    t_ref_c: float = 89.0
    d1_ref_s: float = 7.10
    z1_c: float = 4.3
    d2_ref_s: float = 254.0
    z2_c: float = 2.4
    # [HIPÓTESE] Fração inicial da isoenzima lábil. A dissertação não traz o
    # valor no resumo; conferir no texto completo e ajustar.
    fracao_labil: float = 0.80


@dataclass(frozen=True)
class CriterioSanitario:
    """Branqueamento contra T. cruzi.
    Legislação do Pará (2012) e Amapá (2015): frutos em água a 80 °C por 10 s
    (Embrapa, COT 151/2017). O parasita está na SUPERFÍCIE (fezes/fragmentos de
    barbeiro aderidos), logo o ponto crítico é r = R, não o centro.
    Critério adotado: temperatura efetiva da superfície ≥ 80 °C acumulada por ≥ 10 s.
    """

    temp_superficie_min_c: float = 80.0
    tempo_minimo_s: float = 10.0


@dataclass(frozen=True)
class ParametrosModelo:
    geometria: Geometria = field(default_factory=Geometria)
    polpa: Material = POLPA
    caroco: Material = CAROCO
    conveccao: Conveccao = field(default_factory=Conveccao)
    antocianinas: CineticaAntocianinas = field(default_factory=CineticaAntocianinas)
    pod: CineticaPOD = field(default_factory=CineticaPOD)
    criterio: CriterioSanitario = field(default_factory=CriterioSanitario)

    def como_dict(self) -> dict:
        return asdict(self)


R_GAS = 8.314462618  # J/(mol·K)
