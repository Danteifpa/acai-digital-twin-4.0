"""
Calibra o coeficiente convectivo de imersão (h) contra dados da Embrapa:
Bezerra et al. — temperatura efetiva na superfície de frutos de açaí imersos
(alice.cnptia.embrapa.br, doc/1070158):
  banho 80,2 °C → superfície 77,8–78,8 °C (2–10 s)
  banho 88,9 °C → superfície 84,7–86,5 °C (2–10 s)
Uso: python -m scripts.calibrar_h   (a partir da pasta engine/)
"""
from dataclasses import replace

import numpy as np

from acai_twin.parametros import Conveccao, ParametrosModelo
from acai_twin.processo import Lote

OBS = [  # (T_banho, T_superficie média observada)
    (80.2, (77.8 + 78.8) / 2),
    (88.9, (84.7 + 86.5) / 2),
]
TEMPOS = [2, 4, 6, 8, 10]


def sup_media(h: float, t_banho: float) -> float:
    p = replace(ParametrosModelo(), conveccao=Conveccao(h_imersao=h))
    lote = Lote("cal", 25.0, p)
    vals = []
    for t in range(1, 11):
        lote.passo(t_banho, 1.0)
        if t in TEMPOS:
            vals.append(lote.temp_superficie_c)
    return float(np.mean(vals))


def erro(h: float) -> float:
    return float(np.sqrt(np.mean([(sup_media(h, tb) - obs) ** 2 for tb, obs in OBS])))


if __name__ == "__main__":
    candidatos = [250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000]
    for h in candidatos:
        print(f"h={h:6.0f}  RMSE={erro(h):5.2f} °C  "
              + "  ".join(f"[{tb}→{sup_media(h, tb):.1f} obs {o:.1f}]" for tb, o in OBS))
    melhor = min(candidatos, key=erro)
    print("melhor h na grade:", melhor)
    from scipy.optimize import minimize_scalar
    res = minimize_scalar(erro, bounds=(1000, 10000), method="bounded", options={"xatol": 10})
    print(f"h ótimo (contínuo): {res.x:.0f} W/m²K  RMSE={res.fun:.2f} °C")
