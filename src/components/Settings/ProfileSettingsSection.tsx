import React, { useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { Edit2, KeyRound, Lock, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../../store/useStore';
import { auth } from '../../firebase';
import { cn } from '../../utils/helpers';

type Panel = 'pin' | 'password' | null;
type Feedback = { type: 'ok' | 'error'; text: string } | null;

const cardClass = 'bg-white/5 rounded-2xl p-3 border border-white/10';
const primaryBtn = 'w-full bg-brand-primary text-black h-10 rounded-2xl font-black uppercase text-sm tracking-widest shadow-lg shadow-brand-primary/20 active:scale-95 transition-all disabled:opacity-40';
const secondaryBtn = 'w-full bg-white/10 text-white/80 h-10 rounded-2xl font-black uppercase text-sm tracking-widest active:scale-95 transition-all';

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
    <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest whitespace-nowrap">{label}</span>
    <span className="text-sm font-bold text-white truncate">{value}</span>
  </div>
);

const FeedbackMessage: React.FC<{ feedback: Feedback }> = ({ feedback }) => {
  if (!feedback) return null;
  const isOk = feedback.type === 'ok';
  return (
    <div className={cn(
      'flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold',
      isOk ? 'text-lime-400 bg-lime-400/10 border-lime-400/20' : 'text-rose-400 bg-rose-400/10 border-rose-400/20'
    )}>
      {isOk ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      <span>{feedback.text}</span>
    </div>
  );
};

export const ProfileSettingsSection: React.FC = () => {
  const { currentUser, updateUser } = useStore();
  const isCEO = currentUser?.role === 'CEO';

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [commission, setCommission] = useState('0');
  const [dataFeedback, setDataFeedback] = useState<Feedback>(null);

  const [panel, setPanel] = useState<Panel>(null);
  const [newPin, setNewPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityFeedback, setSecurityFeedback] = useState<Feedback>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  if (!currentUser) return null;

  const startEditing = () => {
    setName(currentUser.name);
    setCommission(String(Math.round(currentUser.commission * 100)));
    setDataFeedback(null);
    setIsEditing(true);
  };

  const handleSaveData = () => {
    if (!name.trim()) {
      setDataFeedback({ type: 'error', text: 'El nombre es obligatorio.' });
      return;
    }
    const changes: { name: string; commission?: number } = { name: name.trim() };
    if (isCEO) {
      if (!/^\d+$/.test(commission) || Number(commission) > 100) {
        setDataFeedback({ type: 'error', text: 'La comisión debe ser un entero entre 0 y 100.' });
        return;
      }
      changes.commission = Number(commission) / 100;
    }
    try {
      updateUser(currentUser.id, changes);
      setIsEditing(false);
      setDataFeedback({ type: 'ok', text: 'Datos actualizados.' });
    } catch {
      setDataFeedback({ type: 'error', text: 'No se pudieron guardar los datos.' });
    }
  };

  const togglePanel = (next: Exclude<Panel, null>) => {
    setSecurityFeedback(null);
    setPanel(prev => (prev === next ? null : next));
  };

  const handleUpdatePin = () => {
    if (newPin.length < 4) {
      setSecurityFeedback({ type: 'error', text: 'El PIN debe contener entre 4 y 6 dígitos.' });
      return;
    }
    try {
      updateUser(currentUser.id, { pin: newPin });
      setNewPin('');
      setPanel(null);
      setSecurityFeedback({ type: 'ok', text: 'PIN actualizado.' });
    } catch {
      setSecurityFeedback({ type: 'error', text: 'No se pudo actualizar el PIN.' });
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      setSecurityFeedback({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityFeedback({ type: 'error', text: 'Las contraseñas no coinciden.' });
      return;
    }
    if (!auth.currentUser) {
      setSecurityFeedback({ type: 'error', text: 'No hay una sesión activa.' });
      return;
    }
    setIsSavingPassword(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setPanel(null);
      setSecurityFeedback({ type: 'ok', text: 'Contraseña actualizada.' });
    } catch (err: any) {
      const text = err?.code === 'auth/requires-recent-login'
        ? 'Por seguridad, cierra sesión, vuelve a entrar e inténtalo de nuevo.'
        : 'No se pudo actualizar la contraseña.';
      setSecurityFeedback({ type: 'error', text });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const securityRow = (id: Exclude<Panel, null>, label: string, Icon: React.ElementType) => (
    <button
      type="button"
      onClick={() => togglePanel(id)}
      className="w-full flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all"
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className="text-slate-400" />
        <span className="text-sm font-bold">{label}</span>
      </div>
      <ChevronRight size={16} className={cn('text-slate-600 transition-transform', panel === id && 'rotate-90')} />
    </button>
  );

  return (
    <div className="space-y-3">
      <div className={cardClass}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-primary/20 flex items-center justify-center text-brand-primary text-lg font-black border border-brand-primary/30">
            {currentUser.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{currentUser.name}</h3>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{currentUser.role} • ID: {currentUser.sellerId}</p>
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-black text-white uppercase tracking-widest px-1">Datos del Usuario</h4>
          {!isEditing && (
            <button type="button" onClick={startEditing} className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-white/10 text-white text-xs font-bold uppercase tracking-wider active:scale-95 transition-all">
              <Edit2 size={14} />
              Editar
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="form-compact space-y-2 mt-2">
            <div className="form-group">
              <label>Nombre</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Usuario</label>
              <input type="text" value={currentUser.username} disabled />
            </div>
            {isCEO && (
              <div className="form-group">
                <label>Comisión (%)</label>
                <input type="text" inputMode="numeric" value={commission} onChange={e => setCommission(e.target.value.replace(/\D/g, '').slice(0, 3))} />
              </div>
            )}
            <FeedbackMessage feedback={dataFeedback} />
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setIsEditing(false); setDataFeedback(null); }} className={secondaryBtn}>Cancelar</button>
              <button type="button" onClick={handleSaveData} className={primaryBtn}>Guardar</button>
            </div>
          </div>
        ) : (
          <>
            <Row label="Nombre" value={currentUser.name} />
            <Row label="Usuario" value={`@${currentUser.username}`} />
            <Row label="Rol" value={currentUser.role} />
            <Row label="Comisión" value={`${Math.round(currentUser.commission * 100)}%`} />
            <div className="mt-2"><FeedbackMessage feedback={dataFeedback} /></div>
          </>
        )}
      </div>

      <div className={cn(cardClass, 'space-y-2')}>
        <h4 className="text-sm font-black text-white uppercase tracking-widest px-1">Seguridad</h4>

        {securityRow('pin', 'Cambiar PIN de Seguridad', Lock)}
        <AnimatePresence initial={false}>
          {panel === 'pin' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="form-compact overflow-hidden">
              <div className="p-3 bg-black/20 rounded-xl border border-white/10 space-y-2">
                <div className="form-group">
                  <label>Nuevo PIN (4 a 6 dígitos)</label>
                  <input type="password" inputMode="numeric" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} maxLength={6} />
                </div>
                <button type="button" onClick={handleUpdatePin} className={primaryBtn}>Actualizar PIN</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {securityRow('password', 'Cambiar Contraseña', KeyRound)}
        <AnimatePresence initial={false}>
          {panel === 'password' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="form-compact overflow-hidden">
              <div className="p-3 bg-black/20 rounded-xl border border-white/10 space-y-2">
                <div className="form-group">
                  <label>Nueva contraseña</label>
                  <input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Confirmar contraseña</label>
                  <input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                </div>
                <button type="button" onClick={handleUpdatePassword} disabled={isSavingPassword} className={primaryBtn}>
                  {isSavingPassword ? 'Guardando...' : 'Actualizar Contraseña'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <FeedbackMessage feedback={securityFeedback} />
      </div>
    </div>
  );
};
