# API do motor

Base: `http://127.0.0.1:8000` (local) ou o endereço publicado no Render. A documentação interativa (Swagger) fica em **`/docs`**.

| Método | Rota | Para quê |
|---|---|---|
| GET | `/` | saúde do serviço |
| GET | `/api/v1/parametros` | parâmetros do modelo e grandezas derivadas (α, Bi, espessura da polpa) |
| POST | `/api/v1/simular` | ciclo completo em um modo |
| POST | `/api/v1/comparar` | os três modos lado a lado |
| POST | `/api/v1/lotes/{id}/leituras` | tempo real: uma leitura do sensor |
| POST | `/api/v1/lotes/{id}/reset` | reinicia o lote e apaga a série gravada |
| GET | `/api/v1/lotes` | lotes gravados (mais recentes primeiro) |
| GET | `/api/v1/lotes/{id}` | estado atual do lote |
| GET | `/api/v1/lotes/{id}/serie` | série gravada (JSON) |
| GET | `/api/v1/lotes/{id}/csv` | série gravada (CSV) |
| GET | `/api/v1/stream` | eventos em tempo real (Server-Sent Events) |

## Simulação

```http
POST /api/v1/simular
Content-Type: application/json

{
  "diametro_mm": 14,
  "temp_banho_c": 88,
  "temp_inicial_c": 25,
  "modo": "preditivo",
  "tempo_imersao_fixo_s": 10,
  "tempo_resfriamento_s": 60,
  "intervalo_saida_s": 1
}
```

`modo` aceita três valores:

- `preditivo`: corta quando o critério sanitário é cumprido;
- `fixo`: imersão por `tempo_imersao_fixo_s`;
- `centro_70`: critério da versão anterior do projeto, mantido só para comparação.

A resposta traz `resumo` (conformidade, tempo de corte, energia, POD, antocianinas), `serie` (um ponto por `intervalo_saida_s`, com o perfil radial) e a malha (`raio_nos_mm`, `raio_caroco_mm`).

`/api/v1/comparar` recebe os mesmos campos, exceto `modo`, e devolve `{preditivo, fixo, centro_70}`.

## Tempo real

```http
POST /api/v1/lotes/LOTE-001/leituras
Content-Type: application/json

{ "temp_banho_c": 88.2, "dt_s": 1.0, "imerso": true }
```

Resposta (resumida):

```json
{
  "lote_id": "LOTE-001",
  "tempo_decorrido_s": 12.0,
  "temp_superficie_c": 86.1,
  "temp_centro_c": 25.1,
  "tempo_letal_superficie_s": 10.8,
  "taxa_inativacao_pct": 12.8,
  "retencao_antocianinas_pct": 99.97,
  "energia_absorvida_kj_kg": 77.7,
  "previsao_corte_s": 0.0,
  "acao_recomendada": "RETIRAR_DO_BANHO",
  "status_processo": "CONFORMIDADE_ATINGIDA",
  "perfil_radial_c": [25.1, "…", 86.1]
}
```

| `status_processo` | Significado |
|---|---|
| `AGUARDANDO` | lote criado, sem leituras |
| `EM_AQUECIMENTO` | imerso, critério ainda não cumprido |
| `BANHO_INSUFICIENTE` | banho abaixo de ~80,5 °C: a superfície não chega a 80 °C |
| `CONFORMIDADE_ATINGIDA` | critério cumprido, ainda imerso |
| `RESFRIAMENTO` | fora do banho, critério cumprido |
| `NAO_CONFORME` | fora do banho sem cumprir o critério |

## Stream (SSE)

```js
const fonte = new EventSource('http://127.0.0.1:8000/api/v1/stream');
fonte.onmessage = (ev) => console.log(JSON.parse(ev.data));
```

Cada leitura registrada gera um evento com o mesmo JSON da resposta acima. O servidor envia `: ping` a cada 15 s para manter a conexão aberta.

## Exemplo com ESP32 (TCC 2)

O hardware só precisa fazer um `POST` por segundo com a temperatura do banho e obedecer a `acao_recomendada`. O script [`simulator/mock_sensor.py`](../simulator/mock_sensor.py) é a referência desse comportamento.
