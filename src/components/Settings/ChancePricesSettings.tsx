import React, { useState, useEffect } from 'react';
import { useStore, ChancePrice } from '../../store/useStore';
import { Plus, Trash2, Edit, Check, X, Star, AlertCircle, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateId } from '../../utils/helpers';
import { PermissionGuard } from './PermissionGuard';
import { cn } from '../../utils/helpers';

const defaultPayouts = { first: 60, second: 8, third: 4 };

export const ChancePricesSettings: React.FC = () => {
  const { settings, updateSettings } = useStore();
  const [isAdding, setIsAdding] = useState(false);

  const sortedPrices = [...(settings.chancePrices || [])].sort((a, b) => (a.isDefault ? -1 : 1));

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
            <div>
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Precios de Chances</h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Configura los valores y pagos de los chances.</p>
            </div>
            <PermissionGuard allowedRoles={['CEO']}>
                <button 
                    onClick={() => setIsAdding(true)}
                    className="bg-brand-primary text-black px-4 h-10 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-brand-primary/20 active:scale-95 transition-all"
                >
                    <Plus size={16} />
                    Añadir Precio
                </button>
            </PermissionGuard>
      </div>

      <AnimatePresence>
        {isAdding && (
            <PriceFormModal onClose={() => setIsAdding(false)} />
        )}
      </AnimatePresence>
      
      <div className="space-y-3">
        {sortedPrices.length > 0 ? sortedPrices.map(price => (
          <PriceItem key={price.id} price={price} />
        )) : (
            <div className='text-center py-16 opacity-50'>
                <Tag size={32} className='mx-auto text-slate-600 mb-3'/>
                <h3 className='font-bold text-slate-400 text-sm'>No Hay Precios de Chance</h3>
                <p className='text-xs text-slate-500 mt-1'>Añade tu primer precio para empezar a vender.</p>
            </div>
        )}
      </div>
    </div>
  );
};

// Price Item Component
interface PriceItemProps {
    price: ChancePrice;
}

const PriceItem: React.FC<PriceItemProps> = ({ price }) => {
    const { settings, updateSettings } = useStore();
    const [isEditing, setIsEditing] = useState(false);

    const handleDelete = () => {
        if (price.isDefault) {
            alert('No puedes eliminar el precio predeterminado.');
            return;
        }
        if (window.confirm(`¿Estás seguro de eliminar el precio "${price.name}"?`)) {
            const updatedPrices = settings.chancePrices.filter(p => p.id !== price.id);
            updateSettings({ ...settings, chancePrices: updatedPrices });
        }
    }

    const handleSetDefault = () => {
        const updatedPrices = settings.chancePrices.map(p => ({ ...p, isDefault: p.id === price.id }));
        updateSettings({ ...settings, chancePrices: updatedPrices });
    }

    return (
        <AnimatePresence>
        {isEditing ? (
             <PriceFormModal price={price} onClose={() => setIsEditing(false)} />
        ) : (
            <motion.div layout className="bg-white/5 rounded-2xl border border-white/10 p-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                        <button onClick={handleSetDefault} title="Marcar como predeterminado">
                            <Star size={20} className={cn("transition-all mt-0.5", price.isDefault ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600 hover:text-yellow-400')} />
                        </button>
                        <div>
                            <p className="font-bold text-base text-white">{price.name} <span className='font-mono text-sm text-slate-400'>(${price.value.toFixed(2)})</span></p>
                            <div className="flex gap-4 mt-1.5">
                                <p className="text-xs text-slate-400"><span className='font-bold text-slate-300'>1er:</span> ${price.payouts.first.toFixed(2)}</p>
                                <p className="text-xs text-slate-400"><span className='font-bold text-slate-300'>2do:</span> ${price.payouts.second.toFixed(2)}</p>
                                <p className="text-xs text-slate-400"><span className='font-bold text-slate-300'>3er:</span> ${price.payouts.third.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                    <PermissionGuard allowedRoles={['CEO']}>
                        <div className="flex items-center gap-1">
                           <button onClick={() => setIsEditing(true)} className="p-2.5 rounded-lg text-slate-500 hover:text-white transition-colors"><Edit size={16}/></button>
                           {!price.isDefault && <button onClick={handleDelete} className="p-2.5 rounded-lg text-slate-600 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>}
                        </div>
                    </PermissionGuard>
                </div>
            </motion.div>
        )}
        </AnimatePresence>
    )
}


// Price Form Modal
interface PriceFormModalProps {
    price?: ChancePrice;
    onClose: () => void;
}

const PriceFormModal: React.FC<PriceFormModalProps> = ({ price, onClose }) => {
    const { settings, updateSettings } = useStore();
    const [formData, setFormData] = useState({
        name: price?.name || '',
        value: price?.value.toString() || '',
        payouts: {
            first: price?.payouts.first.toString() || '60',
            second: price?.payouts.second.toString() || '8',
            third: price?.payouts.third.toString() || '4',
        }
    });
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name.includes('.')) {
            const [parent, child] = name.split('.') as ['payouts', 'first' | 'second' | 'third'];
            setFormData(prev => ({ ...prev, [parent]: { ...prev[parent], [child]: value }}));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!formData.name.trim() || !formData.value.trim() || !formData.payouts.first.trim() || !formData.payouts.second.trim() || !formData.payouts.third.trim()) {
            setError('Todos los campos son obligatorios.');
            return;
        }

        const value = parseFloat(formData.value);
        const payouts = {
            first: parseFloat(formData.payouts.first),
            second: parseFloat(formData.payouts.second),
            third: parseFloat(formData.payouts.third),
        };

        if (isNaN(value) || value <= 0 || isNaN(payouts.first) || isNaN(payouts.second) || isNaN(payouts.third)) {
            setError('Por favor, introduce valores numéricos válidos y positivos.');
            return;
        }
        
        setIsSaving(true);

        const newPrice: ChancePrice = {
            id: price?.id || generateId(),
            name: formData.name.trim(),
            value: value,
            payouts: payouts,
            isDefault: price?.isDefault || settings.chancePrices?.length === 0,
        };

        let updatedPrices;
        if (price) {
            updatedPrices = settings.chancePrices.map(p => p.id === price.id ? newPrice : p);
        } else {
            updatedPrices = [...(settings.chancePrices || []), newPrice];
        }

        updateSettings({ ...settings, chancePrices: updatedPrices });
        setIsSaving(false);
        onClose();
    }

    return (
         <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 250 }}
                className="bg-[#0B1220] w-full max-w-md rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative"
            >
            <div className="p-5 flex flex-col items-center justify-center text-center bg-brand-primary/10 border-b border-brand-primary/20">
                <Tag size={40} className="text-brand-primary mb-3"/>
                <h3 className="text-lg font-black text-white">{price ? 'Editar Precio' : 'Añadir Nuevo Precio'}</h3>
                <p className="text-xs text-slate-300 font-medium max-w-[300px]">Define un nombre, valor y los pagos correspondientes para este precio.</p>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar">
                <div className='form-group'>
                    <label>Nombre del Precio</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Ej: Chance Normal" />
                </div>
                <div className='form-group'>
                    <label>Valor por Chance ($)</label>
                    <input type="number" name="value" value={formData.value} onChange={handleChange} placeholder="Ej: 0.50" step="0.01"/>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Pagos por Posición (Multiplicador)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="form-group">
                          <label>1ra Posición</label>
                          <input type="number" name="payouts.first" value={formData.payouts.first} onChange={handleChange} placeholder="Ej: 60"/>
                      </div>
                      <div className="form-group">
                          <label>2da Posición</label>
                          <input type="number" name="payouts.second" value={formData.payouts.second} onChange={handleChange} placeholder="Ej: 8"/>
                      </div>
                       <div className="form-group">
                          <label>3ra Posición</label>
                          <input type="number" name="payouts.third" value={formData.payouts.third} onChange={handleChange} placeholder="Ej: 4"/>
                      </div>
                  </div>
                </div>

                {error && (
                    <motion.div 
                    initial={{opacity: 0, y: -10}}
                    animate={{opacity: 1, y: 0}}
                    className="flex items-center gap-3 text-rose-400 bg-rose-400/10 p-3 rounded-xl border border-rose-400/20 mt-2">
                    <AlertCircle size={18} />
                    <p className="text-xs font-bold uppercase tracking-tight">{error}</p>
                    </motion.div>
                )}

                <div className="flex gap-3 pt-2">
                    <button type="button" onClick={onClose} className="w-full bg-white/10 text-white/80 h-12 rounded-2xl font-black uppercase text-sm tracking-widest active:scale-95 transition-all">
                        Cancelar
                    </button>
                    <button type="submit" disabled={isSaving} className="w-full bg-brand-primary text-black h-12 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 active:scale-95 transition-all disabled:opacity-40">
                        {isSaving ? 'Guardando...' : (price ? 'Actualizar Precio' : 'Añadir Precio')}
                    </button>
                </div>
            </form>
            </motion.div>
      </div>
    );
}
