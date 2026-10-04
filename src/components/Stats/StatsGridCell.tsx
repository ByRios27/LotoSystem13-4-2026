import React from 'react';
import { cn } from '../../utils/helpers';
import { WinningPosition } from '../../store/useStore';

interface GridCellProps {
  number: string;
  amount: number;
  isWinner?: boolean;
  position?: WinningPosition;
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
    if (amount > 0) return `rgba(22, 163, 74, ${0.25 + intensity * 0.7})`;
    if (isWinner) return 'rgba(34, 197, 94, 0.8)';
    return 'rgba(255, 255, 255, 0.05)';
  };

  const getTextColor = () => {
    if (isWinner || intensity > 0.45) return 'text-white';
    return 'text-slate-300';
  };

  return (
    <button
      onClick={onClick}
      disabled={amount === 0}
      className={cn(
        'relative w-full aspect-square rounded flex flex-col justify-center items-center shadow-inner transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        isWinner ? 'ring-1 ring-emerald-300/70' : 'hover:ring-2 hover:ring-brand-primary/50'
      )}
      style={{ backgroundColor: getBackgroundColor() }}
    >
      <span className={cn('text-[10px] font-black tracking-tight leading-none', getTextColor())}>
        {number}
      </span>
      {amount > 0 && (
        <span className={cn(
          'text-[7px] font-bold leading-none mt-0.5',
          isWinner || intensity > 0.45 ? 'text-white/75' : 'text-slate-300'
        )}>
          x{amount}
        </span>
      )}
      {position && (
        <span className="absolute -top-0.5 -right-0.5 bg-yellow-300 text-black text-[6px] leading-none font-black px-0.5 py-0.5 rounded-full shadow-sm">
          {position}
        </span>
      )}
    </button>
  );
});
