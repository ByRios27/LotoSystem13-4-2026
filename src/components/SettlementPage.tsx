import React, { useMemo, useRef, useState } from 'react';
import { useStore, Ticket } from '../store/useStore';
import { cn, formatCurrency, getBusinessDate } from '../utils/helpers';
import { Receipt, Share2 } from 'lucide-react';
import { SettlementReceipt } from './SettlementReceipt';
import { motion, AnimatePresence } from 'motion/react';
import { exportNodeAsPng } from '../utils/shareImage';
import { shareGeneratedImage } from '../utils/shareGeneratedImage';

export const SettlementPage: React.FC = () => {
  const { tickets, users, currentUser } = useStore();
  const isCEO = currentUser?.role === 'CEO';
  const [scope, setScope] = useState<string>('local');
  const settlementRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const otherUsers = useMemo(
    () => users.filter(u => u.id !== currentUser?.id).sort((a, b) => a.name.localeCompare(b.name)),
    [users, currentUser?.id]
  );
  const scopeUserId = scope === 'local' ? currentUser?.id : scope;
  const scopeLabel = scope === 'global'
    ? 'Global'
    : scope === 'local'
      ? (currentUser?.name || 'Administrador')
      : (users.find(u => u.id === scope)?.name || 'Usuario');

  const stats = useMemo(() => {
    const scoped = scope === 'global' && isCEO ? tickets : tickets.filter(t => t.userId === scopeUserId);
    const totalSales = scoped.reduce((sum, t) => sum + t.total, 0);
    const totalCommission = Number(scoped.reduce((sum, t) => sum + (t.commission || 0), 0).toFixed(2));
    const totalPrizes = scoped.reduce((sum, t) => sum + (t.totalPrize || 0), 0);
    const utility = Number((totalSales - totalCommission - totalPrizes).toFixed(2));
    return {
      sales: totalSales,
      prizes: totalPrizes,
      commission: totalCommission,
      netProfit: utility,
    };
  }, [tickets, scope, scopeUserId, isCEO, currentUser?.commission]);

  const isLiquidationPositive = stats.netProfit >= 0;
  const businessDate = getBusinessDate();

  const handleExportSettlement = async () => {
    if (!isCEO) return;
    setIsExporting(true);

    setTimeout(async () => {
      if (!settlementRef.current) {
        setIsExporting(false);
        return;
      }

      try {
        const dataUrl = await exportNodeAsPng(settlementRef.current, {
          pixelRatio: 4,
          style: {
            textRendering: 'geometricPrecision',
            WebkitFontSmoothing: 'antialiased',
          },
        });

        await shareGeneratedImage({
          dataUrl,
          fileName: `liquidacion-${businessDate}.png`,
          title: 'Liquidacion LottoPro',
          text: 'Reporte de liquidacion final',
          dialogTitle: 'Compartir liquidacion',
        });
      } catch (err) {
        console.error('Error sharing settlement:', err);
      } finally {
        setIsExporting(false);
      }
    }, 500);
  };

  return (
    <div className="h-full flex flex-col bg-[#0B1220] text-white overflow-hidden">
      {/* Hidden Export Container */}
      <div className="fixed left-[-9999px] top-0">
        <div ref={settlementRef}>
          <SettlementReceipt 
            operatorName={scopeLabel}
            date={businessDate}
            stats={{
              grossSales: stats.sales,
              prizes: stats.prizes,
              commission: stats.commission,
              netProfit: stats.netProfit
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 pb-24">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="min-w-0">
            <h2 className="text-sm font-black uppercase text-white">Cierre del día</h2>
            <p className="mt-1 text-[10px] font-bold text-slate-400">{new Date(`${businessDate}T12:00:00`).toLocaleDateString()}</p>
          </div>
          {isCEO && (
          <div className="flex shrink-0 items-center gap-2">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              aria-label="Liquidar usuario"
              className="h-7 rounded-lg border border-white/20 bg-[#0B1220] px-2 text-[10px] font-black uppercase tracking-widest text-slate-200 outline-none focus:border-brand-primary/80"
            >
              <option value="local">Mi cuenta</option>
              {otherUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              <option value="global">Todos</option>
            </select>
            <button
              type="button"
              aria-label={`Compartir liquidación de ${scopeLabel}`}
              title="Compartir liquidación"
              onClick={handleExportSettlement}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10 active:scale-95"
            >
              <Share2 size={16} />
            </button>
          </div>
          )}
        </div>

        <div className="space-y-1 px-1">
          <div className="flex items-center justify-between py-3">
            <span className="flex items-center gap-2 text-xs font-bold text-slate-300"><Receipt size={14} className="text-brand-primary" />Ventas brutas</span>
            <span className="text-sm font-black text-white">${formatCurrency(stats.sales)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/5 py-3">
            <span className="text-xs font-bold text-slate-300">Premios</span>
            <span className="text-sm font-black text-rose-300">−${formatCurrency(stats.prizes)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/5 py-3">
            <span className="text-xs font-bold text-slate-300">Comisión ({stats.sales > 0 ? `${(stats.commission / stats.sales * 100).toFixed(2)}%` : '0%'})</span>
            <span className="text-sm font-black text-blue-300">−${formatCurrency(stats.commission)}</span>
          </div>
        </div>

        <div className={cn(
          'flex items-center justify-between gap-3 rounded-xl border px-4 py-4',
          isLiquidationPositive ? 'border-emerald-400/20 bg-emerald-500/10' : 'border-rose-400/20 bg-rose-500/10'
        )}>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">Balance de liquidación</p>
            <p className="mt-1 text-[9px] font-bold text-slate-400">Ventas − premios − comisión</p>
          </div>
          <p className={cn('shrink-0 text-xl font-black', isLiquidationPositive ? 'text-emerald-300' : 'text-rose-300')}>
            {isLiquidationPositive ? '+' : '−'}${formatCurrency(Math.abs(stats.netProfit))}
          </p>
        </div>
      </div>

      {/* Exporting Overlay */}
      <AnimatePresence>
        {isExporting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center"
          >
            <div className="w-16 h-16 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-6" />
            <p className="text-white font-black text-sm uppercase tracking-widest animate-pulse">Generando Imagen...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
