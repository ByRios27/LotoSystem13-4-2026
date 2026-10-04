import React, { useEffect, useRef, useState } from 'react';
import { Bluetooth, Check, CircleAlert, LoaderCircle, Printer, RefreshCw, Trash2, Usb, Wifi } from 'lucide-react';
import { ThermalPrinter, type DiscoveredPrinter, type PrinterProfile } from '@delicity/capacitor-thermal-printer';
import { cn } from '../../utils/helpers';
import {
  discoverThermalPrinters,
  forgetThermalPrinter,
  getDefaultThermalPrinter,
  getSavedThermalPrinters,
  isNativePrinterAvailable,
  setDefaultThermalPrinter,
} from '../../services/printerService';
import type { ThermalPaperWidth } from '../../utils/thermalReceipt';

export const PrinterSettingsSection: React.FC = () => {
  const nativePrinterAvailable = isNativePrinterAvailable();
  const [printers, setPrinters] = useState<DiscoveredPrinter[]>([]);
  const [profiles, setProfiles] = useState<PrinterProfile[]>([]);
  const [defaultPrinter, setDefaultPrinter] = useState<PrinterProfile | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [busyPrinterId, setBusyPrinterId] = useState<string | null>(null);
  const [paperWidth, setPaperWidth] = useState<ThermalPaperWidth>(58);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const scanRequestRef = useRef(0);

  useEffect(() => {
    let active = true;
    Promise.all([getSavedThermalPrinters(), getDefaultThermalPrinter()])
      .then(([saved, selected]) => {
        if (!active) return;
        setProfiles(saved);
        setDefaultPrinter(selected);
        if (selected?.capabilities.paperWidthMm === 80) setPaperWidth(80);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const startScan = async () => {
    if (!nativePrinterAvailable) {
      setMessage({ error: false, text: 'Buscar dispositivos está disponible en el APK.' });
      return;
    }
    const requestId = ++scanRequestRef.current;
    setPrinters([]);
    setMessage(null);
    setIsScanning(true);
    try {
      const found = await discoverThermalPrinters();
      if (requestId === scanRequestRef.current) setPrinters(found);
    } catch (error: any) {
      setMessage({ error: true, text: error?.message || 'No se pudieron buscar impresoras Bluetooth.' });
    } finally {
      if (requestId === scanRequestRef.current) setIsScanning(false);
    }
  };

  const refreshSaved = async () => {
    const [saved, selected] = await Promise.all([getSavedThermalPrinters(), getDefaultThermalPrinter()]);
    setProfiles(saved);
    setDefaultPrinter(selected);
  };

  const connect = async (device: DiscoveredPrinter) => {
    setBusyPrinterId(device.id);
    setMessage(null);
    try {
      const detectedWidth = device.capabilities?.paperWidthMm;
      const selectedWidth: ThermalPaperWidth = detectedWidth === 80 ? 80 : detectedWidth === 58 ? 58 : paperWidth;
      setPaperWidth(selectedWidth);
      await setDefaultThermalPrinter(device.id, selectedWidth);
      await refreshSaved();
      setMessage({ error: false, text: `${device.name} se conectó y quedó guardada como predeterminada.` });
    } catch (error: any) {
      setMessage({ error: true, text: error?.message || 'No se pudo conectar con la impresora.' });
    } finally {
      setBusyPrinterId(null);
    }
  };

  const chooseDefault = async (printer: PrinterProfile) => {
    setBusyPrinterId(printer.id);
    try {
      await setDefaultThermalPrinter(printer.id, paperWidth);
      await refreshSaved();
      setMessage({ error: false, text: `${printer.name} es la impresora predeterminada.` });
    } catch (error: any) {
      setMessage({ error: true, text: error?.message || 'No se pudo seleccionar la impresora.' });
    } finally {
      setBusyPrinterId(null);
    }
  };

  const removePrinter = async (printer: PrinterProfile) => {
    try {
      await forgetThermalPrinter(printer.id);
      await refreshSaved();
      setMessage({ error: false, text: `${printer.name} se quitó de los dispositivos guardados.` });
    } catch (error: any) {
      setMessage({ error: true, text: error?.message || 'No se pudo quitar la impresora.' });
    }
  };

  const selectWidth = async (width: ThermalPaperWidth) => {
    setPaperWidth(width);
    if (defaultPrinter) {
      try {
        await setDefaultThermalPrinter(defaultPrinter.id, width);
        await refreshSaved();
      } catch (error: any) {
        setMessage({ error: true, text: error?.message || 'No se pudo guardar el ancho de papel.' });
      }
    }
  };

  const transportIcon = (transport: string) => {
    if (transport === 'wifi' || transport === 'ethernet') return <Wifi size={17} className="shrink-0 text-slate-400" />;
    if (transport === 'usb') return <Usb size={17} className="shrink-0 text-slate-400" />;
    return <Bluetooth size={17} className="shrink-0 text-slate-400" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-2">
        <div>
          <h2 className="text-sm font-black text-white uppercase tracking-widest">Impresoras</h2>
          <p className="text-xs text-slate-400 font-bold">Bluetooth, BLE, USB y red local.</p>
        </div>
        <button
          type="button"
          onClick={startScan}
          disabled={isScanning || !nativePrinterAvailable}
          title={nativePrinterAvailable ? 'Buscar impresoras cercanas' : 'La búsqueda de dispositivos requiere el APK'}
          className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-brand-primary px-3 text-[10px] font-black uppercase tracking-wider text-black shadow-lg shadow-brand-primary/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isScanning ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          {isScanning ? 'Buscando' : 'Buscar'}
        </button>
      </div>

      {!nativePrinterAvailable && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs font-bold leading-relaxed text-slate-300">
          Busca, conecta y guarda impresoras desde el APK. En navegador no hay conexión Bluetooth directa; Print BT avisa si no hay dispositivo conectado.
        </div>
      )}

      {defaultPrinter && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"><Printer size={18} /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{defaultPrinter.name}</p>
              <p className="truncate text-[10px] font-bold text-slate-400">{defaultPrinter.transport.toUpperCase()} · {defaultPrinter.brand || defaultPrinter.adapter.toUpperCase()} · Predeterminada</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Ancho de papel</span>
            <div className="flex gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
              {([58, 80] as const).map((width) => (
                <button
                  key={width}
                  type="button"
                  onClick={() => selectWidth(width)}
                  className={cn('h-7 rounded-md px-3 text-[10px] font-black transition-colors', paperWidth === width ? 'bg-brand-primary text-black' : 'text-slate-400')}
                >
                  {width} mm
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isScanning && <p className="px-2 text-xs font-bold text-slate-400">Buscando impresoras cercanas y de la red local…</p>}
      {printers.map((device) => (
        <div key={device.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          {transportIcon(device.transport)}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{device.name || 'Impresora'}</p>
            <p className="truncate text-[10px] text-slate-500">{device.transport.toUpperCase()} · {device.brand || device.adapter.toUpperCase()} · {device.address}</p>
          </div>
          <button
            type="button"
            onClick={() => connect(device)}
            disabled={busyPrinterId !== null}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 text-[9px] font-black uppercase tracking-wider text-white disabled:opacity-50"
          >
            {busyPrinterId === device.id ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}
            Conectar
          </button>
        </div>
      ))}

      <div className="space-y-2 pt-1">
        <h3 className="px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Dispositivos guardados</h3>
        {profiles.length > 0 ? profiles.map((profile) => (
            <div key={profile.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              {transportIcon(profile.transport)}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{profile.name}</p>
                <p className="truncate text-[10px] text-slate-500">{profile.transport.toUpperCase()} · {profile.brand || profile.adapter.toUpperCase()}</p>
              </div>
              {defaultPrinter?.id !== profile.id && (
                <button type="button" onClick={() => chooseDefault(profile)} disabled={busyPrinterId !== null} className="rounded-lg bg-white/10 px-2.5 py-2 text-[9px] font-black uppercase tracking-wider text-white disabled:opacity-50">Conectar</button>
              )}
              <button type="button" onClick={() => removePrinter(profile)} title="Quitar impresora guardada" className="rounded-lg p-2 text-slate-500 hover:text-rose-400"><Trash2 size={15} /></button>
            </div>
          )) : (
          <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-[10px] font-bold text-slate-500">No hay dispositivos guardados.</p>
        )}
      </div>

      {message && (
        <div className={cn('flex items-center gap-2 rounded-xl border p-2.5 text-xs font-bold', message.error ? 'border-rose-400/20 bg-rose-400/10 text-rose-300' : 'border-lime-400/20 bg-lime-400/10 text-lime-300')}>
          <CircleAlert size={15} />{message.text}
        </div>
      )}

      <p className="px-2 text-[10px] leading-relaxed text-slate-500">ESC/POS genérico funciona por Bluetooth, USB o red. Los protocolos de marca requieren que el SDK del fabricante esté disponible en el APK.</p>
    </div>
  );
};
