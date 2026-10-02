import React, { useState, useMemo } from 'react';
import { Calendar, ChevronDown, Lock, BarChart3 } from 'lucide-react';
import { cn, formatAMPM, formatCurrency, getDrawStatus } from '../../utils/helpers';
import { Ticket, Entry, Draw, useStore } from '../../store/useStore';
import { calculateTicketPayoutForDraw, calculateTicketSalesForDraw, getEntriesForDraw } from '../../utils/ticketUtils';
import { motion, AnimatePresence } from 'motion/react';
import { StatsResultsHeader } from './StatsResultsHeader';
import { StatsNumberGrid } from './StatsNumberGrid';
import { StatsCombinationsSection } from './StatsCombinationsSection';
import { TicketsForNumberModal } from '../Sales/TicketsForNumberModal';

interface DrawStatsProps {
  draw: Draw;
  tickets: Ticket[];
}

export const StatsDrawCard: React.FC<DrawStatsProps> = ({ draw, tickets }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCombination, setSelectedCombination] = useState<Entry | null>(null);

  const { settings } = useStore();
  const stats = useMemo(() => {
    const drawTickets = tickets.filter(t => t.drawIds?.includes(draw.id));
    
    const pricePerTime = settings.pricePerTime || 1;

    const totalSoldMoney = drawTickets.reduce((sum, t) => sum + calculateTicketSalesForDraw(t, draw.id), 0);
    const totalFractions = totalSoldMoney / pricePerTime;

    let totalPrizes = 0;
    if (draw.results && draw.results.length === 3) {
      drawTickets.forEach(t => {
        totalPrizes += calculateTicketPayoutForDraw(t, draw, settings);
      });
    }

    const salesByNumber: { [number: string]: number } = {};
    const prizesByNumber: { [number: string]: number } = {};
    const combinationsMap: { [key: string]: Entry } = {};
    
    drawTickets.forEach(t => {
      getEntriesForDraw(t, draw.id).forEach(e => {
        const amountForDraw = e.amount;
        const pieces = e.pieces;
        
        if (e.type === 'CHANCE') {
          const num = e.number.length === 4 ? e.number.slice(-2) : e.number;
          salesByNumber[num] = (salesByNumber[num] || 0) + pieces;
          if (e.prize && e.prize > 0) {
            prizesByNumber[num] = (prizesByNumber[num] || 0) + e.prize;
          }
        } else if (e.type === 'PALÉ') {
          const key = `${e.type}-${e.number}`;
          if (combinationsMap[key]) {
            combinationsMap[key].amount = Number((combinationsMap[key].amount + amountForDraw).toFixed(2));
            (combinationsMap[key] as any).quantity = ((combinationsMap[key] as any).quantity || 0) + pieces;
            if (e.prize) {
              combinationsMap[key].prize = (combinationsMap[key].prize || 0) + e.prize;
            }
          } else {
            combinationsMap[key] = { ...e, amount: amountForDraw };
            (combinationsMap[key] as any).quantity = pieces;
          }
        } else if (e.type === 'BILLETE') {
          const key = `${e.type}-${e.number}`;
          if (combinationsMap[key]) {
            combinationsMap[key].amount = Number((combinationsMap[key].amount + amountForDraw).toFixed(2));
            (combinationsMap[key] as any).quantity = ((combinationsMap[key] as any).quantity || 0) + pieces;
            if (e.prize) {
              combinationsMap[key].prize = (combinationsMap[key].prize || 0) + e.prize;
            }
          } else {
            combinationsMap[key] = { ...e, amount: amountForDraw };
            (combinationsMap[key] as any).quantity = pieces;
          }
        }
      });
    });

    const combinations = Object.values(combinationsMap);
    const hasResults = !!draw.results && draw.results.length === 3;
    const isLoss = totalPrizes > totalSoldMoney;
    const isWinnerDraw = hasResults && totalPrizes > 0 && !isLoss;

    return {
      totalSoldMoney,
      totalFractions,
      totalPrizes,
      salesByNumber,
      prizesByNumber,
      combinations,
      isLoss,
      isWinnerDraw
    };
  }, [draw, tickets, settings]);

  return (
    <div className={cn(
      "rounded-[1.2rem] border transition-all duration-300 overflow-hidden mb-3",
      stats.isLoss
        ? "bg-red-700 border-red-400"
        : stats.isWinnerDraw
          ? "bg-[#0E1B14] border-green-500/30"
          : "bg-[#121A2B] border-[#1E293B]",
      isExpanded && !stats.isLoss && !stats.isWinnerDraw ? "border-brand-primary/30 shadow-[0_0_20px_rgba(22,163,74,0.1)]" : "",
      isExpanded && stats.isWinnerDraw ? "border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.15)]" : "",
      isExpanded && stats.isLoss ? "border-red-300 shadow-[0_0_20px_rgba(220,38,38,0.3)]" : ""
    )}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "p-3 flex items-center justify-between transition-colors cursor-pointer",
          stats.isLoss ? "active:bg-red-800" : stats.isWinnerDraw ? "active:bg-green-500/10" : "active:bg-white/5"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            className={stats.isLoss ? "text-white" : stats.isWinnerDraw ? "text-green-400" : "text-slate-500"}
          >
            <ChevronDown size={18} />
          </motion.div>
          
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className={cn("font-black text-sm tracking-tight leading-none truncate", stats.isLoss ? "text-red-100" : stats.isWinnerDraw ? "text-green-100" : "text-white")}>{draw.name}</h4>
              {getDrawStatus(draw) === 'closed' && <Lock size={10} className={cn("shrink-0", stats.isLoss ? "text-white" : stats.isWinnerDraw ? "text-green-500/60" : "text-slate-600")} />}
              <p className={cn(
                "shrink-0 text-[10px] font-bold uppercase tracking-widest leading-none",
                stats.isLoss ? "text-white" : stats.isWinnerDraw ? "text-green-400/70" : "text-slate-500"
              )}>
                {formatAMPM(draw.drawTime)}
              </p>
            </div>
          </div>
        </div>

        <div className={cn(
          "px-4 py-2 rounded-xl border shadow-inner text-center min-w-[80px]",
          stats.isLoss ? "bg-red-900 border-red-300" : stats.isWinnerDraw ? "bg-green-500/10 border-green-500/20" : "bg-[#0B1220] border-white/5"
        )}>
          <span className={cn(
            "text-[8px] font-black uppercase tracking-widest block mb-0.5",
            stats.isLoss ? "text-white" : stats.isWinnerDraw ? "text-green-400" : "text-slate-500"
          )}>FRACCIONES</span>
          <p className={cn("text-sm font-black leading-none tracking-tight", stats.isLoss ? "text-red-100" : stats.isWinnerDraw ? "text-green-100" : "text-white")}>
            {Number.isInteger(stats.totalFractions) ? stats.totalFractions : stats.totalFractions.toFixed(2)}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className={cn(
              "px-3 pb-6",
              stats.isLoss ? "bg-red-800" : stats.isWinnerDraw ? "bg-green-950/20" : "bg-black/20"
            )}>
              <div className="h-[1px] w-full bg-white/5 mb-4" />
              
              <StatsResultsHeader results={draw.results} />

              <StatsNumberGrid 
                drawId={draw.id}
                salesByNumber={stats.salesByNumber} 
                results={draw.results}
              />

                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-4 px-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm border border-white/15 bg-white/10" />
                  <span className="text-[9px] font-bold uppercase tracking-wide text-slate-200">Sin ventas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm border border-emerald-300/30" style={{ backgroundColor: 'rgba(22, 163, 74, 0.35)' }} />
                  <span className="text-[9px] font-bold uppercase tracking-wide text-slate-200">Venta baja</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm border border-emerald-200/50" style={{ backgroundColor: 'rgba(22, 163, 74, 0.9)' }} />
                  <span className="text-[9px] font-bold uppercase tracking-wide text-slate-200">Venta alta</span>
                </div>
              </div>

              <StatsCombinationsSection combinations={stats.combinations} onSelect={setSelectedCombination} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedCombination && (
        <TicketsForNumberModal
          drawId={draw.id}
          number={selectedCombination.number}
          entryType={selectedCombination.type}
          onClose={() => setSelectedCombination(null)}
        />
      )}
    </div>
  );
};
