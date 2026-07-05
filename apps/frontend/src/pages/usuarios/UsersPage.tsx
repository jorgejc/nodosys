/**
 * UsersPage.tsx — corregido
 * Fixes: import Info, tipo User correcto (sin cedula), search en service
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Users, Plus, Search, X, Save, Loader2, Shield,
  Eye, EyeOff, CheckCircle2, XCircle, Pencil, Info, Filter, MapPin,
} from 'lucide-react';
import { usersService } from '@/services/users.service';
import { catalogsService } from '@/services/catalogs.service';
import { useAuth } from '@/hooks/useAuth';
import { usePagination } from '@/components/ui/Pagination';
import type { User } from '@/types';

// ── Tipos de documento colombianos ────────────────────────
const DOCUMENT_TYPES = [
  { value: 'CC',  label: 'CC  — Cédula de Ciudadanía' },
  { value: 'TI',  label: 'TI  — Tarjeta de Identidad' },
  { value: 'RC',  label: 'RC  — Registro Civil' },
  { value: 'PA',  label: 'PA  — Pasaporte' },
  { value: 'CE',  label: 'CE  — Cédula de Extranjería' },
  { value: 'PEP', label: 'PEP — Permiso Especial de Permanencia' },
  { value: 'PPT', label: 'PPT — Permiso de Protección Temporal' },
  { value: 'NIT', label: 'NIT — NIT (instituciones)' },
];

// ── Configuración de roles ────────────────────────────────
const ROLE_CFG: Record<string, {
  label: string; color: string; description: string;
  reqFaculty: boolean; reqProgram: boolean;
}> = {
  admin:                 { label:'Administrador',         color:'text-red-400 bg-red-400/10 border-red-400/30',           description:'Acceso total al sistema',               reqFaculty:false, reqProgram:false },
  vicerrector_extension: { label:'Vicerrector Extensión', color:'text-purple-400 bg-purple-400/10 border-purple-400/30',  description:'Supervisa todos los nodos',             reqFaculty:false, reqProgram:false },
  vicerrector_academico: { label:'Vicerrector Académico', color:'text-violet-400 bg-violet-400/10 border-violet-400/30',  description:'Supervisa planes de trabajo',           reqFaculty:false, reqProgram:false },
  equipo_extension:      { label:'Equipo Extensión',      color:'text-indigo-400 bg-indigo-400/10 border-indigo-400/30',  description:'Apoyo al vicerrector extensión',        reqFaculty:false, reqProgram:false },
  decano:                { label:'Decano',                color:'text-blue-400 bg-blue-400/10 border-blue-400/30',        description:'Ve su facultad y programas',            reqFaculty:true,  reqProgram:false },
  coordinador:           { label:'Coordinador',           color:'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',        description:'Ve su programa específico',            reqFaculty:true,  reqProgram:true  },
  enlace:                { label:'Enlace de Nodo',        color:'text-[#FF6B2B] bg-[#FF6B2B]/10 border-[#FF6B2B]/30',    description:'Docente gestor de nodo',               reqFaculty:false, reqProgram:false },
  docente:               { label:'Docente Ocasional',     color:'text-green-400 bg-green-400/10 border-green-400/30',     description:'Solo su plan de trabajo',              reqFaculty:false, reqProgram:false },
  monitor:               { label:'Monitor',               color:'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', description:'Apoya inventario del nodo',            reqFaculty:false, reqProgram:false },
  auxiliar:              { label:'Auxiliar',              color:'text-[#888] bg-[#1A1A1A] border-[#333]',                description:'Apoyo operativo del nodo',             reqFaculty:false, reqProgram:false },
};

// Roles que requieren tener un nodo asignado
const NODO_ROLES = ['enlace', 'monitor', 'auxiliar'];

// Qué roles puede asignar cada perfil
const ASSIGNABLE: Record<string, string[]> = {
  admin:  Object.keys(ROLE_CFG),
  enlace: ['monitor','auxiliar'],
};

const inp = "w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B] transition-colors";
const inpErr = "w-full bg-[#1A1A1A] border border-red-500/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#555] outline-none transition-colors";
const lbl = "text-xs text-[#666] uppercase tracking-wider block mb-1.5";

// ── Validación con reglas condicionales por rol ───────────
const schema = z.object({
  name:           z.string().min(3,'Nombre obligatorio (mínimo 3 caracteres)'),
  documentType:   z.string().default('CC'),
  documentNumber: z.string().optional(),
  email:          z.string().email('Ingresa un email válido'),
  password:       z.string().min(8,'La contraseña debe tener al menos 8 caracteres').optional().or(z.literal('')),
  role:           z.string().min(1,'Debes seleccionar un rol'),
  nodoId:         z.string().optional(),
  nodoName:       z.string().optional(),
  facultyId:      z.string().optional(),
  programId:      z.string().optional(),
  phone:          z.string().optional(),
}).superRefine((d, ctx) => {
  const cfg = ROLE_CFG[d.role];
  if (cfg?.reqFaculty && !d.facultyId?.trim())
    ctx.addIssue({ code:'custom', path:['facultyId'], message:`La facultad es obligatoria para el rol ${cfg.label}` });
  if (cfg?.reqProgram && !d.programId?.trim())
    ctx.addIssue({ code:'custom', path:['programId'], message:`El programa es obligatorio para el rol ${cfg.label}` });
  if (NODO_ROLES.includes(d.role) && !d.nodoName?.trim())
    ctx.addIssue({ code:'custom', path:['nodoName'], message:'Debes asignar un nodo a este rol' });
});
type FD = z.infer<typeof schema>;

// ── Traducciones de errores del backend ───────────────────
function friendlyBackendError(msg: string | string[]): string {
  const raw = Array.isArray(msg) ? msg.join(' · ') : (msg ?? '');
  const map: Record<string, string> = {
    'already exists':       'Ya existe un usuario con ese email',
    'must be a valid email':'El email ingresado no es válido',
    'should not exist':     'Hay un campo que no está permitido. Contacta al administrador.',
    'must be longer than':  'La contraseña debe tener al menos 8 caracteres',
    'Unauthorized':         'No tienes permiso para realizar esta acción',
    'Forbidden':            'No tienes permiso para realizar esta acción',
    'Not Found':            'Usuario no encontrado',
  };
  for (const [key, friendly] of Object.entries(map)) {
    if (raw.toLowerCase().includes(key.toLowerCase())) return friendly;
  }
  return raw || 'Ocurrió un error. Por favor intenta de nuevo.';
}

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CFG[role];
  if (!cfg) return <span className="text-xs text-[#555]">{role}</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}>
      <Shield size={9}/>{cfg.label}
    </span>
  );
}

// ── Modal crear/editar ────────────────────────────────────
function UserModal({
  user, onClose,
}: {
  user: (FD & { id?: string }) | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { role: myRole, isAdmin } = useAuth();
  const isEdit = !!user?.id;
  const [showPass, setShowPass] = useState(false);
  const [serverError, setServerError] = useState('');
  const [nodoInputMode, setNodoInputMode] = useState<'picker' | 'new'>(
    user?.nodoId ? 'picker' : 'new'
  );

  const assignable = ASSIGNABLE[myRole ?? ''] ?? (isAdmin ? Object.keys(ROLE_CFG) : []);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FD>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:           user?.name           ?? '',
      documentType:   user?.documentType   ?? 'CC',
      documentNumber: user?.documentNumber ?? '',
      email:          user?.email          ?? '',
      password:       '',
      role:           user?.role           ?? 'docente',
      nodoId:         user?.nodoId         ?? '',
      nodoName:       user?.nodoName       ?? '',
      facultyId:      user?.facultyId      ?? '',
      programId:      user?.programId      ?? '',
      phone:          user?.phone          ?? '',
    },
  });

  const selectedRole      = watch('role');
  const selectedDocType   = watch('documentType');
  const watchedNodoId     = watch('nodoId');
  const watchedNodoName   = watch('nodoName');
  const selectedFacultyId = watch('facultyId');
  const cfg = ROLE_CFG[selectedRole];
  const isNodoRole = NODO_ROLES.includes(selectedRole);

  // Carga nodos existentes cuando el rol lo requiere
  const nodosQuery = useQuery({
    queryKey: ['nodos'],
    queryFn:  usersService.getNodos,
    enabled:  isNodoRole,
    staleTime: 5 * 60 * 1000,
  });

  // Catálogos de facultades y programas
  const facultiesQ = useQuery({
    queryKey: ['faculties'],
    queryFn:  catalogsService.getFaculties,
    staleTime: 10 * 60 * 1000,
  });
  const programsQ = useQuery({
    queryKey: ['programs', selectedFacultyId],
    queryFn:  () => selectedFacultyId
      ? catalogsService.getProgramsByFaculty(selectedFacultyId)
      : Promise.resolve([]),
    enabled:  !!(cfg?.reqFaculty || cfg?.reqProgram || isAdmin),
    staleTime: 10 * 60 * 1000,
  });

  const pickNodo = (nodoId: string, nodoName: string) => {
    setValue('nodoId', nodoId);
    setValue('nodoName', nodoName);
    setNodoInputMode('picker');
  };

  const startNewNodo = () => {
    setValue('nodoId', crypto.randomUUID());
    setValue('nodoName', '');
    setNodoInputMode('new');
  };

  const mutation = useMutation({
    mutationFn: (data: FD) => {
      const payload: Record<string, unknown> = {};
      if (data.name)           payload.name           = data.name;
      if (data.documentType)   payload.documentType   = data.documentType;
      if (data.documentNumber) payload.documentNumber = data.documentNumber;
      if (data.email)          payload.email          = data.email;
      if (data.password)       payload.password       = data.password;
      if (data.role)           payload.role           = data.role;
      if (data.phone) payload.phone = data.phone;
      // Nodo: solo para roles que lo requieren
      if (isNodoRole) {
        if (data.nodoId)   payload.nodoId   = data.nodoId;
        if (data.nodoName) payload.nodoName = data.nodoName;
      }
      // Facultad/programa: envía el UUID del catálogo + el nombre como texto (legacy)
      if (cfg?.reqFaculty || cfg?.reqProgram || isAdmin || ['docente','decano','coordinador'].includes(selectedRole)) {
        if (data.facultyId) {
          payload.facultyId = data.facultyId;
          const fac = facultiesQ.data?.find(f => f.id === data.facultyId);
          if (fac) payload.faculty = fac.name;
        }
        if (data.programId) {
          payload.programId = data.programId;
          const prg = programsQ.data?.find(p => p.id === data.programId);
          if (prg) payload.program = prg.name;
        }
      }

      if (isEdit && user?.id) return usersService.update(user.id, payload);
      return usersService.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onClose(); },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const msg = err.response?.data?.message ?? 'Error desconocido';
      setServerError(friendlyBackendError(msg));
    },
  });

  const hint = cfg?.reqFaculty && cfg?.reqProgram
    ? '⚠️ Este rol requiere asociar una facultad y un programa.'
    : cfg?.reqFaculty
      ? '⚠️ Este rol requiere asociar una facultad.'
      : null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-[#2A2A2A] rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E1E] flex-shrink-0">
          <div>
            <p className="text-xs font-mono text-[#555] uppercase mb-0.5">{isEdit ? 'Editar' : 'Nuevo'} usuario</p>
            <h2 className="text-white font-semibold">{isEdit ? user?.name : 'Registrar en el sistema'}</h2>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white p-1"><X size={18}/></button>
        </div>

        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Error del servidor — mensaje amigable */}
          {serverError && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <Info size={15} className="text-red-400 flex-shrink-0 mt-0.5"/>
              <p className="text-red-400 text-sm">{serverError}</p>
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className={lbl}>Nombre completo *</label>
            <input {...register('name')} placeholder="Jorge Andrés Pérez Cruz"
              className={errors.name ? inpErr : inp}/>
            {errors.name && (
              <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <Info size={10}/> {errors.name.message}
              </p>
            )}
          </div>

          {/* Documento */}
          <div>
            <label className={lbl}>Documento de identidad</label>
            <div className="grid grid-cols-5 gap-2">
              <select {...register('documentType')} className={`col-span-2 ${inp}`}>
                {DOCUMENT_TYPES.map(d => <option key={d.value} value={d.value}>{d.value}</option>)}
              </select>
              <input {...register('documentNumber')} placeholder="Número"
                className={`col-span-3 ${inp}`}/>
            </div>
            <p className="text-xs text-[#444] mt-1">
              {DOCUMENT_TYPES.find(d => d.value === selectedDocType)?.label}
            </p>
          </div>

          {/* Email */}
          <div>
            <label className={lbl}>Correo institucional *</label>
            <input {...register('email')} type="email"
              placeholder="usuario@iudigital.edu.co"
              className={errors.email ? inpErr : inp}/>
            {errors.email && (
              <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <Info size={10}/> {errors.email.message}
              </p>
            )}
          </div>

          {/* Contraseña */}
          <div>
            <label className={lbl}>
              {isEdit ? 'Contraseña (deja vacío para no cambiar)' : 'Contraseña *'}
            </label>
            <div className="relative">
              <input {...register('password')} type={showPass ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres"
                className={`${errors.password ? inpErr : inp} pr-10`}/>
              <button type="button" onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-white">
                {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <Info size={10}/> {errors.password.message}
              </p>
            )}
          </div>

          {/* Rol */}
          <div>
            <label className={lbl}>Rol en el sistema *</label>
            <select {...register('role')} className={errors.role ? inpErr : inp}>
              <option value="">— Selecciona un rol —</option>
              {assignable.map(r => (
                <option key={r} value={r}>
                  {ROLE_CFG[r]?.label} — {ROLE_CFG[r]?.description}
                </option>
              ))}
            </select>
            {errors.role && (
              <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <Info size={10}/> {errors.role.message}
              </p>
            )}
          </div>

          {/* Selector de nodo — solo para enlace / monitor / auxiliar */}
          {isNodoRole && (
            <div>
              <label className={lbl}>
                <MapPin size={11} className="inline mr-1 mb-0.5"/>
                Nodo asignado *
              </label>

              {/* Chips de nodos existentes */}
              {(nodosQuery.data?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {nodosQuery.data!.map(n => (
                    <button
                      type="button" key={n.nodoId}
                      onClick={() => pickNodo(n.nodoId, n.nodoName)}
                      className={`px-3 py-1.5 text-xs rounded-lg border font-mono transition-colors ${
                        watchedNodoId === n.nodoId && nodoInputMode === 'picker'
                          ? 'bg-[#FF6B2B]/10 border-[#FF6B2B]/30 text-[#FF6B2B]'
                          : 'bg-[#1A1A1A] border-[#2A2A2A] text-[#666] hover:text-white hover:border-[#444]'
                      }`}
                    >
                      {n.nodoName}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={startNewNodo}
                    className={`px-3 py-1.5 text-xs rounded-lg border font-mono transition-colors ${
                      nodoInputMode === 'new'
                        ? 'bg-[#FF6B2B]/10 border-[#FF6B2B]/30 text-[#FF6B2B]'
                        : 'bg-[#1A1A1A] border-[#2A2A2A] text-[#666] hover:text-white hover:border-[#444]'
                    }`}
                  >
                    + Nuevo nodo
                  </button>
                </div>
              )}

              {/* Input: nombre del nodo (visible cuando mode=new o no hay nodos aún) */}
              {(nodoInputMode === 'new' || (nodosQuery.data?.length ?? 0) === 0) && (
                <input
                  value={watchedNodoName ?? ''}
                  onChange={e => setValue('nodoName', e.target.value)}
                  placeholder="Nombre del nodo (ej: Arboletes, Medellín...)"
                  className={errors.nodoName ? inpErr : inp}
                />
              )}

              {/* Confirmación: nodo seleccionado */}
              {watchedNodoName && nodoInputMode === 'picker' && (
                <p className="text-xs text-[#FF6B2B] mt-1 font-mono">
                  ✓ {watchedNodoName}
                </p>
              )}

              {errors.nodoName && (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <Info size={10}/> {errors.nodoName.message}
                </p>
              )}
            </div>
          )}

          {/* Aviso contextual del rol */}
          {hint && (
            <div className="flex items-start gap-2 bg-yellow-400/8 border border-yellow-400/20 rounded-lg px-4 py-2.5">
              <Info size={14} className="text-yellow-400 flex-shrink-0 mt-0.5"/>
              <p className="text-yellow-400 text-xs">{hint}</p>
            </div>
          )}

          {/* Facultad — SELECT del catálogo */}
          {(cfg?.reqFaculty || cfg?.reqProgram || isAdmin) && (
            <div>
              <label className={`${lbl} ${cfg?.reqFaculty ? 'text-white' : ''}`}>
                Facultad {cfg?.reqFaculty ? '*' : <span className="text-[#444] normal-case">(opcional)</span>}
              </label>
              <select {...register('facultyId')} className={errors.facultyId ? inpErr : inp}>
                <option value="">— Selecciona una facultad —</option>
                {(facultiesQ.data ?? []).map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {errors.facultyId && (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <Info size={10}/> {errors.facultyId.message}
                </p>
              )}
            </div>
          )}

          {/* Programa — SELECT dependiente de la facultad */}
          {(cfg?.reqProgram || ['decano','coordinador','docente'].includes(selectedRole)) && (
            <div>
              <label className={`${lbl} ${cfg?.reqProgram ? 'text-white' : ''}`}>
                Programa {cfg?.reqProgram ? '*' : <span className="text-[#444] normal-case">(opcional)</span>}
              </label>
              <select {...register('programId')}
                className={errors.programId ? inpErr : inp}
                disabled={!selectedFacultyId}>
                <option value="">
                  {selectedFacultyId ? '— Selecciona un programa —' : '— Primero selecciona una facultad —'}
                </option>
                {(programsQ.data ?? []).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {errors.programId && (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <Info size={10}/> {errors.programId.message}
                </p>
              )}
            </div>
          )}

          {/* Teléfono */}
          <div>
            <label className={lbl}>Teléfono</label>
            <input {...register('phone')} placeholder="3001234567" className={inp}/>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-[#1E1E1E]">
            <button type="button" onClick={onClose}
              className="text-sm text-[#666] hover:text-white transition-colors px-4">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex items-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
              {mutation.isPending ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
              {isEdit ? 'Guardar cambios' : 'Crear usuario'}
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
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleF, setRoleF] = useState('');
  const [facF, setFacF] = useState('');
  const [modal, setModal] = useState<(FD & { id?: string }) | null | false>(false);

  const q = useQuery({
    queryKey: ['users', search, roleF, facF],
    queryFn: () => usersService.getAll({
      search:  search || undefined,
      role:    roleF  || undefined,
      faculty: facF   || undefined,
    }),
    staleTime: 30_000,
  });

  const users = (q.data ?? []) as User[];

  // Facultades del catálogo para el filtro de búsqueda
  const facultiesQ = useQuery({
    queryKey: ['faculties'],
    queryFn:  catalogsService.getFaculties,
    staleTime: 10 * 60 * 1000,
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? usersService.activate(id) : usersService.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const { paginated, PaginationUI } = usePagination(users, 10);
  const assignable = ASSIGNABLE[role ?? ''] ?? (isAdmin ? Object.keys(ROLE_CFG) : []);
  const hasFilters = !!(search || roleF || facF);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono text-[#555] uppercase tracking-widest mb-1">// GESTIÓN DE USUARIOS</p>
          <h1 className="text-2xl font-bold text-white">Usuarios del Sistema</h1>
          <p className="text-[#666] text-sm mt-1">{users.length} usuario{users.length !== 1 ? 's' : ''}</p>
        </div>
        {canCreateUsers && (
          <button onClick={() => setModal(null)}
            className="flex items-center gap-2 bg-[#FF6B2B] hover:bg-[#e55c20] text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
            <Plus size={16}/> Nuevo usuario
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]"/>
          <input placeholder="Buscar por nombre, documento o email..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#111] border border-[#2A2A2A] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B]"/>
        </div>
        <select value={roleF} onChange={e => setRoleF(e.target.value)}
          className="bg-[#111] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF6B2B] min-w-[170px]">
          <option value="">Todos los roles</option>
          {Object.entries(ROLE_CFG).map(([r,c]) => <option key={r} value={r}>{c.label}</option>)}
        </select>
        {isAdmin && (
          <input placeholder="Filtrar por facultad..." value={facF}
            onChange={e => setFacF(e.target.value)} list="fac-filter"
            className="bg-[#111] border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#FF6B2B] min-w-[190px]"/>
        )}
        <datalist id="fac-filter">
          {(facultiesQ.data ?? []).map(f => <option key={f.id} value={f.name}/>)}
        </datalist>
        {hasFilters && (
          <button onClick={() => { setSearch(''); setRoleF(''); setFacF(''); }}
            className="flex items-center gap-1 text-xs text-[#FF6B2B] hover:text-white px-3">
            <Filter size={12}/> Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl overflow-hidden">
        <div className="border-b border-[#1E1E1E] px-5 py-3 flex justify-between">
          <span className="text-xs font-mono text-[#555] uppercase tracking-widest">// USUARIOS</span>
          <span className="text-xs text-[#555]">{users.length} resultado{users.length !== 1 ? 's' : ''}</span>
        </div>

        {q.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-[#FF6B2B]"/></div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <Users size={36} className="text-[#333] mb-3"/>
            <p className="text-[#555] text-sm">
              {hasFilters ? 'Sin resultados para tu búsqueda' : 'No hay usuarios registrados'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E1E1E]">
                    {['Usuario','Documento','Rol','Facultad / Programa','Estado',
                      canManageUsers ? 'Acciones' : null,
                    ].filter(Boolean).map(h => (
                      <th key={h!} className="text-left text-xs font-mono text-[#555] uppercase px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(u => (
                    <tr key={u.id} className="border-b border-[#1A1A1A] hover:bg-[#161616]">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#FF6B2B]/15 border border-[#FF6B2B]/25 flex items-center justify-center flex-shrink-0">
                            <span className="text-[#FF6B2B] text-xs font-bold">
                              {u.name.split(' ').slice(0,2).map((n:string) => n[0]).join('').toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="text-white font-medium text-sm">{u.name}</div>
                            <div className="text-[#555] text-xs">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-mono text-[#666]">
                          {u.documentType && <span className="text-[#FF6B2B] mr-1">{u.documentType}</span>}
                          {u.documentNumber ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5"><RoleBadge role={u.role}/></td>
                      <td className="px-4 py-3.5">
                        {NODO_ROLES.includes(u.role) ? (
                          u.nodoName
                            ? <span className="flex items-center gap-1 text-xs text-[#FF6B2B]">
                                <MapPin size={10}/>{u.nodoName}
                              </span>
                            : <span className="text-xs text-yellow-500">Sin nodo</span>
                        ) : (
                          <>
                            <div className="text-xs text-[#888]">{u.faculty ?? '—'}</div>
                            {u.program && <div className="text-xs text-[#555]">{u.program}</div>}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {u.isActive
                          ? <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 size={12}/> Activo</span>
                          : <span className="flex items-center gap-1 text-xs text-[#555]"><XCircle size={12}/> Inactivo</span>
                        }
                      </td>
                      {canManageUsers && (
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            {(isAdmin || assignable.includes(u.role)) && (
                              <button
                                onClick={() => setModal({
                                  id:             u.id,
                                  name:           u.name,
                                  documentType:   u.documentType ?? 'CC',
                                  documentNumber: u.documentNumber ?? '',
                                  email:          u.email,
                                  role:           u.role,
                                  nodoId:         u.nodoId    ?? '',
                                  nodoName:       u.nodoName  ?? '',
                                  facultyId:      u.facultyId ?? '',
                                  programId:      u.programId ?? '',
                                  phone:          u.phone     ?? '',
                                  password:       '',
                                })}
                                className="p-1.5 text-[#555] hover:text-[#FF6B2B] hover:bg-[#FF6B2B]/10 rounded transition-colors"
                                title="Editar usuario">
                                <Pencil size={13}/>
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => toggleActive.mutate({ id: u.id, active: !u.isActive })}
                                className={`p-1.5 rounded transition-colors ${
                                  u.isActive
                                    ? 'text-[#555] hover:text-red-400 hover:bg-red-400/10'
                                    : 'text-[#555] hover:text-green-400 hover:bg-green-400/10'
                                }`}
                                title={u.isActive ? 'Desactivar acceso' : 'Reactivar acceso'}>
                                {u.isActive ? <XCircle size={13}/> : <CheckCircle2 size={13}/>}
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
            <PaginationUI/>
          </>
        )}
      </div>

      {modal !== false && (
        <UserModal
          user={modal}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  );
}
