# Como contribuir

Obrigado pelo interesse! Este é um projeto de TCC, mas sugestões e correções são bem-vindas.

## Fluxo

1. Abra uma *issue* descrevendo o problema ou a proposta.
2. Crie um branch a partir da `main` (`git checkout -b minha-melhoria`).
3. Faça as mudanças e rode as verificações locais:
   ```bash
   make lint
   make testes
   cd frontend && npm run build
   ```
4. Abra um *pull request*. A integração contínua precisa passar.

## Padrões

- **Python:** formatação e lint com `ruff` (configuração em `engine/pyproject.toml`).
- **JavaScript:** ESLint (`frontend/eslint.config.js`).
- **Commits:** mensagens no imperativo, com prefixo quando fizer sentido (`feat:`, `fix:`, `docs:`, `test:`).
- **Parâmetros físicos:** todo valor novo em `engine/acai_twin/parametros.py` precisa de fonte. Se for estimativa, marque com `[HIPÓTESE]`.
- **Figuras:** se mudar o modelo, rode `make figuras` e atualize `docs/validacao.md`.

## Mudanças no modelo

Toda mudança no solver ou na cinética precisa manter os testes de verificação (`engine/tests/test_termico.py`) passando. Se a mudança alterar resultados, explique no pull request por que o novo resultado é melhor.
