import React, { useState } from 'react';
import { useStore, BilleteSettings, BilletePayouts } from '../../store/useStore';
import { Ticket, Save, AlertCircle, Info, ToggleLeft, ToggleRight, Award } from 'lucide-react';
import { cn } from '../../utils/helpers';
import { PermissionGuard } from './PermissionGuard';
import { motion } from 'motion/react';

const defaultBillete: BilleteSettings = {
  enabled: true,
  unitPrice: 1.00,
  globalLimitPerNumber: 5,
  payouts: {
    firstPrize: { exact4: 2000, exact3PrefixOrSuffix: 50, exact2PrefixOrSuffix: 3 },
    secondPrize: { exact4: 600, exact3PrefixOrSuffix: 20, exact2PrefixOrSuffix: 2 },
    thirdPrize: { exact4: 300, exact3PrefixOrSuffix: 10, exact2PrefixOrSuffix: 1 }
  }
};

export const BilleteSettingsSection: React.FC = () => {
  const { settings, updateSettings } = useStore();
  const [billete, setBillete] = useState<BilleteSettings>(settings.billete || defaultBillete);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    updateSettings({ billete });
    setTimeout(() => {
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    }, 500);
  };

  const updatePayout = (prizeKey: keyof BilleteSettings['payouts'], fieldKey: keyof BilletePayouts, value: string) => {
    const num = parseFloat(value) || 0;
    setBillete(prev => ({
      ...prev,
      payouts: {
        ...prev.payouts,
        [prizeKey]: {
          ...prev.payouts[prizeKey],
          [fieldKey]: num
        }
      }
    }));
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
            <div>
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Ajustes de Billete</h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Configura los límites, pagos y estado del billete.</p>
            </div>
             <PermissionGuard allowedRoles={['CEO']}>
                <div className="flex items-center justify-between form-group-inline p-0 m-0 border-none bg-transparent">
                    <label className='text-xs font-bold text-white'>Venta de Billetes</label>
                    <button type="button" onClick={() => setBillete(prev => ({...prev, enabled: !prev.enabled}))} className={cn("transition-all active:scale-90", billete.enabled ? "text-brand-primary" : "text-slate-700")}>
                        {billete.enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                </div>
          </PermissionGuard>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
             <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider px-1 mb-4">Límites y Precios</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className='form-group'>
                  <label>Precio Fijo por Billete</label>
                  <input type="number" value={billete.unitPrice} readOnly disabled />
                  <p className="text-xs text-slate-500 mt-2 px-1">El precio es fijo por unidad y no se puede modificar.</p>
              </div>
              <div className='form-group'>
                  <label>Límite Global por Número</label>
                  <input type="number" value={billete.globalLimitPerNumber} onChange={(e) => setBillete(prev => ({ ...prev, globalLimitPerNumber: parseInt(e.target.value, 10) || 0 }))} />
                   <p className="text-xs text-slate-500 mt-2 px-1">Cantidad máxima de billetes de un mismo número.</p>
              </div>
            </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider px-3 mb-3">Tabla de Premiación (Por Billete)</h4>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <PrizeCard 
                title="Primer Premio" 
                prizeKey="firstPrize" 
                payouts={billete.payouts.firstPrize} 
                onUpdate={updatePayout} 
                icon={<Award size={20}/>}
                colorClass="border-amber-400/20 bg-amber-400/10 text-amber-400"
            />
             <PrizeCard 
                title="Segundo Premio" 
                prizeKey="secondPrize" 
                payouts={billete.payouts.secondPrize} 
                onUpdate={updatePayout} 
                icon={<Award size={20}/>}
                colorClass="border-slate-400/20 bg-slate-400/10 text-slate-400"
            />
             <PrizeCard 
                title="Tercer Premio" 
                prizeKey="thirdPrize" 
                payouts={billete.payouts.thirdPrize} 
                onUpdate={updatePayout} 
                icon={<Award size={20}/>}
                colorClass="border-orange-600/20 bg-orange-600/10 text-orange-600"
            />
          </div>
        </div>

       <PermissionGuard allowedRoles={['CEO']}>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-brand-primary text-black h-14 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 active:scale-95 transition-all disabled:opacity-40"
          >
            <Save size={18} />
            {isSaving ? 'Guardando Cambios...' : 'Guardar Configuración de Billete'}
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

interface PrizeCardProps {
    title: string;
    prizeKey: keyof BilleteSettings['payouts'];
    payouts: BilletePayouts;
    onUpdate: (prizeKey: keyof BilleteSettings['payouts'], fieldKey: keyof BilletePayouts, value: string) => void;
    icon: React.ReactNode;
    colorClass: string;
}

const PrizeCard: React.FC<PrizeCardProps> = ({ title, prizeKey, payouts, onUpdate, icon, colorClass }) => {
    return (
        <div className={cn("border rounded-2xl", colorClass)}>
            <div className="flex items-center gap-3 p-4 border-b border-current">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-current/10">
                    {icon}
                </div>
                <h4 className="font-black text-sm uppercase tracking-wider text-white">{title}</h4>
            </div>
            <div className="p-4 space-y-3">
                <div className="form-group">
                    <label>4 Cifras Exactas</label>
                    <input type="number" value={payouts.exact4} onChange={(e) => onUpdate(prizeKey, 'exact4', e.target.value)} />
                </div>
                 <div className="form-group">
                    <label>3 Cifras (Inicio o Fin)</label>
                    <input type="number" value={payouts.exact3PrefixOrSuffix} onChange={(e) => onUpdate(prizeKey, 'exact3PrefixOrSuffix', e.target.value)} />
                </div>
                 <div className="form-group">
                    <label>2 Cifras (Inicio o Fin)</label>
                    <input type="number" value={payouts.exact2PrefixOrSuffix} onChange={(e) => onUpdate(prizeKey, 'exact2PrefixOrSuffix', e.target.value)} />
                </div>
            </div>
        </div>
    )
}
