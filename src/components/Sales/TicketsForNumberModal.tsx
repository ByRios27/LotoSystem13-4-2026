import React, { useMemo, useState } from 'react';
import { Ticket as TicketType, useStore } from '../../store/useStore';
import { X, Receipt } from 'lucide-react';
import { formatCurrency, getCustomerDisplayName } from '../../utils/helpers';
import { normalizeTicketDrawEntries } from '../../utils/ticketUtils';
import { TicketModal } from '../TicketModal';

interface TicketsForNumberModalProps {
  drawId: string;
  number: string;
  onClose: () => void;
}

interface TicketInfo {
  ticket: TicketType;
  totalAmount: number;
  totalPieces: number;
}

export const TicketsForNumberModal: React.FC<TicketsForNumberModalProps> = ({ drawId, number, onClose }) => {
  const tickets = useStore(state => state.tickets);
  const draws = useStore(state => state.draws);
  const [ticketToShow, setTicketToShow] = useState<TicketType | null>(null);

  const draw = useMemo(() => draws.find(d => d.id === drawId), [draws, drawId]);

  const relevantTicketsInfo: TicketInfo[] = useMemo(() => {
    if (!draw) return [];

    const relevant = tickets.map(ticket => {
      const entriesForNumber = normalizeTicketDrawEntries(ticket)
        .filter(group => group.drawId === drawId)
        .flatMap(group => group.entries)
        .filter(entry => {
            if (entry.type === 'CHANCE') {
                const num = entry.number.length === 4 ? entry.number.slice(-2) : entry.number;
                return num === number;
            } else if (entry.type === 'PALÉ') {
                const n1 = entry.number.substring(0, 2);
                const n2 = entry.number.substring(2, 4);
                return n1 === number || n2 === number;
            } else if (entry.type === 'BILLETE') {
                return entry.number.slice(-2) === number;
            }
            return false;
        });

      if (entriesForNumber.length === 0) {
        return null;
      }

      const totalAmount = entriesForNumber.reduce((sum, entry) => {
          if (entry.type === 'PALÉ') {
            // If it's a Palé, only count the portion corresponding to the selected number, which is tricky.
            // For simplicity, we'll count the full amount if either number matches.
            // A more accurate approach would require knowing how the amount is split.
            return sum + entry.amount;
          } 
          return sum + entry.amount
      }, 0);
      const totalPieces = entriesForNumber.reduce((sum, entry) => sum + entry.pieces, 0);

      return { ticket, totalAmount, totalPieces };
    }).filter((info): info is TicketInfo => info !== null && info.totalAmount > 0);
    
    return relevant;
  }, [tickets, drawId, number, draw]);

  if (!draw) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-lg flex justify-center items-center z-50 p-4 animate-in fade-in duration-300">
        <div className="bg-gradient-to-b from-[#1A1F30] to-[#0B1220] rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className='flex items-center gap-3'>
              <div className="w-12 h-12 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded-xl flex items-center justify-center">
                <span className="text-2xl font-black">{number}</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">
                  Detalle de Ventas
                </h2>
                <p className="text-xs text-slate-400">Clientes que compraron el {number}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {relevantTicketsInfo.length > 0 ? (
              relevantTicketsInfo.map(({ ticket, totalAmount, totalPieces }) => (
                <div key={ticket.id} className="bg-white/5 rounded-xl p-3 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center border-2 border-slate-500">
                      {/* Customer icon or initials can go here */}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-200">
                        {getCustomerDisplayName(ticket.customerName)}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400">
                        {new Date(ticket.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • <span className='font-bold'>{draw.name}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className='text-right'>
                      <p className="text-sm font-bold text-white">{formatCurrency(totalAmount)}</p>
                      <p className="text-xs font-black text-brand-primary">x{totalPieces}</p>
                    </div>
                    <button 
                      onClick={() => setTicketToShow(ticket)}
                      className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                      <Receipt size={20} className="text-slate-300" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10">
                <p className="text-slate-400">No se encontraron tickets para este número en el sorteo seleccionado.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {ticketToShow && <TicketModal ticket={ticketToShow} onClose={() => setTicketToShow(null)} />}
    </>
  );
};
