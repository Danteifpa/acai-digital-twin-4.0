import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="Digital Twin Açaí Pasteurization API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SimulationInput(BaseModel):
    lote_id: str
    tempo_decorrido_s: float
    temp_banho_c: float
    temp_inicial_fruta_c: float = 25.0

class SimulationOutput(BaseModel):
    lote_id: str
    tempo_decorrido_s: float
    temp_superficie_c: float
    temp_centro_c: float
    taxa_inativacao_pct: float
    retencao_antocianinas_pct: float
    status_processo: str

def resolver_perfil_termico(tempo_s: float, temp_banho_c: float, temp_inicial_c: float):
    if tempo_s <= 0:
        return temp_inicial_c, temp_inicial_c

    # Dimensões e propriedades físicas da baga de açaí
    R = 0.007         # Raio: 7 mm (0.007 m)
    alpha = 1.4e-7    # Difusividade térmica média (m²/s)
    k = 0.6           # Condutividade térmica (W/m·K)
    h = 350.0         # Coeficiente convectivo do banho (W/m²·K)
    
    # Malha espacial unidimensional estável
    Nr = 15
    dr = R / (Nr - 1)
    biot_factor = h * dr / k

    # Discretização temporal respeitando o critério de estabilidade de Fourier
    dt_seguro = 0.2 * (dr**2) / alpha
    n_passos = max(1, int(np.ceil(tempo_s / dt_seguro)))
    dt = tempo_s / n_passos

    # Vetores de raio e temperatura inicial
    T = np.full(Nr, temp_inicial_c, dtype=np.float64)
    r = np.linspace(0, R, Nr)

    for _ in range(n_passos):
        T_novo = T.copy()

        # Condição de contorno no centro (r = 0): simetria dT/dr = 0
        T_novo[0] = T[0] + 6.0 * alpha * (dt / (dr**2)) * (T[1] - T[0])

        # Nós intermediários (condução esférica 1D)
        for i in range(1, Nr - 1):
            termo_difusao = (T[i+1] - 2.0 * T[i] + T[i-1]) / (dr**2)
            termo_esferico = (2.0 / r[i]) * ((T[i+1] - T[i-1]) / (2.0 * dr))
            T_novo[i] = T[i] + alpha * dt * (termo_difusao + termo_esferico)

        # Superfície externa (r = R): balanço de convecção
        T_novo[-1] = (T_novo[-2] + biot_factor * temp_banho_c) / (1.0 + biot_factor)

        # Limitação termodinâmica contra oscilações de truncamento
        T = np.clip(T_novo, min(temp_inicial_c, temp_banho_c), max(temp_inicial_c, temp_banho_c))

    return float(T[0]), float(T[-1])

def calcular_cinetica_enzimatica(temp_centro_c: float, tempo_s: float):
    # Cinética de primeira ordem para inativação da Peroxidase (POD)
    # Modelo simplificado: ativação rápida acima de 65°C
    if temp_centro_c < 65.0:
        inativacao = min(15.0, (temp_centro_c / 65.0) * 10.0)
    else:
        fator_termico = (temp_centro_c - 65.0) / 20.0
        inativacao = min(99.9, 15.0 + 84.9 * (1.0 - np.exp(-0.08 * fator_termico * tempo_s)))

    # Degradação de antocianinas em função do choque térmico
    perda_antocianinas = 0.0
    if temp_centro_c > 75.0:
        perda_antocianinas = (temp_centro_c - 75.0) * 0.45 * (tempo_s / 60.0)
    retencao = max(70.0, 100.0 - perda_antocianinas)

    # Definição do estado operacional
    if inativacao >= 95.0:
        status = "PASTEURIZADO"
    elif temp_centro_c >= 70.0:
        status = "ZONA_CRITICA"
    else:
        status = "EM_AQUECIMENTO"

    return round(float(inativacao), 2), round(float(retencao), 2), status

@app.get("/")
def health_check():
    return {"status": "online", "sistema": "Açaí Digital Twin"}

@app.post("/api/v1/simulate", response_model=SimulationOutput)
def simular(payload: SimulationInput):
    t_centro, t_sup = resolver_perfil_termico(
        payload.tempo_decorrido_s,
        payload.temp_banho_c,
        payload.temp_inicial_fruta_c
    )

    inativacao, retencao, status = calcular_cinetica_enzimatica(
        t_centro,
        payload.tempo_decorrido_s
    )

    return SimulationOutput(
        lote_id=payload.lote_id,
        tempo_decorrido_s=payload.tempo_decorrido_s,
        temp_superficie_c=round(t_sup, 2),
        temp_centro_c=round(t_centro, 2),
        taxa_inativacao_pct=inativacao,
        retencao_antocianinas_pct=retencao,
        status_processo=status
    )