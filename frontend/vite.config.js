import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import process from 'node:process'

// VITE_BASE é definido no workflow do GitHub Pages (/nome-do-repositorio/).
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rolldownOptions: {
      output: {
        // bibliotecas grandes em arquivos separados: melhor cache no navegador
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'graficos', test: /node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|es-toolkit|immer|@reduxjs|react-redux|reselect|redux)[\\/]/ },
            { name: 'icones', test: /node_modules[\\/]lucide-react[\\/]/ },
          ],
        },
      },
    },
  },
})
