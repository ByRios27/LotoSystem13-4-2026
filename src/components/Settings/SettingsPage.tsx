import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Clock, Users, Tag, Sparkles, Bluetooth, ShieldCheck, History, Zap, Lock as LockOut, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/helpers';
import { DrawsSettingsSection } from './DrawsSettingsSection';
import { UsersSettingsSection } from './UsersSettingsSection';
import { SpecialPlaysSettingsSection } from './SpecialPlaysSettingsSection';
import { ChancePricesSettings } from './ChancePricesSettings';
import { PinValidationModal } from '../PinValidationModal';
import { motion, AnimatePresence } from 'motion/react';
import { PullToRefresh } from '../PullToRefresh';

type SettingsTab = 'draws' | 'users' | 'chances' | 'special' | 'devices' | 'profile';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('draws');
  const { currentUser, resetSalesData, archiveTickets, updateUser } = useStore();
  const [isResetting, setIsResetting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [showPinForm, setShowPinForm] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinAction, setPinAction] = useState<'reset' | 'archive' | null>(null);

  const handleReset = () => {
    setPinAction('reset');
    setIsPinModalOpen(true);
  };

  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      await resetSalesData();
      alert('Todos los datos de ventas han sido eliminados con éxito.');
    } catch (error) {
      alert('Error al eliminar los datos de ventas. Por favor, inténtalo de nuevo.');
    } finally {
      setIsResetting(false);
      setPinAction(null);
    }
  };

  const handleArchiveClick = () => {
    setPinAction('archive');
    setIsPinModalOpen(true);
  };

  const handleConfirmArchive = async () => {
    setIsArchiving(true);
    try {
      await archiveTickets();
      alert('El cierre diario ha sido archivado correctamente.');
    } catch (error) {
      alert('Error al archivar el cierre. Por favor, inténtalo de nuevo.');
    } finally {
      setIsArchiving(false);
      setPinAction(null);
    }
  };

  const handleUpdatePin = async () => {
    if (!newPin || newPin.length < 4) {
      alert('El PIN debe contener entre 4 y 6 dígitos.');
      return;
    }
    if (currentUser) {
      try {
        await updateUser(currentUser.id, { pin: newPin });
        alert('PIN de seguridad actualizado con éxito.');
        setNewPin('');
        setShowPinForm(false);
      } catch (error) {
        alert('No se pudo actualizar el PIN. Inténtalo de nuevo.');
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0B1220] text-white overflow-hidden">
      <div className="px-4 py-3 bg-[#0B1220] border-b border-white/5">
        <div className="flex gap-1 p-1 bg-white/5 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar">
          {[
            { id: 'draws', label: 'Sorteos', icon: Clock },
            { id: 'users', label: 'Usuarios', icon: Users },
            { id: 'chances', label: 'Chances', icon: Tag },
            { id: 'special', label: 'Especiales', icon: Sparkles },
            { id: 'devices', label: 'Dispositivos', icon: Bluetooth },
            { id: 'profile', label: 'Mi Perfil', icon: ShieldCheck },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={cn(
                "flex-1 min-w-[110px] flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                activeTab === tab.id ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-slate-400 hover:text-white"
              )}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <PullToRefresh onRefresh={async () => window.location.reload()} className="flex-1 px-4 py-6 pb-24">
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
            {activeTab === 'devices' && (
                <div className="space-y-6">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest px-2">Gestión de Impresoras</h4>
                     <button 
                      onClick={() => alert('Función en desarrollo. Próximamente podrás conectar y gestionar tus impresoras Bluetooth.')}
                      className="w-full flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Bluetooth size={18} className="text-slate-400" />
                        <span className="text-sm font-bold">Conectar Impresora Bluetooth</span>
                      </div>
                      <ChevronRight size={16} className="text-slate-600" />
                    </button>
                </div>
            )}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-brand-primary/20 flex items-center justify-center text-brand-primary text-2xl font-black border border-brand-primary/30">
                      {currentUser?.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xl font-black">{currentUser?.name}</h3>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{currentUser?.role} • ID: {currentUser?.sellerId}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button 
                      onClick={() => setShowPinForm(prev => !prev)}
                      className="w-full flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <LockOut size={18} className="text-slate-400" />
                        <span className="text-sm font-bold">Cambiar PIN de Seguridad</span>
                      </div>
                      <ChevronRight size={16} className="text-slate-600" />
                    </button>

                    {showPinForm && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: '12px' }}
                        className="p-4 bg-black/20 rounded-2xl border border-white/10 space-y-4"
                      >
                        <input 
                          type="password"
                          placeholder="Nuevo PIN (4-6 dígitos)"
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value)}
                          maxLength={6}
                          className="w-full bg-[#0B1220] border-2 border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:border-brand-primary outline-none transition-all text-center tracking-widest"
                        />
                        <button 
                          onClick={handleUpdatePin}
                          className="w-full bg-brand-primary text-black py-3 rounded-xl font-black uppercase tracking-widest text-xs"
                        >
                          Actualizar PIN
                        </button>
                      </motion.div>
                    )}
                  </div>
                </div>

                {currentUser?.role === 'CEO' && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest px-2">Zona de Administrador</h4>
                    
                    <button 
                      onClick={handleArchiveClick}
                      disabled={isArchiving}
                      className="w-full flex items-center gap-4 p-4 bg-orange-400/10 rounded-2xl border border-orange-400/20 text-orange-400 hover:bg-orange-400/20 transition-all disabled:opacity-50"
                    >
                      <div className="w-10 h-10 rounded-xl bg-orange-400/20 flex items-center justify-center">
                        <History size={20} />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-black">Archivar Cierre del Día</p>
                        <p className="text-xs opacity-80 font-medium">Genera un registro histórico de las ventas del día.</p>
                      </div>
                    </button>

                    <button 
                      onClick={handleReset}
                      disabled={isResetting}
                      className="w-full flex items-center gap-4 p-4 bg-rose-400/10 rounded-2xl border border-rose-400/20 text-rose-400 hover:bg-rose-400/20 transition-all disabled:opacity-50"
                    >
                      <div className="w-10 h-10 rounded-xl bg-rose-400/20 flex items-center justify-center">
                        <Zap size={20} />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-black">Reinicio de Ventas</p>
                        <p className="text-xs opacity-80 font-medium">Elimina todos los tickets. Acción irreversible.</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
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

      <PinValidationModal 
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPinAction(null);
        }}
        onSuccess={pinAction === 'reset' ? handleConfirmReset : handleConfirmArchive}
        title={pinAction === 'reset' ? 'Confirmar Reinicio de Ventas' : 'Confirmar Cierre Diario'}
        description={pinAction === 'reset' 
          ? 'Esta acción eliminará permanentemente todos los datos de ventas. Ingresa tu PIN para proceder.' 
          : 'Se generará un resumen histórico de las ventas del día. Ingresa tu PIN para confirmar.'}
      />
    </div>
  );
};
