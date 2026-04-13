import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { formatCurrency } from '../utils/helpers';
import { History, Calendar, ChevronRight, FileText, Download } from 'lucide-react';
import { motion } from 'motion/react';

interface ArchiveEntry {
  id: string;
  timestamp: number;
  totalSales: number;
  totalPrizes: number;
  tickets: any[];
}

export const ArchivePage: React.FC = () => {
  const [archives, setArchives] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'archives'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ArchiveEntry));
      setArchives(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="h-full flex flex-col bg-[#0B1220] text-white overflow-hidden">
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : archives.length === 0 ? (
          <div className="bg-white/5 rounded-2xl p-12 flex flex-col items-center justify-center text-center border border-dashed border-white/10 opacity-40">
            <History size={32} className="text-slate-600 mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest">No hay archivos guardados</p>
          </div>
        ) : (
          archives.map((archive, index) => (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              key={archive.id}
              className="bg-[#121A2B] rounded-xl p-3 border border-white/5 flex items-center justify-between group hover:bg-white/[0.04] transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-400/10 flex items-center justify-center text-orange-400">
                  <Calendar size={18} />
                </div>
                <div>
                  <h4 className="text-[11px] font-black text-white uppercase tracking-tight">
                    {new Date(archive.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                      {archive.tickets.length} Tickets
                    </span>
                    <span className="w-0.5 h-0.5 rounded-full bg-slate-700" />
                    <span className="text-[8px] text-brand-primary font-black uppercase tracking-widest">
                      {formatCurrency(archive.totalSales)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-[7px] text-slate-500 font-black uppercase tracking-widest mb-0.5">Utilidad</p>
                  <p className="text-xs font-black text-emerald-400">${formatCurrency(archive.totalSales - archive.totalPrizes)}</p>
                </div>
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-600 group-hover:text-brand-primary group-hover:bg-brand-primary/10 transition-all">
                  <ChevronRight size={14} />
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
