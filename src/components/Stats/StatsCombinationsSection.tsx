import React from 'react';
import { Layers } from 'lucide-react';
import { Entry } from '../../store/useStore';
import { formatCurrency, formatPlayNumberForDisplay } from '../../utils/helpers';

interface CombinationsSectionProps {
  combinations: Entry[];
  onSelect: (combination: Entry) => void;
}

export const StatsCombinationsSection: React.FC<CombinationsSectionProps> = ({ combinations, onSelect }) => {
  if (combinations.length === 0) return null;

  return (
    <div className="mt-6 px-2">
      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
        <Layers size={12} className="text-brand-primary" />
        Combinaciones Vendidas
      </h3>
      
      <div className="grid grid-cols-2 gap-2">
        {combinations.map((combo, idx) => (
          <button
            type="button"
            key={idx} 
            onClick={() => onSelect(combo)}
            aria-label={`Ver tickets de ${combo.type} ${formatPlayNumberForDisplay(combo.number, combo.type)}`}
            className="w-full text-left bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between shadow-inner hover:bg-white/10 hover:border-brand-primary/30 active:bg-white/10 transition-colors"
          >
            <div className="flex flex-col">
              <span className="text-sm font-black text-white leading-none tracking-tight">{formatPlayNumberForDisplay(combo.number, combo.type)}</span>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">{combo.type}</span>
            </div>
            <div className="text-right">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                {combo.type === 'PALÉ' ? 'Monto' : 'Cant'}
              </span>
              <span className="text-xs font-black text-brand-primary leading-none">
                {combo.type === 'PALÉ'
                  ? `$${formatCurrency(combo.amount)}`
                  : Number.isInteger((combo as any).quantity)
                    ? (combo as any).quantity
                    : Number((combo as any).quantity || 0).toFixed(2)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
