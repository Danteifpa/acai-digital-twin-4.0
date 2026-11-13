# Atalhos de desenvolvimento.  Uso: make <alvo>
.PHONY: help instalar motor painel sensor testes lint figuras calibrar docker limpar

help:            ## lista os comandos
	@grep -E '^[a-z]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-10s %s\n", $$1, $$2}'

instalar:        ## instala dependências do motor e do painel
	cd engine && pip install -r requirements-dev.txt
	cd frontend && npm ci

motor:           ## sobe o motor em http://127.0.0.1:8000 (docs em /docs)
	cd engine && uvicorn main:app --reload

painel:          ## sobe o painel em http://localhost:5173
	cd frontend && npm run dev

sensor:          ## envia leituras do sensor virtual ao motor local
	python simulator/mock_sensor.py --banho 88

testes:          ## roda os testes do motor
	cd engine && pytest

lint:            ## verifica estilo do motor e do painel
	cd engine && ruff check . && ruff format --check .
	cd frontend && npm run lint

figuras:         ## regenera as figuras de validação em docs/figuras
	cd engine && python -m scripts.gerar_figuras

calibrar:        ## recalibra o coeficiente convectivo h
	cd engine && python -m scripts.calibrar_h

docker:          ## sobe motor + painel com Docker Compose
	docker compose up --build

limpar:          ## remove artefatos de build e cache
	rm -rf frontend/dist engine/.pytest_cache engine/.ruff_cache
	find engine -name __pycache__ -type d -prune -exec rm -rf {} +
