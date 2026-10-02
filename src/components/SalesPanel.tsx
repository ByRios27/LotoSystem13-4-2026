import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore, Entry, Ticket, ChancePrice } from '../store/useStore';
import { cn, formatAMPM, generateId, getCurrentTimeMinutes, normalizePale, toCents, fromCents, formatCurrency, getDrawStatus, formatPlayNumberForDisplay, getCustomerDisplayName, sortDrawsByTime } from '../utils/helpers';
import {
  Menu, 
  LogOut, 
  User, 
  Calendar, 
  ChevronDown, 
  Delete, 
  RotateCcw, 
  Plus, 
  Zap,
  Ticket as TicketIcon,
  Check,
  ChevronUp,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TicketModal } from './TicketModal';
import { SaleCustomerModal } from './Sales/SaleCustomerModal';
import { QuickPasteModal } from './Sales/QuickPasteModal';
import { ReuseDrawSelectionModal } from './Sales/ReuseDrawSelectionModal';
import { PullToRefresh } from './PullToRefresh';
import { buildDrawEntries, cloneDrawEntryMap, normalizeTicketDrawEntries } from '../utils/ticketUtils';

type InputTarget = 'number' | 'amount';
type GameMode = 'CHANCE' | 'PALÉ' | 'BILLETE';

export const SalesPanel: React.FC = () => {
  const {
    draws, 
    addTicket, 
    updateTicket,
    reusedTicket, 
    setReusedTicket, 
    editingTicket,
    setEditingTicket,
    nextTicketSequence, 
    incrementSequence,
    settings,
    currentUser,
    lastSelectedDrawId,
    setLastSelectedDrawId,
  } = useStore();

  const activeDraws = useMemo(() => {
    const now = getCurrentTimeMinutes();
    if (now < 5) return [];
    return sortDrawsByTime(draws.filter(d => 
      d.isActive && 
      getDrawStatus(d) === 'open'
    ));
  }, [draws]);

  const [isReuseModalOpen, setIsReuseModalOpen] = useState(false);
  const [pendingReusedTicket, setPendingReusedTicket] = useState<Ticket | null>(null);

  const [selectedDrawIds, setSelectedDrawIds] = useState<string[]>(() => {
    if (lastSelectedDrawId && activeDraws.some((draw) => draw.id === lastSelectedDrawId)) {
      return [lastSelectedDrawId];
    }
    return activeDraws[0] ? [activeDraws[0].id] : [];
  });
  const [isMultiMode, setIsMultiMode] = useState(false);
  const [isDrawListOpen, setIsDrawListOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isQuickPasteOpen, setIsQuickPasteOpen] = useState(false);
  const [isInverted, setIsInverted] = useState(false);

  const [gameMode, setGameMode] = useState<GameMode>('CHANCE');
  const [activeInput, setActiveInput] = useState<InputTarget>('number');
  
  const [numberInput, setNumberInput] = useState('');
  const [amountInput, setAmountInput] = useState('1');
  
  const [drawEntryMap, setDrawEntryMap] = useState<Record<string, Entry[]>>({});
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingEntryDrawId, setEditingEntryDrawId] = useState<string | null>(null);
  const [showTicket, setShowTicket] = useState(false);
  const [lastTicket, setLastTicket] = useState<any>(null);
  const [prefilledCustomerName, setPrefilledCustomerName] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const saleSubmissionLockRef = useRef(false);

  // Chance Price state
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [isPriceSelectorOpen, setIsPriceSelectorOpen] = useState(false);
  const { chancePrices = [] } = settings;

  useEffect(() => {
    if (!selectedPriceId && chancePrices.length > 0) {
        const defaultPrice = chancePrices.find(p => p.isDefault) || chancePrices[0];
        setSelectedPriceId(defaultPrice.id);
    }
  }, [chancePrices, selectedPriceId]);

  const currentPricePerUnit = useMemo(() => {
    if (gameMode !== 'CHANCE' || chancePrices.length === 0) {
        return settings.pricePerTime || 1;
    }
    const selectedPrice = chancePrices.find(p => p.id === selectedPriceId) || chancePrices.find(p => p.isDefault) || chancePrices[0];
    return selectedPrice?.value || 1;
  }, [gameMode, settings.pricePerTime, chancePrices, selectedPriceId]);

  const resetEntryState = () => {
    setDrawEntryMap({});
    setEditingEntryDrawId(null);
  };

  const sanitizeEntryForNewSale = (entry: Entry): Entry => ({
    id: generateId(),
    number: entry.number,
    amount: Number(entry.amount),
    pieces: Number(entry.pieces),
    type: entry.type,
    status: 'pending',
    ...(entry.priceId ? { priceId: entry.priceId } : {}),
  });

  const getTargetDrawIds = (): string[] => {
    if (editingEntryId && editingEntryDrawId) return [editingEntryDrawId];
    if (isMultiMode) return selectedDrawIds;
    return selectedDrawIds[0] ? [selectedDrawIds[0]] : [];
  };
  
  const handleConfirmReuse = (drawIds: string[]) => {
    if (drawIds.length === 0 || !pendingReusedTicket) return;

    const normalizedGroups = normalizeTicketDrawEntries(pendingReusedTicket);
    const fallbackEntries = (normalizedGroups[0]?.entries || pendingReusedTicket.entries || []).map(sanitizeEntryForNewSale);

    setSelectedDrawIds(drawIds);
    setIsMultiMode(drawIds.length > 1);
    setPrefilledCustomerName('');
    setEditingEntryDrawId(null);
    setDrawEntryMap(
      drawIds.reduce<Record<string, Entry[]>>((acc, drawId) => {
        const matched = normalizedGroups.find((group) => group.drawId === drawId);
        acc[drawId] = (matched ? matched.entries : fallbackEntries).map(sanitizeEntryForNewSale);
        return acc;
      }, {})
    );

    setIsReuseModalOpen(false);
    setPendingReusedTicket(null);
  };

  const handleQuickPaste = (newEntries: Entry[]) => {
    const targetDrawIds = getTargetDrawIds();
    if (targetDrawIds.length === 0) return;

    setDrawEntryMap((prev) => {
      const next = { ...prev };

      targetDrawIds.forEach((drawId) => {
        const updated = [...(next[drawId] || [])];
        newEntries.forEach((entry) => {
          const existing = updated.find((item) => item.number === entry.number && item.type === entry.type);
          if (existing) {
            existing.pieces += entry.pieces;
            existing.amount = Number((existing.amount + entry.amount).toFixed(2));
          } else {
            updated.push({ ...entry, id: generateId() });
          }
        });
        next[drawId] = updated;
      });

      return next;
    });

    setIsQuickPasteOpen(false);
  };

  useEffect(() => {
    if (reusedTicket) {
      setEditingTicket(null);
      setPendingReusedTicket(reusedTicket);
      setIsReuseModalOpen(true);
      setReusedTicket(null);
    }
  }, [reusedTicket, setReusedTicket, setEditingTicket]);

  useEffect(() => {
    if (editingTicket) {
      const normalizedGroups = normalizeTicketDrawEntries(editingTicket);
      const nextDrawIds = normalizedGroups.map((group) => group.drawId);

      setSelectedDrawIds(nextDrawIds);
      setIsMultiMode(nextDrawIds.length > 1);
      setPrefilledCustomerName(editingTicket.customerName);
      setDrawEntryMap(cloneDrawEntryMap(normalizedGroups));
      setEditingEntryDrawId(null);
    }
  }, [editingTicket]);

  useEffect(() => {
    if (selectedDrawIds.length === 0 && activeDraws.length > 0) {
      setSelectedDrawIds([activeDraws[0].id]);
    }
  }, [activeDraws, selectedDrawIds]);

  useEffect(() => {
    const activeDrawIdSet = new Set(activeDraws.map((draw) => draw.id));

    setSelectedDrawIds((prev) => {
      const filtered = prev.filter((id) => activeDrawIdSet.has(id));
      if (filtered.length > 0) return filtered;
      if (lastSelectedDrawId && activeDrawIdSet.has(lastSelectedDrawId)) return [lastSelectedDrawId];
      return activeDraws[0] ? [activeDraws[0].id] : [];
    });
  }, [activeDraws, lastSelectedDrawId]);

  useEffect(() => {
    setLastSelectedDrawId(selectedDrawIds[0] || null);
  }, [selectedDrawIds, setLastSelectedDrawId]);

  const selectedDraws = useMemo(
    () => sortDrawsByTime(activeDraws.filter((draw) => selectedDrawIds.includes(draw.id))),
    [activeDraws, selectedDrawIds]
  );

  const mainDraw = useMemo(() => selectedDraws[0], [selectedDraws]);

  useEffect(() => {
    if (!mainDraw) return;
    const maxDigits = gameMode === 'PALÉ' ? 4 : mainDraw.digitsMode;
    if (numberInput.length > maxDigits) {
      setNumberInput(prev => prev.slice(0, maxDigits)); 
    }
    if (gameMode === 'PALÉ' && !mainDraw.allowedSpecialBets.pale) setGameMode('CHANCE');
    if (gameMode === 'BILLETE' && (mainDraw.digitsMode !== 4 || !mainDraw.allowedSpecialBets.billete)) setGameMode('CHANCE');
  }, [mainDraw, numberInput, gameMode]);

  const handleSetGameMode = (mode: GameMode) => {
    setGameMode(mode);
    setNumberInput('');
    setAmountInput('1');
    setActiveInput('number');
    setEditingEntryId(null);
  };

  const handleKeypadPress = (val: string) => {
    if (!mainDraw) return;
    if (val === '.') {
      if (gameMode !== 'PALÉ' || activeInput !== 'amount') return;
      setAmountInput((prev) => (prev.includes('.') ? prev : `${prev || '0'}.`));
      return;
    }

    const maxDigits = gameMode === 'CHANCE' ? 2 : (gameMode === 'PALÉ' ? 4 : mainDraw.digitsMode);

    if (activeInput === 'number') {
      if (numberInput.length < maxDigits) {
        const nextVal = numberInput + val;
        setNumberInput(nextVal);
        if (nextVal.length === maxDigits) {
          setTimeout(() => {
            setActiveInput('amount');
            if (amountInput === '1') setAmountInput('');
          }, 100);
        }
      }
    } else {
      setAmountInput((prev) => {
        if (gameMode === 'PALÉ' && prev.includes('.') && prev.split('.')[1].length >= 2) return prev;
        return prev === '0' || prev === '' ? val : prev + val;
      });
    }
  };

  const handleBackspace = () => {
    if (activeInput === 'number') {
      setNumberInput(prev => prev.slice(0, -1));
    } else {
      setAmountInput(prev => (prev.length > 1 ? prev.slice(0, -1) : '1'));
    }
  };

  const handleReset = () => {
    setNumberInput('');
    setAmountInput('1');
    setActiveInput('number');
    setEditingEntryId(null);
    setEditingEntryDrawId(null);
  };

  const handleEditEntryForDraw = (drawId: string, entry: Entry) => {
    setEditingEntryDrawId(drawId);
    setSelectedDrawIds([drawId]);
    setIsMultiMode(false);
    
    setEditingEntryId(entry.id || null);
    setNumberInput(entry.number);
    setAmountInput(String(entry.type === 'PALÉ' ? entry.amount : entry.pieces));
    setGameMode(entry.type);
    if (entry.type === 'CHANCE' && entry.priceId) {
      setSelectedPriceId(entry.priceId);
    }
    setActiveInput('amount');
  };

  const handleRemoveEntryForDraw = (drawId: string, entryId: string) => {
    setDrawEntryMap((prev) => ({
      ...prev,
      [drawId]: (prev[drawId] || []).filter((entry) => entry.id !== entryId),
    }));
    if (editingEntryId === entryId) handleReset();
  };

  const handleAddEntry = async () => {
    if (!mainDraw) return;

    const targetDrawIds = getTargetDrawIds();
    if (targetDrawIds.length === 0) return;

    if (gameMode === 'PALÉ') {
      const paleSettings = settings.pale || { enabled: false, minAmount: 0, maxAmountPerPlay: 0 };
      if (!paleSettings.enabled) {
        alert('El modo de juego Palé está desactivado en la configuración.');
        return;
      }
      if (numberInput.length !== 4) {
        alert('Para Palé, debes ingresar 2 números de 2 cifras (ej: 4578).');
        return;
      }
      const amount = parseFloat(amountInput);
      if (isNaN(amount) || amount < paleSettings.minAmount) {
        alert(`El monto mínimo para una jugada de Palé es $${formatCurrency(paleSettings.minAmount)}.`);
        return;
      }
      if (amount > paleSettings.maxAmountPerPlay) {
        alert(`El monto máximo por jugada de Palé es $${formatCurrency(paleSettings.maxAmountPerPlay)}.`);
        return;
      }
      const normalized = normalizePale(numberInput);

      setDrawEntryMap((prev) => {
        const next = { ...prev };
        targetDrawIds.forEach((drawId) => {
          const newEntries = [...(next[drawId] || [])];
          const existingIndex = newEntries.findIndex((e) => e.number === normalized && e.type === 'PALÉ');

          if (editingEntryId) {
            const idx = newEntries.findIndex((entry) => entry.id === editingEntryId);
            if (idx !== -1) {
              newEntries[idx] = { ...newEntries[idx], number: normalized, amount, pieces: amount, type: 'PALÉ' };
              next[drawId] = newEntries;
              return;
            }
          }

          if (existingIndex >= 0) {
            newEntries[existingIndex].amount += amount;
            newEntries[existingIndex].pieces = newEntries[existingIndex].amount;
          } else {
            newEntries.push({ id: generateId(), number: normalized, amount, pieces: amount, type: 'PALÉ', status: 'pending' });
          }
          next[drawId] = newEntries;
        });
        return next;
      });

    } else if (gameMode === 'BILLETE') {
      const billeteSettings = settings.billete || { enabled: false, unitPrice: 1.00 };
      if (!billeteSettings.enabled) {
        alert('El modo de juego Billete está desactivado en la configuración.');
        return;
      }
      if (mainDraw.digitsMode !== 4) {
        alert('El modo Billete solo está permitido en sorteos de 4 cifras.');
        return;
      }
      if (numberInput.length !== 4) {
        alert('Para Billete, debes ingresar un número de 4 cifras.');
        return;
      }
      const units = parseInt(amountInput, 10);
      if (isNaN(units) || units <= 0) {
        alert('Por favor, ingrese una cantidad de piezas válida.');
        return;
      }
      const finalAmount = Number((units * billeteSettings.unitPrice).toFixed(2));

      setDrawEntryMap((prev) => {
        const next = { ...prev };
        targetDrawIds.forEach((drawId) => {
          const newEntries = [...(next[drawId] || [])];
          const existingIndex = newEntries.findIndex((e) => e.number === numberInput && e.type === 'BILLETE');
          
          if (editingEntryId) {
            const idx = newEntries.findIndex((entry) => entry.id === editingEntryId);
            if (idx !== -1) {
              newEntries[idx] = { ...newEntries[idx], number: numberInput, amount: finalAmount, pieces: units, type: 'BILLETE' };
              next[drawId] = newEntries;
              return;
            }
          }

          if (existingIndex >= 0) {
            newEntries[existingIndex].pieces += units;
            newEntries[existingIndex].amount = Number((newEntries[existingIndex].pieces * billeteSettings.unitPrice).toFixed(2));
          } else {
            newEntries.push({ id: generateId(), number: numberInput, amount: finalAmount, pieces: units, type: 'BILLETE', status: 'pending' });
          }
          next[drawId] = newEntries;
        });
        return next;
      });

    } else { // CHANCE
      if (numberInput.length !== 2 || !amountInput) return;
      const units = parseInt(amountInput, 10);
      if (isNaN(units) || units <= 0) return;

      const price = chancePrices.find(p => p.id === selectedPriceId) || chancePrices.find(p => p.isDefault) || chancePrices[0];
      if (!price) {
        alert('No hay precios configurados para Chances. Por favor, configure los precios en Ajustes.');
        return;
      }
      const amount = Number((units * price.value).toFixed(2));

      setDrawEntryMap((prev) => {
        const next = { ...prev };
        targetDrawIds.forEach((drawId) => {
          const newEntries = [...(next[drawId] || [])];
          const existingIndex = newEntries.findIndex((e) => e.number === numberInput && e.type === 'CHANCE' && e.priceId === price.id);

          if (editingEntryId) {
            const idx = newEntries.findIndex((entry) => entry.id === editingEntryId);
            if (idx !== -1) {
              newEntries[idx] = { ...newEntries[idx], number: numberInput, amount, pieces: units, type: 'CHANCE', priceId: price.id };
              next[drawId] = newEntries;
              return;
            }
          }

          if (existingIndex >= 0) {
            newEntries[existingIndex].pieces += units;
            newEntries[existingIndex].amount += amount;
          } else {
            newEntries.push({ id: generateId(), number: numberInput, amount, pieces: units, type: 'CHANCE', priceId: price.id, status: 'pending' });
          }
          next[drawId] = newEntries;
        });
        return next;
      });
    }

    handleReset();
  };

  const previewGroups = useMemo(() => {
    return sortDrawsByTime(
      draws.filter((draw) => (drawEntryMap[draw.id] || []).length > 0)
    ).map((draw) => {
      const groupEntries = drawEntryMap[draw.id] || [];
      const subtotalCents = groupEntries.reduce((sum, entry) => sum + toCents(entry.amount), 0);
      return {
        drawId: draw.id,
        drawName: draw.name,
        entries: groupEntries,
        subtotal: fromCents(subtotalCents),
      };
    });
  }, [draws, drawEntryMap]);

  const totalAmount = useMemo(
    () => fromCents(previewGroups.reduce((sum, group) => sum + toCents(group.subtotal), 0)),
    [previewGroups]
  );

  const hasEntries = previewGroups.length > 0;
  const totalLinesInCart = previewGroups.reduce((sum, group) => sum + group.entries.length, 0);

  const handleOpenCustomerModal = () => {
    if (!hasEntries) return;
    setIsCustomerModalOpen(true);
  };
  
  const handleCancelPlay = () => {
    resetEntryState();
    handleReset();
    setEditingEntryId(null);
    setEditingTicket(null);
    setPrefilledCustomerName('');
  };
  
  const handleGenerateTicket = async (customerName: string) => {
    if (isProcessingSale || saleSubmissionLockRef.current) return;

    saleSubmissionLockRef.current = true;
    setIsProcessingSale(true);

    try {
      const activeDrawIdSet = new Set(activeDraws.map((draw) => draw.id));
      const drawIdsInCart = Object.keys(drawEntryMap).filter((drawId) => (drawEntryMap[drawId] || []).length > 0);
      const validDrawIds = drawIdsInCart.filter((id) => activeDrawIdSet.has(id));

      if (validDrawIds.length === 0) {
        alert('El sorteo seleccionado ha cerrado. Por favor, selecciona un sorteo abierto.');
        return;
      }

      const allDrawNames = validDrawIds.map((id) => draws.find((d) => d.id === id)?.name || '');
      const entryMap = validDrawIds.reduce<Record<string, Entry[]>>((acc, drawId) => {
        acc[drawId] = (drawEntryMap[drawId] || []).map((entry) => sanitizeEntryForNewSale(entry));
        return acc;
      }, {});
      const drawEntries = buildDrawEntries(validDrawIds, allDrawNames, entryMap);
      const total = Number(drawEntries.reduce((sum, group) => sum + group.subtotal, 0).toFixed(2));
      const rate = currentUser?.commission ?? settings.commissionRate;

      if (editingTicket) {
        const updatedTicket: Partial<Ticket> = {
          drawIds: validDrawIds,
          drawNames: allDrawNames,
          drawEntries,
          entries: drawEntries.flatMap((group) => group.entries.map((entry) => ({ ...entry }))),
          total,
          commission: Number((total * rate).toFixed(2)),
          commissionRateApplied: rate,
          customerName: customerName.trim() || editingTicket.customerName,
        };
        const persistedUpdatedTicket = await updateTicket(editingTicket.id, updatedTicket);
        setLastTicket(persistedUpdatedTicket);
      } else {
        const newTicket: Ticket = {
          id: generateId(),
          drawIds: validDrawIds,
          drawNames: allDrawNames,
          drawEntries,
          entries: drawEntries.flatMap((group) => group.entries.map((entry) => ({ ...entry }))),
          total,
          commission: Number((total * rate).toFixed(2)),
          commissionRateApplied: rate,
          timestamp: Date.now(),
          customerName: customerName.trim() || getCustomerDisplayName('', nextTicketSequence),
          sequenceNumber: nextTicketSequence,
          sellerName: currentUser?.name || 'Vendedor',
        };
        const finalTicket = await addTicket(newTicket);
        setLastTicket(finalTicket);
        incrementSequence();
      }

      setShowTicket(true);
      setEditingTicket(null);
      resetEntryState();
      setPrefilledCustomerName('');
      setIsCustomerModalOpen(false);

    } catch (error) {
        console.error('Error al registrar la venta:', error);
        alert('La venta no pudo ser registrada. Por favor, intente de nuevo.');
    } finally {
      saleSubmissionLockRef.current = false;
      setIsProcessingSale(false);
    }
  };

  const toggleDrawSelection = (id: string) => {
    if (isMultiMode) {
      setSelectedDrawIds(prev => {
        if (prev.includes(id)) {
          if (prev.length === 1) return prev; // Keep at least one
          return prev.filter(dId => dId !== id);
        }
        return [...prev, id];
      });
    } else {
      setSelectedDrawIds([id]);
      setIsDrawListOpen(false);
    }
  };

  const selectedPriceName = useMemo(() => {
      return chancePrices.find(p => p.id === selectedPriceId)?.name || 'Precio';
  }, [selectedPriceId, chancePrices]);


  return (
    <div className="flex flex-col h-full bg-dark-bg text-white select-none">
      <PullToRefresh onRefresh={async () => window.location.reload()} className="flex-1 px-3 pt-2 pb-4 space-y-2">
        {/* Draw Selector */}
        <div className="relative z-50 mb-2">
          <div className={cn("bg-card-bg rounded-xl px-3 h-10 flex items-center justify-between border border-white/5 shadow-lg transition-all active:scale-[0.99]", isDrawListOpen && "rounded-b-none border-b-transparent")} onClick={() => setIsDrawListOpen(!isDrawListOpen)}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-brand-primary/20 text-brand-strong rounded-lg flex items-center justify-center"><Calendar size={16} /></div>
              <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Sorteo Activo</p>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[13px]">{isMultiMode ? `${selectedDrawIds.length} Sorteos Seleccionados` : `${mainDraw?.name || 'Seleccionar'} ${mainDraw ? formatAMPM(mainDraw.drawTime) : ''}`}</span>
                  <motion.div animate={{ rotate: isDrawListOpen ? 180 : 0 }}><ChevronDown size={14} className="text-slate-500" /></motion.div>
                </div>
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setIsMultiMode(!isMultiMode); if (!isMultiMode) { setIsDrawListOpen(true); } else { setSelectedDrawIds(prev => [prev[0]]); setIsDrawListOpen(false); } }} className={cn("px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter border transition-all", isMultiMode ? "bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/20" : "bg-slate-800 text-slate-400 border-white/5")}>Múltiple</button>
          </div>
          <AnimatePresence>
            {isDrawListOpen && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 right-0 bg-card-bg border-x border-b border-white/5 rounded-b-xl shadow-2xl overflow-hidden">
                <div className="max-h-[200px] overflow-y-auto divide-y divide-white/5">
                  {isMultiMode && (
                    <div className="flex justify-end gap-3 px-3 py-1">
                      <button onClick={() => setSelectedDrawIds(sortDrawsByTime(activeDraws).map(d => d.id))} className="text-[9px] font-bold uppercase tracking-widest text-slate-500 active:text-white">Todos</button>
                      {/* Siempre queda un sorteo seleccionado */}
                      <button onClick={() => setSelectedDrawIds(prev => prev.slice(0, 1))} className="text-[9px] font-bold uppercase tracking-widest text-slate-500 active:text-white">Ninguno</button>
                    </div>
                  )}
                  {activeDraws.map((draw) => (
                    <div key={draw.id} onClick={() => toggleDrawSelection(draw.id)} className={cn("p-3 flex items-center justify-between active:bg-white/5 transition-colors cursor-pointer", selectedDrawIds.includes(draw.id) && "bg-brand-primary/10")}>
                      <div className="flex flex-col"><span className="text-sm font-bold text-white">{draw.name}</span><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{formatAMPM(draw.drawTime)}</span></div>
                      {selectedDrawIds.includes(draw.id) && <div className="w-5 h-5 bg-brand-primary rounded-full flex items-center justify-center shadow-lg shadow-brand-primary/20"><Check size={12} className="text-white" strokeWidth={4} /></div>}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Game Mode Tabs */}
        <div className="flex gap-1.5 bg-card-bg p-1 rounded-xl border border-white/5 h-10 mb-2">
          <button onClick={() => handleSetGameMode('CHANCE')} className={cn("flex-1 rounded-lg font-bold text-xs uppercase tracking-wider transition-all", gameMode === 'CHANCE' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-slate-500 hover:text-white")}>Chance</button>
          <div className="flex-1 flex gap-1 bg-white/5 p-0.5 rounded-lg">
            {mainDraw?.allowedSpecialBets.pale && <button onClick={() => handleSetGameMode('PALÉ')} className={cn("flex-1 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all", gameMode === 'PALÉ' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-slate-500 hover:text-white")}>Palé</button>}
            {mainDraw?.digitsMode === 4 && mainDraw?.allowedSpecialBets.billete && <button onClick={() => handleSetGameMode('BILLETE')} className={cn("flex-1 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all", gameMode === 'BILLETE' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-slate-500 hover:text-white")}>Billete</button>}
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setActiveInput('number')} className={cn("bg-card-bg rounded-2xl h-20 flex flex-col items-center justify-center border-2 transition-all relative overflow-hidden", activeInput === 'number' ? "border-brand-primary bg-brand-primary/10" : "border-transparent")}>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Número</p>
            <p className="text-3xl font-black tracking-widest leading-none">{gameMode === 'PALÉ' ? (numberInput ? <>{numberInput.substring(0, 2)}{numberInput.length > 2 && <span className="text-brand-primary mx-1">-</span>}{numberInput.substring(2)}</> : '-- --') : (numberInput || (mainDraw?.digitsMode === 4 ? '----' : '--'))}</p>
          </button>
          <div className={cn("bg-card-bg rounded-2xl h-20 flex flex-col items-center justify-center border-2 transition-all relative", activeInput === 'amount' ? "border-brand-primary bg-brand-primary/10" : "border-transparent")} onClick={() => { setActiveInput('amount'); if (amountInput === '1') setAmountInput(''); }}>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <span>{ gameMode === 'CHANCE' || gameMode === 'BILLETE' ? 'Piezas' : 'Monto'}</span>
                {gameMode === 'CHANCE' && chancePrices.length > 1 && (
                  <div className='relative'>
                      <button onClick={(e) => { e.stopPropagation(); setIsPriceSelectorOpen(prev => !prev); }} className='bg-slate-700/50 rounded-md px-1.5 text-slate-300 flex items-center gap-1 text-[10px] font-bold'>
                          {selectedPriceName} <ChevronDown size={12}/>
                      </button>
                      {isPriceSelectorOpen && (
                          <div className='absolute top-full right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-lg z-10 p-1 w-24'>
                              {chancePrices.map(p => (
                                  <button key={p.id} onClick={(e) => { e.stopPropagation(); setSelectedPriceId(p.id); setIsPriceSelectorOpen(false); }} className={cn('block w-full text-left px-2 py-1.5 text-xs font-bold rounded-md', selectedPriceId === p.id ? 'bg-brand-primary text-white' : 'hover:bg-slate-800 text-slate-300')}>
                                      {p.name}
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>
                )}
            </div>
            <p className="text-3xl font-black leading-none text-center">{amountInput || '0'}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold tracking-tight">{gameMode !== 'PALÉ' && `Total: $`+formatCurrency((parseInt(amountInput, 10) || 0) * currentPricePerUnit)}</p>
          </div>
        </div>

        {/* Keypad, Actions, Cart... */}
        <div className="grid grid-cols-3 gap-3 px-1 mt-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <button key={n} onClick={() => handleKeypadPress(n.toString())} className="keypad-button">{n}</button>
          ))}
          <button onClick={() => handleKeypadPress('.')} className="keypad-button">.</button>
          <button onClick={() => handleKeypadPress('0')} className="keypad-button">0</button>
          <button onClick={handleBackspace} className="keypad-button text-brand-primary"><Delete size={24} /></button>
        </div>

        <div className="flex justify-center pt-2 pb-1">
          <button onClick={handleReset} className="text-slate-600 active:rotate-[-180deg] transition-transform duration-300"><RotateCcw size={20} /></button>
        </div>

        <div className="space-y-3 pb-2">
          <button onClick={handleAddEntry} disabled={!numberInput} className={cn("w-full h-14 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg", numberInput ? "bg-brand-primary text-white shadow-brand-primary/20" : "bg-slate-800 text-slate-600", editingEntryId && "bg-yellow-500 text-black shadow-yellow-500/20")}>
            {editingEntryId ? <Check size={18} strokeWidth={3} /> : <Plus size={18} strokeWidth={3} />}
            {editingEntryId ? 'Guardar Cambios' : 'Agregar al Ticket'}
          </button>

          <AnimatePresence>
            {hasEntries && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 mt-4">
                <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{selectedDrawIds.length > 1 ? 'Resumen de Jugadas' : 'Jugadas del Ticket'}</span>
                    <span className="text-xs font-black text-brand-primary uppercase tracking-widest">{totalLinesInCart} Líneas</span>
                </div>
                <div className="space-y-2.5 max-h-[280px] overflow-y-auto no-scrollbar pb-2">
                  {previewGroups.map((group) => (
                    <div key={group.drawId} className="bg-card-bg border border-white/5 rounded-xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-200 uppercase tracking-wide">{group.drawName}</span>
                          <span className="text-sm font-bold text-brand-primary">${formatCurrency(group.subtotal)}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {group.entries.map((entry) => {
                            const priceInfo = entry.type === 'CHANCE' && chancePrices.find(p => p.id === entry.priceId);
                            return (
                                <div key={`${group.drawId}-${entry.id}`} onClick={() => handleEditEntryForDraw(group.drawId, entry)} className={cn("min-w-[80px] py-0.5 transition-all active:scale-[0.98] cursor-pointer rounded-lg", editingEntryId === entry.id && "bg-yellow-500/10 px-2")}>
                                    <div className="flex items-baseline gap-1.5">
                                        <p className={cn("text-base font-bold text-white leading-none tracking-wider", editingEntryId === entry.id && "text-yellow-400")}>{formatPlayNumberForDisplay(entry.number, entry.type)}</p>
                                        <button onClick={(e) => { e.stopPropagation(); handleRemoveEntryForDraw(group.drawId, entry.id!); }} className="text-slate-600 hover:text-red-400 transition-colors"><Delete size={10} /></button>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-none mt-1">
                                        x{entry.pieces} {priceInfo && <span className='text-slate-500 text-[9px]'>({priceInfo.name})</span>} <span className="text-brand-primary font-semibold">${formatCurrency(entry.amount)}</span>
                                    </p>
                                </div>
                            );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3">
            <button onClick={() => setIsQuickPasteOpen(true)} className="w-full h-12 rounded-xl bg-card-bg border border-white/5 font-black text-xs text-slate-400 flex items-center justify-center gap-2 active:bg-slate-800 uppercase tracking-wider">
              <Zap size={14} className="text-brand-glow" /> Pegado Rápido
            </button>
            {hasEntries && <button onClick={handleCancelPlay} className="w-full h-12 rounded-xl bg-red-500/10 border border-red-400/25 text-red-300 font-black text-xs uppercase tracking-widest active:scale-[0.98] transition-all">Cancelar Venta</button>}
          </div>

          {hasEntries && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-2 rounded-2xl bg-brand-primary p-3 shadow-xl shadow-brand-primary/20 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="shrink-0 rounded-lg bg-black/15 p-2">
                  <TicketIcon size={18} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-black/70 uppercase tracking-wider">Total a pagar</p>
                  <p className="text-lg font-black text-white leading-tight">${formatCurrency(totalAmount)}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {editingTicket && <button onClick={handleCancelPlay} className="h-10 rounded-lg bg-black/15 px-3 text-[10px] font-black text-white active:scale-95">Cancelar</button>}
                <button onClick={handleOpenCustomerModal} disabled={selectedDrawIds.length === 0 || isProcessingSale} className="h-10 rounded-lg bg-white px-4 text-sm font-black text-brand-primary shadow-md active:scale-95 disabled:opacity-50">
                  {isProcessingSale ? 'Procesando...' : editingTicket ? 'Actualizar' : 'Vender'}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </PullToRefresh>
      
      <QuickPasteModal isOpen={isQuickPasteOpen} onClose={() => setIsQuickPasteOpen(false)} onConfirm={handleQuickPaste} gameMode={gameMode} chancePrice={chancePrices.find((price) => price.id === selectedPriceId) || chancePrices.find((price) => price.isDefault) || chancePrices[0]} isInverted={isInverted} setIsInverted={setIsInverted} />
      <ReuseDrawSelectionModal isOpen={isReuseModalOpen} onClose={() => { setIsReuseModalOpen(false); setPendingReusedTicket(null); }} onConfirm={handleConfirmReuse} activeDraws={activeDraws} />
      <SaleCustomerModal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} onConfirm={handleGenerateTicket} isSubmitting={isProcessingSale} initialName={prefilledCustomerName} previewGroups={previewGroups} totalAmount={totalAmount} isEditing={!!editingTicket} />
      {showTicket && lastTicket && <TicketModal ticket={lastTicket} onClose={() => setShowTicket(false)} saleConfirmation />}
    </div>
  );
};
