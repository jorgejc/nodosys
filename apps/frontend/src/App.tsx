/**
 * App.tsx — Configuración de rutas de la aplicación
 *
 * Cada "Route" es una página diferente.
 * El sistema de rutas irá creciendo a medida que construyamos los módulos.
 */
import { Routes, Route, Navigate } from 'react-router-dom'

// Por ahora una página temporal de "estamos construyendo"
function ComingSoon({ name }: { name: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', fontFamily: 'monospace',
      background: '#0A0A0A', color: '#F0EDE8'
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>NodoSys</h1>
      <p style={{ color: '#888' }}>Módulo en construcción: <strong style={{ color: '#FF6B2B' }}>{name}</strong></p>
      <p style={{ color: '#555', fontSize: 12, marginTop: 24 }}>Backend corriendo → http://localhost:3001/api</p>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Ruta raíz: redirige al dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Rutas que iremos construyendo módulo a módulo */}
      <Route path="/login"     element={<ComingSoon name="Login" />} />
      <Route path="/dashboard" element={<ComingSoon name="Dashboard" />} />
      <Route path="/inventario/*" element={<ComingSoon name="Inventario" />} />
      <Route path="/plan-trabajo/*" element={<ComingSoon name="Plan de Trabajo" />} />
      <Route path="/reportes/*" element={<ComingSoon name="Reportes" />} />
      <Route path="/usuarios/*" element={<ComingSoon name="Usuarios" />} />

      {/* 404 */}
      <Route path="*" element={<ComingSoon name="404 - Página no encontrada" />} />
    </Routes>
  )
}
