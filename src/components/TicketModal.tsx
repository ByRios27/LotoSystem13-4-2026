import React, { useEffect, useRef, useState } from 'react';
import { Ticket as TicketType, useStore } from '../store/useStore';
import { Share2, X, Download, Printer, CheckCircle, Bluetooth } from 'lucide-react';
import { Printer as SystemPrinter } from '@capgo/capacitor-printer';
import { TicketReceipt } from './Sales/TicketReceipt';
import { ThermalReceipt } from './Sales/ThermalReceipt';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share as CapacitorShare } from '@capacitor/share';
import { exportNodeAsPng } from '../utils/shareImage';
import { formatAMPM, formatCurrency } from '../utils/helpers';
import { formatThermalReceipt, getThermalReceiptBoldLines, type ThermalPaperWidth } from '../utils/thermalReceipt';
import { getDefaultThermalPrinter, isNativePrinterAvailable, printThermalText } from '../services/printerService';
import { createThermalReceiptPdf } from '../utils/thermalReceiptPdf';
import { createThermalReceiptImages } from '../utils/thermalReceiptImage';
import { AnimatePresence, motion } from 'motion/react';

interface TicketModalProps {
  ticket: TicketType;
  onClose: () => void;
  saleConfirmation?: boolean;
}

export const TicketModal: React.FC<TicketModalProps> = ({ ticket, onClose, saleConfirmation = false }) => {
  const graphicReceiptRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showThermalPreview, setShowThermalPreview] = useState(false);
  const [paperWidth, setPaperWidth] = useState<ThermalPaperWidth>(58);
  
  const draws = useStore((state) => state.draws);
  const fileName = `ticket-${ticket.id.substring(0, 8)}.png`;
  const thermalFileName = `ticket-termico-${ticket.id.substring(0, 8)}`;

  useEffect(() => {
    if (!isNativePrinterAvailable()) return;
    getDefaultThermalPrinter()
      .then((printer) => {
        if (printer?.capabilities.paperWidthMm === 80) setPaperWidth(80);
      })
      .catch(() => undefined);
  }, []);

  const ticketDrawSummary = ticket.drawIds
    .map((drawId, index) => {
      const draw = draws.find((d) => d.id === drawId);
      const drawName = ticket.drawNames?.[index] || draw?.name || 'Sorteo';
      const drawTime = draw?.drawTime ? formatAMPM(draw.drawTime) : '';
      return drawTime ? `${drawName} ${drawTime}` : drawName;
    })
    .join(' | ');

  const shareText = `Ticket: *${ticketDrawSummary || 'Sorteo'}*\nTotal de venta: *$${formatCurrency(ticket.total)}*`;
  const thermalShareText = `Recibo térmico: ${ticketDrawSummary || 'Sorteo'}\nTotal de venta: $${formatCurrency(ticket.total)}`;

  const pdfBytesToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  };

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

  const handleShareThermal = async () => {
    setIsPrinting(true);
    try {
      const imageBlobs = await createThermalReceiptImages(ticket, draws, paperWidth);
      if (Capacitor.isNativePlatform()) {
        const saved = await Promise.all(imageBlobs.map(async (blob, index) => {
          const imageData = new Uint8Array(await blob.arrayBuffer());
          return Filesystem.writeFile({
            path: `${thermalFileName}-${index + 1}.png`,
            data: pdfBytesToBase64(imageData),
            directory: Directory.Cache,
            recursive: true,
          });
        }));
        await CapacitorShare.share({
          title: 'Recibo térmico',
          text: thermalShareText,
          files: saved.map((file) => file.uri),
          dialogTitle: 'Compartir recibo',
        });
      } else {
        const files = imageBlobs.map((blob, index) => new File(
          [blob],
          `${thermalFileName}-${index + 1}.png`,
          { type: 'image/png' },
        ));
        if (navigator.share && (!navigator.canShare || navigator.canShare({ files }))) {
          await navigator.share({ files, title: 'Recibo térmico', text: thermalShareText });
        } else {
          imageBlobs.forEach((blob, index) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `${thermalFileName}-${index + 1}.png`;
            link.href = url;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 30000);
          });
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Error al compartir el recibo térmico:', err);
      alert('No se pudo compartir el recibo de impresión.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const thermalText = formatThermalReceipt(ticket, draws, paperWidth);
      const boldLines = getThermalReceiptBoldLines(ticket, draws, paperWidth);
      const defaultPrinter = isNativePrinterAvailable() ? await getDefaultThermalPrinter() : null;
      if (defaultPrinter) {
        await printThermalText(thermalText, `${window.location.origin}/ticket/${ticket.id}`, paperWidth, boldLines);
      } else {
        const pdfBytes = await createThermalReceiptPdf(ticket, draws, paperWidth);
        await SystemPrinter.printBase64({
          name: `Ticket ${ticket.sequenceNumber}`,
          data: pdfBytesToBase64(pdfBytes),
          mimeType: 'application/pdf',
        });
      }
    } catch (err: any) {
      console.error('Error de impresión:', err);
      alert(err?.message || 'No se pudo enviar el ticket a imprimir.');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <>
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
                  onClick={() => setShowThermalPreview(true)}
                  className="w-full bg-white/5 text-slate-300 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-white/10 hover:text-white"
                >
                  <Printer size={14} />
                  Imprimir
                </button>

                <button
                  onClick={() => setShowThermalPreview(true)}
                  className="w-full bg-white/5 text-slate-300 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-white/10 hover:text-white"
                >
                  <Bluetooth size={14} />
                  Print BT
                </button>

                <button
                  onClick={handleSave}
                  className="w-full bg-white/5 text-slate-300 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-white/10 hover:text-white col-span-2"
                >
                  <Download size={14} />
                  Guardar Foto
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

      <AnimatePresence>
        {showThermalPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowThermalPreview(false)}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm"
          >
            <motion.section
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              onClick={(event) => event.stopPropagation()}
              className="flex max-h-[92dvh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0B1220] shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Printer size={16} className="text-brand-primary" />
                  <div>
                    <p className="text-[9px] font-bold text-slate-400">{paperWidth} mm · Monocromo</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowThermalPreview(false)} className="rounded-full bg-white/10 p-1.5 text-slate-300">
                  <X size={16} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto bg-slate-200 p-3">
                <ThermalReceipt ticket={ticket} paperWidth={paperWidth} />
              </div>

              <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/10 p-3">
                <button
                  type="button"
                  onClick={handleShareThermal}
                  disabled={isPrinting}
                  className="flex h-10 items-center justify-center gap-2 rounded-xl bg-white/10 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
                >
                  <Share2 size={14} />
                  Compartir Recibo
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={isPrinting}
                  className="flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-primary text-[10px] font-black uppercase tracking-widest text-black disabled:opacity-50"
                >
                  <Printer size={14} />
                  {isPrinting ? 'Enviando…' : 'Print BT'}
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
