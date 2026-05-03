import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Con esto puedes escribir: import algo from '@/components/Button'
      // en lugar de: import algo from '../../components/Button'
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Proxy: las peticiones a /api se redirigen al backend en 3001
    // Así el frontend no sabe nada de la URL del backend
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
