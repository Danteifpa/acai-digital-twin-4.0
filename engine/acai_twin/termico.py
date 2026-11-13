"""
Condução térmica transiente 1D em esfera composta (caroço + polpa).

Formulação em volumes finitos (conservativa), nós em r_i = i·Δr, i = 0…N.
Cada nó representa a casca esférica [r_i − Δr/2, r_i + Δr/2] (truncada em 0 e R):

    C_i · dT_i/dt = Σ_j G_ij (T_j − T_i) + δ_iN · h·A_s · (T_∞ − T_N)

    C_i  = ρ_i c_i V_i                         (capacidade térmica do volume)
    G_ij = k_face · 4π r_face² / Δr            (condutância entre nós vizinhos)
    k_face = média harmônica (correta na interface caroço/polpa)

Vantagens sobre o esquema anterior (diferenças finitas com T(R) = T_banho):
  * contorno convectivo (Robin) – a superfície NÃO fica instantaneamente igual ao banho;
  * propriedades diferentes no caroço e na polpa;
  * conservação de energia exata no discreto;
  * o centro (r = 0) é tratado naturalmente, sem regra de L'Hôpital;
  * passo explícito escolhido automaticamente pelo critério de estabilidade.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from .parametros import ParametrosModelo


@dataclass
class Malha:
    r: np.ndarray            # posição dos nós [m]
    volume: np.ndarray       # volume de controle [m³]
    capacidade: np.ndarray   # C_i = ρ c V [J/K]
    massa: np.ndarray        # ρ V [kg]
    g_vizinho: np.ndarray    # G entre i e i+1 [W/K] (tamanho N)
    area_superficie: float   # 4πR² [m²]
    e_polpa: np.ndarray      # máscara booleana dos nós de polpa

    @property
    def n(self) -> int:
        return len(self.r)

    def dt_critico(self, h: float) -> float:
        """Maior passo explícito estável: Δt ≤ C_i / Σ G_i para todo i."""
        soma_g = np.zeros(self.n)
        soma_g[:-1] += self.g_vizinho
        soma_g[1:] += self.g_vizinho
        soma_g[-1] += h * self.area_superficie
        return float(np.min(self.capacidade / soma_g))


def construir_malha(p: ParametrosModelo) -> Malha:
    g = p.geometria
    n = g.n_nos
    R = g.raio_m
    dr = R / (n - 1)
    r = np.linspace(0.0, R, n)

    r_in = np.clip(r - dr / 2, 0.0, R)
    r_out = np.clip(r + dr / 2, 0.0, R)
    volume = 4.0 / 3.0 * math.pi * (r_out**3 - r_in**3)

    # Material por nó: o volume de controle é dividido entre caroço e polpa
    # proporcionalmente quando a interface cai dentro dele.
    rc = g.raio_caroco_m
    v_caroco = 4.0 / 3.0 * math.pi * (np.clip(r_out, 0, rc)**3 - np.clip(r_in, 0, rc)**3)
    v_polpa = volume - v_caroco
    capacidade = v_caroco * p.caroco.rho * p.caroco.cp + v_polpa * p.polpa.rho * p.polpa.cp
    massa = v_caroco * p.caroco.rho + v_polpa * p.polpa.rho
    e_polpa = v_polpa > 0.5 * volume

    # Condutância entre nós: duas meias-resistências em série (média harmônica).
    r_face = (r[:-1] + r[1:]) / 2
    area_face = 4.0 * math.pi * r_face**2
    # material de cada meia-célula (esquerda: r_i→r_face; direita: r_face→r_{i+1})
    k_esq = np.where((r[:-1] + r_face) / 2 < rc, p.caroco.k, p.polpa.k)
    k_dir = np.where((r[1:] + r_face) / 2 < rc, p.caroco.k, p.polpa.k)
    k_face = 2.0 * k_esq * k_dir / (k_esq + k_dir)
    g_viz = k_face * area_face / dr

    return Malha(
        r=r,
        volume=volume,
        capacidade=capacidade,
        massa=massa,
        g_vizinho=g_viz,
        area_superficie=4.0 * math.pi * R**2,
        e_polpa=e_polpa,
    )


def avancar(T: np.ndarray, malha: Malha, t_inf: float, h: float, dt: float,
            fator_seguranca: float = 0.9) -> np.ndarray:
    """Avança a temperatura por um intervalo dt (subdividido para estabilidade)."""
    dt_max = fator_seguranca * malha.dt_critico(h)
    n_sub = max(1, math.ceil(dt / dt_max))
    dts = dt / n_sub
    T = T.copy()
    g = malha.g_vizinho
    hA = h * malha.area_superficie
    inv_c = dts / malha.capacidade
    for _ in range(n_sub):
        fluxo = g * (T[1:] - T[:-1])         # W, de i+1 para i
        q = np.zeros_like(T)
        q[:-1] += fluxo
        q[1:] -= fluxo
        q[-1] += hA * (t_inf - T[-1])
        T += q * inv_c
    return T


def energia_absorvida_j(T: np.ndarray, T0: float, malha: Malha) -> float:
    """Calor sensível acumulado no fruto em relação a T0 [J]."""
    return float(np.sum(malha.capacidade * (T - T0)))
