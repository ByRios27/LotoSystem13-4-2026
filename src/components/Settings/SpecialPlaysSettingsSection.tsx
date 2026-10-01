import React, { useState } from 'react';
import { PaleSettingsSection } from './PaleSettingsSection';
import { BilleteSettingsSection } from './BilleteSettingsSection';
import { cn } from '../../utils/helpers';
import { Zap, Ticket } from 'lucide-react';

export const SpecialPlaysSettingsSection: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'pale' | 'billete'>('pale');

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
            <div>
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Jugadas Especiales</h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Configura los pagos para Palé y Billete.</p>
            </div>
        </div>
        
      <div className="flex gap-1 p-1 bg-white/5 rounded-2xl border border-white/5 mx-2">
        <button
          onClick={() => setActiveSubTab('pale')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
            activeSubTab === 'pale' ? "bg-brand-primary text-black shadow-lg shadow-brand-primary/20" : "text-slate-400 hover:text-white"
          )}
        >
          <Zap size={16} />
          Configuración de Palé
        </button>
        <button
          onClick={() => setActiveSubTab('billete')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
            activeSubTab === 'billete' ? "bg-brand-primary text-black shadow-lg shadow-brand-primary/20" : "text-slate-400 hover:text-white"
          )}
        >
          <Ticket size={16} />
          Configuración de Billete
        </button>
      </div>

      <div className="px-2">
        {activeSubTab === 'pale' ? <PaleSettingsSection /> : <BilleteSettingsSection />}
      </div>
    </div>
  );
};
