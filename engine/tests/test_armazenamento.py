from acai_twin.armazenamento import Armazenamento
from acai_twin.processo import Lote


def test_grava_e_le_serie(tmp_path):
    banco = Armazenamento(tmp_path / "t.db")
    lote = Lote("X")
    for _ in range(3):
        lote.passo(90, 1.0)
        banco.salvar(lote.registro())
    s = banco.serie("X")
    assert [r["tempo_decorrido_s"] for r in s] == [1.0, 2.0, 3.0]
    assert isinstance(s[0]["perfil_radial_c"], list) and s[0]["imerso"] is True
    # reabre o arquivo: os dados persistem
    assert len(Armazenamento(tmp_path / "t.db").serie("X")) == 3
