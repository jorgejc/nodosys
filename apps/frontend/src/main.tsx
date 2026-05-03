/**
 * main.tsx — Punto de entrada de React
 *
 * Aquí montamos la aplicación en el DOM.
 * Configuramos:
 * - QueryClientProvider: para TanStack Query (manejo de estado del servidor)
 * - BrowserRouter: para la navegación entre páginas
 * - ReactQueryDevtools: herramienta de depuración (solo en desarrollo)
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App'
import './index.css'

// QueryClient: gestiona el caché de las peticiones al backend
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // Los datos se consideran frescos por 5 minutos
      retry: 1,                   // Reintentar 1 vez si falla la petición
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      {/* Devtools: solo visible en desarrollo, te muestra el estado de las queries */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>,
)
