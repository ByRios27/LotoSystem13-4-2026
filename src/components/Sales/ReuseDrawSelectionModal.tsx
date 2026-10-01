import React, { useEffect, useMemo, useState } from 'react';
import { Layers, Check, X, ArrowRight, CalendarCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Draw } from '../../store/useStore';
import { cn, formatAMPM } from '../../utils/helpers';

interface ReuseDrawSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (drawIds: string[]) => void;
  activeDraws: Draw[];
}

export const ReuseDrawSelectionModal: React.FC<ReuseDrawSelectionModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  activeDraws 
}) => {
  const activeDrawIds = useMemo(() => activeDraws.map((draw) => draw.id), [activeDraws]);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    activeDrawIds.length > 0 ? [activeDrawIds[0]] : []
  );

  useEffect(() => {
    if (isOpen) {
        setSelectedIds((prev) => {
            const validSelected = prev.filter((id) => activeDrawIds.includes(id));
            if (validSelected.length > 0) return validSelected;
            return activeDrawIds.length > 0 ? [activeDrawIds[0]] : [];
        });
    }
  }, [isOpen, activeDraws, activeDrawIds]);


  if (!isOpen) return null;

  const toggleDraw = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter(i => i !== id);
      }
      return [...prev, id];
    });
  };

  const handleConfirm = () => {
    if (selectedIds.length > 0) {
      onConfirm(selectedIds);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 250 }}
            className="bg-[#0B1220] w-full max-w-sm rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative"
        >
            <div className="p-5 flex flex-col items-center justify-center text-center bg-brand-primary/10 border-b border-brand-primary/20">
                <Layers size={40} className="text-brand-primary mb-3"/>
                <h3 className="text-lg font-black text-white">Reutilizar Jugada</h3>
                <p className="text-xs text-slate-300 font-medium max-w-[300px]">Selecciona los sorteos donde quieres aplicar las jugadas anteriores.</p>
            </div>

            <div className="p-4 space-y-2 max-h-[40vh] overflow-y-auto no-scrollbar">
                {activeDraws.length > 0 ? (
                    activeDraws.map((draw) => (
                    <button
                        key={draw.id}
                        onClick={() => toggleDraw(draw.id)}
                        className={cn(
                        "w-full p-3 rounded-2xl flex items-center justify-between border-2 transition-all duration-200",
                        selectedIds.includes(draw.id) 
                            ? "bg-brand-primary/10 border-brand-primary/60 shadow-lg shadow-brand-primary/10" 
                            : "bg-white/5 border-transparent hover:bg-white/10"
                        )}
                    >
                        <div className="flex min-w-0 flex-1 items-center">
                        <div className="text-left">
                            <p className={cn(
                            "text-sm font-bold tracking-tight leading-none",
                            selectedIds.includes(draw.id) ? "text-white" : "text-slate-300"
                            )}>{draw.name}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">CIERRE: {formatAMPM(draw.drawTime)}</p>
                        </div>
                        </div>
                        <div className={cn(
                        "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all",
                        selectedIds.includes(draw.id) 
                            ? "bg-brand-primary border-brand-strong" 
                            : "border-white/10"
                        )}>
                        {selectedIds.includes(draw.id) && <Check size={16} className="text-white" strokeWidth={3}/>}
                        </div>
                    </button>
                    ))
                ) : (
                    <div className="py-12 text-center opacity-50">
                        <CalendarCheck size={32} className="mx-auto mb-3 text-slate-600"/>
                        <p className="text-sm font-bold text-slate-400">No hay Sorteos Activos</p>
                        <p className="text-xs font-medium text-slate-500 mt-1">Por favor, espera a que se abran nuevos sorteos.</p>
                    </div>
                )}
            </div>

            <div className="p-4 bg-black/20 border-t border-white/5">
                <button
                    onClick={handleConfirm}
                    disabled={selectedIds.length === 0}
                    className="w-full bg-brand-primary text-black h-12 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 active:scale-95 transition-all disabled:opacity-40"
                >
                    Confirmar ({selectedIds.length}) Sorteos
                    <ArrowRight size={18} />
                </button>
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
    </div>
  );
};
