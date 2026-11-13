# Changelog

Mudanças relevantes do projeto. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e [versionamento semântico](https://semver.org/lang/pt-BR/).

## [5.1.0] — 2026-11-13

### Adicionado
- Persistência local em SQLite e exportação de lotes em CSV.
- Stream em tempo real por Server-Sent Events (`/api/v1/stream`).
- Integração contínua (ruff, pytest, ESLint, build) e publicação do painel no GitHub Pages.
- `render.yaml`, `docker-compose.yml`, `Makefile` e `.editorconfig`.
- Documentação técnica em `docs/` com figuras de verificação geradas por script.
- Solução analítica de referência (`acai_twin/analitico.py`) e teste de convergência de malha.
- `CITATION.cff`, guia de contribuição e modelos de issue e pull request.

### Alterado
- O gerador de PDF é carregado só quando o laudo é pedido, o que reduz o carregamento inicial do painel.
- Teste de conservação de energia passou a comparar o calor que entra pela superfície com a variação de energia interna.

### Removido
- Dependência do Supabase (banco, chaves e `supabase-js`).

## [5.0.0] — 2026-11-13

### Alterado
- Motor reescrito: esfera composta (caroço + polpa) em volumes finitos, com contorno convectivo calibrado contra dados da Embrapa.
- Cinética integrada nó a nó: antocianinas (Arrhenius, Anjos et al., 2020) e POD bifásica (D–z, Costa, 2019).
- Critério sanitário movido para a superfície do fruto (≥ 80 °C por ≥ 10 s), com corte preditivo.
- Painel passou a consumir o motor (sem simulação própria), e o laudo em PDF reflete o resultado real.

### Corrigido
- Simulador chamava uma rota inexistente.
- Gravação no banco falhava por falta de `lote_id`.

## [4.0.0]

Versão apresentada no TCC 1: diferenças finitas com superfície igual ao banho e critério no centro (≥ 70 °C).
