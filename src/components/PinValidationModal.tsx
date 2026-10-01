import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';

interface PinValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export const PinValidationModal: React.FC<PinValidationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'Requiere Autorización',
  description = 'Para continuar, por favor ingresa tu PIN de seguridad.'
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const currentUser = useStore(state => state.currentUser);

  useEffect(() => {
    if (!isOpen) {
      setPin('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.pin) {
        setError('No se ha configurado un PIN para el usuario actual.');
        return;
    }

    if (pin === currentUser.pin) {
      onSuccess();
    } else {
      setError('El PIN ingresado es incorrecto. Inténtalo de nuevo.');
      setPin('');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 250 }}
            className="bg-[#0B1220] w-full max-w-sm rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative"
          >
            <div className="p-5 flex flex-col items-center justify-center text-center bg-brand-primary/10 border-b border-brand-primary/20">
                <ShieldCheck size={40} className="text-brand-primary mb-3"/>
                <h3 className="text-lg font-black text-white">{title}</h3>
                <p className="text-xs text-slate-300 font-medium max-w-[300px]">{description}</p>
            </div>

            <div className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Ingresa tu PIN de seguridad"
                    className="w-full bg-black/20 border-2 border-white/10 rounded-xl pl-12 pr-4 py-4 text-center text-lg tracking-widest font-bold text-white outline-none focus:border-brand-primary/50 transition-colors"
                    autoFocus
                    required
                  />
                </div>

                {error && (
                   <motion.div 
                    initial={{opacity: 0, y: -10}}
                    animate={{opacity: 1, y: 0}}
                    className="flex items-center gap-3 text-rose-400 bg-rose-400/10 p-3 rounded-xl border border-rose-400/20">
                    <AlertCircle size={18} />
                    <p className="text-xs font-bold uppercase tracking-tight">{error}</p>
                  </motion.div>
                )}

                <button
                  type="submit"
                  className="w-full bg-brand-primary text-black h-14 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-brand-primary/20 active:scale-95 transition-all disabled:opacity-50"
                  disabled={!pin}
                >
                  Validar y Confirmar
                </button>
              </form>
            </div>

            <div className="absolute top-3 right-3">
                <button
                    onClick={onClose}
                    className="w-8 h-8 bg-black/30 text-white/70 rounded-full flex items-center justify-center backdrop-blur-sm active:bg-black/50 transition-colors"
                    >
                    <X size={18} />
                </button>
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
