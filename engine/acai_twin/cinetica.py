"""
Cinética de reações térmicas integrada no tempo e no espaço.

Diferente da versão anterior (função instantânea da temperatura do centro, com
tetos e pisos fixos), aqui cada nó da polpa acumula sua própria história:

    ln C_i(t+Δt) = ln C_i(t) − k(T_i)·Δt

e o resultado é a média ponderada pela massa de polpa. Se a temperatura cair,
a inativação NÃO regride – como na realidade.
"""

from __future__ import annotations

import math

import numpy as np

from .parametros import R_GAS, CineticaAntocianinas, CineticaPOD


def k_arrhenius(T_c: np.ndarray | float, k0: float, ea: float) -> np.ndarray:
    """k(T) = k0·exp(−Ea / (R·T)), T em °C, k em s⁻¹."""
    T_k = np.asarray(T_c, dtype=float) + 273.15
    return k0 * np.exp(-ea / (R_GAS * T_k))


def k_dz(T_c: np.ndarray | float, d_ref_s: float, z_c: float, t_ref_c: float) -> np.ndarray:
    """Modelo D–z: D(T) = D_ref·10^((T_ref − T)/z);  k = ln(10)/D."""
    T_c = np.asarray(T_c, dtype=float)
    d = d_ref_s * np.power(10.0, (t_ref_c - T_c) / z_c)
    return math.log(10.0) / d


class EstadoCinetico:
    """Guarda ln(C/C0) por nó para antocianinas e para as duas frações da POD."""

    def __init__(self, n_nos: int, antoc: CineticaAntocianinas, pod: CineticaPOD):
        self.antoc = antoc
        self.pod = pod
        self.ln_antoc = np.zeros(n_nos)
        self.ln_pod1 = np.zeros(n_nos)
        self.ln_pod2 = np.zeros(n_nos)

    def avancar(self, T_ini: np.ndarray, T_fim: np.ndarray, dt: float) -> None:
        # regra do trapézio na taxa (melhor que usar só T_fim)
        def media(f):
            return 0.5 * (f(T_ini) + f(T_fim))

        a, p = self.antoc, self.pod
        self.ln_antoc -= media(lambda T: k_arrhenius(T, a.k0_s, a.ea_j_mol)) * dt
        self.ln_pod1 -= media(lambda T: k_dz(T, p.d1_ref_s, p.z1_c, p.t_ref_c)) * dt
        self.ln_pod2 -= media(lambda T: k_dz(T, p.d2_ref_s, p.z2_c, p.t_ref_c)) * dt

    def retencao_antocianinas(self, peso: np.ndarray) -> float:
        """Fração retida (0–1), média ponderada pela massa de polpa."""
        return float(np.sum(peso * np.exp(self.ln_antoc)) / np.sum(peso))

    def atividade_pod(self, peso: np.ndarray) -> float:
        """Atividade residual da POD (0–1), modelo bifásico."""
        f = self.pod.fracao_labil
        a = f * np.exp(self.ln_pod1) + (1 - f) * np.exp(self.ln_pod2)
        return float(np.sum(peso * a) / np.sum(peso))
