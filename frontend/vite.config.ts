import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Support VITE_* environment variables defined in either frontend/.env or root .env
  const rootEnv = loadEnv(mode, path.resolve(import.meta.dirname, '..'), '')
  const localEnv = loadEnv(mode, import.meta.dirname, '')
  const cartoApiKey = localEnv.VITE_CARTO_API_KEY || rootEnv.VITE_CARTO_API_KEY || ''

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    define: {
      'import.meta.env.VITE_CARTO_API_KEY': JSON.stringify(cartoApiKey),
    },
  }
})
