"""Verificação do solver térmico contra soluções analíticas (esfera homogênea)."""
from dataclasses import replace

import numpy as np
import pytest
from scipy.optimize import brentq

from acai_twin.parametros import POLPA, Conveccao, Geometria, ParametrosModelo
from acai_twin.termico import avancar, construir_malha, energia_absorvida_j

R = 0.007


def params_homogeneo(h: float, n: int = 81) -> ParametrosModelo:
    # caroço com as mesmas propriedades da polpa → esfera homogênea
    return replace(
        ParametrosModelo(),
        geometria=Geometria(raio_m=R, fracao_volume_caroco=0.85, n_nos=n),
        caroco=replace(POLPA, nome="caroco"),
        conveccao=Conveccao(h_imersao=h),
    )


def centro_analitico_robin(t, bi, alpha, T0=25.0, Tinf=85.0, termos=60):
    """Esfera com convecção: autovalores de 1 − λ·cot λ = Bi."""
    soma = 0.0
    for n in range(1, termos + 1):
        a, b = (n - 1) * np.pi + 1e-9, n * np.pi - 1e-9
        lam = brentq(lambda x: 1 - x / np.tan(x) - bi, a, b)
        cn = 4 * (np.sin(lam) - lam * np.cos(lam)) / (2 * lam - np.sin(2 * lam))
        soma += cn * np.exp(-lam**2 * alpha * t / R**2)
    return Tinf - (Tinf - T0) * soma


@pytest.mark.parametrize("h", [200.0, 1000.0, 4700.0])
def test_centro_bate_com_solucao_analitica(h):
    p = params_homogeneo(h)
    malha = construir_malha(p)
    T = np.full(malha.n, 25.0)
    bi = h * R / POLPA.k
    for t in range(1, 121):
        T = avancar(T, malha, 85.0, h, 1.0)
        if t in (30, 60, 120):
            esperado = centro_analitico_robin(t, bi, POLPA.alpha)
            assert abs(T[0] - esperado) < 0.5, (t, T[0], esperado)


def test_conservacao_de_energia():
    p = ParametrosModelo()
    malha = construir_malha(p)
    T = np.full(malha.n, 25.0)
    h, Tinf, dt = p.conveccao.h_imersao, 85.0, 0.25
    calor_entrou = 0.0
    for _ in range(200):
        Ts_ini = T[-1]
        T_novo = avancar(T, malha, Tinf, h, dt)
        # calor que entrou pela superfície ≈ variação de energia interna
        calor_entrou += energia_absorvida_j(T_novo, 0, malha) - energia_absorvida_j(T, 0, malha)
        T = T_novo
    assert np.isclose(calor_entrou, energia_absorvida_j(T, 25.0, malha), rtol=1e-9)
    assert np.all(T <= Tinf + 1e-9) and np.all(T >= 25.0 - 1e-9)  # princípio do máximo


def test_estabilidade_com_passo_grande():
    p = ParametrosModelo()
    malha = construir_malha(p)
    T = avancar(np.full(malha.n, 25.0), malha, 90.0, p.conveccao.h_imersao, 30.0)
    assert np.all(np.isfinite(T)) and T.max() <= 90.0 + 1e-9


def test_caroco_ocupa_fracao_correta():
    p = ParametrosModelo()
    malha = construir_malha(p)
    v_polpa = malha.volume[malha.e_polpa].sum() / malha.volume.sum()
    assert abs(v_polpa - (1 - p.geometria.fracao_volume_caroco)) < 0.05
