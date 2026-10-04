import React, { useState } from 'react';
import { useStore, Draw } from '../../store/useStore';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';
import { cn, formatAMPM, sortDrawsChronologically } from '../../utils/helpers';
import { PermissionGuard } from './PermissionGuard';
import { motion, AnimatePresence } from 'motion/react';
import { DrawFormModal } from '../Draws/DrawFormModal';

export const DrawsSettingsSection: React.FC = () => {
  const { draws, updateDraw, deleteDraw } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDraw, setEditingDraw] = useState<Draw | null>(null);
  const [modalDrawType, setModalDrawType] = useState<'normal' | 'special'>('normal');

  const sortedDraws = sortDrawsChronologically(draws);
  const normalDraws = sortedDraws.filter((draw) => draw.drawType !== 'special');
  const specialDraws = sortedDraws.filter((draw) => draw.drawType === 'special');
  
  const handleOpenModal = (draw?: Draw, drawType: 'normal' | 'special' = 'normal') => {
    setEditingDraw(draw || null);
    setModalDrawType(draw?.drawType || drawType);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingDraw(null);
    setIsModalOpen(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-sm font-black text-white uppercase tracking-widest">Administración de Sorteos</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Añade, edita y gestiona los sorteos.</p>
        </div>
        <PermissionGuard allowedRoles={['CEO']}>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-brand-primary text-black px-4 h-10 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-brand-primary/20 active:scale-95 transition-all shrink-0 whitespace-nowrap"
          >
            <Plus size={16} />
            Añadir Sorteo
          </button>
        </PermissionGuard>
      </div>

      <div className="space-y-2">
        {normalDraws.length > 0 ? normalDraws.map((draw) => (
          <motion.div 
            layout
            key={draw.id} 
            className={cn(
              "bg-white/5 rounded-2xl border p-3 flex items-center justify-between transition-all",
              draw.isActive ? "border-white/10" : "border-red-500/20 opacity-70"
            )}
          >
            <div className="flex min-w-0 items-center">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-white tracking-tight">{draw.name}</h4>
                  {!draw.isActive && (
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[8px] font-black uppercase tracking-widest rounded-md border border-red-500/30">
                      Inactivo
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider whitespace-nowrap">
                    HORA: {formatAMPM(draw.drawTime)}
                  </p>
                  <p className="text-[11px] text-rose-400 font-bold uppercase tracking-wider whitespace-nowrap">
                    CIERRE: {formatAMPM(draw.closeTime)}
                  </p>
                </div>
              </div>
            </div>

            <PermissionGuard 
              allowedRoles={['CEO']}
              fallback={<p className='text-[10px] font-bold text-slate-600 uppercase pr-2'>Sin Permisos</p>}
            >
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => updateDraw(draw.id, { isActive: !draw.isActive })}
                  className={cn("p-2 rounded-lg transition-all active:scale-90", draw.isActive ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-400")}
                >
                  {draw.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
                <button 
                  onClick={() => handleOpenModal(draw)}
                  className="p-2 rounded-lg text-slate-500 hover:text-white transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => {
                    if (window.confirm(`¿Estás seguro de que quieres eliminar el sorteo \"${draw.name}\"? Esta acción no se puede deshacer.`)) {
                      deleteDraw(draw.id);
                    }
                  }}
                  className="p-2 rounded-lg text-slate-600 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </PermissionGuard>
          </motion.div>
        )) : (
          <div className='text-center py-16 opacity-50'>
            <AlertCircle size={32} className='mx-auto text-slate-600 mb-3'/>
            <h3 className='font-bold text-slate-400 text-sm'>No se Encontraron Sorteos</h3>
            <p className='text-xs text-slate-500 mt-1'>Crea tu primer sorteo para empezar.</p>
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between px-2">
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Sorteos Especiales</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Configura cifras, premios y precio de Chance por sorteo.</p>
          </div>
          <PermissionGuard allowedRoles={['CEO']}>
            <button onClick={() => handleOpenModal(undefined, 'special')} className="bg-brand-primary text-black px-3 h-10 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-brand-primary/20 active:scale-95 transition-all shrink-0 whitespace-nowrap">
              <Plus size={16} /> Añadir Especial
            </button>
          </PermissionGuard>
        </div>
        <div className="space-y-2">
          {specialDraws.map((draw) => (
            <motion.div layout key={draw.id} className={cn("bg-white/5 rounded-2xl border p-3 flex items-center justify-between transition-all", draw.isActive ? "border-white/10" : "border-red-500/20 opacity-70")}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-white tracking-tight">{draw.name}</h4>
                  {!draw.isActive && <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[8px] font-black uppercase tracking-widest rounded-md border border-red-500/30">Inactivo</span>}
                </div>
                <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {formatAMPM(draw.drawTime)} · cierre {formatAMPM(draw.closeTime)} · {draw.specialPrizeRules?.slice(0, draw.prizeCount || 3).map((rule) => rule.resultDigits).join('/') || draw.digitsMode} cifras · {draw.prizeCount || 3} premios · ${Number(draw.chancePricePerPiece ?? 1).toFixed(2)} / Chance
                </p>
                <p className="truncate text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  {[draw.allowedSpecialBets.chance !== false && 'Chance', draw.allowedSpecialBets.pale && 'Palé', draw.allowedSpecialBets.billete && 'Billete', draw.allowedSpecialBets.billeteExtra && `Billete Extra ${draw.specialBilleteDigits || 5}`].filter(Boolean).join(' · ')}
                </p>
              </div>
              <PermissionGuard allowedRoles={['CEO']}>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateDraw(draw.id, { isActive: !draw.isActive })} className={cn("p-2 rounded-lg transition-all active:scale-90", draw.isActive ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-400")}>
                    {draw.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </button>
                  <button onClick={() => handleOpenModal(draw, 'special')} className="p-2 rounded-lg text-slate-500 hover:text-white transition-colors"><Edit2 size={16} /></button>
                  <button onClick={() => { if (window.confirm(`¿Estás seguro de que quieres eliminar el sorteo \"${draw.name}\"? Esta acción no se puede deshacer.`)) deleteDraw(draw.id); }} className="p-2 rounded-lg text-slate-600 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                </div>
              </PermissionGuard>
            </motion.div>
          ))}
          {specialDraws.length === 0 && <p className="py-6 text-center text-xs font-bold uppercase tracking-wider text-slate-600">No hay sorteos especiales</p>}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <DrawFormModal 
            draw={editingDraw} 
            drawType={modalDrawType}
            onClose={handleCloseModal} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};
