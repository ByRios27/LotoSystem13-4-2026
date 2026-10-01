import React from 'react';
import { cn } from '../../utils/helpers';

interface GridCellProps {
  number: string;
  amount: number;
  isWinner?: boolean;
  position?: '1er' | '2do' | '3er';
  maxAmount: number;
  onClick: () => void;
}

export const StatsGridCell: React.FC<GridCellProps> = React.memo(({ 
  number, 
  amount, 
  isWinner, 
  position, 
  maxAmount, 
  onClick 
}) => {
  const intensity = maxAmount > 0 ? (amount / maxAmount) : 0;

  const getBackgroundColor = () => {
    if (isWinner) return 'bg-brand-primary';
    if (intensity === 0) return 'bg-white/5';
    return `rgba(22, 163, 74, ${0.1 + intensity * 0.8})`;
  };

  const getTextColor = () => {
    if (isWinner) return 'text-white';
    if (intensity > 0.6) return 'text-white';
    return 'text-slate-300';
  };

  return (
    <button
      onClick={onClick}
      disabled={amount === 0}
      className={cn(
        'relative w-full aspect-square rounded-lg flex flex-col justify-center items-center shadow-inner transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        !isWinner && 'hover:ring-2 hover:ring-brand-primary/50'
      )}
      style={{ backgroundColor: getBackgroundColor() }}
    >
      <span className={cn('text-[13px] font-black tracking-tight leading-none', getTextColor())}>
        {number}
      </span>
      {amount > 0 && (
        <span className={cn(
          'text-[8px] font-bold mt-0.5',
          isWinner ? 'text-white/70' : intensity > 0.6 ? 'text-white/60' : 'text-slate-500'
        )}>
          x{amount}
        </span>
      )}
      {position && (
        <span className="absolute -top-1 -right-1.5 bg-yellow-400 text-black text-[7px] font-black px-1 py-0.5 rounded-full">
          {position}
        </span>
      )}
    </button>
  );
});
