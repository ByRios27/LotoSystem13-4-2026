import React, { useRef, useState } from 'react';
import { Ticket as TicketType, useStore } from '../store/useStore';
import { Share2, X, Download, Printer, CheckCircle } from 'lucide-react';
import { TicketReceipt } from './Sales/TicketReceipt';
import { ThermalReceipt } from './Sales/ThermalReceipt';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share as CapacitorShare } from '@capacitor/share';
import { exportNodeAsPng } from '../utils/shareImage';
import { formatAMPM, formatCurrency } from '../utils/helpers';
import { motion } from 'motion/react';

interface TicketModalProps {
  ticket: TicketType;
  onClose: () => void;
  saleConfirmation?: boolean;
}

export const TicketModal: React.FC<TicketModalProps> = ({ ticket, onClose, saleConfirmation = false }) => {
  const graphicReceiptRef = useRef<HTMLDivElement>(null);
  const thermalReceiptRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  
  const draws = useStore((state) => state.draws);
  const fileName = `ticket-${ticket.id.substring(0, 8)}.png`;

  const ticketDrawSummary = ticket.drawIds
    .map((drawId, index) => {
      const draw = draws.find((d) => d.id === drawId);
      const drawName = ticket.drawNames?.[index] || draw?.name || 'Sorteo';
      const drawTime = draw?.drawTime ? formatAMPM(draw.drawTime) : '';
      return drawTime ? `${drawName} ${drawTime}` : drawName;
    })
    .join(' | ');

  const shareText = `Ticket: *${ticketDrawSummary || 'Sorteo'}*\nMonto Total: *$${formatCurrency(ticket.total)}*`;

  const handleSave = async () => {
    if (!graphicReceiptRef.current) return;
    try {
      const dataUrl = await exportNodeAsPng(graphicReceiptRef.current);
      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error al guardar el ticket:', err);
      alert('No se pudo guardar la imagen del ticket.');
    }
  };

  const handleShare = async () => {
    if (!graphicReceiptRef.current) return;

    try {
      const dataUrl = await exportNodeAsPng(graphicReceiptRef.current);

      if (Capacitor.isNativePlatform()) {
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
        const saved = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true,
        });

        await CapacitorShare.share({
          title: 'Ticket de Lotería',
          text: shareText,
          url: saved.uri,
          dialogTitle: 'Compartir Ticket',
        });
      } else {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], fileName, { type: 'image/png' });

        if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
          await navigator.share({ files: [file], title: 'Ticket de Lotería', text: shareText });
        } else {
          const link = document.createElement('a');
          link.download = fileName;
          link.href = dataUrl;
          link.click();
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Error al compartir el ticket:', err);
      alert('No se pudo compartir el ticket.');
    }
  };

  const handlePrint = async () => {
    if (!thermalReceiptRef.current) return;
    setIsPrinting(true);
    try {
      const dataUrl = await exportNodeAsPng(thermalReceiptRef.current, { quality: 0.9, type: 'image/jpeg' });
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes e intenta otra vez.');
        return;
      }
      printWindow.document.write(`
        <html>
          <head>
            <title>Imprimir Ticket</title>
            <style>
              body { margin: 0; padding: 16px; background: white; }
              img { width: 100%; max-width: 420px; display: block; margin: 0 auto; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            <img src="${dataUrl}" />
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    } catch (err) {
      console.error('Error de impresión:', err);
      alert('Hubo un error al preparar la impresión.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleBtPrint = () => {
    const message = 'Para imprimir con impresora Bluetooth, conéctala desde los Ajustes del dispositivo y vuelve a intentarlo.';
    alert(message);
  };

  return (
    <>
      <div className="fixed top-[-9999px] left-[-9999px]">
        <div ref={thermalReceiptRef}><ThermalReceipt ticket={ticket} /></div>
      </div>

      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 250 }}
            className="relative bg-[#0B1220] rounded-3xl w-full max-w-sm max-h-[94dvh] border border-white/10 shadow-2xl overflow-hidden flex flex-col"
        >
            {saleConfirmation && (
              <div className="shrink-0 px-4 py-2 flex items-center justify-center gap-2 bg-brand-primary/10 border-b border-brand-primary/20">
                <CheckCircle size={16} className="text-brand-primary" />
                <p className="text-xs font-bold text-white">Venta registrada</p>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white">
              <div ref={graphicReceiptRef}><TicketReceipt ticket={ticket} /></div>
            </div>
            
            <div className="shrink-0 p-3 flex flex-col gap-2 border-t border-white/5">
              <button
                onClick={handleShare}
                className="w-full bg-green-500 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-lg shadow-green-500/20 active:scale-95 transition-transform"
              >
                <Share2 size={16} />
                Compartir Ticket
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handlePrint}
                  disabled={isPrinting}
                  className="w-full bg-white/5 text-slate-300 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  <Printer size={14} />
                  Imprimir
                </button>

                <button
                  onClick={handleBtPrint}
                  className="w-full bg-white/5 text-slate-300 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-white/10 hover:text-white"
                >
                  <Printer size={14} />
                  Print BT
                </button>

                <button
                  onClick={handleSave}
                  className="w-full bg-white/5 text-slate-300 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-white/10 hover:text-white col-span-2"
                >
                  <Download size={14} />
                  Guardar
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-full text-center text-slate-500 font-bold text-[10px] uppercase tracking-widest py-1 hover:text-white transition-colors"
              >
                Cerrar Ventana
              </button>
            </div>

             <div className="absolute top-3 right-3">
                <button
                    onClick={onClose}
                    className="w-8 h-8 bg-black/30 text-white/70 rounded-full flex items-center justify-center backdrop-blur-sm active:bg-black/50 transition-colors"
                    >
                    <X size={18} />
                </button>
            </div>
        </motion.div>
      </div>
    </>
  );
};
