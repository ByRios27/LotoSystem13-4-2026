import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { UserPlus, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Entry } from '../../store/useStore';
import { formatCurrency, formatPlayNumberForDisplay } from '../../utils/helpers';

interface SalePreviewGroup {
  drawId: string;
  drawName: string;
  entries: Entry[];
  subtotal: number;
}

interface SaleCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customerName: string) => void | Promise<void>;
  isSubmitting?: boolean;
  initialName?: string;
  previewGroups: SalePreviewGroup[];
  totalAmount: number;
  isEditing?: boolean;
}

export const SaleCustomerModal: React.FC<SaleCustomerModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
  initialName = '',
  previewGroups,
  totalAmount,
  isEditing = false,
}) => {
  const [name, setName] = useState(initialName);
  const [isConfirming, setIsConfirming] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setName(initialName);
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const totalLines = previewGroups.reduce((sum, group) => sum + group.entries.length, 0);

  const getEntryTypeAbbr = (type: Entry['type']): 'CH' | 'PL' | 'BL' | 'BE' => {
    if (type === 'PALÉ') return 'PL';
    if (type === 'BILLETE_ESPECIAL') return 'BE';
    if (type === 'BILLETE') return 'BL';
    return 'CH';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isConfirming) return;
    setIsConfirming(true);
    try {
      await onConfirm(name.trim());
    } finally {
      setIsConfirming(false);
    }
  };
  
  const loading = isSubmitting || isConfirming;

  return (
    createPortal(<AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center overflow-y-auto p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 250 }}
            className="bg-[#0B1220] w-full max-w-sm max-h-[calc(100dvh-1.5rem-env(safe-area-inset-bottom))] sm:max-h-[90dvh] rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative flex flex-col"
          >
            <div className="shrink-0 p-4 sm:p-5 flex flex-col items-center justify-center text-center bg-brand-primary/10 border-b border-brand-primary/20">
                <UserPlus size={40} className="text-brand-primary mb-3"/>
                <h3 className="text-lg font-black text-white">{isEditing ? 'Actualizar Venta' : 'Finalizar Venta'}</h3>
                <p className="text-xs text-slate-300 font-medium max-w-[300px]">Revisa los detalles y asigna un cliente antes de confirmar.</p>
            </div>

            <div className="flex-1 min-h-0 p-4 overflow-y-auto overscroll-contain no-scrollbar">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Nombre del Cliente (Opcional)</label>
                  <div className="relative">
                    <input
                      autoFocus
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Cliente General"
                      className="w-full bg-black/20 border-2 border-white/10 rounded-xl px-4 py-3.5 text-white font-bold placeholder:text-slate-600 focus:outline-none focus:border-brand-primary/50 transition-all"
                    />
                  </div>
                </div>

                <div className="bg-black/20 p-3 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resumen del Ticket</p>
                    <p className="text-xs font-bold text-brand-primary uppercase tracking-wider">{totalLines} Jugadas</p>
                  </div>

                  <div className="space-y-2 max-h-[200px] overflow-y-auto no-scrollbar pr-1">
                    {previewGroups.map((group) => (
                      <div key={group.drawId} className="bg-[#0B1220] border border-white/5 rounded-xl p-2.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-black text-white uppercase tracking-wider">{group.drawName}</p>
                          <p className="text-xs font-black text-brand-primary">${formatCurrency(group.subtotal)}</p>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          {group.entries.map((entry, idx) => (
                            <div key={`${group.drawId}-${entry.id || idx}`} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white tracking-widest">{formatPlayNumberForDisplay(entry.number, entry.type)}</span>
                                <span className="font-semibold text-slate-500 uppercase">{getEntryTypeAbbr(entry.type)}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-slate-400">x{entry.pieces}</span>
                                <span className="font-bold text-slate-200 w-12 text-right">${formatCurrency(entry.amount)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t-2 border-white/5 pt-3 mt-2">
                    <p className="text-sm font-bold text-slate-300 uppercase tracking-wider">Total General</p>
                    <p className="text-lg font-black text-brand-primary">${formatCurrency(totalAmount)}</p>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="shrink-0 p-4 bg-black/20 border-t border-white/5 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full bg-brand-primary text-black h-12 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 active:scale-95 transition-all disabled:opacity-40"
                >
                    {loading ? 'Procesando...' : (isEditing ? 'Confirmar Cambios' : 'Registrar Venta')}
                    {!loading && <ArrowRight size={18} />}
                </button>
            </div>

            <div className="absolute top-3 right-3">
                <button
                    onClick={onClose}
                    disabled={loading}
                    className="w-8 h-8 bg-black/30 text-white/70 rounded-full flex items-center justify-center backdrop-blur-sm active:bg-black/50 transition-colors disabled:opacity-30"
                >
                    <X size={18} />
                </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>, document.body)
  );
};
