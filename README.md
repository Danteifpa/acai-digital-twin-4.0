<div align="center">

# AçaíThermal Twin

**Gêmeo digital do branqueamento de frutos de açaí (*Euterpe oleracea*)**

Estima em tempo real a temperatura da superfície do fruto e indica o instante exato em que o critério sanitário contra o *Trypanosoma cruzi* é cumprido.

[![CI](https://github.com/Danteifpa/acai-digital-twin-4.0/actions/workflows/ci.yml/badge.svg)](https://github.com/Danteifpa/acai-digital-twin-4.0/actions/workflows/ci.yml)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-3776AB?logo=python&logoColor=white)](engine/)
[![React 19](https://img.shields.io/badge/react-19-61DAFB?logo=react&logoColor=black)](frontend/)
[![Citar](https://img.shields.io/badge/citar-CITATION.cff-8A2BE2)](CITATION.cff)

*Trabalho de Conclusão de Curso — Bacharelado em Ciência e Tecnologia — IFPA Campus Ananindeua*

![Supervisório do gêmeo digital](docs/assets/dashboard.png)

</div>

---

## Sumário

- [O problema](#o-problema)
- [O que o sistema faz](#o-que-o-sistema-faz)
- [Principais resultados](#principais-resultados)
- [Início rápido](#início-rápido)
- [Arquitetura](#arquitetura)
- [Documentação](#documentação)
- [Limitações](#limitações)
- [Como citar](#como-citar)
- [Referências](#referências)

## O problema

O branqueamento dos frutos (água a **80 °C por 10 s**, obrigatório no Pará desde 2012 e no Amapá desde 2015) é a barreira contra a transmissão oral da Doença de Chagas pelo açaí. O *T. cruzi* chega ao fruto em fezes ou fragmentos de barbeiro **aderidos à casca**, então o que importa é a temperatura efetiva da **superfície do fruto**, não a da água.

Medições da Embrapa mostram que, com a água a ~80 °C, a superfície fica entre 77,8 e 78,8 °C nos primeiros 10 s. Ou seja, o binômio nominal sozinho não garante a condição no fruto.

## O que o sistema faz

- **Modelo físico:** condução transiente numa esfera composta (caroço + polpa), em volumes finitos, com troca de calor convectiva calibrada contra dados experimentais.
- **Cinética:** degradação de antocianinas (Arrhenius) e inativação da peroxidase (bifásica, D–z), integradas no tempo em cada ponto da polpa.
- **Corte preditivo:** a cada leitura do sensor do banho, prevê quando a superfície terá ficado 10 s acima de 80 °C e avisa quando retirar os frutos.
- **Painel:** supervisório em tempo real, comparação de estratégias, análise de sensibilidade e laudo em PDF com o resultado real do lote.

## Principais resultados

Fruto de 14 mm, banho a 88 °C:

| Estratégia | Imersão | Calor absorvido | Critério sanitário |
|---|---:|---:|:---:|
| **Preditiva (gêmeo digital)** | **11,5 s** | **77,7 kJ/kg** | ✅ |
| Tempo fixo de 10 s | 10,0 s | 73,8 kJ/kg | ❌ |
| Centro ≥ 70 °C (versão anterior) | 83,0 s | 138,8 kJ/kg | ✅ |

1. **44 % menos calor** absorvido que esperar o centro do fruto chegar a 70 °C.
2. O tempo de corte **quase não depende do tamanho do fruto** (11–11,5 s de 10 a 20 mm). O critério no centro vai de 43 s a 168 s.
3. **Água a 80 °C não cumpre o critério**: a superfície só tende assintoticamente a 80 °C.
4. Em segundos de branqueamento, a perda de antocianinas é inferior a 0,1 %.

O solver reproduz a solução analítica com erro < 0,005 °C, converge com ordem 2 e conserva energia. Detalhes e figuras em [docs/validacao.md](docs/validacao.md).

![Comparativo de estratégias](docs/figuras/comparativo_estrategias.png)

## Início rápido

```bash
git clone https://github.com/Danteifpa/acai-digital-twin-4.0.git
cd acai-digital-twin-4.0

make instalar   # dependências do motor e do painel
make motor      # terminal 1 → http://127.0.0.1:8000/docs
make painel     # terminal 2 → http://localhost:5173
make sensor     # terminal 3 (opcional) → leituras em tempo real
```

Sem `make` (Windows), ou com Docker (`docker compose up --build`): veja [docs/implantacao.md](docs/implantacao.md).

## Arquitetura

```
Sensor do banho (ESP32 · simulator/mock_sensor.py)
      │  POST /api/v1/lotes/{id}/leituras        (1 leitura/s)
      ▼
Motor numérico — engine/  (FastAPI + NumPy · Render ou local)
      ├─ T(r,t) e cinética do lote
      ├─ previsão de corte → MANTER | RETIRAR_DO_BANHO
      ├─ SQLite (exportação CSV)
      └─ Server-Sent Events → /api/v1/stream
      ▼
Painel — frontend/  (React + Recharts · GitHub Pages)
```

```
engine/
├── acai_twin/        modelo: parametros, termico, cinetica, processo, armazenamento, analitico
├── tests/            verificação analítica, conservação, cinética, API
├── scripts/          calibração de h e geração de figuras
└── main.py           API REST + SSE
frontend/src/         painel (abas em abas/, laudo PDF em laudo.js)
simulator/            sensor virtual
docs/                 modelo, validação, API, implantação e figuras
```

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/modelo.md](docs/modelo.md) | equações, discretização, cinética, critério sanitário, hipóteses |
| [docs/validacao.md](docs/validacao.md) | verificação analítica, convergência, calibração, resultados |
| [docs/api.md](docs/api.md) | rotas, exemplos de requisição e stream em tempo real |
| [docs/implantacao.md](docs/implantacao.md) | instalação local, Docker, Render e GitHub Pages |
| [CONTRIBUTING.md](CONTRIBUTING.md) | fluxo de contribuição e padrões |
| [CHANGELOG.md](CHANGELOG.md) | histórico de versões |

## Limitações

- As propriedades térmicas do **caroço** são estimativas, por falta de medição publicada para o açaí.
- A **fração lábil da POD** (0,80) foi assumida.
- O modelo considera o fruto isolado e esférico, num banho de temperatura uniforme.
- O critério de 80 °C/10 s é regulatório: não há modelo cinético do *T. cruzi*.

A tabela completa de hipóteses, com o caminho para resolver cada uma, está em [docs/modelo.md](docs/modelo.md#8-hipóteses-e-limitações).

## Como citar

Use o botão **"Cite this repository"** do GitHub (gerado a partir de [CITATION.cff](CITATION.cff)) ou:

> Monteiro, D. D. (2026). *AçaíThermal Twin: gêmeo digital do branqueamento de frutos de açaí* (versão 5.1.0) [Software]. IFPA Campus Ananindeua. https://github.com/Danteifpa/acai-digital-twin-4.0

## Referências

- Anjos, C. A. R. et al. (2020). Thermal degradation kinetics of total anthocyanins in açaí pulp and transient processing simulations. *SN Applied Sciences*, 2, 523. https://doi.org/10.1007/s42452-020-2340-0
- Costa, H. C. B. (2019). *Avaliação da pasteurização contínua da polpa de açaí sobre a inativação térmica das enzimas peroxidase e polifenoloxidase*. Dissertação, Universidade Federal de Uberlândia.
- Bezerra, V. S. et al. Temperatura efetiva na superfície de frutos de açaí no branqueamento. Embrapa (Alice, doc. 1070158).
- Bezerra, V. S. (2017). *Tratamento térmico do açaí*. Embrapa Amapá, Comunicado Técnico 151.
- Ferreira, E. A. P. et al. (2016). O branqueamento do açaí em batedeiras artesanais para controle do *Trypanosoma cruzi*. Embrapa.
- Caracterização termofísica da polpa de açaí. Universidade Federal de Campina Grande (BDTD riufcg/2218).

## Licença

[MIT](LICENSE) © 2026 Dante Dias Monteiro
