"""Verificação do solver térmico contra soluções analíticas (esfera homogênea)."""

from dataclasses import replace

import numpy as np
import pytest

from acai_twin.analitico import temperatura_esfera
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


def centro_analitico_robin(t, bi, alpha, T0=25.0, Tinf=85.0):
    return temperatura_esfera(0.0, t, bi, alpha, R, T0, Tinf)


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
    """Calor que entra pela superfície = variação da energia interna (balanço global)."""
    p = ParametrosModelo()
    malha = construir_malha(p)
    T = np.full(malha.n, 25.0)
    calor_total = 0.0
    for t_inf, h in [(85.0, p.conveccao.h_imersao), (25.0, p.conveccao.h_resfriamento)]:
        for _ in range(60):
            T, q = avancar(T, malha, t_inf, h, 0.5, devolver_calor=True)
            calor_total += q
    assert np.isclose(calor_total, energia_absorvida_j(T, 25.0, malha), rtol=1e-10)


def test_principio_do_maximo():
    p = ParametrosModelo()
    malha = construir_malha(p)
    T = np.full(malha.n, 25.0)
    for _ in range(200):
        T = avancar(T, malha, 85.0, p.conveccao.h_imersao, 0.25)
        assert T.max() <= 85.0 + 1e-9 and T.min() >= 25.0 - 1e-9


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
