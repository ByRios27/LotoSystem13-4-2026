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
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;
    let url = '';
    setImageUrl('');
    setError('');
    createThermalReceiptImages(ticket, draws, paperWidth)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (isActive) setImageUrl(url);
      })
      .catch((err: any) => {
        if (isActive) setError(err?.message || 'No se pudo preparar la vista del recibo.');
      });
    return () => {
      isActive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [ticket, draws, paperWidth]);

  return (
    <div className="flex min-w-full flex-col items-center gap-3">
      {error ? (
        <p className="max-w-xs rounded-xl bg-white p-3 text-xs font-bold text-rose-700">{error}</p>
      ) : !imageUrl ? (
        <p className="rounded-xl bg-white p-3 text-xs font-bold text-slate-600">Preparando imagen…</p>
      ) : (
        <img src={imageUrl} alt="Recibo de venta" className="h-auto max-w-full bg-white shadow-lg" />
      )}
    </div>
  );
};
