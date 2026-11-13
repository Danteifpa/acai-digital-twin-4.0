# Instalação e publicação

## Requisitos

- Python 3.11 ou superior
- Node.js 22 ou superior
- (opcional) Docker, para subir tudo com um comando

## Rodar localmente

### Opção A: Make

```bash
make instalar     # dependências do motor e do painel
make motor        # terminal 1 → http://127.0.0.1:8000/docs
make painel       # terminal 2 → http://localhost:5173
make sensor       # terminal 3 (opcional) → leituras em tempo real
```

`make help` lista todos os atalhos (testes, lint, figuras, calibração).

### Opção B: comandos diretos (Windows, macOS, Linux)

```bash
# Motor
cd engine
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements-dev.txt
uvicorn main:app --reload

# Painel (outro terminal)
cd frontend
copy .env.example .env.local    # Windows  (cp no macOS/Linux)
npm install
npm run dev

# Sensor virtual (outro terminal, opcional)
python simulator/mock_sensor.py --banho 88
```

### Opção C: Docker Compose

```bash
docker compose up --build
```

O motor fica em `http://localhost:8000` e o painel em `http://localhost:5173`. Os lotes ficam num volume Docker (`dados-motor`) e sobrevivem a reinícios.

## Variáveis de ambiente

| Onde | Variável | Padrão | Para quê |
|---|---|---|---|
| motor | `ACAI_DB` | `engine/dados/acai_twin.db` | arquivo SQLite dos lotes |
| motor | `CORS_ORIGINS` | `*` | origens autorizadas a chamar a API |
| motor | `PORT` | `8000` | porta (o Render define sozinho) |
| painel | `VITE_ENGINE_URL` | `http://127.0.0.1:8000` | endereço do motor |
| sensor | `ENGINE_URL` | `http://127.0.0.1:8000` | endereço do motor |

## Publicar

### Motor no Render

1. No Render: **New → Blueprint** e escolha este repositório. O arquivo `render.yaml` configura tudo.
2. Anote o endereço gerado, por exemplo `https://acai-twin-engine.onrender.com`.
3. (Recomendado) Depois de publicar o painel, troque `CORS_ORIGINS` para `https://danteifpa.github.io`.

> No plano gratuito o serviço hiberna sem uso: a primeira chamada leva cerca de 1 minuto. O disco também é apagado a cada deploy. Exporte em CSV os lotes que for usar no TCC.

### Painel no GitHub Pages

1. **Settings → Pages → Source:** `GitHub Actions`.
2. **Settings → Secrets and variables → Actions → Variables → New repository variable:** `ENGINE_URL` = endereço do motor.
3. Faça um envio (push) para a `main`, ou rode o workflow *Painel no GitHub Pages* manualmente em **Actions**.

O painel fica em `https://danteifpa.github.io/acai-digital-twin-4.0/`.

## Integração contínua

O workflow `.github/workflows/ci.yml` roda em todo pull request e em todo envio para a `main`:

- **motor:** `ruff check`, `ruff format --check` e `pytest`;
- **painel:** `npm ci`, `npm run lint` e `npm run build`.

O selo **CI** no README mostra o estado atual.
