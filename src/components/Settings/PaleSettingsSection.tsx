import React, { useState } from 'react';
import { useStore, PaleSettings } from '../../store/useStore';
import { Zap, Save, AlertCircle, Info, ToggleLeft, ToggleRight } from 'lucide-react';
import { cn } from '../../utils/helpers';
import { PermissionGuard } from './PermissionGuard';
import { motion } from 'motion/react';

const defaultPale: PaleSettings = {
  enabled: true,
  minAmount: 0.10,
  maxAmountPerPlay: 5.00,
  globalLimitPerCombination: 5.00,
  payouts: {
    firstSecond: 1000,
    firstThird: 1000,
    secondThird: 200
  }
};

export const PaleSettingsSection: React.FC = () => {
  const { settings, updateSettings } = useStore();
  const [pale, setPale] = useState<PaleSettings>(settings.pale || defaultPale);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    updateSettings({ pale });
    setTimeout(() => {
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    }, 500);
  };

  const updateField = (field: keyof PaleSettings, value: any) => {
    setPale(prev => ({ ...prev, [field]: value }));
  };

  const updatePayout = (key: keyof PaleSettings['payouts'], value: string) => {
    const num = parseInt(value, 10) || 0;
    setPale(prev => ({ ...prev, payouts: { ...prev.payouts, [key]: num } }));
  };

  return (
    <div className="form-compact space-y-3">
        <div className="flex flex-col gap-2 px-2">
            <div>
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Ajustes de Palé</h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Configura los límites, pagos y estado del palé.</p>
            </div>
             <PermissionGuard allowedRoles={['CEO']}>
                <div className="flex items-center justify-between form-group-inline p-0 m-0 border-none bg-transparent">
                    <label className='text-xs font-bold text-white whitespace-nowrap mr-2'>Venta de Palés</label>
                    <button type="button" onClick={() => updateField('enabled', !pale.enabled)} className={cn("transition-all active:scale-90", pale.enabled ? "text-brand-primary" : "text-slate-700")}>
                        {pale.enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                </div>
          </PermissionGuard>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider px-1 mb-2">Límites y Montos</h4>
            <div className="space-y-2">
              <div className='form-group'>
                  <label>Monto Mínimo por Jugada</label>
                  <input type="number" value={pale.minAmount} onChange={(e) => updateField('minAmount', parseFloat(e.target.value) || 0)} />
              </div>
              <div className='form-group'>
                  <label>Monto Máximo por Jugada</label>
                  <input type="number" value={pale.maxAmountPerPlay} onChange={(e) => updateField('maxAmountPerPlay', parseFloat(e.target.value) || 0)} />
              </div>
              <div className='form-group'>
                  <label>Límite Global por Combinación</label>
                  <input type="number" value={pale.globalLimitPerCombination} onChange={(e) => updateField('globalLimitPerCombination', parseFloat(e.target.value) || 0)} />
              </div>
            </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider px-1 mb-2">Tabla de Pagos (Multiplicadores)</h4>
            <div className="grid grid-cols-3 gap-2">
              <div className='form-group text-center'>
                  <label>1ro y 2do</label>
                  <input type="number" value={pale.payouts.firstSecond} onChange={(e) => updatePayout('firstSecond', e.target.value)} className='text-center'/>
              </div>
              <div className='form-group text-center'>
                  <label>1ro y 3ro</label>
                  <input type="number" value={pale.payouts.firstThird} onChange={(e) => updatePayout('firstThird', e.target.value)} className='text-center'/>
              </div>
              <div className='form-group text-center'>
                  <label>2do y 3ro</label>
                  <input type="number" value={pale.payouts.secondThird} onChange={(e) => updatePayout('secondThird', e.target.value)} className='text-center'/>
              </div>
            </div>
        </div>

      <PermissionGuard allowedRoles={['CEO']}>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-brand-primary text-black h-11 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 active:scale-95 transition-all disabled:opacity-40"
          >
            <Save size={18} />
            {isSaving ? 'Guardando Cambios...' : 'Guardar Configuración de Palé'}
          </button>
      </PermissionGuard>

      {showSuccess && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-5 right-5 flex items-center gap-3 text-lime-400 bg-lime-400/10 p-4 rounded-2xl border border-lime-400/20 shadow-lg"
        >
          <AlertCircle size={18} />
          <span className="text-sm font-bold">Configuración guardada.</span>
        </motion.div>
      )}
    </div>
  );
};
