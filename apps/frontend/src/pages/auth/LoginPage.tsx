/**
 * LoginPage.tsx — Página de inicio de sesión
 *
 * Usa React Hook Form para manejar el formulario y
 * Zod para validar los datos ANTES de enviar al servidor.
 *
 * Flujo:
 *  1. Usuario llena email y contraseña
 *  2. Zod valida el formato (email válido, contraseña >= 8 chars)
 *  3. Si pasa validación → llama al authService.login()
 *  4. Si login exitoso → guarda token en Zustand → redirige al dashboard
 *  5. Si falla → muestra el error del servidor
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';

// ─── Esquema de validación con Zod ────────────────────────
// Zod define las reglas. Si no se cumplen, muestra el mensaje de error.
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es obligatorio')
    .email('Ingresa un email válido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

// TypeScript infiere el tipo desde el esquema Zod automáticamente
type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // React Hook Form: maneja el estado del formulario
  const {
    register,       // conecta los inputs al formulario
    handleSubmit,   // envuelve el submit con validación
    formState: { errors, isSubmitting }, // errores y estado de carga
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema), // conecta Zod con React Hook Form
  });

  // ─── Submit ───────────────────────────────────────────────
  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    try {
      const response = await authService.login(data);
      // Guardar en Zustand (y localStorage automáticamente)
      setAuth(response.user, response.accessToken);
      navigate('/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(
        error.response?.data?.message ?? 'Error al iniciar sesión. Intenta de nuevo.',
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      {/* Glow de fondo decorativo */}
      <div
        className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255,107,43,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Logo / Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-lg bg-[#FF6B2B] flex items-center justify-center">
              <span className="text-white font-black text-lg">N</span>
            </div>
            <span className="text-2xl font-black text-white tracking-tight">
              Nodo<span className="text-[#FF6B2B]">Sys</span>
            </span>
          </div>
          <h1 className="text-xl font-semibold text-white mb-1">
            Bienvenido de nuevo
          </h1>
          <p className="text-sm text-[#888]">
            Sistema de Gestión · IU Digital
          </p>
        </div>

        {/* Card del formulario */}
        <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

            {/* Error del servidor */}
            {serverError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                <p className="text-red-400 text-sm">{serverError}</p>
              </div>
            )}

            {/* Campo Email */}
            <div>
              <label className="block text-xs font-medium text-[#888] uppercase tracking-wider mb-2">
                Correo institucional
              </label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="tu.nombre@iudigital.edu.co"
                className={`
                  w-full bg-[#1A1A1A] border rounded-lg px-4 py-3 text-sm text-white
                  placeholder:text-[#555] outline-none transition-colors
                  focus:border-[#FF6B2B]
                  ${errors.email ? 'border-red-500' : 'border-[#2A2A2A]'}
                `}
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>
              )}
            </div>

            {/* Campo Contraseña */}
            <div>
              <label className="block text-xs font-medium text-[#888] uppercase tracking-wider mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`
                    w-full bg-[#1A1A1A] border rounded-lg px-4 py-3 pr-12 text-sm text-white
                    placeholder:text-[#555] outline-none transition-colors
                    focus:border-[#FF6B2B]
                    ${errors.password ? 'border-red-500' : 'border-[#2A2A2A]'}
                  `}
                />
                {/* Botón mostrar/ocultar contraseña */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#888] transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>
              )}
            </div>

            {/* Botón Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="
                w-full bg-[#FF6B2B] hover:bg-[#e55c20] disabled:bg-[#FF6B2B]/50
                text-white font-semibold py-3 rounded-lg text-sm
                transition-all duration-200
                flex items-center justify-center gap-2
                mt-2
              "
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#555] mt-6 font-mono">
          NODOSYS · NODO ARBOLETES · IU DIGITAL
        </p>
      </div>
    </div>
  );
}
