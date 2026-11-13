"""
Gera as figuras de verificação, calibração e resultados usadas em docs/ e no TCC.

Uso (a partir da pasta engine/):
    python -m scripts.gerar_figuras            # salva em ../docs/figuras
    python -m scripts.gerar_figuras --saida X  # outra pasta

Também grava docs/figuras/resumo.json com os números citados na documentação,
para que texto e figuras venham sempre da mesma execução.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import replace
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

from acai_twin.analitico import temperatura_esfera  # noqa: E402
from acai_twin.parametros import POLPA, Conveccao, Geometria, ParametrosModelo  # noqa: E402
from acai_twin.processo import Lote, simular_processo  # noqa: E402
from acai_twin.termico import avancar, construir_malha  # noqa: E402
from scripts.calibrar_h import FAIXAS, OBS, erro, sup_media  # noqa: E402

ROXO, LARANJA, VERMELHO, CINZA, VERDE = "#7c3aed", "#f59e0b", "#e11d48", "#64748b", "#059669"
R = 0.007

plt.rcParams.update(
    {
        "figure.dpi": 150,
        "savefig.bbox": "tight",
        "font.size": 10,
        "axes.grid": True,
        "grid.alpha": 0.3,
        "axes.spines.top": False,
        "axes.spines.right": False,
    }
)


def _homogeneo(h: float, n: int) -> ParametrosModelo:
    return replace(
        ParametrosModelo(),
        geometria=Geometria(raio_m=R, n_nos=n),
        caroco=replace(POLPA, nome="caroco"),
        conveccao=Conveccao(h_imersao=h),
    )


def _centro_numerico(h: float, n: int, tempos: list[float]) -> list[float]:
    malha = construir_malha(_homogeneo(h, n))
    T, t, saida = np.full(malha.n, 25.0), 0.0, []
    for alvo in tempos:
        T = avancar(T, malha, 85.0, h, alvo - t)
        t = alvo
        saida.append(float(T[0]))
    return saida


def fig_validacao(saida: Path, resumo: dict) -> None:
    tempos = list(np.arange(5, 181, 5.0))
    fig, ax = plt.subplots(figsize=(6.4, 4))
    erros = {}
    for h, cor in [(200.0, CINZA), (1000.0, LARANJA), (4700.0, ROXO)]:
        bi = h * R / POLPA.k
        ana = [temperatura_esfera(0, t, bi, POLPA.alpha, R, 25, 85) for t in tempos]
        num = _centro_numerico(h, 81, tempos)
        erros[f"Bi={bi:.1f}"] = float(np.max(np.abs(np.array(num) - np.array(ana))))
        ax.plot(tempos, ana, color=cor, lw=2, alpha=0.5, label=f"analítica, Bi = {bi:.1f}")
        ax.plot(tempos[::3], num[::3], "o", color=cor, ms=4, label=f"volumes finitos, Bi = {bi:.1f}")
    ax.set(
        xlabel="tempo (s)",
        ylabel="temperatura no centro (°C)",
        title="Verificação: esfera homogênea, banho a 85 °C",
    )
    ax.legend(fontsize=8, ncol=2)
    fig.savefig(saida / "validacao_analitica.png")
    plt.close(fig)
    resumo["erro_max_centro_c"] = erros


def fig_convergencia(saida: Path, resumo: dict) -> None:
    h, t = 4700.0, 60.0
    bi = h * R / POLPA.k
    ref = temperatura_esfera(0, t, bi, POLPA.alpha, R, 25, 85)
    ns = [11, 21, 41, 81, 161]
    dr = [R / (n - 1) * 1000 for n in ns]
    err = [abs(_centro_numerico(h, n, [t])[0] - ref) for n in ns]
    ordem = float(np.polyfit(np.log(dr[-3:]), np.log(err[-3:]), 1)[0])
    fig, ax = plt.subplots(figsize=(5.2, 3.8))
    ax.loglog(dr, err, "o-", color=ROXO, label="erro no centro (t = 60 s)")
    guia = err[-1] * (np.array(dr) / dr[-1]) ** 2
    ax.loglog(dr, guia, "--", color=CINZA, label="referência O(Δr²)")
    ax.set(
        xlabel="Δr (mm)",
        ylabel="|T_num − T_analítica| (°C)",
        title=f"Convergência de malha (ordem observada ≈ {ordem:.2f})",
    )
    ax.legend(fontsize=8)
    fig.savefig(saida / "convergencia_malha.png")
    plt.close(fig)
    resumo["ordem_convergencia"] = round(ordem, 2)
    resumo["convergencia"] = {f"n={n}": round(e, 4) for n, e in zip(ns, err, strict=True)}


def fig_calibracao(saida: Path, resumo: dict) -> None:
    hs = np.geomspace(500, 15000, 30)
    rmse = [erro(h) for h in hs]
    h_ot = ParametrosModelo().conveccao.h_imersao
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(10, 3.8))
    a1.semilogx(hs, rmse, color=ROXO)
    a1.axvline(h_ot, color=VERMELHO, ls="--", label=f"h adotado = {h_ot:.0f} W/m²K")
    a1.set(xlabel="h (W/m²K)", ylabel="RMSE (°C)", title="Calibração do coeficiente convectivo")
    a1.legend(fontsize=8)
    for (tb, lo, hi), cor in zip(FAIXAS, [LARANJA, VERMELHO], strict=True):
        p = replace(ParametrosModelo(), conveccao=Conveccao(h_imersao=h_ot))
        lote, ts, sup = Lote("c", 25.0, p), [], []
        for t in np.arange(0.25, 10.01, 0.25):
            lote.passo(tb, 0.25)
            ts.append(t)
            sup.append(lote.temp_superficie_c)
        a2.plot(ts, sup, color=cor, label=f"modelo, banho {tb} °C")
        a2.axhspan(lo, hi, color=cor, alpha=0.18, label=f"Embrapa (2–10 s): {lo}–{hi} °C")
    a2.set(
        xlabel="tempo (s)", ylabel="superfície (°C)", ylim=(60, 92), title="Modelo × medições na superfície"
    )
    a2.legend(fontsize=7)
    fig.savefig(saida / "calibracao_h.png")
    plt.close(fig)
    resumo["h_adotado"] = h_ot
    resumo["rmse_calibracao_c"] = round(erro(h_ot), 2)
    resumo["superficie_media_modelo"] = {str(tb): round(sup_media(h_ot, tb), 2) for tb, _ in OBS}


def fig_perfis(saida: Path) -> None:
    lote = Lote("perfil")
    r_mm = lote.malha.r * 1000
    rc = lote.p.geometria.raio_caroco_m * 1000
    fig, ax = plt.subplots(figsize=(6.4, 4))
    cores = plt.cm.plasma(np.linspace(0.1, 0.85, 6))
    marcos = [2, 5, 10, 20, 40, 80]
    t = 0.0
    for alvo, cor in zip(marcos, cores, strict=True):
        while t < alvo:
            lote.passo(88.0, 0.5)
            t += 0.5
        ax.plot(r_mm, lote.T, color=cor, lw=2, label=f"t = {alvo} s")
    ax.axvspan(rc, r_mm[-1], color=ROXO, alpha=0.08, label="polpa")
    ax.set(
        xlabel="raio (mm)",
        ylabel="temperatura (°C)",
        title="Perfis radiais T(r) — fruto de 14 mm, banho a 88 °C",
    )
    ax.legend(fontsize=8, ncol=2)
    fig.savefig(saida / "perfis_radiais.png")
    plt.close(fig)


def fig_estrategias(saida: Path, resumo: dict) -> None:
    nomes = {
        "preditivo": "Preditivo (gêmeo digital)",
        "fixo": "Tempo fixo 10 s",
        "centro_70": "Centro ≥ 70 °C",
    }
    cores = {"preditivo": ROXO, "fixo": LARANJA, "centro_70": CINZA}
    res = {m: simular_processo(temp_banho_c=88.0, modo=m, tempo_resfriamento_s=45) for m in nomes}
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(10, 3.8), gridspec_kw={"width_ratios": [1.6, 1]})
    for m, r in res.items():
        ts = [p["tempo_decorrido_s"] for p in r["serie"]]
        a1.plot(ts, [p["temp_superficie_c"] for p in r["serie"]], color=cores[m], lw=2, label=nomes[m])
    a1.axhline(80, color=VERDE, ls="--", lw=1, label="critério 80 °C")
    a1.set(xlabel="tempo (s)", ylabel="superfície (°C)", title="Temperatura da superfície", xlim=(0, 130))
    a1.legend(fontsize=8)
    x = np.arange(3)
    tempos = [res[m]["resumo"]["tempo_corte_s"] for m in nomes]
    energia = [res[m]["resumo"]["energia_absorvida_no_corte_kj_kg"] for m in nomes]
    a2.bar(x - 0.2, tempos, 0.4, color=ROXO, label="imersão (s)")
    a2.bar(x + 0.2, energia, 0.4, color="#22d3ee", label="energia (kJ/kg)")
    a2.set_xticks(x, ["Preditivo", "Fixo 10 s", "Centro 70 °C"], fontsize=8)
    for i, m in enumerate(nomes):
        marca = "✓" if res[m]["resumo"]["conforme"] else "✗"
        a2.text(
            i,
            max(tempos[i], energia[i]) + 4,
            marca,
            ha="center",
            fontsize=12,
            color=VERDE if res[m]["resumo"]["conforme"] else VERMELHO,
        )
    a2.set(title="Custo de cada estratégia", ylim=(0, max(energia) * 1.2))
    a2.legend(fontsize=8)
    fig.savefig(saida / "comparativo_estrategias.png")
    plt.close(fig)
    resumo["estrategias_88c_14mm"] = {m: res[m]["resumo"] for m in nomes}


def fig_sensibilidade(saida: Path, resumo: dict) -> None:
    diam = [10, 12, 14, 16, 18, 20]
    pred, leg = [], []
    for d in diam:
        base = ParametrosModelo()
        p = replace(base, geometria=replace(base.geometria, raio_m=d / 2000))
        pred.append(
            simular_processo(88.0, modo="preditivo", tempo_resfriamento_s=0, p=p)["resumo"]["tempo_corte_s"]
        )
        leg.append(
            simular_processo(88.0, modo="centro_70", tempo_resfriamento_s=0, p=p)["resumo"]["tempo_corte_s"]
        )
    fig, ax = plt.subplots(figsize=(5.6, 3.8))
    ax.plot(diam, leg, "o-", color=CINZA, label="critério no centro (≥ 70 °C)")
    ax.plot(diam, pred, "o-", color=ROXO, label="critério na superfície (proposto)")
    ax.set(
        xlabel="diâmetro do fruto (mm)",
        ylabel="tempo de imersão (s)",
        title="Sensibilidade ao tamanho (banho a 88 °C)",
    )
    ax.legend(fontsize=8)
    fig.savefig(saida / "sensibilidade_diametro.png")
    plt.close(fig)
    resumo["sensibilidade_diametro_88c"] = {
        str(d): {"preditivo_s": a, "centro_70_s": b} for d, a, b in zip(diam, pred, leg, strict=True)
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--saida", default=str(Path(__file__).resolve().parents[2] / "docs" / "figuras"))
    saida = Path(ap.parse_args().saida)
    saida.mkdir(parents=True, exist_ok=True)
    resumo: dict = {}
    fig_validacao(saida, resumo)
    fig_convergencia(saida, resumo)
    fig_calibracao(saida, resumo)
    fig_perfis(saida)
    fig_estrategias(saida, resumo)
    fig_sensibilidade(saida, resumo)
    (saida / "resumo.json").write_text(json.dumps(resumo, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Figuras salvas em {saida}")


if __name__ == "__main__":
    main()
