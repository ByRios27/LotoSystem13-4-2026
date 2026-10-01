import React from 'react';

interface ResultsHeaderProps {
  results?: string[];
}

export const StatsResultsHeader: React.FC<ResultsHeaderProps> = ({ results }) => {
  if (!results || results.length === 0) return null;

  return (
    <div className="mx-auto flex w-full max-w-[220px] items-center justify-between gap-1.5 mb-2 px-1">
      {/* 1er */}
      <div className="flex-1 bg-yellow-400/10 border border-yellow-400/30 rounded-md p-1.5 flex flex-col items-center justify-center">
        <span className="text-[7px] font-black text-yellow-300 uppercase tracking-wide">1er</span>
        <span className="text-sm font-black text-white leading-none tracking-tight">{results[0] || '--'}</span>
      </div>

      {/* 2do */}
      <div className="flex-1 bg-blue-500/10 border border-blue-400/30 rounded-md p-1.5 flex flex-col items-center justify-center">
        <span className="text-[7px] font-black text-blue-300 uppercase tracking-wide">2do</span>
        <span className="text-sm font-black text-white leading-none tracking-tight">{results[1] || '--'}</span>
      </div>

      {/* 3ro */}
      <div className="flex-1 bg-orange-500/10 border border-orange-400/30 rounded-md p-1.5 flex flex-col items-center justify-center">
        <span className="text-[7px] font-black text-orange-300 uppercase tracking-wide">3ro</span>
        <span className="text-sm font-black text-white leading-none tracking-tight">{results[2] || '--'}</span>
      </div>
    </div>
  );
};
