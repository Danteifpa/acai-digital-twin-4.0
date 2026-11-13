from fastapi.testclient import TestClient

from main import app

cli = TestClient(app)


def test_saude():
    assert cli.get("/").json()["status"] == "online"


def test_simular_e_comparar():
    r = cli.post("/api/v1/simular", json={"temp_banho_c": 88}).json()
    assert r["resumo"]["conforme"] is True and len(r["serie"]) > 10
    c = cli.post("/api/v1/comparar", json={"temp_banho_c": 88}).json()
    assert set(c) == {"preditivo", "fixo", "centro_70"}


def test_fluxo_tempo_real():
    cli.post("/api/v1/lotes/L1/reset", json={"temp_inicial_c": 25})
    ultimo = None
    for _ in range(15):
        ultimo = cli.post("/api/v1/lotes/L1/leituras", json={"temp_banho_c": 90}).json()
    assert ultimo["status_processo"] == "CONFORMIDADE_ATINGIDA"
    assert ultimo["acao_recomendada"] == "RETIRAR_DO_BANHO"
    assert cli.get("/api/v1/lotes/L1").json()["tempo_decorrido_s"] == 15


def test_validacao_de_entrada():
    assert cli.post("/api/v1/simular", json={"temp_banho_c": 300}).status_code == 422
