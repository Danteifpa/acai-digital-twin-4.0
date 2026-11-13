"""
Persistência local em SQLite (biblioteca padrão do Python — sem serviço externo).

O arquivo fica em $ACAI_DB (padrão: engine/dados/acai_twin.db). Em hospedagens
com disco efêmero (ex.: Render gratuito) os dados somem a cada novo deploy:
use a exportação CSV (/api/v1/lotes/{id}/csv) para guardar os ensaios do TCC.
"""
from __future__ import annotations

import csv
import io
import json
import os
import sqlite3
import threading
from pathlib import Path

COLUNAS = [
    "lote_id", "tempo_decorrido_s", "temp_banho_c", "temp_superficie_c", "temp_centro_c",
    "tempo_letal_superficie_s", "taxa_inativacao_pct", "retencao_antocianinas_pct",
    "energia_absorvida_kj_kg", "imerso", "previsao_corte_s", "acao_recomendada", "status_processo",
]

_ESQUEMA = """
create table if not exists estados (
    id integer primary key autoincrement,
    lote_id text not null,
    tempo_decorrido_s real not null,
    temp_banho_c real,
    temp_superficie_c real not null,
    temp_centro_c real not null,
    tempo_letal_superficie_s real not null,
    taxa_inativacao_pct real not null,
    retencao_antocianinas_pct real not null,
    energia_absorvida_kj_kg real,
    imerso integer,
    previsao_corte_s real,
    acao_recomendada text,
    status_processo text not null,
    perfil_radial_c text,
    registrado_em text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index if not exists idx_estados_lote on estados (lote_id, tempo_decorrido_s);
"""


class Armazenamento:
    def __init__(self, caminho: str | os.PathLike | None = None):
        caminho = caminho or os.getenv("ACAI_DB") or Path(__file__).resolve().parents[1] / "dados" / "acai_twin.db"
        if str(caminho) != ":memory:":
            Path(caminho).parent.mkdir(parents=True, exist_ok=True)
        self._con = sqlite3.connect(str(caminho), check_same_thread=False)
        self._con.row_factory = sqlite3.Row
        self._trava = threading.Lock()
        with self._trava:
            self._con.executescript(_ESQUEMA)

    def salvar(self, registro: dict) -> None:
        valores = [registro.get(c) for c in COLUNAS] + [json.dumps(registro.get("perfil_radial_c"))]
        with self._trava, self._con:
            self._con.execute(
                f"insert into estados ({', '.join(COLUNAS)}, perfil_radial_c) "
                f"values ({', '.join('?' * (len(COLUNAS) + 1))})",
                valores,
            )

    def apagar_lote(self, lote_id: str) -> None:
        with self._trava, self._con:
            self._con.execute("delete from estados where lote_id = ?", (lote_id,))

    def lotes(self, limite: int = 50) -> list[dict]:
        with self._trava:
            linhas = self._con.execute(
                """select lote_id, count(*) as pontos, max(tempo_decorrido_s) as duracao_s,
                          max(tempo_letal_superficie_s) as tempo_letal_superficie_s,
                          min(registrado_em) as inicio, max(registrado_em) as fim
                   from estados group by lote_id order by max(id) desc limit ?""",
                (limite,),
            ).fetchall()
        return [dict(l) for l in linhas]

    def serie(self, lote_id: str) -> list[dict]:
        with self._trava:
            linhas = self._con.execute(
                "select * from estados where lote_id = ? order by id", (lote_id,)
            ).fetchall()
        saida = []
        for l in linhas:
            d = dict(l)
            d["perfil_radial_c"] = json.loads(d["perfil_radial_c"]) if d["perfil_radial_c"] else None
            d["imerso"] = None if d["imerso"] is None else bool(d["imerso"])
            saida.append(d)
        return saida

    def csv(self, lote_id: str) -> str:
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(COLUNAS + ["registrado_em"])
        for d in self.serie(lote_id):
            w.writerow([d.get(c) for c in COLUNAS] + [d["registrado_em"]])
        return buf.getvalue()
