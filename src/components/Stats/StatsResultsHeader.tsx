import React from 'react';
import { getPrizePositionLabel } from '../../utils/drawUtils';

interface ResultsHeaderProps {
  results?: string[];
}

export const StatsResultsHeader: React.FC<ResultsHeaderProps> = ({ results }) => {
  if (!results || results.length === 0) return null;

  return (
    <div className="mx-auto mb-2 grid w-full max-w-[360px] grid-cols-3 sm:grid-cols-5 gap-1.5 px-1">
      {results.map((result, index) => {
        const colors = [
          'bg-yellow-400/10 border-yellow-400/30 text-yellow-300',
          'bg-blue-500/10 border-blue-400/30 text-blue-300',
          'bg-orange-500/10 border-orange-400/30 text-orange-300',
        ];
        const color = colors[index] || 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300';
        return (
          <div key={index} className={`min-w-0 rounded-md border p-1.5 flex flex-col items-center justify-center ${color}`}>
            <span className="text-[7px] font-black uppercase tracking-wide">{getPrizePositionLabel(index)}</span>
            <span className={`max-w-full truncate font-black text-white leading-none tracking-tight ${result.length > 6 ? 'text-[9px]' : 'text-sm'}`}>{result || '--'}</span>
          </div>
        );
      })}
    </div>
  );
};
