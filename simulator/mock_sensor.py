import time
import requests
from supabase import create_client, Client

# --- ENDPOINTS E CREDENCIAIS ---
RENDER_API_URL = "https://acai-digital-twin-4-0.onrender.com/api/v1/simulate"
SUPABASE_URL = "https://gvuogxrizykuwgidgdtb.supabase.co"
SUPABASE_KEY = "sb_publishable_onldBnaFf68VyabZIMcV_A_JYUmr9DQ"

# Inicializa o cliente Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def executar_ciclo_pasteurizacao():
    lote_id = "LOTE-2026-TCC"
    temp_banho_agua = 85.0  # Temperatura da água de pasteurização (°C)
    duracao_total_s = 60    # Duração total da simulação em segundos
    passo_s = 5             # Intervalo de tempo entre cada cálculo (segundos)

    print(f"[*] Conectando ao Render ({RENDER_API_URL})...")
    print(f"[*] Gravando dados no Supabase ({SUPABASE_URL})...")
    print(f"[*] Iniciando lote: {lote_id}\n")

    for t in range(0, duracao_total_s + 1, passo_s):
        # 1. Persistir telemetria bruta no Supabase
        leitura_dado = {
            "lote_id": lote_id,
            "temp_banho_c": temp_banho_agua
        }
        res_leitura = supabase.table("leituras_sensores").insert(leitura_dado).execute()
        leitura_id = res_leitura.data[0]["id"] if res_leitura.data else None

        # 2. Requisitar simulação física no Render
        payload = {
            "lote_id": lote_id,
            "tempo_decorrido_s": float(t),
            "temp_banho_c": temp_banho_agua,
            "temp_inicial_fruta_c": 25.0
        }

        try:
            resp = requests.post(RENDER_API_URL, json=payload, timeout=25)
            if resp.status_code == 200:
                calc = resp.json()

                # 3. Persistir o estado físico simulado no Supabase
                estado_dado = {
                    "leitura_origem_id": leitura_id,
                    "lote_id": lote_id,
                    "tempo_decorrido_s": calc["tempo_decorrido_s"],
                    "temp_superficie_c": calc["temp_superficie_c"],
                    "temp_centro_c": calc["temp_centro_c"],
                    "taxa_inativacao_pct": calc["taxa_inativacao_pct"],
                    "retencao_antocianinas_pct": calc["retencao_antocianinas_pct"],
                    "status_processo": calc["status_processo"]
                }
                supabase.table("estado_digital_twin").insert(estado_dado).execute()

                print(f"[t={t:02d}s] T_centro: {calc['temp_centro_c']:.1f}°C | "
                      f"Inativação: {calc['taxa_inativacao_pct']:.1f}% | "
                      f"Status: {calc['status_processo']} -> Gravado com sucesso!")
            else:
                print(f"[!] Erro no Render ({resp.status_code}): {resp.text}")

        except Exception as e:
            print(f"[!] Falha na conexão com o Render: {e}")

        time.sleep(2)

    print("\n[*] Ciclo finalizado! Todos os dados foram calculados e persistidos.")

if __name__ == "__main__":
    executar_ciclo_pasteurizacao()