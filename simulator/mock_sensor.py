import time
import requests

API_URL = "http://localhost:8000/api/v1/simulate"
LOTE_ID = "LOTE-DEMO-TCC1"

print(f"Iniciando emulador telemétrico para o {LOTE_ID}...\n")

for t in range(0, 91, 5):
    payload = {
        "lote_id": LOTE_ID,
        "tempo_decorrido_s": float(t),
        "temp_banho_c": 82.5,
        "temp_inicial_c": 25.0
    }
    
    try:
        resp = requests.post(API_URL, json=payload, timeout=3)
        if resp.status_code == 200:
            dado = resp.json()
            print(f"[{t:02d}s] Superfície: {dado['temp_superficie_c']}°C | "
                  f"Centro: {dado['temp_centro_c']}°C | "
                  f"Inativação: {dado['taxa_inativacao_pct']}% | "
                  f"Antocianina: {dado['retencao_antocianinas_pct']}% | "
                  f"Status: {dado['status_processo']}")
        else:
            print(f"Erro da API: {resp.status_code}")
    except Exception as e:
        print(f"Falha de conexão com o motor: {e}")
        
    time.sleep(1)