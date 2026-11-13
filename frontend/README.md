# AçaíThermal Twin — painel

Painel React (Vite + Tailwind + Recharts) do gêmeo digital.

```bash
cp .env.example .env.local   # VITE_ENGINE_URL e, opcionalmente, Supabase
npm install
npm run dev                  # http://localhost:5173
npm run lint && npm run build
```

* **Simulação**: chama `POST /api/v1/comparar` no motor e reproduz a série calculada.
* **Tempo real**: assina a tabela `estado_digital_twin` no Supabase (precisa das variáveis `VITE_SUPABASE_*`).

Estrutura: `DashboardDigitalTwin.jsx` (estado e layout), `abas/` (cada aba), `laudo.js` (PDF a partir do resultado real), `api.js`, `config.js`, `componentes.jsx`, `util.js`.
