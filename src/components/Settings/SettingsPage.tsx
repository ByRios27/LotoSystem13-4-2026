import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Clock, Users, Tag, Sparkles, Bluetooth, ShieldCheck } from 'lucide-react';
import { cn } from '../../utils/helpers';
import { DrawsSettingsSection } from './DrawsSettingsSection';
import { UsersSettingsSection } from './UsersSettingsSection';
import { SpecialPlaysSettingsSection } from './SpecialPlaysSettingsSection';
import { ChancePricesSettings } from './ChancePricesSettings';
import { ProfileSettingsSection } from './ProfileSettingsSection';
import { PrinterSettingsSection } from './PrinterSettingsSection';
import { motion, AnimatePresence } from 'motion/react';
import { PullToRefresh } from '../PullToRefresh';

type SettingsTab = 'draws' | 'users' | 'chances' | 'special' | 'devices' | 'profile';

export const SettingsPage: React.FC = () => {
  const [selectedTab, setActiveTab] = useState<SettingsTab>('draws');
  const currentUser = useStore((state) => state.currentUser);
  const isCEO = currentUser?.role === 'CEO';

  const tabs = [
    { id: 'draws', label: 'Sorteos', icon: Clock, ceoOnly: true },
    { id: 'users', label: 'Usuarios', icon: Users, ceoOnly: true },
    { id: 'chances', label: 'Chances', icon: Tag, ceoOnly: true },
    { id: 'special', label: 'Especiales', icon: Sparkles, ceoOnly: true },
    { id: 'devices', label: 'Dispositivos', icon: Bluetooth, ceoOnly: false },
    { id: 'profile', label: 'Mi Perfil', icon: ShieldCheck, ceoOnly: false },
  ].filter(tab => isCEO || !tab.ceoOnly);
  const activeTab: SettingsTab = tabs.some(tab => tab.id === selectedTab) ? selectedTab : (tabs[0].id as SettingsTab);

  return (
    <div className="flex flex-col h-full bg-[#0B1220] text-white overflow-hidden">
      <div className="px-4 py-3 bg-[#0B1220] border-b border-white/5">
        <div className="flex gap-1 p-1 bg-white/5 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={cn(
                "flex-1 min-w-[110px] flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                activeTab === tab.id ? "bg-brand-primary text-black shadow-lg shadow-brand-primary/20" : "text-slate-400 hover:text-white"
              )}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <PullToRefresh onRefresh={async () => window.location.reload()} className="flex-1 px-4 py-4 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'draws' && <DrawsSettingsSection />}
            {activeTab === 'users' && <UsersSettingsSection />}
            {activeTab === 'chances' && <ChancePricesSettings />}
            {activeTab === 'special' && <SpecialPlaysSettingsSection />}
            {activeTab === 'devices' && <PrinterSettingsSection />}
            {activeTab === 'profile' && <ProfileSettingsSection />}
          </motion.div>
        </AnimatePresence>

        <div className="mt-12 pt-6 border-t border-white/5 opacity-60 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <ShieldCheck size={12} className="text-brand-primary" />
            <span className="text-[9px] font-black uppercase tracking-wider">LottoPro Cloud v2.5.1</span>
          </div>
          <p className="text-[9px] font-bold text-brand-primary uppercase tracking-widest mb-1">
            Sesión: {currentUser?.name} ({currentUser?.role})
          </p>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
            La actividad en esta sección es monitoreada.
          </p>
        </div>
      </PullToRefresh>
    </div>
  );
};
