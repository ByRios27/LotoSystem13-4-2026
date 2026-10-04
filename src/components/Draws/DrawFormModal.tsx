import React, { useState } from 'react';
import { useStore, Draw, SpecialPalePairRule, SpecialPrizeRule } from '../../store/useStore';
import { ToggleLeft, ToggleRight, AlertCircle, Clock, X, Tag } from 'lucide-react';
import { cn, generateId, formatAMPM, timeToMinutes, minutesToTime } from '../../utils/helpers';
import { motion } from 'motion/react';

interface ModalProps {
  draw: Draw | null;
  drawType?: 'normal' | 'special';
  onClose: () => void;
}

const createSpecialPrizeRule = (resultDigits: number, chancePayoutPerPiece: number): SpecialPrizeRule => ({
  resultDigits,
  chanceEnabled: true,
  chanceSegment: 'last',
  chancePayoutPerPiece,
  billeteEnabled: false,
  billeteSegment: 'last',
  billeteExtraEnabled: false,
  billeteExtraSegment: 'last',
  billeteExtraPayouts: Array(11).fill(0),
});

const buildSpecialPalePairs = (
  prizeCount: number,
  payouts: { firstSecond: number; firstThird: number; secondThird: number },
  previous: SpecialPalePairRule[] = [],
): SpecialPalePairRule[] => Array.from({ length: prizeCount }, (_, firstPrizeIndex) => firstPrizeIndex)
  .flatMap((firstPrizeIndex) => Array.from({ length: prizeCount - firstPrizeIndex - 1 }, (_, offset) => firstPrizeIndex + offset + 1)
    .map((secondPrizeIndex) => {
      const existing = previous.find((pair) => pair.firstPrizeIndex === firstPrizeIndex && pair.secondPrizeIndex === secondPrizeIndex);
      const multiplier = firstPrizeIndex === 0 && secondPrizeIndex === 1
        ? payouts.firstSecond
        : firstPrizeIndex === 0 && secondPrizeIndex === 2
          ? payouts.firstThird
          : firstPrizeIndex === 1 && secondPrizeIndex === 2
            ? payouts.secondThird
            : 0;
      const isStandardPair = secondPrizeIndex < 3;
      return {
        firstPrizeIndex,
        secondPrizeIndex,
        enabled: existing?.enabled ?? isStandardPair,
        multiplier: existing?.multiplier ?? multiplier,
      };
    }));

export const DrawFormModal: React.FC<ModalProps> = ({ draw, drawType = 'normal', onClose }) => {
  const { addDraw, updateDraw, currentUser, settings } = useStore();
  const activeDrawType = draw?.drawType || drawType;
  const [name, setName] = useState(draw?.name || '');
  const [drawTime, setDrawTime] = useState(draw?.drawTimeSort ? minutesToTime(draw.drawTimeSort) : '12:00');
  const [digitsMode, setDigitsMode] = useState<number>(draw?.digitsMode || 2);
  const [prizeCount, setPrizeCount] = useState(draw?.prizeCount || 3);
  const [chancePricePerPiece, setChancePricePerPiece] = useState(draw?.chancePricePerPiece ?? 1);
  const defaultChancePayouts = settings.chancePrices?.find((price) => price.isDefault)?.payouts || settings.chancePrices?.[0]?.payouts || { first: 60, second: 8, third: 4 };
  const defaultSpecialChancePayouts = [defaultChancePayouts.first, defaultChancePayouts.second, defaultChancePayouts.third, ...Array(7).fill(defaultChancePayouts.third)];
  const defaultPalePayouts = settings.pale?.payouts || { firstSecond: 1000, firstThird: 1000, secondThird: 200 };
  const makeExistingSpecialPrizeRule = (index: number): SpecialPrizeRule => {
    const defaultRule = createSpecialPrizeRule(draw?.digitsMode || 2, defaultSpecialChancePayouts[index] ?? defaultChancePayouts.third);
    return {
      ...defaultRule,
      chanceEnabled: draw?.allowedSpecialBets?.chance !== false,
      chanceSegment: draw?.chanceMatchPosition || 'last',
      chancePayoutPerPiece: draw?.specialChancePayouts?.[index] ?? defaultRule.chancePayoutPerPiece,
      billeteEnabled: draw?.allowedSpecialBets?.billete ?? false,
      billeteSegment: draw?.billeteMatchPosition || 'last',
    };
  };
  const [specialPrizeRules, setSpecialPrizeRules] = useState<SpecialPrizeRule[]>(() => Array.from({ length: draw?.prizeCount || 3 }, (_, index) => draw?.specialPrizeRules?.[index] || makeExistingSpecialPrizeRule(index)));
  const [specialBilleteDigits, setSpecialBilleteDigits] = useState(draw?.specialBilleteDigits || 5);
  const [specialPalePairs, setSpecialPalePairs] = useState<SpecialPalePairRule[]>(() => buildSpecialPalePairs(draw?.prizeCount || 3, defaultPalePayouts, draw?.specialPalePairs));
  const [specialChancePayouts, setSpecialChancePayouts] = useState<number[]>(draw?.specialChancePayouts || defaultSpecialChancePayouts);
  const [chanceMatchPosition, setChanceMatchPosition] = useState<'first' | 'last'>(draw?.chanceMatchPosition || 'last');
  const [billeteMatchPosition, setBilleteMatchPosition] = useState<'first' | 'last'>(draw?.billeteMatchPosition || 'last');
  const [paleEnabled, setPaleEnabled] = useState(draw?.allowedSpecialBets?.pale ?? true);
  const [billeteEnabled, setBilleteEnabled] = useState(draw?.allowedSpecialBets?.billete ?? false);
  const [closeTime, setCloseTime] = useState(
    draw?.closeTime || minutesToTime((timeToMinutes(draw?.drawTimeSort ? minutesToTime(draw.drawTimeSort) : '12:00') - 3 + 1440) % 1440)
  );
  const [isActive, setIsActive] = useState(draw?.isActive ?? true);
  const [error, setError] = useState('');

  const handlePrizeCountChange = (count: number) => {
    setPrizeCount(count);
    setSpecialPrizeRules((previous) => Array.from({ length: count }, (_, index) => previous[index] || createSpecialPrizeRule(digitsMode, defaultSpecialChancePayouts[index] ?? defaultChancePayouts.third)));
    setSpecialPalePairs((previous) => buildSpecialPalePairs(count, defaultPalePayouts, previous));
  };

  const updatePrizeRule = (index: number, update: Partial<SpecialPrizeRule>) => {
    setSpecialPrizeRules((previous) => previous.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...update } : rule));
  };

  const updatePalePair = (firstPrizeIndex: number, secondPrizeIndex: number, update: Partial<SpecialPalePairRule>) => {
    setSpecialPalePairs((previous) => previous.map((pair) => pair.firstPrizeIndex === firstPrizeIndex && pair.secondPrizeIndex === secondPrizeIndex ? { ...pair, ...update } : pair));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    if (activeDrawType === 'special' && (prizeCount < 1 || prizeCount > 10 || !Number.isInteger(prizeCount))) {
      setError('La cantidad de premios debe estar entre 1 y 10');
      return;
    }
    if (activeDrawType === 'special' && (!Number.isFinite(chancePricePerPiece) || chancePricePerPiece < 0)) {
      setError('El precio por pieza no puede ser negativo');
      return;
    }
    if (activeDrawType === 'special' && specialPrizeRules.slice(0, prizeCount).some((rule) => !Number.isInteger(rule.resultDigits) || rule.resultDigits < 2 || rule.resultDigits > 10)) {
      setError('Cada premio debe tener entre 2 y 10 cifras');
      return;
    }
    if (activeDrawType === 'special' && specialPrizeRules.slice(0, prizeCount).some((rule) => rule.chanceEnabled && (!Number.isFinite(rule.chancePayoutPerPiece) || rule.chancePayoutPerPiece < 0))) {
      setError('Los pagos de Chance no pueden ser negativos');
      return;
    }
    if (activeDrawType === 'special' && specialPrizeRules.slice(0, prizeCount).some((rule) => rule.billeteEnabled && rule.resultDigits < 4)) {
      setError('Billete requiere que el resultado tenga al menos 4 cifras');
      return;
    }
    if (activeDrawType === 'special' && specialPrizeRules.slice(0, prizeCount).some((rule) => rule.billeteExtraEnabled && rule.resultDigits < specialBilleteDigits)) {
      setError('Billete Extraordinario requiere que el resultado tenga al menos las cifras configuradas para la jugada');
      return;
    }
    if (activeDrawType === 'special' && specialPrizeRules.slice(0, prizeCount).some((rule) => rule.billeteExtraEnabled && rule.billeteExtraPayouts.slice(1, specialBilleteDigits + 1).some((payout) => !Number.isFinite(payout) || payout < 0))) {
      setError('Los pagos de Billete Extraordinario no pueden ser negativos');
      return;
    }
    if (activeDrawType === 'special' && specialPalePairs.some((pair) => pair.enabled && (!Number.isFinite(pair.multiplier) || pair.multiplier < 0))) {
      setError('Los multiplicadores de Palé no pueden ser negativos');
      return;
    }

    const drawTimeSort = timeToMinutes(drawTime);
    if (!closeTime) {
      setError('La hora de cierre es obligatoria');
      return;
    }
    const closeTimeSort = timeToMinutes(closeTime);

    const drawData = {
      drawType: activeDrawType,
      name,
      drawTime: drawTime,
      drawTimeSort,
      closeTime: closeTime,
      closeTimeSort,
      digitsMode: activeDrawType === 'special' ? (specialPrizeRules[0]?.resultDigits || digitsMode) : digitsMode,
      ...(activeDrawType === 'special' ? {
        prizeCount,
        chancePricePerPiece: Number(chancePricePerPiece.toFixed(2)),
        specialPrizeRules: specialPrizeRules.slice(0, prizeCount),
        specialPalePairs: paleEnabled ? specialPalePairs : [],
        specialBilleteDigits,
        allowedSpecialBets: {
          chance: specialPrizeRules.slice(0, prizeCount).some((rule) => rule.chanceEnabled),
          pale: paleEnabled,
          billete: specialPrizeRules.slice(0, prizeCount).some((rule) => rule.billeteEnabled),
          billeteExtra: specialPrizeRules.slice(0, prizeCount).some((rule) => rule.billeteExtraEnabled),
        },
      } : {
        allowedSpecialBets: {
          pale: paleEnabled,
          billete: digitsMode === 4 ? billeteEnabled : false
        },
      }),
      isActive,
      updatedAt: Date.now(),
      updatedBy: currentUser?.username || 'admin',
    };

    if (draw) {
      updateDraw(draw.id, drawData);
    } else {
      addDraw({
        id: generateId(),
        ...drawData,
        createdAt: Date.now(),
        createdBy: currentUser?.username || 'admin',
      } as Draw);
    }
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-[#0C1422] w-full max-w-[368px] rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative"
      >
        <div className="px-4 py-3 flex items-center justify-between bg-white/5 border-b border-white/10">
            <div className="flex items-center gap-3">
                <Tag size={16} className="text-brand-primary"/>
                <h3 className="font-black text-white text-sm uppercase tracking-wider">
                    {draw ? 'Editar Sorteo' : activeDrawType === 'special' ? 'Nuevo Sorteo Especial' : 'Nuevo Sorteo'}
                </h3>
            </div>
            <button onClick={onClose} className="p-1.5 bg-white/10 rounded-full active:scale-95 transition-all text-slate-300">
                <X size={16}/>
            </button>
        </div>

          <form onSubmit={handleSubmit} className="form-compact p-4 space-y-2.5 max-h-[70vh] overflow-y-auto no-scrollbar">
            <div className='form-group'>
              <label>Nombre del Sorteo</label>
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. La Primera, Lote-Real..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className='form-group'>
                <label>Hora del Sorteo</label>
                <input 
                  type="time"
                  value={drawTime}
                  onChange={(e) => setDrawTime(e.target.value)}
                />
              </div>
              <div className='form-group'>
                <label>Hora de Cierre</label>
                <input 
                  type="time"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                />
              </div>
            </div>

            {activeDrawType === 'normal' && <div className='form-group'>
              <label>Modalidad de Cifras</label>
              <div className="grid grid-cols-2 gap-2">
                {[2, 4].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDigitsMode(mode)}
                    className={cn(
                      "py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border",
                      digitsMode === mode 
                        ? "bg-brand-primary border-transparent text-black shadow-lg shadow-brand-primary/20" 
                        : "bg-transparent border-white/10 text-slate-300"
                    )}
                  >
                    {mode} Cifras
                  </button>
                ))}
              </div>
            </div>}

            {activeDrawType === 'special' ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="form-group">
                    <label>Cantidad de premios</label>
                    <select value={prizeCount} onChange={(event) => handlePrizeCountChange(Number(event.target.value))}>
                      {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Precio Chance por pieza</label>
                    <input type="number" min="0" step="0.01" value={chancePricePerPiece} onChange={(event) => setChancePricePerPiece(Number(event.target.value))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="px-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Reglas por premio</p>
                  {specialPrizeRules.slice(0, prizeCount).map((rule, index) => (
                    <div key={index} className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black uppercase tracking-wider text-white">{index + 1}º premio</p>
                        <select
                          aria-label={`Cifras del ${index + 1}º premio`}
                          value={rule.resultDigits}
                          onChange={(event) => updatePrizeRule(index, { resultDigits: Number(event.target.value) })}
                          className="w-24 rounded-lg border border-white/10 bg-[#0B1220] px-2 py-1.5 text-xs font-bold text-white outline-none focus:border-brand-primary/80"
                        >
                          {Array.from({ length: 9 }, (_, digitIndex) => digitIndex + 2).map((digits) => <option key={digits} value={digits} className="bg-[#0B1220] text-white">{digits} cifras</option>)}
                        </select>
                      </div>

                      <label className="flex items-center gap-2 text-[10px] font-bold text-slate-300">
                        <input type="checkbox" checked={rule.chanceEnabled} onChange={(event) => updatePrizeRule(index, { chanceEnabled: event.target.checked })} />
                        Chance de 2 cifras
                      </label>
                      {rule.chanceEnabled && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="form-group">
                            <label>Segmento Chance</label>
                            <select value={rule.chanceSegment} onChange={(event) => updatePrizeRule(index, { chanceSegment: event.target.value as 'first' | 'last' })}>
                              <option value="first">Primeras 2</option>
                              <option value="last">Últimas 2</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Pago por pieza</label>
                            <input type="number" min="0" step="0.01" value={rule.chancePayoutPerPiece} onChange={(event) => updatePrizeRule(index, { chancePayoutPerPiece: Number(event.target.value) })} />
                          </div>
                        </div>
                      )}

                      <label className="flex items-center gap-2 text-[10px] font-bold text-slate-300">
                        <input type="checkbox" disabled={rule.resultDigits < 4} checked={rule.billeteEnabled} onChange={(event) => updatePrizeRule(index, { billeteEnabled: event.target.checked })} />
                        Billete de 4 cifras {rule.resultDigits < 4 && '(requiere resultado de 4 cifras o más)'}
                      </label>
                      {rule.billeteEnabled && (
                        <div className="form-group">
                          <label>Segmento Billete</label>
                          <select value={rule.billeteSegment} onChange={(event) => updatePrizeRule(index, { billeteSegment: event.target.value as 'first' | 'last' })}>
                            <option value="first">Primeras 4 cifras</option>
                            <option value="last">Últimas 4 cifras</option>
                          </select>
                        </div>
                      )}

                      <label className="flex items-center gap-2 text-[10px] font-bold text-slate-300">
                        <input type="checkbox" disabled={rule.resultDigits < specialBilleteDigits} checked={rule.billeteExtraEnabled} onChange={(event) => updatePrizeRule(index, { billeteExtraEnabled: event.target.checked })} />
                        Billete Extraordinario de {specialBilleteDigits} cifras {rule.resultDigits < specialBilleteDigits && '(resultado demasiado corto)'}
                      </label>
                      {rule.billeteExtraEnabled && (
                        <div className="space-y-2">
                          <div className="form-group">
                            <label>Segmento Billete Extraordinario</label>
                            <select value={rule.billeteExtraSegment} onChange={(event) => updatePrizeRule(index, { billeteExtraSegment: event.target.value as 'first' | 'last' })}>
                              <option value="first">Primeras {specialBilleteDigits} cifras</option>
                              <option value="last">Últimas {specialBilleteDigits} cifras</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {Array.from({ length: specialBilleteDigits }, (_, digitIndex) => digitIndex + 1).map((matchedDigits) => (
                              <div className="form-group" key={matchedDigits}>
                                <label>{matchedDigits} cifra{matchedDigits === 1 ? '' : 's'} acertada{matchedDigits === 1 ? '' : 's'}</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={rule.billeteExtraPayouts[matchedDigits] ?? 0}
                                  onChange={(event) => {
                                    const payouts = [...rule.billeteExtraPayouts];
                                    payouts[matchedDigits] = Number(event.target.value);
                                    updatePrizeRule(index, { billeteExtraPayouts: payouts });
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="form-group">
                    <label>Cifras del Billete Extra</label>
                    <select value={specialBilleteDigits} onChange={(event) => setSpecialBilleteDigits(Number(event.target.value))}>
                      {Array.from({ length: 9 }, (_, index) => index + 2).map((digits) => <option key={digits} value={digits}>{digits} cifras</option>)}
                    </select>
                  </div>
                  <div className="form-group-inline">
                    <label>Permitir Palé</label>
                    <button type="button" onClick={() => setPaleEnabled(!paleEnabled)} className={cn("transition-all active:scale-90", paleEnabled ? "text-brand-primary" : "text-slate-700")}>
                      {paleEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                  </div>
                </div>

                {paleEnabled && (
                  <div className="space-y-1 rounded-xl border border-white/10 p-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Parejas de premios para Palé</p>
                    <p className="text-[9px] text-slate-500">Cada pareja compara las dos cifras de Chance definidas en sus puestos.</p>
                    {specialPalePairs.map((pair) => (
                      <div key={`${pair.firstPrizeIndex}-${pair.secondPrizeIndex}`} className="flex items-center gap-2 py-1">
                        <input type="checkbox" checked={pair.enabled} onChange={(event) => updatePalePair(pair.firstPrizeIndex, pair.secondPrizeIndex, { enabled: event.target.checked })} />
                        <span className="min-w-0 flex-1 text-[10px] font-bold text-white">{pair.firstPrizeIndex + 1}º + {pair.secondPrizeIndex + 1}º</span>
                        <input type="number" min="0" step="0.01" disabled={!pair.enabled} value={pair.multiplier} aria-label={`Multiplicador Palé ${pair.firstPrizeIndex + 1} y ${pair.secondPrizeIndex + 1}`} onChange={(event) => updatePalePair(pair.firstPrizeIndex, pair.secondPrizeIndex, { multiplier: Number(event.target.value) })} className="w-20" />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between form-group-inline">
                  <label>Sorteo Activo</label>
                  <button type="button" onClick={() => setIsActive(!isActive)} className={cn("transition-all active:scale-90", isActive ? "text-brand-primary" : "text-slate-700")}>
                    {isActive ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                  </button>
                </div>
              </div>
            ) : (
            <div className="pt-1 space-y-2">
                <div className="flex items-center justify-between form-group-inline">
                    <label>Permitir Jugada de Palé</label>
                    <button type="button" onClick={() => setPaleEnabled(!paleEnabled)} className={cn("transition-all active:scale-90", paleEnabled ? "text-brand-primary" : "text-slate-700")}>
                      {paleEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                </div>
                 {digitsMode === 4 && (
                  <div className="flex items-center justify-between form-group-inline">
                    <label>Permitir Jugada de Billete</label>
                     <button type="button" onClick={() => setBilleteEnabled(!billeteEnabled)} className={cn("transition-all active:scale-90", billeteEnabled ? "text-brand-primary" : "text-slate-700")}>
                      {billeteEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                </div>
                 )}
                <div className="flex items-center justify-between form-group-inline">
                    <label>Sorteo Activo</label>
                    <button type="button" onClick={() => setIsActive(!isActive)} className={cn("transition-all active:scale-90", isActive ? "text-brand-primary" : "text-slate-700")}>
                        {isActive ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                </div>
            </div>
            )}


            {error && (
              <div className="flex items-center gap-3 text-rose-400 bg-rose-400/10 p-3.5 rounded-2xl border border-rose-400/20">
                <AlertCircle size={18} />
                <p className="text-xs font-bold uppercase tracking-tight">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button 
                type="button"
                onClick={onClose}
                className="w-full bg-white/10 text-white/80 h-10 rounded-2xl font-black uppercase text-sm tracking-widest active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="w-full bg-brand-primary text-black h-10 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 active:scale-95 transition-all disabled:opacity-40"
              >
                {draw ? 'Actualizar Sorteo' : activeDrawType === 'special' ? 'Crear Sorteo Especial' : 'Crear Sorteo'}
              </button>
            </div>
          </form>
      </motion.div>
    </motion.div>
  );
};
