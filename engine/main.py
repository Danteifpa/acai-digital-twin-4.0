from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import numpy as np

app = FastAPI(
    title="Açaí Thermal Digital Twin Engine",
    description="Motor de simulação física e cinética para pasteurização de açaí (TCC 1)",
    version="1.0.0"
)

class TelemetriaInput(BaseModel):
    lote_id: str = Field(..., example="LOTE-TCC1-01")
    tempo_decorrido_s: float = Field(..., ge=0.0, example=45.0)
    temp_banho_c: float = Field(..., ge=20.0, le=100.0, example=82.5)
    temp_inicial_c: float = Field(default=25.0, ge=5.0, le=40.0, example=25.0)

class DigitalTwinOutput(BaseModel):
    lote_id: str
    tempo_decorrido_s: float
    temp_banho_c: float
    temp_superficie_c: float
    temp_centro_c: float
    taxa_inativacao_pct: float
    retencao_antocianinas_pct: float
    status_processo: str

@app.post("/api/v1/simulate", response_model=DigitalTwinOutput)
def simular_estado_termico(dados: TelemetriaInput):
    try:
        # Constantes termofísicas
        R = 0.0065          # 6.5 mm
        rho = 1030.0        # kg/m^3
        cp = 3700.0         # J/(kg.K)
        k = 0.52            # W/(m.K)
        alpha = k / (rho * cp)
        h = 600.0           # W/(m^2.K)

        # Cinética (Arrhenius)
        R_u = 8.314
        Ea_enz = 92000.0
        k_ref_enz = 0.045
        T_ref = 353.15

        Ea_ant = 70000.0
        k_ref_ant = 0.0018

        # Malha 1D esférica
        N_r = 25
        dr = R / (N_r - 1)
        r = np.linspace(0, R, N_r)

        dt = 0.35 * (dr**2) / alpha
        n_steps = max(1, int(dados.tempo_decorrido_s / dt))

        T = np.full(N_r, dados.temp_inicial_c)
        T_novo = np.copy(T)

        dose_enz = 0.0
        dose_ant = 0.0

        for _ in range(n_steps):
            # Centro: r = 0
            T_novo[0] = T[0] + 6.0 * alpha * dt * (T[1] - T[0]) / (dr**2)

            # Polpa intermediária: condução via Lei de Fourier
            for i in range(1, N_r - 1):
                d2T = (T[i+1] - 2*T[i] + T[i-1]) / (dr**2)
                dT = (T[i+1] - T[i-1]) / (2 * dr)
                T_novo[i] = T[i] + alpha * dt * (d2T + (2.0 / r[i]) * dT)

            # Superfície: balanço convectivo de Newton com condução de Fourier
            T_novo[-1] = (k * T_novo[-2] + h * dr * dados.temp_banho_c) / (k + h * dr)
            T[:] = T_novo[:]

            # Camada da polpa
            T_polpa_K = T[int(N_r * 0.75)] + 273.15
            k_enz = k_ref_enz * np.exp(- (Ea_enz / R_u) * ((1.0 / T_polpa_K) - (1.0 / T_ref)))
            k_ant = k_ref_ant * np.exp(- (Ea_ant / R_u) * ((1.0 / T_polpa_K) - (1.0 / T_ref)))

            dose_enz += k_enz * dt
            dose_ant += k_ant * dt

        inativacao_pct = float(np.clip((1.0 - np.exp(-dose_enz)) * 100.0, 0.0, 100.0))
        retencao_ant_pct = float(np.clip(np.exp(-dose_ant) * 100.0, 0.0, 100.0))

        if inativacao_pct < 90.0:
            status = "EM_AQUECIMENTO"
        elif inativacao_pct >= 90.0 and retencao_ant_pct >= 80.0:
            status = "OTIMIZADO"
        else:
            status = "DEGRADACAO_RISCO"

        return DigitalTwinOutput(
            lote_id=dados.lote_id,
            tempo_decorrido_s=round(dados.tempo_decorrido_s, 1),
            temp_banho_c=round(dados.temp_banho_c, 2),
            temp_superficie_c=round(float(T[-1]), 2),
            temp_centro_c=round(float(T[0]), 2),
            taxa_inativacao_pct=round(inativacao_pct, 2),
            retencao_antocianinas_pct=round(retencao_ant_pct, 2),
            status_processo=status
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno de simulação: {str(e)}")