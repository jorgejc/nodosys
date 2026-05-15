/**
 * UsersPage.tsx — Gestión de usuarios del sistema
 *
 * Quién puede ver esto:
 *  - admin: ve y gestiona TODOS los usuarios
 *  - enlace: puede crear monitoras y auxiliares de su nodo
 *  - decano/vicerrector: solo lectura (ver quién hay)
 *
 * Funcionalidades:
 *  - Listar usuarios con filtros por rol, facultad, programa
 *  - Crear nuevo usuario con rol asignado
 *  - Editar datos y rol
 *  - Activar/desactivar acceso
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Users, Plus, Search, X, Save, Loader2,
  Shield, Eye, EyeOff, CheckCircle2, XCircle,
  Pencil, Filter,
} from 'lucide-react';
import { usersService } from '@/services/users.service';
import { useAuth } from '@/hooks/useAuth';
import type { User, UserRole } from '@/types';

// ── Configuración de roles ────────────────────────────────
const ROLE_CONFIG: Record<UserRole, { label: string; color: string; description: string }> = {
  admin:                  { label: 'Administrador',      color: 'text-red-400 bg-red-400/10 border-red-400/30',       description: 'Acceso total al sistema' },
  vicerrector_extension:  { label: 'Vicerrector',        color: 'text-purple-400 bg-purple-400/10 border-purple-400/30', description: 'Ve todos los planes y nodos' },
  decano:                 { label: 'Decano',             color: 'text-blue-400 bg-blue-400/10 border-blue-400/30',    description: 'Ve planes de su facultad' },
  coordinador:            { label: 'Coordinador',        color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',    description: 'Ve planes de su programa' },
  enlace:                 { label: 'Enlace de Nodo',     color: 'text-[#FF6B2B] bg-[#FF6B2B]/10 border-[#FF6B2B]/30', description: 'Gestiona su nodo completo' },
  docente:                { label: 'Docente Ocasional',  color: 'text-green-400 bg-green-400/10 border-green-400/30', description: 'Ve su propio plan de trabajo' },
  monitor:                { label: 'Monitor',            color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', description: 'Puede agregar inventario' },
  auxiliar:               { label: 'Auxiliar',           color: 'text-[#888] bg-[#1A1A1A] border-[#333]',           description: 'Puede agregar inventario' },
};

// Roles que puede asignar cada rol
const ASSIGNABLE_ROLES: Record<string, UserRole[]> = {
  admin:   ['admin', 'vicerrector_extension', 'decano', 'coordinador', 'enlace', 'docente', 'monitor', 'auxiliar'],
  enlace:  ['monitor', 'auxiliar'],
};

const inp = "w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B] transition-colors";
const lbl = "text-xs text-[#666] uppercase tracking-wider block mb-1.5";

// ── Esquema de validación ─────────────────────────────────
const userSchema = z.object({
  name:     z.string().min(3, 'Nombre requerido'),
  email:    z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres').optional().or(z.literal('')),
  role:     z.string().min(1, 'Selecciona un rol'),
  faculty:  z.string().optional(),
  program:  z.string().optional(),
  phone:    z.string().optional(),
  position: z.string().optional(),
});
type UserFormData = z.infer<typeof userSchema>;

// ── Badge de rol ──────────────────────────────────────────
function RoleBadge({ role }: { role: UserRole }) {
  const cfg = ROLE_CONFIG[role] ?? { label: role, color: 'text-[#666] bg-[#1A1A1A] border-[#333]' };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}>
      <Shield size={9} />
      {cfg.label}
    </span>
  );
}

// ── Modal crear/editar usuario ────────────────────────────
function UserModal({
  user, onClose,
}: { user: UserFormData & { id?: string } | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { role: currentRole, isAdmin } = useAuth();
  const isEditing = !!user?.id;
  const [showPass, setShowPass] = useState(false);
  const [serverError, setServerError] = useState('');

  const assignable = ASSIGNABLE_ROLES[currentRole ?? ''] ?? [];

  const { register, handleSubmit, formState: { errors } } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      password: '',
      role: user?.role ?? 'docente',
      faculty: user?.faculty ?? '',
      program: user?.program ?? '',
      phone: user?.phone ?? '',
      position: user?.position ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: UserFormData) => {
      const payload: Record<string, unknown> = { ...data };
      if (!payload.password) delete payload.password;
      if (isEditing && user?.id) {
        return usersService.update(user.id, payload);
      }
      // Crear usuario nuevo
      return usersService.register({ ...payload, password: data.password });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      setServerError(err.response?.data?.message ?? 'Error al guardar');
    },
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-[#2A2A2A] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E1E] flex-shrink-0">
          <div>
            <div className="text-xs font-mono text-[#555] uppercase tracking-widest mb-0.5">
              {isEditing ? 'Editar usuario' : 'Nuevo usuario'}
            </div>
            <h2 className="text-white font-semibold">{isEditing ? user?.name : 'Registrar acceso al sistema'}</h2>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex-1 overflow-y-auto p-6 space-y-4">
          {serverError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 text-red-400 text-xs">
              {serverError}
            </div>
          )}

          <div>
            <label className={lbl}>Nombre completo *</label>
            <input {...register('name')} placeholder="Jorge Andrés Pérez" className={inp} />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className={lbl}>Correo institucional *</label>
            <input {...register('email')} type="email" placeholder="usuario@iudigital.edu.co" className={inp} />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className={lbl}>{isEditing ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label>
            <div className="relative">
              <input {...register('password')} type={showPass ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres" className={`${inp} pr-10`} />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-white">
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className={lbl}>Rol en el sistema *</label>
            <select {...register('role')} className={inp}>
              {assignable.map(r => (
                <option key={r} value={r}>{ROLE_CONFIG[r]?.label ?? r} — {ROLE_CONFIG[r]?.description}</option>
              ))}
            </select>
            {errors.role && <p className="text-red-400 text-xs mt-1">{errors.role.message}</p>}
          </div>

          {isAdmin && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Facultad</label>
                  <input {...register('faculty')} placeholder="Ingeniería y Ciencias..." className={inp} />
                </div>
                <div>
                  <label className={lbl}>Programa</label>
                  <input {...register('program')} placeholder="Tec. en Desarrollo..." className={inp} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Teléfono</label>
                  <input {...register('phone')} placeholder="3001234567" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Cargo</label>
                  <input {...register('position')} placeholder="Docente Ocasional TC" className={inp} />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="text-sm text-[#666] hover:text-white transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex items-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
              {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isEditing ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────
export default function UsersPage() {
  const { canManageUsers, canCreateUsers, isAdmin, role } = useAuth();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('');
  const [modalUser, setModalUser] = useState<(UserFormData & { id?: string }) | null | false>(false);
  const qc = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ['users', roleFilter, facultyFilter],
    queryFn: () => usersService.getAll({
      role: roleFilter || undefined,
      faculty: facultyFilter || undefined,
    }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? usersService.activate(id) : usersService.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const users = (usersQuery.data ?? []) as User[];
  const filtered = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()),
  );

  const assignable = (ASSIGNABLE_ROLES[role ?? ''] ?? []) as UserRole[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-1">// GESTIÓN DE USUARIOS</p>
          <h1 className="text-2xl font-bold text-white">Usuarios del Sistema</h1>
          <p className="text-[#666] text-sm mt-1">
            Administra accesos y roles · {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreateUsers && (
          <button onClick={() => setModalUser(null)}
            className="flex items-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
            <Plus size={16} /> Nuevo usuario
          </button>
        )}
      </div>

      {/* Info de roles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['admin', 'enlace', 'docente', 'monitor'] as UserRole[]).map(r => {
          const count = users.filter(u => u.role === r).length;
          const cfg = ROLE_CONFIG[r];
          return (
            <div key={r} className="bg-[#111] border border-[#2A2A2A] rounded-xl p-4 cursor-pointer hover:border-[#333]"
              onClick={() => setRoleFilter(roleFilter === r ? '' : r)}>
              <div className={`text-xl font-bold mb-1 ${roleFilter === r ? 'text-[#FF6B2B]' : 'text-white'}`}>{count}</div>
              <div className="text-xs text-[#666]">{cfg?.label ?? r}</div>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
          <input placeholder="Buscar por nombre o email..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#111] border border-[#2A2A2A] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B]" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="bg-[#111] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF6B2B] min-w-[160px]">
          <option value="">Todos los roles</option>
          {Object.entries(ROLE_CONFIG).map(([r, cfg]) => (
            <option key={r} value={r}>{cfg.label}</option>
          ))}
        </select>
        {isAdmin && (
          <input placeholder="Filtrar por facultad..." value={facultyFilter}
            onChange={e => setFacultyFilter(e.target.value)}
            className="bg-[#111] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B] min-w-[200px]" />
        )}
        {(roleFilter || facultyFilter) && (
          <button onClick={() => { setRoleFilter(''); setFacultyFilter(''); }}
            className="flex items-center gap-1 text-xs text-[#FF6B2B] hover:text-white transition-colors px-2">
            <Filter size={12} /> Limpiar
          </button>
        )}
      </div>

      {/* Tabla de usuarios */}
      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl overflow-hidden">
        <div className="border-b border-[#1E1E1E] px-5 py-3 flex items-center justify-between">
          <span className="text-xs font-mono text-[#555] uppercase tracking-widest">// LISTA DE USUARIOS</span>
          <span className="text-xs text-[#555]">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {usersQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[#FF6B2B]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users size={40} className="text-[#333] mb-3" />
            <p className="text-[#555] text-sm">No hay usuarios que coincidan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E1E1E]">
                  {['Usuario', 'Rol', 'Facultad / Programa', 'Estado', canManageUsers ? 'Acciones' : ''].filter(Boolean).map(h => (
                    <th key={h} className="text-left text-xs font-mono text-[#555] uppercase tracking-wider px-5 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="border-b border-[#1A1A1A] hover:bg-[#161616] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#FF6B2B]/15 border border-[#FF6B2B]/25 flex items-center justify-center flex-shrink-0">
                          <span className="text-[#FF6B2B] text-xs font-bold">
                            {u.name.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="text-white font-medium text-sm">{u.name}</div>
                          <div className="text-[#555] text-xs">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-xs text-[#888]">{u.faculty ?? '—'}</div>
                      <div className="text-xs text-[#555]">{u.program ?? ''}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      {u.isActive ? (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle2 size={12} /> Activo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-[#555]">
                          <XCircle size={12} /> Inactivo
                        </span>
                      )}
                    </td>
                    {canManageUsers && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {(isAdmin || assignable.includes(u.role)) && (
                            <button
                              onClick={() => setModalUser({
                                id: u.id, name: u.name, email: u.email,
                                role: u.role, faculty: u.faculty ?? '',
                                program: u.program ?? '', phone: u.phone ?? '',
                                position: u.position ?? '', password: '',
                              })}
                              className="p-1.5 text-[#555] hover:text-[#FF6B2B] hover:bg-[#FF6B2B]/10 rounded transition-colors"
                              title="Editar">
                              <Pencil size={13} />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => toggleActive.mutate({ id: u.id, active: !u.isActive })}
                              className={`p-1.5 rounded transition-colors ${u.isActive ? 'text-[#555] hover:text-red-400 hover:bg-red-400/10' : 'text-[#555] hover:text-green-400 hover:bg-green-400/10'}`}
                              title={u.isActive ? 'Desactivar acceso' : 'Activar acceso'}>
                              {u.isActive ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tabla de permisos (solo admin) */}
      {isAdmin && (
        <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-5">
          <div className="text-xs font-mono text-[#555] uppercase tracking-widest mb-4">// TABLA DE PERMISOS POR ROL</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1E1E1E]">
                  <th className="text-left text-[#666] py-2 pr-4 whitespace-nowrap">Permiso</th>
                  {(['admin','vicerrector_extension','decano','coordinador','enlace','docente','monitor','auxiliar'] as UserRole[]).map(r => (
                    <th key={r} className="text-center text-[#666] py-2 px-2 whitespace-nowrap">
                      {ROLE_CONFIG[r]?.label.split(' ')[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Ver inventario',       access: ['admin','vicerrector_extension','decano','coordinador','enlace','monitor','auxiliar'] },
                  { label: 'Editar inventario',    access: ['admin','enlace'] },
                  { label: 'Agregar inventario',   access: ['admin','enlace','monitor','auxiliar'] },
                  { label: 'Ver plan de trabajo propio', access: ['admin','enlace','docente'] },
                  { label: 'Ver todos los planes', access: ['admin','vicerrector_extension','decano'] },
                  { label: 'Editar plan propio',   access: ['admin','enlace','docente'] },
                  { label: 'Obs. como decano',     access: ['admin','decano'] },
                  { label: 'Ver reportes',         access: ['admin','vicerrector_extension','decano','coordinador','enlace','docente'] },
                  { label: 'Gestionar usuarios',   access: ['admin','enlace'] },
                  { label: 'Crear usuarios',       access: ['admin'] },
                  { label: 'Asignar roles',        access: ['admin'] },
                ].map(({ label, access }) => (
                  <tr key={label} className="border-b border-[#1A1A1A]">
                    <td className="text-[#888] py-2 pr-4">{label}</td>
                    {(['admin','vicerrector_extension','decano','coordinador','enlace','docente','monitor','auxiliar'] as UserRole[]).map(r => (
                      <td key={r} className="text-center py-2 px-2">
                        {access.includes(r)
                          ? <span className="text-green-400">✓</span>
                          : <span className="text-[#333]">—</span>
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalUser !== false && (
        <UserModal user={modalUser} onClose={() => setModalUser(false)} />
      )}
    </div>
  );
}
