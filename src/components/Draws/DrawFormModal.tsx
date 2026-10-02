import React, { useState } from 'react';
import { useStore, Draw } from '../../store/useStore';
import { ToggleLeft, ToggleRight, AlertCircle, Clock, X, Tag } from 'lucide-react';
import { cn, generateId, formatAMPM, timeToMinutes, minutesToTime } from '../../utils/helpers';
import { motion } from 'motion/react';

interface ModalProps {
  draw: Draw | null;
  onClose: () => void;
}

export const DrawFormModal: React.FC<ModalProps> = ({ draw, onClose }) => {
  const { addDraw, updateDraw, currentUser } = useStore();
  const [name, setName] = useState(draw?.name || '');
  const [drawTime, setDrawTime] = useState(draw?.drawTimeSort ? minutesToTime(draw.drawTimeSort) : '12:00');
  const [digitsMode, setDigitsMode] = useState<2 | 4>(draw?.digitsMode || 2);
  const [paleEnabled, setPaleEnabled] = useState(draw?.allowedSpecialBets?.pale ?? true);
  const [billeteEnabled, setBilleteEnabled] = useState(draw?.allowedSpecialBets?.billete ?? false);
  const [closeTime, setCloseTime] = useState(
    draw?.closeTime || minutesToTime((timeToMinutes(draw?.drawTimeSort ? minutesToTime(draw.drawTimeSort) : '12:00') - 3 + 1440) % 1440)
  );
  const [isActive, setIsActive] = useState(draw?.isActive ?? true);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    const drawTimeSort = timeToMinutes(drawTime);
    if (!closeTime) {
      setError('La hora de cierre es obligatoria');
      return;
    }
    const closeTimeSort = timeToMinutes(closeTime);

    const drawData = {
      name,
      drawTime: drawTime,
      drawTimeSort,
      closeTime: closeTime,
      closeTimeSort,
      digitsMode,
      allowedSpecialBets: {
        pale: paleEnabled,
        billete: digitsMode === 4 ? billeteEnabled : false
      },
      isActive,
      updatedAt: Date.now(),
      updatedBy: currentUser?.username || 'admin',
    };

    if (draw) {
      updateDraw(draw.id, drawData);
    } else {
      addDraw({
        id: generateId(),
        ...drawData,
        createdAt: Date.now(),
        createdBy: currentUser?.username || 'admin',
      } as Draw);
    }
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-[#0C1422] w-full max-w-[368px] rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative"
      >
        <div className="px-4 py-3 flex items-center justify-between bg-white/5 border-b border-white/10">
            <div className="flex items-center gap-3">
                <Tag size={16} className="text-brand-primary"/>
                <h3 className="font-black text-white text-sm uppercase tracking-wider">
                    {draw ? 'Editar Sorteo' : 'Nuevo Sorteo'}
                </h3>
            </div>
            <button onClick={onClose} className="p-1.5 bg-white/10 rounded-full active:scale-95 transition-all text-slate-300">
                <X size={16}/>
            </button>
        </div>

          <form onSubmit={handleSubmit} className="form-compact p-4 space-y-2.5 max-h-[70vh] overflow-y-auto no-scrollbar">
            <div className='form-group'>
              <label>Nombre del Sorteo</label>
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. La Primera, Lote-Real..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className='form-group'>
                <label>Hora del Sorteo</label>
                <input 
                  type="time"
                  value={drawTime}
                  onChange={(e) => setDrawTime(e.target.value)}
                />
              </div>
              <div className='form-group'>
                <label>Hora de Cierre</label>
                <input 
                  type="time"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                />
              </div>
            </div>

            <div className='form-group'>
              <label>Modalidad de Cifras</label>
              <div className="grid grid-cols-2 gap-2">
                {[2, 4].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDigitsMode(mode as 2 | 4)}
                    className={cn(
                      "py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border",
                      digitsMode === mode 
                        ? "bg-brand-primary border-transparent text-black shadow-lg shadow-brand-primary/20" 
                        : "bg-transparent border-white/10 text-slate-300"
                    )}
                  >
                    {mode} Cifras
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-1 space-y-2">
                <div className="flex items-center justify-between form-group-inline">
                    <label>Permitir Jugada de Palé</label>
                    <button type="button" onClick={() => setPaleEnabled(!paleEnabled)} className={cn("transition-all active:scale-90", paleEnabled ? "text-brand-primary" : "text-slate-700")}>
                      {paleEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                </div>
                 {digitsMode === 4 && (
                  <div className="flex items-center justify-between form-group-inline">
                    <label>Permitir Jugada de Billete</label>
                     <button type="button" onClick={() => setBilleteEnabled(!billeteEnabled)} className={cn("transition-all active:scale-90", billeteEnabled ? "text-brand-primary" : "text-slate-700")}>
                      {billeteEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                </div>
                 )}
                <div className="flex items-center justify-between form-group-inline">
                    <label>Sorteo Activo</label>
                    <button type="button" onClick={() => setIsActive(!isActive)} className={cn("transition-all active:scale-90", isActive ? "text-brand-primary" : "text-slate-700")}>
                        {isActive ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                </div>
            </div>


            {error && (
              <div className="flex items-center gap-3 text-rose-400 bg-rose-400/10 p-3.5 rounded-2xl border border-rose-400/20">
                <AlertCircle size={18} />
                <p className="text-xs font-bold uppercase tracking-tight">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button 
                type="button"
                onClick={onClose}
                className="w-full bg-white/10 text-white/80 h-10 rounded-2xl font-black uppercase text-sm tracking-widest active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="w-full bg-brand-primary text-black h-10 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 active:scale-95 transition-all disabled:opacity-40"
              >
                {draw ? 'Actualizar Sorteo' : 'Crear Sorteo'}
              </button>
            </div>
          </form>
      </motion.div>
    </motion.div>
  );
};
