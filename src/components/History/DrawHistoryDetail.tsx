import React, { useState, useMemo } from 'react';
import { Ticket, useStore } from '../../store/useStore';
import { calculateEntryPrize } from '../../utils/prizeCalculator';
import { cn, formatCurrency, getDrawStatus, formatPlayNumberForDisplay, getCustomerDisplayName } from '../../utils/helpers';
import { PinValidationModal } from '../PinValidationModal';
import { calculateTicketPayoutForDraw, getEntriesForDraw, getTicketSubtotalForDraw } from '../../utils/ticketUtils';
import { 
  Trash2, 
  Edit2, 
  Share2, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  Layers,
  FileText,
  Clock,
  CheckCircle2
} from 'lucide-react';

interface DetailProps {
  drawId: string;
  tickets: Ticket[];
  onShare: (ticket: Ticket) => void;
  isLoss?: boolean;
}

export const DrawHistoryDetail: React.FC<DetailProps> = ({ drawId, tickets, onShare, isLoss }) => {
  const { deleteTicket, setReusedTicket, setEditingTicket, setCurrentPage: setGlobalPage } = useStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const itemsPerPage = 5;
  
  const draws = useStore(state => state.draws);
  const settings = useStore(state => state.settings);

  const calculateEntryPrizeForDraw = (entry: any, drawId: string) => {
    const draw = draws.find(d => d.id === drawId);
    if (!draw) return { prize: 0, winningPosition: undefined };
    return calculateEntryPrize(entry, draw, settings);
  };

  const ticketsWithPrizes = useMemo(() => {
    return tickets.map(t => {
      const draw = draws.find(d => d.id === drawId);
      const drawSpecificPrize = draw ? calculateTicketPayoutForDraw(t, draw, settings) : 0;
      return {
        ...t,
        calculatedTotalPrize: drawSpecificPrize
      };
    });
  }, [tickets, drawId, draws, settings]);

  const hasDrawResults = useMemo(() => {
    const draw = draws.find((d) => d.id === drawId);
    return !!(draw?.results && draw.results.length === 3);
  }, [draws, drawId]);

  const sortedTickets = useMemo(() => {
    const sorted = [...ticketsWithPrizes];
    const getSortTime = (ticket: Ticket & { calculatedTotalPrize: number }) => {
      const createdAtValue = (ticket as any).createdAt;
      const createdAt = typeof createdAtValue === 'number' ? createdAtValue : 0;
      return createdAt > 0 ? createdAt : (ticket.timestamp || 0);
    };

    if (hasDrawResults) {
      sorted.sort((a, b) => {
        const aIsWinner = a.calculatedTotalPrize > 0;
        const bIsWinner = b.calculatedTotalPrize > 0;

        if (aIsWinner !== bIsWinner) return aIsWinner ? -1 : 1;
        return getSortTime(b) - getSortTime(a);
      });
    } else {
      sorted.sort((a, b) => getSortTime(b) - getSortTime(a));
    }
    return sorted;
  }, [ticketsWithPrizes, hasDrawResults]);

  const totalPages = Math.ceil(sortedTickets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentTickets = sortedTickets.slice(startIndex, startIndex + itemsPerPage);

  const handleReuse = (ticket: Ticket) => {
    setEditingTicket(null);
    setReusedTicket(ticket);
    setGlobalPage('sales');
  };

  const handleEdit = (ticket: Ticket) => {
    setReusedTicket(null);
    setEditingTicket(ticket);
    setGlobalPage('sales');
  };

  const handleDeleteClick = (id: string) => {
    setTicketToDelete(id);
    setIsPinModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (ticketToDelete) {
      try {
        await deleteTicket(ticketToDelete);
        setTicketToDelete(null);
        setIsPinModalOpen(false);
        setShowDeleteSuccess(true);
        window.setTimeout(() => setShowDeleteSuccess(false), 2500);
      } catch (error) {
        console.error('Ticket delete failed', error);
        alert('No se pudo eliminar el ticket.');
      }
    }
  };

  return (
    <div className="space-y-1.5">
      {showDeleteSuccess && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold text-emerald-300">
          <CheckCircle2 size={14} />
          Venta eliminada correctamente.
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-[#0B1220]/50 p-1 rounded-xl border border-white/5 mb-2">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1E293B] rounded-lg text-[9px] font-black uppercase tracking-tighter disabled:opacity-20 transition-all active:scale-95"
          >
            <ChevronLeft size={10} />
            Prev
          </button>
          
          <div className="text-center">
            <div className="flex items-center gap-1.5">
              <span className="bg-white/5 w-5 h-5 flex items-center justify-center rounded-md text-[9px] font-black text-white border border-white/5">{currentPage}</span>
              <span className="text-[8px] font-bold text-slate-500">/ {totalPages}</span>
            </div>
          </div>

          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-primary rounded-lg text-[9px] font-black uppercase tracking-tighter disabled:opacity-20 transition-all active:scale-95 shadow-lg shadow-brand-primary/20"
          >
            Next
            <ChevronRight size={10} />
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        {currentTickets.map((ticket) => {
          const hasPrize = ticket.calculatedTotalPrize > 0;
          
          return (
            <div 
              key={ticket.id} 
              className={cn(
                "bg-[#121A2B] rounded-lg border p-2 shadow-lg relative overflow-hidden group transition-all",
                hasPrize ? "bg-red-700 border-red-400" : "border-white/5"
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <h3 className="min-w-0 truncate whitespace-nowrap text-xs font-bold text-white tracking-tight leading-tight uppercase">
                    {getCustomerDisplayName(ticket.customerName, ticket.sequenceNumber, ticket.id)}
                  </h3>
                  <span className={cn("shrink-0 text-[9px] font-bold uppercase whitespace-nowrap", hasPrize ? "text-amber-200" : "text-brand-primary")}>V:{ticket.sellerId ?? '---'}</span>
                  {ticket.drawIds && ticket.drawIds.length > 1 && (
                    <div className="w-4 h-4 bg-brand-primary/20 rounded-md flex items-center justify-center text-brand-primary">
                      <Layers size={8} />
                    </div>
                  )}
                  {ticket.isPaid && (
                    <span className="px-1 py-0.5 bg-brand-primary/20 text-brand-primary text-[6px] font-black uppercase tracking-widest rounded border border-brand-primary/20">
                      Pagado
                    </span>
                  )}
                </div>
                  <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-right">
                    <span className="text-[11px] font-bold text-white">V ${formatCurrency(getTicketSubtotalForDraw(ticket, drawId))}</span>
                    {hasPrize && (
                      <span className="border-l border-white/25 pl-1.5 text-[11px] font-black text-yellow-200">P ${formatCurrency(ticket.calculatedTotalPrize)}</span>
                    )}
                    {ticket.drawIds && ticket.drawIds.length > 1 && (
                      <span className={cn("border-l pl-1.5 text-[8px] font-semibold", hasPrize ? "border-white/25 text-white" : "border-white/10 text-slate-400")}>
                        Total ${formatCurrency(ticket.total)}
                      </span>
                    )}
                </div>
              </div>

              <div className={cn("flex items-center justify-between gap-2 mb-1.5 border-t pt-1.5", hasPrize ? "border-white/25" : "border-white/5")}>
                <div className={cn("flex min-w-0 items-center gap-1.5 whitespace-nowrap", hasPrize ? "text-white" : "text-slate-300")}>
                  <Clock size={10} className={hasPrize ? "text-yellow-200" : "text-brand-primary"} />
                  <p className="text-[9px] font-semibold tracking-tight">
                    {new Date(ticket.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                  </p>
                  <p className={cn("truncate text-[8px] font-semibold tracking-tight uppercase", hasPrize ? "text-white" : "text-slate-400")}>
                    TX: {ticket.id.slice(0, 10).toUpperCase()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button aria-label="Compartir ticket" onClick={() => onShare(ticket)} className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-all", hasPrize ? "bg-white/15 text-white hover:bg-white/25" : "bg-white/5 text-slate-300 hover:bg-white/10")}>
                    <Share2 size={13} />
                  </button>
                  <button aria-label="Reutilizar ticket" onClick={() => handleReuse(ticket)} className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-all", hasPrize ? "bg-white/15 text-white hover:bg-white/25" : "bg-white/5 text-slate-300 hover:bg-white/10")}>
                    <RefreshCw size={13} />
                  </button>
                  {(!ticket.drawIds || !ticket.drawIds.some(id => {
                    const d = useStore.getState().draws.find(d => d.id === id);
                    return d ? getDrawStatus(d) === 'closed' : true;
                  })) && (
                    <>
                      <button aria-label="Editar ticket" onClick={() => handleEdit(ticket)} className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-all", hasPrize ? "bg-white/15 text-white hover:bg-white/25" : "bg-white/5 text-slate-300 hover:bg-white/10")}>
                        <Edit2 size={13} />
                      </button>
                      <button aria-label="Eliminar ticket" onClick={() => handleDeleteClick(ticket.id)} className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-all", hasPrize ? "bg-red-950 text-white hover:bg-red-900" : "bg-white/5 text-slate-300 hover:bg-rose-500/20 hover:text-rose-300")}>
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-x-2 gap-y-1">
                {getEntriesForDraw(ticket, drawId).map((entry, idx) => {
                  const { prize: entryPrizeInDraw } = calculateEntryPrizeForDraw(entry, drawId);
                  const isWinner = entryPrizeInDraw > 0;

                  return (
                    <div key={idx} className={cn("min-w-0 rounded-md px-1 py-0.5 leading-tight", isWinner && hasPrize && "bg-red-800")}>
                      <p className={cn(
                        "text-[13px] font-bold tracking-tight",
                        isWinner ? "text-yellow-100" : "text-white"
                      )}>
                        {formatPlayNumberForDisplay(entry.number, entry.type)} x{entry.pieces}
                      </p>
                      <div className={cn("text-[10px] font-medium mt-0.5", hasPrize ? "text-white" : "text-slate-300")}>
                        ${formatCurrency(entry.amount)}
                        {isWinner && (
                          <span className="text-amber-300 font-bold ml-1">+{formatCurrency(entryPrizeInDraw)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      
      {tickets.length === 0 && (
        <div className="py-10 text-center">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 opacity-10">
            <FileText size={24} />
          </div>
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-700">No hay registros</p>
        </div>
      )}

      <PinValidationModal 
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setTicketToDelete(null);
        }}
        onSuccess={handleConfirmDelete}
        title="Eliminar Ticket"
        description="Confirma tu PIN para eliminar esta venta."
      />
    </div>
  );
};
