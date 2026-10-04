import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { formatCurrency, getBusinessDate, formatPlayNumberForDisplay, getCustomerDisplayName } from '../utils/helpers';
import { Calendar, ChevronDown, History, Share2 } from 'lucide-react';
import { Draw, Entry, Ticket, useStore } from '../store/useStore';
import { TicketModal } from './TicketModal';

interface ArchiveDayTotals {
  totalSales: number;
  totalCommission: number;
  totalPrizes: number;
  totalUtility: number;
  totalTickets?: number;
}

interface ArchiveDayEntry {
  id: string;
  businessDate: string;
  year?: number;
  month?: string;
  timezone?: string;
  sourceVersion?: string;
  userId: string;
  userName: string;
  sellerId?: string;
  draws: ArchiveDrawEntry[];
  totals: ArchiveDayTotals;
}

interface ArchiveDrawEntry {
  id: string;
  drawName: string;
  totalSales: number;
  totalCommission: number;
  totalPrizes: number;
  totalTickets: number;
  results?: string[];
}

interface ArchiveRecord {
  id: string;
  businessDate: string;
  userId: string;
  userName: string;
  ticketId: string;
  sellerId?: string;
  timestamp: number;
  ticketSnapshot: Ticket;
  drawEntries: Array<{ drawId: string; drawName: string; entries: Entry[]; subtotal: number }>;
  drawSnapshots: Draw[];
}

type ArchiveMode = 'day' | 'month' | 'year' | 'range';

function safeNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatDateLabel(dateString: string): string {
  if (!dateString) return '--';
  const parsed = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return dateString;
  return parsed.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export const ArchivePage: React.FC = () => {
  const { currentUser, users } = useStore();
  const [archives, setArchives] = useState<ArchiveDayEntry[]>([]);
  const [archiveRecords, setArchiveRecords] = useState<ArchiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [mode, setMode] = useState<ArchiveMode>('day');
  const [selectedUserId, setSelectedUserId] = useState(currentUser?.id || 'all');
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const [expandedDrawId, setExpandedDrawId] = useState<string | null>(null);
  const [ticketToShare, setTicketToShare] = useState<{ ticket: Ticket; drawSnapshots: Draw[] } | null>(null);

  const today = getBusinessDate();
  const [singleDate, setSingleDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(Number(today.slice(0, 4)));
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  useEffect(() => {
    if (!currentUser) return;
    const archiveCollection = collection(db, 'archivesDaily');
    const q = currentUser.role === 'CEO'
      ? selectedUserId === 'all'
        ? query(archiveCollection, orderBy('businessDate', 'desc'))
        : query(archiveCollection, where('userId', '==', selectedUserId))
      : query(archiveCollection, where('userId', '==', currentUser.id));
    setLoading(true);
    let cancelled = false;
    const loadArchives = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(q);
        if (cancelled) return;
        const data = snapshot.docs.map((docSnap) => {
          const raw = docSnap.data() as any;
          const totalsRaw = raw?.totals || {};
          const totalSales = safeNumber(totalsRaw.totalSales);
          const totalCommission = safeNumber(totalsRaw.totalCommission);
          const totalPrizes = safeNumber(totalsRaw.totalPrizes);
          const fallbackUtility = totalSales - totalCommission - totalPrizes;

          return {
            id: docSnap.id,
            businessDate: raw?.businessDate || docSnap.id,
            timezone: raw?.timezone,
            sourceVersion: raw?.sourceVersion,
            userId: String(raw?.userId || ''),
            userName: String(raw?.userName || 'Usuario'),
            sellerId: raw?.sellerId ? String(raw.sellerId) : undefined,
            draws: Array.isArray(raw?.draws) ? raw.draws.map((draw: any) => ({
              id: String(draw.drawId || draw.id || ''),
              drawName: String(draw.drawName || draw.name || 'Sorteo'),
              totalSales: safeNumber(draw.totalSales),
              totalCommission: safeNumber(draw.totalCommission),
              totalPrizes: safeNumber(draw.totalPrizes),
              totalTickets: safeNumber(draw.totalTickets),
              results: Array.isArray(draw.results) ? draw.results : [],
            })) : [],
            totals: {
              totalSales,
              totalCommission,
              totalPrizes,
              totalUtility: Number(safeNumber(totalsRaw.totalUtility || fallbackUtility).toFixed(2)),
              totalTickets: safeNumber(totalsRaw.totalTickets),
            },
          } as ArchiveDayEntry;
        });
        setArchives(data.sort((a, b) => b.businessDate.localeCompare(a.businessDate)));
      } catch (error) {
        console.error('Archive load error:', error);
        if (!cancelled) setArchives([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadArchives();

    return () => { cancelled = true; };
  }, [currentUser?.id, currentUser?.role, selectedUserId]);

  const selectedEntries = useMemo(() => {
    if (mode === 'day') {
      return archives.filter((item) => item.businessDate === singleDate);
    }

    if (mode === 'month') return archives.filter((item) => item.businessDate.startsWith(selectedMonth));
    if (mode === 'year') return archives.filter((item) => item.businessDate.startsWith(`${selectedYear}-`));

    const start = fromDate <= toDate ? fromDate : toDate;
    const end = fromDate <= toDate ? toDate : fromDate;

    return archives.filter((item) => item.businessDate >= start && item.businessDate <= end);
  }, [archives, mode, singleDate, selectedMonth, selectedYear, fromDate, toDate]);

  const selectedArchive = selectedEntries.find((archive) => archive.id === selectedArchiveId) || selectedEntries[0] || null;

  const createArchivedTicket = (record: ArchiveRecord) => {
    const ticket: Ticket = {
      ...record.ticketSnapshot,
      id: record.ticketId,
      drawIds: record.drawEntries.map((group) => group.drawId),
      drawNames: record.drawEntries.map((group) => group.drawName),
      drawId: record.drawEntries[0]?.drawId || record.ticketSnapshot.drawIds[0],
      drawEntries: record.drawEntries,
      entries: record.drawEntries.flatMap((group) => group.entries),
    };
    return { ticket, drawSnapshots: record.drawSnapshots };
  };

  useEffect(() => {
    if (mode === 'day' && selectedEntries.length > 0 && !selectedEntries.some((archive) => archive.id === selectedArchiveId)) {
      setSelectedArchiveId(selectedEntries[0].id);
    }
  }, [mode, selectedEntries, selectedArchiveId]);

  useEffect(() => {
    if (mode !== 'day' || !selectedArchive) {
      setArchiveRecords([]);
      setRecordsLoading(false);
      return;
    }

    setRecordsLoading(true);
    const q = query(
      collection(db, 'archiveRecords'),
      where('businessDate', '==', selectedArchive.businessDate),
      where('userId', '==', selectedArchive.userId),
    );
    let cancelled = false;
    const loadRecords = async () => {
      setRecordsLoading(true);
      try {
        const snapshot = await getDocs(q);
        if (cancelled) return;
        const data = snapshot.docs
          .map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() } as ArchiveRecord))
          .sort((a, b) => b.timestamp - a.timestamp);
        setArchiveRecords(data);
      } catch (error) {
        console.error('Archive detail load error:', error);
        if (!cancelled) setArchiveRecords([]);
      } finally {
        if (!cancelled) setRecordsLoading(false);
      }
    };
    void loadRecords();

    return () => { cancelled = true; };
  }, [mode, selectedArchive?.id, selectedArchive?.businessDate, selectedArchive?.userId]);

  const accumulated = useMemo(() => {
    return selectedEntries.reduce(
      (acc, item) => {
        acc.totalSales += safeNumber(item.totals.totalSales);
        acc.totalCommission += safeNumber(item.totals.totalCommission);
        acc.totalPrizes += safeNumber(item.totals.totalPrizes);
        acc.totalUtility += safeNumber(item.totals.totalUtility);
        return acc;
      },
      { totalSales: 0, totalCommission: 0, totalPrizes: 0, totalUtility: 0 }
    );
  }, [selectedEntries]);

  return (
    <div className="h-full flex flex-col bg-[#0B1220] text-white overflow-hidden">
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 pb-24">
        <div className="bg-[#121A2B] rounded-xl p-3 border border-white/5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode('day')}
              className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                mode === 'day'
                  ? 'bg-brand-primary/20 border-brand-primary/40 text-brand-primary'
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              Día
            </button>
            <button
              onClick={() => setMode('month')}
              className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                mode === 'month'
                  ? 'bg-brand-primary/20 border-brand-primary/40 text-brand-primary'
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              Mes
            </button>
            <button onClick={() => setMode('year')} className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${mode === 'year' ? 'bg-brand-primary/20 border-brand-primary/40 text-brand-primary' : 'bg-white/5 border-white/10 text-slate-400'}`}>Año</button>
            <button onClick={() => setMode('range')} className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${mode === 'range' ? 'bg-brand-primary/20 border-brand-primary/40 text-brand-primary' : 'bg-white/5 border-white/10 text-slate-400'}`}>Rango</button>
          </div>

          {currentUser?.role === 'CEO' && (
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Usuario</label>
              <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="w-full bg-[#0B1220] border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 outline-none">
                <option value="all">Todos los usuarios</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.role}</option>)}
              </select>
            </div>
          )}

          {mode === 'day' ? (
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Fecha</label>
              <input
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                className="w-full bg-[#0B1220] border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 outline-none"
              />
            </div>
          ) : mode === 'month' ? (
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Mes</label>
              <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="w-full bg-[#0B1220] border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 outline-none" />
            </div>
          ) : mode === 'year' ? (
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Año</label>
              <input type="number" min="2000" max="2100" value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} className="w-full bg-[#0B1220] border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 outline-none" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Desde</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full bg-[#0B1220] border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Hasta</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full bg-[#0B1220] border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#121A2B] rounded-xl p-3 border border-white/5">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Resumen seleccionado</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded-lg p-2 border border-white/5">
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Ventas</p>
              <p className="text-sm font-black text-brand-primary">${formatCurrency(accumulated.totalSales)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2 border border-white/5">
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Comision</p>
              <p className="text-sm font-black text-amber-400">${formatCurrency(accumulated.totalCommission)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2 border border-white/5">
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Premios</p>
              <p className="text-sm font-black text-rose-400">${formatCurrency(accumulated.totalPrizes)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2 border border-white/5">
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Utilidad</p>
              <p className="text-sm font-black text-emerald-400">${formatCurrency(accumulated.totalUtility)}</p>
            </div>
          </div>
        </div>

        {mode === 'day' && selectedArchive && (
          <div className="bg-[#121A2B] rounded-xl p-3 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Detalle por sorteo</p>
              <span className="text-[9px] font-bold text-slate-500">{formatDateLabel(selectedArchive.businessDate)}</span>
            </div>
            {recordsLoading ? (
              <div className="py-4 text-center text-[10px] font-bold text-slate-500">Cargando sorteos...</div>
            ) : selectedArchive.draws.length === 0 ? (
              <div className="py-4 text-center text-[10px] font-bold text-slate-500">Sin detalle por sorteo para esta fecha</div>
            ) : selectedArchive.draws.map((draw) => {
              const isExpanded = expandedDrawId === draw.id;
              const drawRecords = archiveRecords.filter((record) => record.drawEntries.some((group) => group.drawId === draw.id));
              return (
                <section key={draw.id} className="overflow-hidden rounded-lg border border-white/10 bg-[#0B1220]">
                  <button type="button" onClick={() => setExpandedDrawId((previous) => previous === draw.id ? null : draw.id)} className="w-full p-2.5 text-left active:bg-white/5">
                    <div className="flex items-center gap-1.5">
                      <ChevronDown size={14} className={`shrink-0 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      <span className="min-w-0 flex-1 truncate text-[11px] font-black uppercase text-white">{draw.drawName}</span>
                      <span className="shrink-0 text-[9px] font-bold text-slate-500">{draw.totalTickets} tickets</span>
                    </div>
                    {draw.results && draw.results.length > 0 && (
                      <div className="ml-5 mt-1 flex flex-wrap gap-1">
                        {draw.results.map((result, index) => <span key={index} className="rounded bg-white px-1.5 py-0.5 text-[9px] font-black text-slate-900">{result}</span>)}
                      </div>
                    )}
                    <div className="ml-5 mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold text-slate-400">
                      <span>V ${formatCurrency(draw.totalSales)}</span>
                      <span>C ${formatCurrency(draw.totalCommission)}</span>
                      <span>P ${formatCurrency(draw.totalPrizes)}</span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="space-y-1.5 border-t border-white/5 p-2">
                      {drawRecords.length === 0 ? (
                        <p className="py-3 text-center text-[10px] font-bold text-slate-500">No hay tickets para este sorteo.</p>
                      ) : drawRecords.map((record) => {
                        const group = record.drawEntries.find((item) => item.drawId === draw.id);
                        if (!group) return null;
                        const groupPrize = group.entries.reduce((sum, entry) => sum + Number(entry.prize || 0), 0);
                        return (
                          <div key={record.id} className="rounded-lg border border-white/5 bg-white/[0.03] p-2">
                            <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[10px] font-black uppercase text-white">{getCustomerDisplayName(record.ticketSnapshot.customerName, record.ticketSnapshot.sequenceNumber, record.ticketId)}</p>
                              <p className="mt-0.5 text-[8px] font-bold uppercase text-slate-500">V:{record.ticketSnapshot.sellerId || record.sellerId || '---'} · TX:{record.ticketId.slice(0, 8).toUpperCase()}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <div className="text-right text-[9px] font-black">
                                <p className="text-white">V ${formatCurrency(group.subtotal)}</p>
                                {groupPrize > 0 && <p className="text-amber-300">P ${formatCurrency(groupPrize)}</p>}
                              </div>
                              <button type="button" aria-label={`Compartir ticket ${record.ticketId}`} title="Abrir ticket y compartir" onClick={() => setTicketToShare(createArchivedTicket(record))} className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-slate-200 hover:bg-white/20">
                                <Share2 size={14} />
                              </button>
                            </div>
                          </div>
                            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                              {group.entries.map((entry, index) => (
                                <div key={`${record.id}-${index}`} className="text-[9px] font-bold text-slate-300">
                                  <span className="text-white">{formatPlayNumberForDisplay(entry.number, entry.type)}</span> x{entry.pieces} · ${formatCurrency(entry.amount)}
                                  {entry.prize ? <span className="ml-1 text-amber-300">P ${formatCurrency(entry.prize)}</span> : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : selectedEntries.length === 0 ? (
          <div className="bg-white/5 rounded-2xl p-12 flex flex-col items-center justify-center text-center border border-dashed border-white/10 opacity-40">
            <History size={32} className="text-slate-600 mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest">No hay archivos para ese filtro</p>
          </div>
        ) : (
          selectedEntries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => { setSelectedArchiveId(entry.id); setMode('day'); setSingleDate(entry.businessDate); }}
              className="bg-[#121A2B] rounded-xl p-3 border border-white/5 flex items-start justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-400/10 flex items-center justify-center text-orange-400">
                  <Calendar size={18} />
                </div>
                <div>
                  <h4 className="text-[11px] font-black text-white uppercase tracking-tight">
                    {formatDateLabel(entry.businessDate)} · {entry.userName}
                  </h4>
                  <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                    Ventas ${formatCurrency(entry.totals.totalSales)} | Comision ${formatCurrency(entry.totals.totalCommission)}
                  </p>
                  <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                    Premios ${formatCurrency(entry.totals.totalPrizes)} | Utilidad ${formatCurrency(entry.totals.totalUtility)}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
      {ticketToShare && (
        <TicketModal
          ticket={ticketToShare.ticket}
          drawSnapshots={ticketToShare.drawSnapshots}
          useStoredPrizes
          onClose={() => setTicketToShare(null)}
        />
      )}
    </div>
  );
};
