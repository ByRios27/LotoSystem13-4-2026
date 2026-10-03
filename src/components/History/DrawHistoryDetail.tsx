import React, { useState, useMemo } from 'react';
import { Ticket, useStore } from '../../store/useStore';
import { calculateEntryPrize } from '../../utils/prizeCalculator';
import { cn, formatAMPM, formatCurrency, getDrawStatus, formatPlayNumberForDisplay, getCustomerDisplayName } from '../../utils/helpers';
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
  CheckCircle2,
  X
} from 'lucide-react';

interface DetailProps {
  drawId: string;
  tickets: Ticket[];
  onShare: (ticket: Ticket) => void;
  isLoss?: boolean;
}

export const DrawHistoryDetail: React.FC<DetailProps> = ({ drawId, tickets, onShare, isLoss }) => {
  const { deleteTicket, setReusedTicket, setEditingTicket, setEditingDrawIds, setCurrentPage: setGlobalPage } = useStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);
  const [deleteOptionsTicket, setDeleteOptionsTicket] = useState<Ticket | null>(null);
  const [selectedDeleteDrawIds, setSelectedDeleteDrawIds] = useState<string[]>([]);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState('');
  const [editOptionsTicket, setEditOptionsTicket] = useState<Ticket | null>(null);
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

  const getEditableDrawIds = (ticket: Ticket): string[] => (ticket.drawIds || (ticket.drawId ? [ticket.drawId] : []))
    .filter((id) => {
      const draw = draws.find((item) => item.id === id);
      return !!draw && getDrawStatus(draw) === 'open';
    });

  const beginEdit = (ticket: Ticket, editableDrawIds: string[]) => {
    setReusedTicket(null);
    setEditingDrawIds(editableDrawIds);
    setEditingTicket(ticket);
    setGlobalPage('sales');
  };

  const handleEdit = (ticket: Ticket) => {
    const editableDrawIds = getEditableDrawIds(ticket);
    if (editableDrawIds.length === 0) return;
    if (editableDrawIds.length > 1 && ticket.drawIds.length > 1) {
      setEditOptionsTicket(ticket);
      return;
    }
    beginEdit(ticket, editableDrawIds);
  };

  const handleDeleteClick = (ticket: Ticket) => {
    if (ticket.drawIds?.length > 1) {
      const editableDrawIds = getEditableDrawIds(ticket);
      if (!editableDrawIds.includes(drawId)) return;
      setDeleteOptionsTicket(ticket);
      setSelectedDeleteDrawIds([drawId]);
      return;
    }
    setSelectedDeleteDrawIds([]);
    setTicketToDelete(ticket.id);
    setIsPinModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (ticketToDelete) {
      try {
        const result = await deleteTicket(ticketToDelete, selectedDeleteDrawIds.length > 0 ? selectedDeleteDrawIds : undefined);
        setTicketToDelete(null);
        setSelectedDeleteDrawIds([]);
        setIsPinModalOpen(false);
        setShowDeleteSuccess(true);
        setDeleteMessage(result.deleted
          ? 'Ticket eliminado.'
          : 'Se eliminaron las jugadas abiertas; los sorteos cerrados o con resultados se conservaron.');
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
          {deleteMessage}
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
          const editableDrawIds = getEditableDrawIds(ticket);
          const canEditCurrentDraw = editableDrawIds.includes(drawId);
          const canDeleteCurrentDraw = editableDrawIds.includes(drawId);
          
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
                  {canEditCurrentDraw && (
                    <button aria-label="Editar ticket" onClick={() => handleEdit(ticket)} className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-all", hasPrize ? "bg-white/15 text-white hover:bg-white/25" : "bg-white/5 text-slate-300 hover:bg-white/10")}>
                      <Edit2 size={13} />
                    </button>
                  )}
                  {canDeleteCurrentDraw && (
                    <button aria-label="Eliminar ticket" onClick={() => handleDeleteClick(ticket)} className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-all", hasPrize ? "bg-red-950 text-white hover:bg-red-900" : "bg-white/5 text-slate-300 hover:bg-rose-500/20 hover:text-rose-300")}>
                      <Trash2 size={13} />
                    </button>
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

      {deleteOptionsTicket && (() => {
        const ticketDrawIds = deleteOptionsTicket.drawIds || (deleteOptionsTicket.drawId ? [deleteOptionsTicket.drawId] : []);
        const editableIds = getEditableDrawIds(deleteOptionsTicket);
        const protectedDraws = ticketDrawIds
          .filter((id) => !editableIds.includes(id))
          .map((id) => draws.find((draw) => draw.id === id))
          .filter((draw): draw is NonNullable<typeof draw> => !!draw);

        return (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => { setDeleteOptionsTicket(null); setSelectedDeleteDrawIds([]); }}>
            <div className="w-full max-w-sm space-y-3 rounded-2xl border border-white/10 bg-[#121A2B] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Borrar ticket múltiple</h3>
                  <p className="mt-1 text-xs text-slate-300">Selecciona los sorteos abiertos que deseas borrar.</p>
                </div>
                <button type="button" onClick={() => { setDeleteOptionsTicket(null); setSelectedDeleteDrawIds([]); }} className="rounded-lg p-1 text-slate-500 hover:text-white"><X size={16} /></button>
              </div>

              <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-2.5 text-[11px] font-bold leading-relaxed text-amber-100">
                Los sorteos cerrados o con resultados están protegidos y no se borrarán.
              </p>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={editableIds.length > 0 && editableIds.every((id) => selectedDeleteDrawIds.includes(id))}
                  onChange={(event) => setSelectedDeleteDrawIds(event.target.checked ? editableIds : [])}
                  className="h-4 w-4 accent-emerald-500"
                />
                <span className="text-xs font-black uppercase tracking-widest text-white">Todos</span>
              </label>

              <div className="max-h-[42vh] space-y-1 overflow-y-auto">
                {editableIds.map((id) => {
                  const draw = draws.find((item) => item.id === id);
                  if (!draw) return null;
                  const checked = selectedDeleteDrawIds.includes(id);
                  return (
                    <label key={id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedDeleteDrawIds((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id])}
                        className="h-4 w-4 accent-emerald-500"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-white">{draw.name}</span>
                      <span className="shrink-0 text-[10px] font-semibold text-slate-400">{formatAMPM(draw.drawTime)}</span>
                    </label>
                  );
                })}
              </div>

              {protectedDraws.length > 0 && (
                <div className="space-y-1 rounded-xl border border-white/5 bg-black/20 p-2.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Se conservarán</p>
                  {protectedDraws.map((draw) => (
                    <p key={draw.id} className="truncate text-[10px] font-semibold text-slate-400">{draw.name} · {formatAMPM(draw.drawTime)}</p>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setDeleteOptionsTicket(null); setSelectedDeleteDrawIds([]); }} className="h-10 flex-1 rounded-xl bg-white/10 text-xs font-black uppercase tracking-wider text-white">Cancelar</button>
                <button
                  type="button"
                  disabled={selectedDeleteDrawIds.length === 0}
                  onClick={() => {
                    setTicketToDelete(deleteOptionsTicket.id);
                    setDeleteOptionsTicket(null);
                    setIsPinModalOpen(true);
                  }}
                  className="h-10 flex-1 rounded-xl bg-rose-500 text-xs font-black uppercase tracking-wider text-white disabled:opacity-40"
                >
                  Continuar ({selectedDeleteDrawIds.length})
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {editOptionsTicket && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setEditOptionsTicket(null)}>
          <div className="w-full max-w-xs space-y-3 rounded-2xl border border-white/10 bg-[#121A2B] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Editar ticket múltiple</h3>
                <p className="mt-1 text-xs text-slate-400">Los sorteos cerrados o con resultados se conservarán sin cambios.</p>
              </div>
              <button type="button" onClick={() => setEditOptionsTicket(null)} className="rounded-lg p-1 text-slate-500 hover:text-white"><X size={16} /></button>
            </div>
            <button
              type="button"
              onClick={() => {
                const ids = getEditableDrawIds(editOptionsTicket);
                setEditOptionsTicket(null);
                beginEdit(editOptionsTicket, [drawId].filter((id) => ids.includes(id)));
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left text-xs font-black uppercase tracking-wide text-white"
            >
              Editar solo {draws.find((draw) => draw.id === drawId)?.name || 'este sorteo'}
            </button>
            <button
              type="button"
              onClick={() => {
                const ids = getEditableDrawIds(editOptionsTicket);
                setEditOptionsTicket(null);
                beginEdit(editOptionsTicket, ids);
              }}
              className="w-full rounded-xl bg-brand-primary p-3 text-left text-xs font-black uppercase tracking-wide text-black"
            >
              Editar todos los sorteos abiertos
            </button>
          </div>
        </div>
      )}

      <PinValidationModal 
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setTicketToDelete(null);
          setSelectedDeleteDrawIds([]);
        }}
        onSuccess={handleConfirmDelete}
        title="Eliminar Ticket"
        description="Se borrarán solo las jugadas de sorteos abiertos y sin resultados. Los sorteos cerrados o con resultados se conservarán."
      />
    </div>
  );
};
