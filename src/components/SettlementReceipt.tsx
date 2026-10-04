import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../utils/helpers';

interface SettlementReceiptProps {
  operatorName?: string;
  date?: string;
  stats: {
    grossSales: number;
    prizes: number;
    commission: number;
    netProfit: number;
  };
}

export const SettlementReceipt: React.FC<SettlementReceiptProps> = ({ 
  operatorName, 
  date, 
  stats 
}) => {
  const isPositive = stats.netProfit >= 0;

  return (
    <div className="w-[600px] bg-white p-8 font-sans text-slate-900">
      <div className="flex items-start justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight">LottoPro</h1>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">Liquidación del día</p>
        </div>
        <div className="text-right text-xs font-bold text-slate-600">
          <p>{operatorName || 'Usuario'}</p>
          <p className="mt-1">{date || format(new Date(), 'yyyy-MM-dd', { locale: es })}</p>
        </div>
      </div>

      <div className="py-3">
        <Row label="Ventas brutas" value={stats.grossSales} />
        <Row label="Premios" value={stats.prizes} negative />
        <Row label="Comisión" value={stats.commission} negative />
      </div>

      <div className={`flex items-center justify-between rounded-lg px-4 py-4 text-white ${isPositive ? 'bg-emerald-700' : 'bg-rose-700'}`}>
        <span className="text-xs font-black uppercase tracking-widest">Balance de liquidación</span>
        <span className="text-2xl font-black">{isPositive ? '+' : '−'}${formatCurrency(Math.abs(stats.netProfit))}</span>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: number; negative?: boolean }> = ({ label, value, negative }) => (
  <div className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0">
    <span className="text-sm font-medium text-slate-600">{label}</span>
    <span className="text-sm font-bold text-slate-900">{negative ? '−' : ''}${formatCurrency(value)}</span>
  </div>
);
