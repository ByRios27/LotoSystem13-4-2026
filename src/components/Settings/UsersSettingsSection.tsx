import React, { useState, useEffect, useMemo } from 'react';
import { useStore, User } from '../../store/useStore';
import { collection, doc, setDoc, deleteDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db, auth, firebaseConfig } from '../../firebase';
import { createUserWithEmailAndPassword, signOut, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Trash2, Edit, AlertTriangle, X, ToggleLeft, ToggleRight, Share2 } from 'lucide-react';
import { generateSellerId, cn } from '../../utils/helpers';
import { PinValidationModal } from '../PinValidationModal';


const ROLES: User['role'][] = ['seller', 'leader', 'CEO'];
const roleLabel = (role: string) => (role === 'CEO' ? 'CEO' : role.charAt(0).toUpperCase() + role.slice(1));

const EMAIL_DOMAIN = '@lottopro.system';

async function shareCredentials(email: string, password?: string): Promise<'shared' | 'copied' | 'failed'> {
  const text = `usuario: ${email}${password ? `\ncontraseña: ${password}` : ''}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Credenciales LottoPro', text });
      return 'shared';
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch (err: any) {
    if (err?.name === 'AbortError') return 'shared';
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
}

async function createLoginAccount(username: string, password: string): Promise<string> {
  const email = `${username.toLowerCase().trim()}@lottopro.system`;
  const appName = `lottopro-user-provision-${Date.now()}`;
  
  const secondaryApp = initializeApp(firebaseConfig as any, appName);
  const secondaryAuth = initializeAuth(secondaryApp, { persistence: inMemoryPersistence });

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    return credential.user.uid;
  } finally {
    await signOut(secondaryAuth).catch(() => undefined);
    await deleteApp(secondaryApp).catch(() => undefined);
  }
}


const AddUserForm: React.FC<{ onUserAdded: () => void }> = ({ onUserAdded }) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [commission, setCommission] = useState('25');
  const [role, setRole] = useState<User['role']>('seller');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('123456');
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const users = useStore((state) => state.users);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (users.some(u => u.username.toLowerCase() === username.toLowerCase().trim())) {
      setError('El nombre de usuario ya existe.');
      return;
    }
    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
        setError('El PIN debe contener exactamente 4 números.');
        return;
    }
    if (!/^\d+$/.test(commission) || Number(commission) > 100) {
      setError('La comisión debe ser un número entero entre 0 y 100.');
      return;
    }
    if (!password || password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const newUserId = await createLoginAccount(username, password);
      
      const newUser: User = {
        id: newUserId,
        name: name.trim(),
        username: username.toLowerCase().trim(),
        email: `${username.toLowerCase().trim()}@lottopro.system`,
        pin,
        commission: Number(commission) / 100,
        role,
        status: 'active',
        sellerId: generateSellerId(),
        createdAt: Timestamp.now(),
      };

      await setDoc(doc(db, 'users', newUserId), newUser);
      setCreated({ email: newUser.email!, password });
    } catch (err: any) {
      console.error('Error creating user:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este nombre de usuario ya está registrado en el sistema de autenticación.');
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Ocurrió un error desconocido al crear el usuario.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onUserAdded}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="bg-[#0C1422] w-full max-w-[368px] rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative"
      >
        <div className="px-4 py-3 flex items-center justify-between bg-white/5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <UserPlus size={16} className="text-brand-primary" />
            <h3 className="font-black text-white text-sm uppercase tracking-wider">{created ? 'Usuario Creado' : 'Nuevo Usuario'}</h3>
          </div>
          <button type="button" onClick={onUserAdded} className="p-1.5 bg-white/10 rounded-full active:scale-95 transition-all text-slate-300">
            <X size={16} />
          </button>
        </div>

        {created ? (
          <div className="form-compact p-4 space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1.5">
              <p className="text-[10px] font-black text-slate-200 uppercase tracking-widest">Usuario</p>
              <p className="text-sm font-bold text-white break-all">{created.email}</p>
              <p className="text-[10px] font-black text-slate-200 uppercase tracking-widest pt-1">Contraseña</p>
              <p className="text-sm font-bold text-white break-all">{created.password}</p>
            </div>
            {shareStatus && <p className="text-xs font-bold text-lime-400">{shareStatus}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={onUserAdded} className="w-full bg-white/10 text-white/80 h-10 rounded-2xl font-black uppercase text-sm tracking-widest active:scale-95 transition-all">Cerrar</button>
              <button
                type="button"
                onClick={async () => {
                  const result = await shareCredentials(created.email, created.password);
                  setShareStatus(result === 'copied' ? 'Credenciales copiadas.' : result === 'failed' ? 'No se pudo compartir.' : null);
                }}
                className="w-full bg-brand-primary text-black h-10 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 active:scale-95 transition-all"
              >
                <Share2 size={16} />
                Compartir
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleCreateUser} className="form-compact p-4 space-y-2 max-h-[70vh] overflow-y-auto no-scrollbar">
          <div className="form-group">
            <label>Nombre Completo</label>
            <input type="text" placeholder="Ej. Juan Pérez" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Nombre de Usuario</label>
            <input type="text" placeholder="Ej. juanp" value={username} onChange={e => setUsername(e.target.value.replace(/\s/g, ''))} required className="pr-36" />
            <span className="pointer-events-none absolute right-2.5 bottom-[7px] text-xs font-bold text-slate-400">{EMAIL_DOMAIN}</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="form-group">
              <label>PIN (4 dígitos)</label>
              <input type="text" inputMode="numeric" placeholder="0000" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} required maxLength={4} />
            </div>
            <div className="form-group">
              <label>Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="form-group">
              <label>Rol</label>
              <select value={role} onChange={e => setRole(e.target.value as User['role'])}>
                {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Comisión (%)</label>
              <input type="text" inputMode="numeric" placeholder="25" value={commission} onChange={e => setCommission(e.target.value.replace(/\D/g, '').slice(0, 3))} required />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 text-rose-400 bg-rose-400/10 p-3.5 rounded-2xl border border-rose-400/20">
              <AlertTriangle size={18} />
              <p className="text-xs font-bold uppercase tracking-tight">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onUserAdded} className="w-full bg-white/10 text-white/80 h-10 rounded-2xl font-black uppercase text-sm tracking-widest active:scale-95 transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="w-full bg-brand-primary text-black h-10 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 active:scale-95 transition-all disabled:opacity-40">
              {loading ? 'Creando...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
        )}
      </motion.div>
    </motion.div>
  );
};


export const UsersSettingsSection = () => {
  const currentUser = useStore((state) => state.currentUser);
  const users = useStore((state) => state.users);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  if (currentUser?.role !== 'CEO') return null;

  const sortedUsers = [...users].sort((a, b) => a.username.localeCompare(b.username));

  const handleUpdateUser = async (user: User) => {
    if (!editingUser) return;
    try {
        const userRef = doc(db, "users", user.id);
        await updateDoc(userRef, {
            name: user.name,
            pin: user.pin,
            commission: user.commission,
            role: user.role,
            status: user.status
        });
        setEditingUser(null);
    } catch (error) {
        console.error("Error updating user: ", error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    // Note: This only deletes from Firestore. The Auth user remains.
    // A proper implementation would use a Cloud Function to delete the user from Auth.
    try {
      await deleteDoc(doc(db, "users", userId));
      setConfirmDelete(null); // Close confirmation
    } catch (error) {
      console.error("Error deleting user: ", error);
    }
  };

  const toggleUserStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
        const userRef = doc(db, "users", user.id);
        await updateDoc(userRef, { status: newStatus });
    } catch (error) {
        console.error("Error toggling user status: ", error);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-2">
        <div>
          <h2 className="text-sm font-black text-white uppercase tracking-widest">Gestión de Usuarios</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Crea y administra los usuarios.</p>
        </div>
        <button onClick={() => setIsAddingUser(true)} className="bg-brand-primary text-black px-4 h-10 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-brand-primary/20 active:scale-95 transition-all shrink-0 whitespace-nowrap">
          <UserPlus size={16}/>
          Añadir Usuario
        </button>
      </div>

      <AnimatePresence>
        {isAddingUser && <AddUserForm onUserAdded={() => setIsAddingUser(false)} />}
      </AnimatePresence>

      <div className="space-y-2">
        {sortedUsers.filter(u => u.id !== currentUser.id).map(user => (
             <div key={user.id} className={cn("bg-white/5 rounded-2xl border p-3", user.status === 'active' ? "border-white/10" : "border-red-500/20 opacity-70")}>
                {editingUser?.id === user.id ? (
                    // Editing View
                    <div className="form-compact space-y-2">
                        <div className="form-group"><label>Nombre</label><input value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})}/></div>
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="form-group"><label>PIN</label><input inputMode="numeric" value={editingUser.pin} onChange={e => setEditingUser({...editingUser, pin: e.target.value.replace(/\D/g, '')})} maxLength={4}/></div>
                            <div className="form-group"><label>Comisión (%)</label><input type="text" inputMode="numeric" value={Math.round(editingUser.commission * 100)} onChange={e => setEditingUser({...editingUser, commission: Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0) / 100})}/></div>
                        </div>
                        <div className="form-group"><label>Rol</label>
                            <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as User['role']})}>
                                {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-3 pt-1">
                            <button onClick={() => setEditingUser(null)} className="w-full bg-white/10 text-white/80 h-10 rounded-2xl font-black uppercase text-sm tracking-widest active:scale-95 transition-all">Cancelar</button>
                            <button onClick={() => handleUpdateUser(editingUser)} className="w-full bg-brand-primary text-black h-10 rounded-2xl font-black uppercase text-sm tracking-widest shadow-lg shadow-brand-primary/20 active:scale-95 transition-all">Guardar</button>
                        </div>
                    </div>
                ) : (
                    // Default View
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm text-white tracking-tight truncate">{user.name}</h4>
                                {user.status !== 'active' && (
                                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[8px] font-black uppercase tracking-widest rounded-md border border-red-500/30">Inactivo</span>
                                )}
                            </div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5 truncate">@{user.username} · {user.role} · {Math.round(user.commission * 100)}%</p>
                        </div>
                        <div className="flex items-center shrink-0">
                            <button onClick={() => shareCredentials(user.email || `${user.username}${EMAIL_DOMAIN}`)} title="Compartir usuario" className="p-2 rounded-lg text-slate-500 hover:text-white transition-colors"><Share2 size={16}/></button>
                            <button onClick={() => toggleUserStatus(user)} className={cn("p-2 rounded-lg transition-all active:scale-90", user.status === 'active' ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-400")}>
                                {user.status === 'active' ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                            </button>
                            <button onClick={() => setEditingUser(user)} className="p-2 rounded-lg text-slate-500 hover:text-white transition-colors"><Edit size={16}/></button>
                            <button onClick={() => setConfirmDelete(user.id)} className="p-2 rounded-lg text-slate-600 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                        </div>
                    </div>
                )}
                {confirmDelete === user.id && (
                    <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                        <p className="font-bold text-sm text-white">¿Seguro que quieres eliminar a este usuario?</p>
                        <p className="text-xs text-red-300 mb-3">Esta acción no se puede deshacer.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDelete(null)} className="w-full bg-white/10 text-white/80 h-10 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all">Cancelar</button>
                            <button onClick={() => handleDeleteUser(user.id)} className="w-full bg-red-500 text-white h-10 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all">Sí, Eliminar</button>
                        </div>
                    </div>
                )}
            </div>
        ))}
      </div>
       <PinValidationModal 
         isOpen={isPinModalOpen}
         onClose={() => setIsPinModalOpen(false)}
         onSuccess={() => { /* Handle success */ }}
         title='Confirmar Acción'
         description='Ingresa tu PIN para confirmar.'
       />
    </div>
  );
};
