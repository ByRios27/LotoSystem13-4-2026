import React from 'react';
import QRCode from 'react-qr-code';
import { Ticket as TicketType, useStore } from '../../store/useStore';
import { formatAMPM, formatCurrency, getCustomerDisplayName } from '../../utils/helpers';
import { normalizeTicketDrawEntries, getTicketSubtotalForDraw } from '../../utils/ticketUtils';

interface ThermalReceiptProps {
  ticket: TicketType;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ ticket }) => {
  const draws = useStore(state => state.draws);
  const { user } = useStore();

  const ticketUrl = `${window.location.origin}/ticket/${ticket.id}`;

  const groupedEntries = normalizeTicketDrawEntries(ticket);

  return (
    <div className="bg-white text-black font-mono text-[10px] p-6 w-[302px]">
      <div className="flex items-center gap-4 mb-3">
        <div className='w-[80px] h-[80px] flex items-center justify-center'>
          <QRCode value={ticketUrl} size={80} level="L" />
        </div>
        <div className='text-[9px]'>
            <p className="font-bold">LOTERIA</p>
            <p>COMPROBANTE</p>
            <p>{new Date(ticket.timestamp).toLocaleDateString('es-ES')}</p>
            <p>{new Date(ticket.timestamp).toLocaleTimeString('es-ES', { hour12: true, hour: 'numeric', minute:'2-digit', second: '2-digit' })}</p>
            <p>CLIENTE: {getCustomerDisplayName(ticket.customerName)}</p>
            <p>VENDEDOR: {user?.firstName || 'N/A'}</p>
        </div>
      </div>

      <div className="border-t border-dashed border-black"/>

      <div className="my-2 space-y-2">
        {groupedEntries.map(group => {
            const draw = draws.find(d => d.id === group.drawId);
            const subtotal = getTicketSubtotalForDraw(ticket, group.drawId);
            
            return(
                <div key={group.drawId} className='py-1'>
                    <div className="flex justify-between">
                        <p className='font-bold'>{draw ? `${formatAMPM(draw.drawTime)} ${draw.name}` : 'Sorteo'}</p>
                    </div>
                    <div className="flex justify-between">
                        <p>4x25</p> {/* This seems static in the example. Adjust if needed. */}
                        <p className="font-bold">{formatCurrency(subtotal)}</p>
                    </div>
                    <div className="flex justify-between">
                       <p>TX: {ticket.id.slice(0,8)}</p>
                    </div>
                </div>
            )
        })}
      </div>
      
      <div className="border-t-2 border-dashed border-black pt-2">
        <div className="flex justify-between text-lg font-bold">
            <p>TOTAL:</p>
            <p>{formatCurrency(ticket.total)}</p>
        </div>
      </div>

      <div className="border-t border-dashed border-black mt-2 text-center text-[9px] pt-2">
        <p className='font-bold'>IMPORTANTE</p>
        <p>Sin comprobante no se pagan premios.</p>
        <p className='font-bold mt-1'>¡GRACIAS POR SU COMPRA!</p>
      </div>
    </div>
  );
};
