"""
Sensor virtual do banho de branqueamento.

Envia uma leitura de temperatura por segundo ao motor (/api/v1/lotes/{id}/leituras)
e obedece à ação recomendada pelo gêmeo digital (corte preditivo). O motor grava
cada estado no seu banco SQLite e o transmite ao painel em tempo real.

Uso:
    python simulator/mock_sensor.py                         # motor local
    ENGINE_URL=https://seu-motor.onrender.com python simulator/mock_sensor.py --banho 88
"""

import argparse
import json
import os
import random
import time
import urllib.request
from datetime import datetime

ENGINE_URL = os.getenv("ENGINE_URL", "http://127.0.0.1:8000").rstrip("/")


def post_json(url: str, corpo: dict, timeout: float = 30) -> dict:
    """POST com JSON usando só a biblioteca padrão (sem dependências extras)."""
    req = urllib.request.Request(
        url,
        data=json.dumps(corpo).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lote", default=f"LOTE-{datetime.now():%Y%m%d-%H%M%S}")
    ap.add_argument("--banho", type=float, default=88.0, help="setpoint do banho (°C)")
    ap.add_argument("--ruido", type=float, default=0.4, help="desvio-padrão do sensor (°C)")
    ap.add_argument("--resfriamento", type=int, default=20, help="segundos de resfriamento")
    ap.add_argument("--max", type=int, default=180, help="tempo máximo de imersão (s)")
    ap.add_argument("--intervalo", type=float, default=1.0, help="pausa real entre leituras (s)")
    a = ap.parse_args()

    url = f"{ENGINE_URL}/api/v1/lotes/{a.lote}"
    post_json(f"{url}/reset", {"temp_inicial_c": 25.0})
    print(f"[*] Motor: {ENGINE_URL}  |  lote {a.lote}  |  banho {a.banho:.1f} °C\n")

    imerso, restante_resfr = True, a.resfriamento
    for t in range(1, a.max + a.resfriamento + 1):
        leitura = round(random.gauss(a.banho, a.ruido), 2)
        e = post_json(f"{url}/leituras", {"temp_banho_c": leitura, "dt_s": 1.0, "imerso": imerso})
        prev = e.get("previsao_corte_s")
        print(
            f"t={e['tempo_decorrido_s']:5.0f}s  banho={leitura:5.1f}  "
            f"sup={e['temp_superficie_c']:5.1f}  centro={e['temp_centro_c']:5.1f}  "
            f"letal={e['tempo_letal_superficie_s']:4.1f}s  "
            f"prev={'—' if prev is None else f'{prev:4.1f}s'}  {e['status_processo']}"
        )

        if imerso and e["acao_recomendada"] == "RETIRAR_DO_BANHO":
            print("\n[✓] Critério sanitário cumprido — retirando os frutos do banho.\n")
            imerso = False
        elif not imerso:
            restante_resfr -= 1
            if restante_resfr <= 0:
                break
        elif t >= a.max:
            print("\n[✗] Tempo máximo atingido sem cumprir o critério.")
            break
        time.sleep(a.intervalo)

    print("\n[*] Ciclo finalizado.")


if __name__ == "__main__":
    main()
