"""
AçaíThermal Twin — API do motor numérico (FastAPI).

Rotas principais
  GET  /                               saúde do serviço
  GET  /api/v1/parametros              parâmetros do modelo (com fontes no código)
  POST /api/v1/simular                 ciclo completo (preditivo | fixo | centro_70)
  POST /api/v1/comparar                os três modos lado a lado
  POST /api/v1/lotes/{id}/leituras     modo tempo real: uma leitura de sensor → novo estado
  POST /api/v1/lotes/{id}/reset        reinicia o lote
  GET  /api/v1/lotes/{id}              estado atual do lote

Persistência no Supabase é opcional: defina SUPABASE_URL e SUPABASE_SERVICE_KEY
(chave service_role – nunca a publique no front-end).
"""
from __future__ import annotations

import logging
import os
import threading
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from dataclasses import replace

from acai_twin.parametros import Geometria, ParametrosModelo
from acai_twin.processo import Lote, simular_processo

log = logging.getLogger("acai_twin")

app = FastAPI(
    title="AçaíThermal Twin Engine",
    description="Condução transiente em esfera composta (caroço + polpa) com contorno "
                "convectivo e cinética integrada de antocianinas e POD — TCC IFPA.",
    version="5.0",
)

_origens = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origens],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------- Supabase
_supabase = None
if os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_KEY"):
    try:
        from supabase import create_client
        _supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    except Exception as e:  # pragma: no cover
        log.warning("Supabase indisponível: %s", e)


def _persistir(registro: dict, temp_banho_c: float) -> Optional[str]:
    """Grava leitura + estado. Devolve mensagem de erro (ou None)."""
    if _supabase is None:
        return None
    try:
        leitura = _supabase.table("leituras_sensores").insert(
            {"lote_id": registro["lote_id"], "temp_banho_c": temp_banho_c}
        ).execute()
        leitura_id = leitura.data[0]["id"] if leitura.data else None
        colunas = {k: v for k, v in registro.items() if k not in ("perfil_radial_c", "imerso")}
        colunas["leitura_origem_id"] = leitura_id
        colunas["perfil_radial_c"] = registro["perfil_radial_c"]
        _supabase.table("estado_digital_twin").insert(colunas).execute()
        return None
    except Exception as e:
        log.error("Falha ao persistir no Supabase: %s", e)
        return str(e)


# ---------------------------------------------------------------- estado dos lotes
_lotes: dict[str, Lote] = {}
_trava = threading.Lock()


def _obter_lote(lote_id: str, criar: bool = False, temp_inicial_c: float = 25.0) -> Lote:
    with _trava:
        if lote_id not in _lotes:
            if not criar:
                raise HTTPException(404, f"Lote '{lote_id}' não encontrado.")
            _lotes[lote_id] = Lote(lote_id=lote_id, temp_inicial_c=temp_inicial_c)
        return _lotes[lote_id]


# ---------------------------------------------------------------- esquemas
def _params(diametro_mm: float) -> ParametrosModelo:
    base = ParametrosModelo()
    return replace(base, geometria=replace(base.geometria, raio_m=diametro_mm / 2000.0))


class PedidoSimulacao(BaseModel):
    diametro_mm: float = Field(14.0, ge=8, le=22)
    temp_banho_c: float = Field(85.0, ge=40, le=100)
    temp_inicial_c: float = Field(25.0, ge=0, le=45)
    modo: Literal["preditivo", "fixo", "centro_70"] = "preditivo"
    tempo_imersao_fixo_s: float = Field(10.0, gt=0, le=600)
    tempo_resfriamento_s: float = Field(60.0, ge=0, le=600)
    intervalo_saida_s: float = Field(1.0, ge=0.5, le=10)


class PedidoComparacao(BaseModel):
    diametro_mm: float = Field(14.0, ge=8, le=22)
    temp_banho_c: float = Field(85.0, ge=40, le=100)
    temp_inicial_c: float = Field(25.0, ge=0, le=45)
    tempo_imersao_fixo_s: float = Field(10.0, gt=0, le=600)
    tempo_resfriamento_s: float = Field(60.0, ge=0, le=600)


class Leitura(BaseModel):
    temp_banho_c: float = Field(..., ge=0, le=110)
    dt_s: float = Field(1.0, gt=0, le=10)
    imerso: bool = True
    temp_inicial_c: float = Field(25.0, ge=0, le=45, description="Usado só na criação do lote.")


class PedidoReset(BaseModel):
    temp_inicial_c: float = Field(25.0, ge=0, le=45)


# ---------------------------------------------------------------- rotas
@app.get("/")
def saude():
    return {
        "status": "online",
        "modulo": "AçaíThermal Twin Engine",
        "versao": app.version,
        "persistencia_supabase": _supabase is not None,
        "criterio_sanitario": "superfície ≥ 80 °C por ≥ 10 s (branqueamento — PA 2012 / AP 2015)",
    }


@app.get("/api/v1/parametros")
def parametros():
    p = ParametrosModelo()
    d = p.como_dict()
    d["derivados"] = {
        "alpha_polpa_m2_s": p.polpa.alpha,
        "alpha_caroco_m2_s": p.caroco.alpha,
        "raio_caroco_mm": p.geometria.raio_caroco_m * 1000,
        "espessura_polpa_mm": (p.geometria.raio_m - p.geometria.raio_caroco_m) * 1000,
        "biot_imersao": p.conveccao.h_imersao * p.geometria.raio_m / p.polpa.k,
    }
    return d


@app.post("/api/v1/simular")
def simular(pedido: PedidoSimulacao):
    dados = pedido.model_dump()
    p = _params(dados.pop("diametro_mm"))
    return simular_processo(p=p, **dados)


@app.post("/api/v1/comparar")
def comparar(pedido: PedidoComparacao):
    base = pedido.model_dump()
    p = _params(base.pop("diametro_mm"))
    return {modo: simular_processo(modo=modo, p=p, **base) for modo in ("preditivo", "fixo", "centro_70")}


@app.post("/api/v1/lotes/{lote_id}/leituras")
def registrar_leitura(lote_id: str, leitura: Leitura):
    lote = _obter_lote(lote_id, criar=True, temp_inicial_c=leitura.temp_inicial_c)
    with _trava:
        lote.passo(leitura.temp_banho_c, leitura.dt_s, imerso=leitura.imerso)
        registro = lote.registro()
        previsao = lote.prever_tempo_corte(leitura.temp_banho_c) if leitura.imerso else None
    registro["previsao_corte_s"] = None if previsao is None else round(previsao, 1)
    registro["acao_recomendada"] = (
        "RETIRAR_DO_BANHO" if lote.criterio_atingido and leitura.imerso
        else "AUMENTAR_TEMPERATURA_DO_BANHO" if leitura.imerso and previsao is None
        else "MANTER"
    )
    erro = _persistir(registro, leitura.temp_banho_c)
    if erro:
        registro["aviso_persistencia"] = erro
    return registro


@app.post("/api/v1/lotes/{lote_id}/reset")
def resetar_lote(lote_id: str, pedido: PedidoReset):
    with _trava:
        _lotes[lote_id] = Lote(lote_id=lote_id, temp_inicial_c=pedido.temp_inicial_c)
    return _lotes[lote_id].registro()


@app.get("/api/v1/lotes/{lote_id}")
def estado_lote(lote_id: str):
    return _obter_lote(lote_id).registro()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
