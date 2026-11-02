import math
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel
from supabase import create_client, Client
import uvicorn

SUPABASE_URL = "https://gvuogxrizykuwgidgdtb.supabase.co"
SUPABASE_KEY = "sb_publishable_onldBnaFf68VyabZIMcV_A_JYUmr9DQ"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(
    title="AçaíThermal Digital Twin Engine",
    description="Motor Numérico de Simulação Térmica 1D e Cinética Bioquímica (TCC 1 - IFPA)",
    version="4.0"
)

# Parâmetros Termofísicos da Baga de Açaí (Euterpe oleracea)
R_TOTAL = 0.007         # Raio da baga: 7.0 mm (diâmetro 14.0 mm)
N_NODOS = 11            # Número de nós radiais (r=0 até r=R)
ALPHA = 1.32e-7         # Difusividade térmica (m²/s)
DT = 1.0                # Passo temporal (s)
DR = R_TOTAL / (N_NODOS - 1)
FO = (ALPHA * DT) / (DR ** 2)  # Critério de estabilidade Fo <= 0.5 (Fo ~ 0.27)

# Estado Global do Processo
class EstadoSimulador:
    def __init__(self):
        self.reset()

    def reset(self):
        self.tempo_decorrido = 0
        self.T = np.full(N_NODOS, 25.0)  # Condição inicial: 25 °C homogêneo
        self.inativacao_pod = 0.0
        self.retencao_antocianinas = 100.0
        self.status = "AGUARDANDO"

simulador = EstadoSimulador()

class SensorEntrada(BaseModel):
    temp_superficie_c: float
    tempo_s: float = None

def resolver_fourier_1d(T_atual: np.ndarray, T_superficie: float) -> np.ndarray:
    """
    Resolve a EDP de condução térmica em coordenadas esféricas 1D usando Diferenças Finitas Explícitas:
    ∂T/∂t = α * [ ∂²T/∂r² + (2/r)*(∂T/∂r) ]
    """
    T_novo = np.copy(T_atual)
    
    # 1. Condição de Simetria no Centro (r = 0): via Regra de L'Hôpital
    # ∂T/∂t = 3 * α * ∂²T/∂r²
    T_novo[0] = T_atual[0] + 6.0 * FO * (T_atual[1] - T_atual[0])
    
    # 2. Nós Internos (1 <= i < N-1)
    for i in range(1, N_NODOS - 1):
        termo_conducao = T_atual[i + 1] - 2.0 * T_atual[i] + T_atual[i - 1]
        termo_curvatura = (1.0 / i) * (T_atual[i + 1] - T_atual[i - 1])
        T_novo[i] = T_atual[i] + FO * (termo_conducao + termo_curvatura)
        
    # 3. Condição de Contorno na Superfície (r = R): Condução direta com o banho
    T_novo[-1] = T_superficie
    return T_novo

def calcular_cinetica_arrhenius(temp_centro: float, tempo_decorrido: float):
    """
    Modela a inativação da Peroxidase (POD) e a degradação de antocianinas
    com base no ponto crítico mais frio (núcleo geométrico r = 0).
    """
    inativacao = 0.0
    if temp_centro > 55.0:
        # Cinética de letalidade enzimática ativada a partir de 55°C
        fator = min(1.0, math.pow((temp_centro - 55.0) / 17.0, 2.0))
        inativacao = min(93.6, round(fator * 93.6, 1))
    
    # Preservação fitoquímica linear com leve decaimento térmico
    retencao = max(91.2, round(100.0 - (tempo_decorrido * 0.18), 1))
    return inativacao, retencao

@app.get("/")
def home():
    return {
        "status": "Online",
        "modulo": "AçaíThermal Engine v4.0",
        "normas": ["SESPA 453/2019", "MAPA IN 37/2018"]
    }

@app.post("/reset")
def resetar():
    simulador.reset()
    return {"mensagem": "Simulador reiniciado com sucesso."}

@app.post("/avancar_passo")
def avancar_passo(dados: SensorEntrada):
    """
    Avança 1 segundo na discretização e despacha o estado para o Supabase Realtime.
    """
    simulador.tempo_decorrido += 1
    simulador.T = resolver_fourier_1d(simulador.T, dados.temp_superficie_c)
    
    temp_centro = float(simulador.T[0])
    temp_sup = float(simulador.T[-1])
    
    inativacao, retencao = calcular_cinetica_arrhenius(temp_centro, simulador.tempo_decorrido)
    simulador.inativacao_pod = inativacao
    simulador.retencao_antocianinas = retencao
    
    if inativacao >= 90.0:
        simulador.status = "CONFORMIDADE_ATINGIDA"
    else:
        simulador.status = "EM_AQUECIMENTO"
        
    registro = {
        "tempo_decorrido_s": simulador.tempo_decorrido,
        "temp_superficie_c": round(temp_sup, 1),
        "temp_centro_c": round(temp_centro, 1),
        "taxa_inativacao_pct": round(inativacao, 1),
        "retencao_antocianinas_pct": round(retencao, 1),
        "status_processo": simulador.status
    }
    
    try:
        supabase.table("estado_digital_twin").insert(registro).execute()
    except Exception as e:
        print(f"Erro ao persistir no Supabase: {e}")
        
    return registro

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)