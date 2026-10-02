import React, { useState, useEffect, useMemo } from 'react';
import { useStore, User } from '../../store/useStore';
import { collection, doc, setDoc, deleteDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db, auth, firebaseConfig } from '../../firebase';
import { createUserWithEmailAndPassword, signOut, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Users, Trash2, Edit, ChevronDown, ChevronUp, AlertTriangle, X } from 'lucide-react';
import { generateSellerId } from '../../utils/helpers';
import { PinValidationModal } from '../PinValidationModal';


const ROLES: User['role'][] = ['seller', 'leader'];

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
      onUserAdded();
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
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-4 bg-black/80 backdrop-blur-sm"
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
            <h3 className="font-black text-white text-base uppercase tracking-wider">Nuevo Usuario</h3>
          </div>
          <button type="button" onClick={onUserAdded} className="p-1.5 bg-white/10 rounded-full active:scale-95 transition-all text-slate-300">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleCreateUser} className="p-4 space-y-2 max-h-[70vh] overflow-y-auto no-scrollbar [&_.form-group]:!p-0 [&_.form-group]:!border-0 [&_.form-group]:!bg-transparent [&_.form-group>label]:!mb-0.5 [&_.form-group>label]:!text-slate-200 [&_.form-group>label]:whitespace-nowrap [&_.form-group>input]:!py-1.5 [&_.form-group>input]:!border-white/20 [&_.form-group>select]:!py-1.5 [&_.form-group>select]:!border-white/20">
          <div className="form-group">
            <label>Nombre Completo</label>
            <input type="text" placeholder="Ej. Juan Pérez" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Nombre de Usuario</label>
            <input type="text" placeholder="Ej. juanp" value={username} onChange={e => setUsername(e.target.value)} required />
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
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
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
    <div className="settings-section">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Users size={20}/> Gestión de Usuarios</h2>
      
      <button onClick={() => setIsAddingUser(true)} className="bg-brand-primary text-black px-4 h-10 rounded-xl font-bold text-xs uppercase tracking-wider inline-flex items-center gap-2 shadow-lg shadow-brand-primary/20 active:scale-95 transition-all mb-4">
        <UserPlus size={16}/>
        Añadir Usuario
      </button>

      <AnimatePresence>
        {isAddingUser && <AddUserForm onUserAdded={() => setIsAddingUser(false)} />}
      </AnimatePresence>

      <div className="mt-6 space-y-2">
        {sortedUsers.filter(u => u.id !== currentUser.id).map(user => (
             <div key={user.id} className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
                {editingUser?.id === user.id ? (
                    // Editing View
                    <div className="space-y-3">
                        <input value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="input"/>
                        <input value={editingUser.pin} onChange={e => setEditingUser({...editingUser, pin: e.target.value})} className="input" maxLength={4}/>
                        <input type="text" inputMode="numeric" value={Math.round(editingUser.commission * 100)} onChange={e => setEditingUser({...editingUser, commission: Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0) / 100})} className="input"/>
                        <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as User['role']})} className="input">
                            {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                        </select>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => handleUpdateUser(editingUser)} className="button-primary">Guardar</button>
                            <button onClick={() => setEditingUser(null)} className="button-secondary">Cancelar</button>
                        </div>
                    </div>
                ) : (
                    // Default View
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-bold text-white">{user.name} <span className="text-xs font-mono text-slate-400">@{user.username}</span></p>
                            <p className="text-xs text-slate-300">Rol: {user.role} - Comisión: {Math.round(user.commission * 100)}%</p>
                        </div>
                        <div className="flex items-center gap-3">
                             <label className="flex items-center cursor-pointer">
                                <div className="relative">
                                    <input type="checkbox" checked={user.status === 'active'} onChange={() => toggleUserStatus(user)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                </div>
                                <span className="ml-3 text-xs font-medium text-gray-300">{user.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                            </label>
                            <button onClick={() => setEditingUser(user)} className="p-2 text-slate-400 hover:text-white"><Edit size={16}/></button>
                            <button onClick={() => setConfirmDelete(user.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                        </div>
                    </div>
                )}
                {confirmDelete === user.id && (
                    <div className="mt-4 bg-red-900/50 border border-red-500/30 rounded-lg p-4 text-center">
                        <p className="font-bold text-white">¿Seguro que quieres eliminar a este usuario?</p>
                        <p className="text-xs text-red-200 mb-4">Esta acción no se puede deshacer.</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => handleDeleteUser(user.id)} className="button-danger">Sí, Eliminar</button>
                            <button onClick={() => setConfirmDelete(null)} className="button-secondary">Cancelar</button>
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
