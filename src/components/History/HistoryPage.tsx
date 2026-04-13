import React, { useMemo, useState } from 'react';
import { useStore, Entry, Ticket } from '../../store/useStore';
import { HistoryHeaderSummary } from './HistoryHeaderSummary';
import { HistoryFilters, FilterType } from './HistoryFilters';
import { DrawHistoryCard } from './DrawHistoryCard';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart3, Share2, Layers, Check, X } from 'lucide-react';
import { TicketModal } from '../TicketModal';
import { sortDrawsByTime, getDrawStatus, getCustomerDisplayName } from '../../utils/helpers';
import { PullToRefresh } from '../PullToRefresh';
import { calculateTicketPayoutForDraw, calculateTicketSalesForDraw, getEntriesForDraw, getTicketSubtotalForDraw, normalizeTicketDrawEntries } from '../../utils/ticketUtils';

interface ShareOptionsProps {
  ticket: Ticket;
  onClose: () => void;
  onSelect: (ticket: Ticket) => void;
}

const ShareOptionsModal: React.FC<ShareOptionsProps> = ({ ticket, onClose, onSelect }) => {
  const [view, setView] = useState<'options' | 'select-draw'>('options');

  const handleShareFull = () => {
    onSelect(ticket);
  };

  const handleShareIndividual = (index: number) => {
    const drawId = ticket.drawIds[index];
    const drawName = ticket.drawNames[index];
    const individualTicket: Ticket = {
      ...ticket,
      drawIds: [drawId],
      drawNames: [drawName],
      drawEntries: normalizeTicketDrawEntries(ticket).filter((group) => group.drawId === drawId),
      entries: getEntriesForDraw(ticket, drawId),
      total: getTicketSubtotalForDraw(ticket, drawId),
    };
    onSelect(individualTicket);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#121A2B] w-full max-w-xs rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden"
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Opciones de Compartido</h3>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          {view === 'options' ? (
            <div className="space-y-3">
              <button 
                onClick={handleShareFull}
                className="w-full bg-brand-primary text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 active:scale-95 transition-transform"
              >
                <Layers size={16} />
                Compartir Ticket Completo
              </button>
              <button 
                onClick={() => setView('select-draw')}
                className="w-full bg-white/5 text-slate-300 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 active:bg-white/10 transition-colors"
              >
                <Share2 size={16} />
                Compartir por Sorteo
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Seleccione un sorteo:</p>
              <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                {ticket.drawNames.map((name, idx) => (
                  <button 
                    key={idx}
                    onClick={() => handleShareIndividual(idx)}
                    className="w-full bg-white/5 p-4 rounded-xl flex items-center justify-between border border-white/5 active:bg-brand-primary/10 active:border-brand-primary/30 transition-all group"
                  >
                    <span className="text-xs font-bold text-white group-active:text-brand-primary">{name}</span>
                    <div className="w-5 h-5 rounded-full border border-white/10 flex items-center justify-center group-active:border-brand-primary group-active:bg-brand-primary">
                      <Check size={10} className="text-white" />
                    </div>
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setView('options')}
                className="w-full mt-2 text-[10px] font-black text-slate-500 uppercase tracking-widest py-2"
              >
                Volver
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export const HistoryPage: React.FC = () => {
  const { tickets, draws } = useStore();
  const [activeFilter, setActiveFilter] = useState<FilterType>('TODO');
  const [expandedDrawId, setExpandedDrawId] = useState<string | null>(null);
  const [previewTicket, setPreviewTicket] = useState<Ticket | null>(null);
  const [shareOptionsTicket, setShareOptionsTicket] = useState<Ticket | null>(null);

  const handleShareClick = (ticket: Ticket) => {
    if (ticket.drawIds && ticket.drawIds.length > 1) {
      setShareOptionsTicket(ticket);
    } else {
      setPreviewTicket(ticket);
    }
  };

  // Group tickets by draw and calculate totals
  const drawHistory = useMemo(() => {
    const grouped = draws.map(draw => {
      // Get all tickets for this draw
      const drawTickets = tickets.filter(t => t.drawIds?.includes(draw.id));
      
      // Filter tickets by game type if filter is active
      const filteredTickets = activeFilter === 'TODO' 
        ? drawTickets 
        : drawTickets.filter(t => getEntriesForDraw(t, draw.id).some(e => e.type === activeFilter));

      const sortedTickets = [...filteredTickets].sort((a, b) => {
        const customerA = getCustomerDisplayName(a.customerName, a.sequenceNumber, a.id);
        const customerB = getCustomerDisplayName(b.customerName, b.sequenceNumber, b.id);
        if (customerA !== customerB) return customerA.localeCompare(customerB, 'es', { sensitivity: 'base' });
        return b.timestamp - a.timestamp;
      });

      const totalSold = sortedTickets.reduce((sum, t) => {
        return sum + calculateTicketSalesForDraw(t, draw.id);
      }, 0);
      
      let totalPrizes = 0;
      if (draw.results && draw.results.length === 3) {
        const { settings } = useStore.getState();
        sortedTickets.forEach(t => {
          totalPrizes += calculateTicketPayoutForDraw(t, draw, settings);
        });
      }

      const isActive = totalSold > 0;
      return {
        ...draw,
        totalSold,
        totalPrizes,
        tickets: sortedTickets,
        status: getDrawStatus(draw),
        isActive
      };
    }).filter(d => d.isActive);

    return sortDrawsByTime(grouped);
  }, [tickets, draws, activeFilter]);

  // Calculate global summary
  const summary = useMemo(() => {
    const totalSales = drawHistory.reduce((sum, d) => sum + d.totalSold, 0);
    const totalPrizes = drawHistory.reduce((sum, d) => sum + d.totalPrizes, 0);
    const totalCommission = tickets.reduce((sum, t) => sum + (t.commission || 0), 0);
    const utility = totalSales - totalPrizes;

    return {
      totalSales,
      totalCommission,
      totalPrizes,
      utility
    };
  }, [drawHistory, tickets]);

  const handleToggleExpand = (id: string) => {
    setExpandedDrawId(prev => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col h-full bg-[#0B1220] text-white select-none overflow-hidden">
      <PullToRefresh 
        onRefresh={async () => { window.location.reload(); }}
        className="flex-1 px-3 py-4 pb-24"
      >
        {/* Filters */}
        <HistoryFilters 
          activeFilter={activeFilter} 
          onFilterChange={(filter) => {
            setActiveFilter(filter);
          }} 
        />

        {/* Draw List */}
        <div className="space-y-0.5">
          <AnimatePresence mode="popLayout">
            {drawHistory.length > 0 ? (
              drawHistory.map((draw) => (
                <motion.div
                  key={draw.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <DrawHistoryCard 
                    draw={draw} 
                    isExpanded={expandedDrawId === draw.id}
                    onToggle={() => handleToggleExpand(draw.id)}
                    onShare={handleShareClick}
                  />
                </motion.div>
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 opacity-40"
              >
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3">
                  <BarChart3 size={24} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest">No hay ventas registradas</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </PullToRefresh>

      {/* Share Options Modal */}
      {shareOptionsTicket && (
        <ShareOptionsModal 
          ticket={shareOptionsTicket}
          onClose={() => setShareOptionsTicket(null)}
          onSelect={(ticket) => {
            setPreviewTicket(ticket);
            setShareOptionsTicket(null);
          }}
        />
      )}

      {/* Ticket Preview Modal */}
      {previewTicket && (
        <TicketModal 
          ticket={previewTicket} 
          onClose={() => setPreviewTicket(null)} 
        />
      )}
    </div>
  );
};
