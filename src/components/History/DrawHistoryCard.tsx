import React from 'react';
import { ChevronDown, Lock } from 'lucide-react';
import { cn, formatAMPM, formatCurrency, getDrawStatus } from '../../utils/helpers';
import { DrawHistoryDetail } from './DrawHistoryDetail';
import { Ticket } from '../../store/useStore';
import { motion, AnimatePresence } from 'motion/react';

interface CardProps {
  draw: {
    id: string;
    name: string;
    drawTime: string;
    closeTimeSort?: number;
    digitsMode: number;
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
  const hasResults = !!draw.results && draw.results.length === 3;

  return (
    <div
      className={cn(
        'rounded-[1.2rem] border transition-all duration-300 overflow-hidden mb-1.5',
        'bg-[#121A2B] border-[#1E293B]',
        isExpanded ? 'border-brand-primary/30' : ''
      )}
    >
      <div
        onClick={onToggle}
        className={cn(
          'p-2.5 flex items-center justify-between transition-colors cursor-pointer',
          'active:bg-white/5'
        )}
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            className={'text-slate-500'}
          >
            <ChevronDown size={16} />
          </motion.div>

          <div
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center',
              'bg-brand-primary/10 text-brand-primary'
            )}
          >
            <span className="text-[9px] font-black">{draw.digitsMode}D</span>
          </div>

          <div className="ml-0.5">
            <div className="flex items-center gap-1">
              <h4
                className={cn(
                  'font-black text-[12px] tracking-tight leading-none',
                  'text-white'
                )}
              >
                {draw.name}
              </h4>
              {getDrawStatus(draw) === 'closed' && (
                <Lock size={9} className={'text-slate-600'} />
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p
                className={cn(
                  'text-[8px] font-bold uppercase tracking-widest',
                  'text-slate-500'
                )}
              >
                {formatAMPM(draw.drawTime)}
              </p>
              {draw.results && draw.results.length > 0 && (
                <div className="flex gap-1">
                  {draw.results.map((res, idx) => (
                    <span
                      key={idx}
                      className={cn(
                        'px-1 py-0.5 rounded-md flex items-center justify-center text-[7px] font-black border',
                        idx === 1
                          ? 'bg-slate-800 text-slate-400 border-white/5'
                          : 'bg-brand-primary/20 text-brand-glow border-brand-primary/20'
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

        <div
          className={cn(
            'px-3 py-1.5 rounded-xl border shadow-inner flex flex-col items-center justify-center min-w-[70px]',
            'bg-[#0B1220] border-white/5'
          )}
        >
          <p
            className={cn(
              'text-xs font-black leading-none tracking-tight',
              'text-white'
            )}
          >
            ${formatCurrency(draw.totalSold)}
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
            <div className={cn('px-2.5 pb-3', 'bg-black/20')}>
              <DrawHistoryDetail drawId={draw.id} tickets={draw.tickets} onShare={onShare} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
