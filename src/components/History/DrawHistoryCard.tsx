import React from 'react';
import { ChevronDown, Lock } from 'lucide-react';
import { cn, formatAMPM, formatCurrency, getDrawStatus } from '../../utils/helpers';
import { DrawHistoryDetail } from './DrawHistoryDetail';
import { Draw, Ticket } from '../../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { hasCompleteDrawResults } from '../../utils/drawUtils';

interface CardProps {
  draw: {
    id: string;
    name: string;
    drawTime: string;
    closeTimeSort?: number;
    digitsMode: number;
    drawType?: Draw['drawType'];
    prizeCount?: number;
    status: 'open' | 'closed';
    totalSold: number;
    totalPrizes: number;
    tickets: Ticket[];
    results?: string[];
  };
  isExpanded: boolean;
  onToggle: () => void;
  onShare: (ticket: Ticket) => void;
}

export const DrawHistoryCard: React.FC<CardProps> = ({ draw, isExpanded, onToggle, onShare }) => {
  const hasResults = hasCompleteDrawResults(draw);
  const prizesExceedSales = hasResults && draw.totalPrizes > draw.totalSold;

  return (
    <div
      className={cn(
        'rounded-[1.2rem] border transition-all duration-300 overflow-hidden mb-1.5',
        prizesExceedSales ? 'bg-red-700 border-red-400 shadow-lg shadow-red-950/40' : 'bg-[#121A2B] border-[#1E293B]',
        isExpanded && !prizesExceedSales ? 'border-brand-primary/30' : ''
      )}
    >
      <div
        onClick={onToggle}
        className={cn(
          'p-2.5 flex items-center justify-between transition-colors cursor-pointer',
          'active:bg-white/5'
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            className={prizesExceedSales ? 'text-white' : 'text-slate-500'}
          >
            <ChevronDown size={16} />
          </motion.div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h4
                className={cn(
                  'min-w-0 truncate whitespace-nowrap font-black text-[13px] tracking-tight leading-[15px]',
                  'text-white'
                )}
              >
                {draw.name}
              </h4>
              {getDrawStatus(draw) === 'closed' && (
                <Lock size={9} className={'text-slate-600 shrink-0'} />
              )}
              <p
                className={cn(
                  'shrink-0 text-[10px] font-bold uppercase tracking-wide',
                  prizesExceedSales ? 'text-white' : 'text-slate-400'
                )}
              >
                {formatAMPM(draw.drawTime)}
              </p>
            </div>
            <div className="flex min-w-0 max-w-full items-center gap-2 mt-1 min-h-[13.5px] overflow-x-auto whitespace-nowrap">
              {draw.results && draw.results.length > 0 && (
                <div className="flex shrink-0 gap-1">
                  {draw.results.map((res, idx) => (
                    <span
                      key={idx}
                      className={cn(
                        'min-w-6 shrink-0 px-1 py-0.5 rounded flex items-center justify-center text-[8px] font-black border',
                        res.length > 6 && 'min-w-[58px] text-[7px]',
                        'bg-white text-slate-900 border-white'
                      )}
                    >
                      {res}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="ml-1 flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 bg-[#0B1220] px-2 py-1.5">
          <span className="text-[9px] font-black text-white">V ${formatCurrency(draw.totalSold)}</span>
          {hasResults && draw.totalPrizes > 0 && (
            <span className="border-l border-white/15 pl-1.5 text-[9px] font-black text-yellow-200">P ${formatCurrency(draw.totalPrizes)}</span>
          )}
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
            <div className={cn('px-2.5 pt-2 pb-3', 'bg-black/20')}>
              <DrawHistoryDetail drawId={draw.id} tickets={draw.tickets} onShare={onShare} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
