"""Soluções analíticas de referência para verificação do solver (esfera homogênea)."""

from __future__ import annotations

import numpy as np
from scipy.optimize import brentq


def autovalores_esfera(bi: float, n: int = 60) -> np.ndarray:
    """Raízes de 1 − λ·cot(λ) = Bi, uma em cada intervalo ((k−1)π, kπ)."""
    raizes = []
    for k in range(1, n + 1):
        a, b = (k - 1) * np.pi + 1e-9, k * np.pi - 1e-9
        raizes.append(brentq(lambda x: 1 - x / np.tan(x) - bi, a, b))
    return np.array(raizes)


def temperatura_esfera(
    r_sobre_R: float,
    t: float,
    bi: float,
    alpha: float,
    raio: float,
    t0: float,
    t_inf: float,
    termos: int = 60,
) -> float:
    """T(r, t) numa esfera homogênea com convecção na superfície (série de Fourier)."""
    lam = autovalores_esfera(bi, termos)
    cn = 4 * (np.sin(lam) - lam * np.cos(lam)) / (2 * lam - np.sin(2 * lam))
    x = lam * r_sobre_R
    forma = np.ones_like(lam) if r_sobre_R == 0 else np.sin(x) / x
    theta = np.sum(cn * np.exp(-(lam**2) * alpha * t / raio**2) * forma)
    return float(t_inf - (t_inf - t0) * theta)
