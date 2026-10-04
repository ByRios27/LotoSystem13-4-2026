import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore, Ticket, Entry } from '../store/useStore';
import { calculateEntryPrize } from '../utils/prizeCalculator';
import { cn, formatAMPM, sortDrawsChronologically, sortDrawsByScheduleDescending, formatCurrency, getPaleParts } from '../utils/helpers';
import { PinValidationModal } from './PinValidationModal';
import { 
  Trophy, 
  ChevronDown, 
  Save, 
  Trash2, 
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
  Lock as LockIcon,
  Sun,
  Waves,
  Edit2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PullToRefresh } from './PullToRefresh';
import { calculateTicketPayoutForDraw, calculateTicketSalesForDraw, getEntriesForDraw } from '../utils/ticketUtils';
import { getDrawPrizeCount, getDrawPrizeDigits, getPrizePositionLabel, getResultDigitsForPlay, getWinningPosition, hasCompleteDrawResults } from '../utils/drawUtils';

export const ResultsPage: React.FC = () => {
  const { draws, setResults, removeResults, tickets, currentUser, settings } = useStore();
  
  const [selectedDrawId, setSelectedDrawId] = useState<string | null>(null);
  const [isDrawListOpen, setIsDrawListOpen] = useState(false);
  const [isResultEditorOpen, setIsResultEditorOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  
  const [resultValues, setResultValues] = useState<string[]>(['', '', '']);
  const resultInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('Resultados guardados');

  const filteredDraws = useMemo(() => {
    const visibleDraws = draws.filter(draw => {
      const hasResults = hasCompleteDrawResults(draw);
      const hasSales = tickets.some(t => t.drawIds?.includes(draw.id));
      return hasResults || hasSales;
    });
    return sortDrawsByScheduleDescending(visibleDraws);
  }, [draws, tickets]);

  const drawFinancials = useMemo(() => new Map(draws.map((draw) => {
    const drawTickets = tickets.filter((ticket) => ticket.drawIds?.includes(draw.id));
    const totalSales = drawTickets.reduce((sum, ticket) => sum + calculateTicketSalesForDraw(ticket, draw.id), 0);
    const totalPrizes = hasCompleteDrawResults(draw)
      ? drawTickets.reduce((sum, ticket) => sum + calculateTicketPayoutForDraw(ticket, draw, settings), 0)
      : 0;
    return [draw.id, { totalSales, totalPrizes }];
  })), [draws, tickets, settings]);

  const drawsPendingResults = useMemo(
    () => sortDrawsChronologically(draws.filter((draw) => draw.isActive && !hasCompleteDrawResults(draw))),
    [draws]
  );

  const selectedDraw = useMemo(() => draws.find(d => d.id === selectedDrawId), [draws, selectedDrawId]);
  const resultCount = selectedDraw ? getDrawPrizeCount(selectedDraw) : 3;

  const isCEO = currentUser?.role === 'CEO';

  // Load existing results when draw is selected
  React.useEffect(() => {
    setResultValues(Array.from({ length: resultCount }, (_, index) => selectedDraw?.results?.[index] || ''));
    resultInputRefs.current = [];
  }, [selectedDraw, resultCount]);

  const handleSave = async () => {
    if (!isCEO || !selectedDrawId) return;
    const results = resultValues.slice(0, resultCount);
    if (results.length !== resultCount || results.some((result, index) => result.length !== (selectedDraw ? getDrawPrizeDigits(selectedDraw, index) : 2))) return;

    try {
      await setResults(selectedDrawId, results);
      setSuccessMessage('Resultados guardados');
      setShowSuccess(true);
      setSelectedDrawId(null);
      setIsResultEditorOpen(false);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving draw results:', error);
      alert('No se pudo guardar el resultado en Firestore. Verifica permisos y conexion.');
    }
  };

  const confirmDelete = async () => {
    if (!isCEO || !selectedDrawId) return;
    try {
      await removeResults(selectedDrawId);
      setResultValues(Array.from({ length: resultCount }, () => ''));
      setSelectedDrawId(null);
      setIsResultEditorOpen(false);
      setIsPinModalOpen(false);
      setSuccessMessage('Resultados eliminados');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2500);
    } catch (error) {
      console.error('Error removing draw results:', error);
      alert('No se pudieron eliminar los resultados en Firestore.');
    }
  };

  // Grid Data Calculation
  interface GridItem {
    amount: number;
    count: number;
    prize?: number;
    type?: string;
  }

  const gridData = useMemo(() => {
    if (!selectedDrawId) return null;
    
    const data: Record<string, GridItem> = {};
    
    // Initialize 00-99
    for (let i = 0; i < 100; i++) {
      data[i.toString().padStart(2, '0')] = { amount: 0, count: 0 };
    }

    const drawTickets = tickets.filter(t => t.drawIds?.includes(selectedDrawId));
    
    drawTickets.forEach(ticket => {
      getEntriesForDraw(ticket, selectedDrawId).forEach(entry => {
        const amountForDraw = entry.amount;
        const pieces = entry.pieces;

        if (entry.type === 'CHANCE') {
          const num = entry.number.slice(-2);
          if (data[num]) {
            data[num].amount += amountForDraw;
            data[num].count += pieces;
            
            if (selectedDraw && hasCompleteDrawResults(selectedDraw)) {
              const { prize: entryPrize } = calculateEntryPrize(entry, selectedDraw, useStore.getState().settings);
              if (entryPrize > 0) {
                data[num].prize = (data[num].prize || 0) + entryPrize;
              }
            }
          }
        } else if (entry.type === 'PALÉ') {
          const n1 = entry.number.substring(0, 2);
          const n2 = entry.number.substring(2, 4);
          if (data[n1]) {
            data[n1].amount += amountForDraw;
            data[n1].count += pieces;
          }
          if (data[n2]) {
            data[n2].amount += amountForDraw;
            data[n2].count += pieces;
          }
        } else if (entry.type === 'BILLETE') {
          const num = entry.number.slice(-2);
          if (data[num]) {
            data[num].amount += amountForDraw;
            data[num].count += pieces;
          }
        }
      });
    });

    // Mark winners if results exist
    if (selectedDraw && hasCompleteDrawResults(selectedDraw)) {
      selectedDraw.results?.forEach((result, index) => {
        const winningNumber = getResultDigitsForPlay(selectedDraw, result, 2, 'chance', index);
        if (data[winningNumber]) data[winningNumber].type = getWinningPosition(index);
      });
    }

    return data;
  }, [selectedDrawId, tickets, selectedDraw]);

  const stats = useMemo(() => {
    if (!selectedDrawId) return { sales: 0, prizes: 0, commission: 0, utility: 0 };
    
    const drawTickets = tickets.filter(t => t.drawIds?.includes(selectedDrawId));
    let sales = 0;
    let prizes = 0;
    let commission = 0;

    const draw = draws.find(d => d.id === selectedDrawId);
    if (!draw) return { sales: 0, prizes: 0, commission: 0, utility: 0 };

    const { users, settings } = useStore.getState();

    drawTickets.forEach(ticket => {
      const ticketSales = calculateTicketSalesForDraw(ticket, selectedDrawId);
      sales += ticketSales;
      
      const seller = users.find(u => u.sellerId === ticket.sellerId);
      const rate = seller ? seller.commission : settings.commissionRate;
      commission += (ticketSales * rate);

      if (hasCompleteDrawResults(draw)) {
        prizes += calculateTicketPayoutForDraw(ticket, draw, settings);
      }
    });
    
    return {
      sales,
      prizes,
      commission,
      utility: sales - commission - prizes
    };
  }, [selectedDrawId, tickets, draws]);

  const totalPieces = useMemo(() => {
    if (!selectedDrawId) return 0;
    const drawTickets = tickets.filter(t => t.drawIds?.includes(selectedDrawId));
    
    return drawTickets.reduce((sum, ticket) => {
      return sum + (getEntriesForDraw(ticket, selectedDrawId).reduce((eSum, e) => {
        if (e.type === 'CHANCE') return eSum + e.pieces;
        return eSum;
      }, 0) || 0);
    }, 0);
  }, [selectedDrawId, tickets]);

  const handleResultInput = (index: number, val: string) => {
    const requiredDigits = selectedDraw ? getDrawPrizeDigits(selectedDraw, index) : 2;
    const cleanVal = val.replace(/\D/g, '').slice(0, requiredDigits);
    setResultValues((previous) => previous.map((result, resultIndex) => resultIndex === index ? cleanVal : result));
    if (cleanVal.length === requiredDigits && index + 1 < resultCount) {
      resultInputRefs.current[index + 1]?.focus();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0B1220] text-white select-none overflow-hidden">
      <PullToRefresh 
        onRefresh={async () => { window.location.reload(); }}
        className="flex-1 no-scrollbar pb-24"
      >
        <div className="max-w-md mx-auto p-3 space-y-3">
          {/* Compact Action Card */}
          {isCEO && (
            <div 
              onClick={() => setIsDrawListOpen(true)}
              className="bg-brand-primary rounded-2xl p-4 shadow-lg flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all group overflow-hidden relative"
            >
              <div className="relative z-10">
                <h3 className="font-black text-xs text-white uppercase tracking-widest leading-none">Añadir Resultados</h3>
                <p className="text-[8px] text-white/70 font-bold mt-1 uppercase tracking-tight">Seleccionar sorteo para ingresar números</p>
              </div>
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white relative z-10">
                <Trophy size={16} />
              </div>
            </div>
          )}

          {/* Results List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Sorteos de Hoy</h3>
            </div>
            <div className="space-y-1.5">
              {filteredDraws.map((draw) => {
                const financials = drawFinancials.get(draw.id);
                const prizesExceedSales = !!financials && financials.totalPrizes > financials.totalSales;
                const hasResults = hasCompleteDrawResults(draw);
                const canEnterResults = isCEO && !hasResults;
                const openResultEditor = () => {
                  setSelectedDrawId(draw.id);
                  setIsResultEditorOpen(true);
                };

                return <div 
                  key={draw.id} 
                  role={canEnterResults ? 'button' : undefined}
                  tabIndex={canEnterResults ? 0 : undefined}
                  aria-label={canEnterResults ? `Ingresar resultados de ${draw.name}` : undefined}
                  onClick={canEnterResults ? openResultEditor : undefined}
                  onKeyDown={canEnterResults ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openResultEditor();
                    }
                  } : undefined}
                  className={cn(
                    "p-3 rounded-xl border transition-all flex flex-col gap-2 shadow-md group relative",
                    prizesExceedSales
                      ? "bg-red-700 border-red-400 shadow-red-950/40"
                      : selectedDrawId === draw.id ? "bg-[#121A2B] border-brand-primary/40 ring-1 ring-brand-primary/20" : "bg-[#121A2B] border-white/5",
                    canEnterResults && "cursor-pointer hover:border-brand-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/40"
                  )}
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <p className="min-w-0 truncate whitespace-nowrap text-[13px] font-black text-white leading-[15px]" title={draw.name}>{draw.name}</p>
                      <span className={cn("shrink-0 text-[10px] font-bold uppercase tracking-wide", prizesExceedSales ? "text-white" : "text-slate-400")}>{formatAMPM(draw.drawTime)}</span>
                    </div>
                    {hasResults && (financials?.totalPrizes || 0) > 0 && (
                      <p className="shrink-0 text-[9px] font-black text-yellow-200">
                        Premios ${formatCurrency(financials?.totalPrizes || 0)}
                      </p>
                    )}
                  </div>

                  <div className="flex min-w-0 items-center justify-between gap-2">
                    {hasResults ? (
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
                          {draw.results.map((r, i) => (
                            <div key={i} className={cn(
                              "h-8 min-w-8 shrink-0 rounded-lg px-1 flex items-center justify-center text-xs font-black border",
                              r.length > 6 && "min-w-[58px] text-[9px]",
                              "bg-white text-slate-900 border-white"
                            )}>
                              {r}
                            </div>
                          ))}
                        </div>
                        {isCEO && (
                          <div className="flex shrink-0 gap-1.5">
                            <button
                              aria-label={`Editar resultados de ${draw.name}`}
                              title="Editar resultados"
                              onClick={openResultEditor}
                              className={cn("w-8 h-8 rounded-lg flex items-center justify-center", prizesExceedSales ? "bg-white text-slate-900 hover:bg-slate-100" : "bg-white/5 text-slate-300 hover:text-white")}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              aria-label={`Eliminar resultados de ${draw.name}`}
                              title="Eliminar resultados"
                              onClick={() => {
                                setSelectedDrawId(draw.id);
                                setIsPinModalOpen(true);
                              }}
                              className={cn("w-8 h-8 rounded-lg flex items-center justify-center", prizesExceedSales ? "bg-red-950 text-white hover:bg-red-900" : "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20")}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                  ) : (
                    <span className="ml-auto text-[8px] font-black text-slate-400 uppercase tracking-widest">Pendiente</span>
                  )}
                  </div>
                </div>
              })}
            </div>
          </div>

          {/* Selected draw entry/edit modal */}
          {isCEO && isResultEditorOpen && selectedDraw && createPortal(
            <div className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center overflow-y-auto p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="my-auto w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0B1220] p-3 shadow-2xl space-y-2.5"
            >
              {/* Compact Draw Info */}
              <div className={cn(
                "rounded-2xl p-3 shadow-lg border flex items-center justify-between",
                stats.utility < 0 ? "bg-rose-500/10 border-rose-500/20" : "bg-[#121A2B] border-white/5"
              )}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-slate-400">
                    <Clock size={16} />
                  </div>
                  <div>
                    <h2 className="text-xs font-black text-white uppercase tracking-tight">{selectedDraw.name}</h2>
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{formatAMPM(selectedDraw.drawTime)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Fracciones</p>
                    <p className="text-base font-black text-white leading-none">
                      {Number.isInteger(totalPieces) ? totalPieces : totalPieces.toFixed(2)}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedDrawId(null);
                      setIsResultEditorOpen(false);
                    }}
                    className="w-8 h-8 rounded-lg bg-white/5 text-slate-500 hover:text-white flex items-center justify-center transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Results Input */}
              <div className="bg-[#121A2B] rounded-2xl p-4 border border-white/5 shadow-lg">
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
                  {resultValues.map((result, index) => {
                    const resultDigits = selectedDraw ? getDrawPrizeDigits(selectedDraw, index) : 2;
                    const filledClass = index === 0
                      ? 'bg-yellow-400 text-black border-yellow-400'
                      : index === 1
                        ? 'bg-blue-500 text-black border-blue-500'
                        : index === 2
                          ? 'bg-orange-500 text-black border-orange-500'
                          : 'bg-emerald-400 text-black border-emerald-400';
                    const focusClass = index === 0
                      ? 'focus:border-yellow-400/50'
                      : index === 1
                        ? 'focus:border-blue-500/50'
                        : index === 2
                          ? 'focus:border-orange-500/50'
                          : 'focus:border-emerald-400/50';
                    return (
                      <div key={index} className="flex min-w-0 flex-col items-center gap-1.5">
                        <span className="text-[7px] font-black uppercase tracking-widest text-slate-300">{getPrizePositionLabel(index)}</span>
                        <input
                          ref={(element) => { resultInputRefs.current[index] = element; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={resultDigits}
                          value={result}
                          onChange={(event) => handleResultInput(index, event.target.value)}
                          placeholder={'-'.repeat(resultDigits)}
                          className={cn(
                            "h-12 w-full min-w-0 rounded-xl border-2 text-center font-black transition-all outline-none",
                            resultDigits > 6 ? 'text-xs' : resultDigits > 4 ? 'text-sm' : 'text-lg',
                            result ? filledClass : cn('bg-[#0B1220] text-slate-500 border-white/5', focusClass)
                          )}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={resultValues.slice(0, resultCount).length !== resultCount || resultValues.slice(0, resultCount).some((result, index) => result.length !== (selectedDraw ? getDrawPrizeDigits(selectedDraw, index) : 2))}
                    onClick={handleSave}
                    className="flex-1 bg-brand-primary text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md shadow-brand-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Save size={14} />
                    {selectedDraw.results ? 'Actualizar' : 'Guardar'}
                  </button>
                  
                  {selectedDraw.results && (
                    <button 
                      onClick={() => {
                        setIsResultEditorOpen(false);
                        setIsPinModalOpen(true);
                      }}
                      className="w-12 h-10 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl flex items-center justify-center active:scale-[0.98] transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Stats Preview - Compact */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-[#121A2B] p-2 rounded-xl border border-white/5">
                  <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Ventas</p>
                  <p className="text-[10px] font-black text-white">${formatCurrency(stats.sales)}</p>
                </div>
                <div className="bg-[#121A2B] p-2 rounded-xl border border-white/5">
                  <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Comis</p>
                  <p className="text-[10px] font-black text-blue-400">${formatCurrency(stats.commission)}</p>
                </div>
                <div className="bg-[#121A2B] p-2 rounded-xl border border-white/5">
                  <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Premios</p>
                  <p className="text-[10px] font-black text-rose-400">${formatCurrency(stats.prizes)}</p>
                </div>
                <div className={cn(
                  "p-2 rounded-xl border",
                  stats.utility >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"
                )}>
                  <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Util</p>
                  <p className={cn(
                    "text-[10px] font-black",
                    stats.utility >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}>${formatCurrency(stats.utility)}</p>
                </div>
              </div>
            </motion.div>
            </div>,
            document.body
          )}
        </div>
      </PullToRefresh>

      {/* Draw Selection Modal */}
      <AnimatePresence>
        {isCEO && isDrawListOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawListOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-[#121A2B] w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] border-t sm:border border-white/10 shadow-2xl overflow-hidden relative z-10"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Seleccionar Sorteo</h3>
                  <button onClick={() => setIsDrawListOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                    <X size={24} />
                  </button>
                </div>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto no-scrollbar">
                  {drawsPendingResults.map((draw) => (
                    <div 
                      key={draw.id}
                      onClick={() => {
                        setSelectedDrawId(draw.id);
                        setIsResultEditorOpen(true);
                        setIsDrawListOpen(false);
                      }}
                      className={cn(
                        "p-4 rounded-2xl flex items-center justify-between border transition-all cursor-pointer",
                        selectedDrawId === draw.id 
                          ? "bg-brand-primary/10 border-brand-primary/30" 
                          : "bg-white/5 border-white/5 hover:bg-white/10"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          draw.results ? "bg-brand-primary/20 text-brand-primary" : "bg-white/10 text-slate-500"
                        )}>
                          <Clock size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white">{draw.name}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{formatAMPM(draw.drawTime)}</p>
                        </div>
                      </div>
                      {draw.results && (
                        <div className="flex gap-1">
                          {draw.results.map((r, i) => (
                            <span key={i} className="w-6 h-6 bg-brand-primary/20 text-brand-primary text-[10px] font-black rounded-lg flex items-center justify-center border border-brand-primary/20">
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {drawsPendingResults.length === 0 && (
                    <p className="py-8 text-center text-xs font-bold text-slate-500">
                      No hay sorteos activos pendientes de resultados.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-brand-primary px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-[100]"
          >
            <CheckCircle2 size={18} className="text-white" />
            <span className="text-xs font-black text-white uppercase tracking-widest">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <PinValidationModal 
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={confirmDelete}
        title="Eliminar Resultados"
        description="Confirma tu PIN para eliminar los resultados de este sorteo."
      />

    </div>
  );
};
