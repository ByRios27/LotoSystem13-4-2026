import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Lock as LockIcon, 
  Wallet, 
  UserCog, 
  LogOut, 
  X,
  ChevronRight,
  Ticket,
  Archive as ArchiveIcon
} from 'lucide-react';
import { useStore, Page } from '../store/useStore';
import { cn } from '../utils/helpers';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { setCurrentPage, currentPage, currentUser, setCurrentUser } = useStore();

  const menuItems = [
    { id: 'winners', label: 'Ganadores', icon: Trophy },
    { id: 'closures', label: 'Cierres', icon: LockIcon },
    { id: 'archives', label: 'Archivos', icon: ArchiveIcon },
    { id: 'settlement', label: 'Liquidación', icon: Wallet },
    { id: 'settings', label: 'Configuración', icon: UserCog },
  ];

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      onClose();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
          />

          {/* Sidebar Content */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 250 }}
            className="fixed inset-y-0 left-0 w-[300px] bg-[#0B1220] border-r border-white/5 z-[101] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-brand-primary/20 flex items-center justify-center border border-brand-primary/30">
                  <Ticket className="text-brand-primary" size={22} />
                </div>
                <div>
                  <h2 className="text-white font-black text-xl leading-none">LottoPro</h2>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1.5">{currentUser?.role || 'Panel'}</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
              >
                <X size={20} />
              </button>
            </div>

            {/* Menu Items */}
            <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1.5">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id as Page)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-2xl transition-all group",
                    currentPage === item.id 
                      ? "bg-brand-primary/10 text-brand-primary border border-brand-primary/20 shadow-inner shadow-brand-primary/10" 
                      : "text-slate-300 hover:bg-white/5 hover:text-white border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center transition-all",
                      currentPage === item.id ? "bg-brand-primary/20 text-brand-primary" : "bg-white/5 group-hover:bg-white/10 text-slate-400 group-hover:text-white"
                    )}>
                      <item.icon size={20} />
                    </div>
                    <span className="font-bold text-base tracking-tight">{item.label}</span>
                  </div>
                  <ChevronRight size={18} className={cn(
                    "text-slate-600 transition-all",
                    currentPage === item.id ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
                  )} />
                </button>
              ))}
            </div>

            {/* Footer / Logout */}
            <div className="p-4 mt-auto border-t border-white/5">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-4 p-3 rounded-2xl text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-all group"
              >
                <div className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center transition-all",
                  "bg-red-500/10 text-red-400/80 group-hover:bg-red-500/20 group-hover:text-red-400"
                )}>
                  <LogOut size={20} />
                </div>
                <span className="font-bold text-base tracking-tight">Cerrar Sesión</span>
              </button>
              <p className="text-center text-[9px] font-bold text-slate-700 uppercase tracking-widest mt-4">
                LottoPro v2.5.0
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
