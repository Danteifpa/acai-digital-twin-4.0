import numpy as np

from acai_twin.cinetica import k_arrhenius, k_dz
from acai_twin.parametros import CineticaAntocianinas, CineticaPOD
from acai_twin.processo import Lote, simular_processo


def test_k_antocianinas_reproduz_anjos_2020():
    # Anjos et al. (2020): k(90 °C) ≈ 0,002 min⁻¹ ; k(60 °C) ≈ 0,0005 min⁻¹
    a = CineticaAntocianinas()
    assert 0.001 < k_arrhenius(90, a.k0_s, a.ea_j_mol) * 60 < 0.003
    assert 0.0002 < k_arrhenius(60, a.k0_s, a.ea_j_mol) * 60 < 0.0008


def test_dz_pod_valor_de_referencia():
    p = CineticaPOD()
    # em T_ref, 90 % de inativação da fração lábil leva exatamente D1
    k = k_dz(p.t_ref_c, p.d1_ref_s, p.z1_c, p.t_ref_c)
    assert np.isclose(np.exp(-k * p.d1_ref_s), 0.1)


def test_inativacao_nao_regride_no_resfriamento():
    lote = Lote("t")
    for _ in range(30):
        lote.passo(92.0, 1.0)
    inat = 1 - lote.cin.atividade_pod(lote.peso_polpa)
    for _ in range(30):
        lote.passo(92.0, 1.0, imerso=False)
    assert 1 - lote.cin.atividade_pod(lote.peso_polpa) >= inat


def test_banho_a_80_nao_cumpre_criterio():
    # coerente com Bezerra et al./Embrapa: água a 80 °C não leva a superfície a 80 °C
    r = simular_processo(temp_banho_c=80.0, modo="preditivo")
    assert r["resumo"]["conforme"] is False


def test_preditivo_corta_antes_do_criterio_legado():
    pred = simular_processo(temp_banho_c=85.0, modo="preditivo")["resumo"]
    legado = simular_processo(temp_banho_c=85.0, modo="centro_70")["resumo"]
    assert pred["conforme"]
    assert pred["tempo_corte_s"] < legado["tempo_corte_s"]
    assert pred["energia_absorvida_no_corte_kj_kg"] < legado["energia_absorvida_no_corte_kj_kg"]


def test_previsao_de_corte_consistente_com_simulacao():
    lote = Lote("p")
    prev = lote.prever_tempo_corte(88.0, dt=0.5)
    real = simular_processo(temp_banho_c=88.0, modo="preditivo", dt=0.5)["resumo"]["tempo_corte_s"]
    assert prev is not None and abs(prev - real) <= 0.5
