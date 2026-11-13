"""
AçaíThermal Twin — API do motor numérico (FastAPI).

Rotas
  GET  /                               saúde do serviço
  GET  /api/v1/parametros              parâmetros do modelo (com fontes no código)
  POST /api/v1/simular                 ciclo completo (preditivo | fixo | centro_70)
  POST /api/v1/comparar                os três modos lado a lado
  POST /api/v1/lotes/{id}/leituras     tempo real: uma leitura do sensor → novo estado
  POST /api/v1/lotes/{id}/reset        reinicia o lote (apaga a série gravada)
  GET  /api/v1/lotes                   lotes gravados
  GET  /api/v1/lotes/{id}              estado atual do lote
  GET  /api/v1/lotes/{id}/serie        série gravada (JSON)
  GET  /api/v1/lotes/{id}/csv          série gravada (CSV, para o TCC)
  GET  /api/v1/stream                  eventos em tempo real (Server-Sent Events)

Sem serviços externos: os dados ficam num arquivo SQLite (variável ACAI_DB).
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import threading
from dataclasses import replace
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field

from acai_twin.armazenamento import Armazenamento
from acai_twin.parametros import ParametrosModelo
from acai_twin.processo import Lote, simular_processo

app = FastAPI(
    title="AçaíThermal Twin Engine",
    description="Condução transiente em esfera composta (caroço + polpa) com contorno "
    "convectivo e cinética integrada de antocianinas e POD — TCC IFPA.",
    version="5.1",
)

_origens = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origens],
    allow_methods=["*"],
    allow_headers=["*"],
)

banco = Armazenamento()

# ---------------------------------------------------------------- tempo real (SSE)
_assinantes: set[asyncio.Queue] = set()


def _publicar(evento: dict) -> None:
    for fila in list(_assinantes):
        with contextlib.suppress(asyncio.QueueFull):  # cliente lento: descarta o evento para ele
            fila.put_nowait(evento)


@app.get("/api/v1/stream")
async def stream(request: Request):
    fila: asyncio.Queue = asyncio.Queue(maxsize=500)
    _assinantes.add(fila)

    async def eventos():
        try:
            yield "retry: 3000\n\n"
            while not await request.is_disconnected():
                try:
                    evento = await asyncio.wait_for(fila.get(), timeout=15)
                    yield f"data: {json.dumps(evento, ensure_ascii=False)}\n\n"
                except TimeoutError:
                    yield ": ping\n\n"  # mantém a conexão viva em proxies
        finally:
            _assinantes.discard(fila)

    return StreamingResponse(
        eventos(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------- estado dos lotes
_lotes: dict[str, Lote] = {}
_trava = threading.Lock()


def _params(diametro_mm: float) -> ParametrosModelo:
    base = ParametrosModelo()
    return replace(base, geometria=replace(base.geometria, raio_m=diametro_mm / 2000.0))


# ---------------------------------------------------------------- esquemas
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
        "persistencia": "sqlite",
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
async def registrar_leitura(lote_id: str, leitura: Leitura):
    with _trava:
        lote = _lotes.get(lote_id)
        if lote is None:
            lote = _lotes[lote_id] = Lote(lote_id=lote_id, temp_inicial_c=leitura.temp_inicial_c)
        lote.passo(leitura.temp_banho_c, leitura.dt_s, imerso=leitura.imerso)
        registro = lote.registro()
        previsao = lote.prever_tempo_corte(leitura.temp_banho_c) if leitura.imerso else None
        atingido = lote.criterio_atingido
    registro["previsao_corte_s"] = None if previsao is None else round(previsao, 1)
    registro["acao_recomendada"] = (
        "RETIRAR_DO_BANHO"
        if atingido and leitura.imerso
        else "AUMENTAR_TEMPERATURA_DO_BANHO"
        if leitura.imerso and previsao is None
        else "MANTER"
    )
    banco.salvar(registro)
    _publicar(registro)
    return registro


@app.post("/api/v1/lotes/{lote_id}/reset")
def resetar_lote(lote_id: str, pedido: PedidoReset):
    with _trava:
        _lotes[lote_id] = Lote(lote_id=lote_id, temp_inicial_c=pedido.temp_inicial_c)
        registro = _lotes[lote_id].registro()
    banco.apagar_lote(lote_id)
    return registro


@app.get("/api/v1/lotes")
def listar_lotes(limite: int = 50):
    return banco.lotes(limite)


@app.get("/api/v1/lotes/{lote_id}")
def estado_lote(lote_id: str):
    with _trava:
        if lote_id in _lotes:
            return _lotes[lote_id].registro()
    serie = banco.serie(lote_id)
    if not serie:
        raise HTTPException(404, f"Lote '{lote_id}' não encontrado.")
    return serie[-1]


@app.get("/api/v1/lotes/{lote_id}/serie")
def serie_lote(lote_id: str):
    return banco.serie(lote_id)


@app.get("/api/v1/lotes/{lote_id}/csv", response_class=PlainTextResponse)
def csv_lote(lote_id: str):
    return PlainTextResponse(
        banco.csv(lote_id),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{lote_id}.csv"'},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
