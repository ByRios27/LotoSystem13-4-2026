import React, { useEffect, useState } from 'react';
import { Ticket as TicketType, useStore } from '../../store/useStore';
import type { ThermalPaperWidth } from '../../utils/thermalReceipt';
import { createThermalReceiptImages } from '../../utils/thermalReceiptImage';

interface ThermalReceiptProps {
  ticket: TicketType;
  paperWidth?: ThermalPaperWidth;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ ticket, paperWidth = 58 }) => {
  const draws = useStore(state => state.draws);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;
    let urls: string[] = [];
    setImages([]);
    setError('');
    createThermalReceiptImages(ticket, draws, paperWidth)
      .then((blobs) => {
        urls = blobs.map((blob) => URL.createObjectURL(blob));
        if (isActive) setImages(urls);
      })
      .catch((err: any) => {
        if (isActive) setError(err?.message || 'No se pudo preparar la vista del recibo.');
      });
    return () => {
      isActive = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [ticket, draws, paperWidth]);

  return (
    <div className="flex min-w-full flex-col items-center gap-3">
      {error ? (
        <p className="max-w-xs rounded-xl bg-white p-3 text-xs font-bold text-rose-700">{error}</p>
      ) : images.length === 0 ? (
        <p className="rounded-xl bg-white p-3 text-xs font-bold text-slate-600">Preparando imagen…</p>
      ) : images.map((src, index) => (
        <img key={src} src={src} alt={`Recibo térmico ${index + 1}`} className="h-auto max-w-full bg-white shadow-lg" />
      ))}
    </div>
  );
};
