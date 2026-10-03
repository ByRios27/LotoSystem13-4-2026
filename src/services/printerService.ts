import { Capacitor } from '@capacitor/core';
import { ThermalPrinter, type DiscoveredPrinter, type PrinterProfile } from '@delicity/capacitor-thermal-printer';
import type { ThermalPaperWidth } from '../utils/thermalReceipt';

export const isNativePrinterAvailable = (): boolean => Capacitor.isNativePlatform();

export async function getDefaultThermalPrinter(): Promise<PrinterProfile | null> {
  const { profile } = await ThermalPrinter.getDefaultPrinter();
  return profile;
}

export async function getSavedThermalPrinters(): Promise<PrinterProfile[]> {
  const { profiles } = await ThermalPrinter.getSavedPrinters();
  return profiles;
}

export async function discoverThermalPrinters(): Promise<DiscoveredPrinter[]> {
  await ThermalPrinter.requestPermissions();
  const { printers } = await ThermalPrinter.discoverPrinters({ timeoutMs: 10000 });
  return printers;
}

export async function connectAndTestThermalPrinter(
  printerId: string,
  paperWidth: ThermalPaperWidth,
): Promise<void> {
  const connection = await ThermalPrinter.connectPrinter({ printerId, paperWidthMm: paperWidth });
  if (!connection.connected) throw new Error('No se pudo conectar con la impresora.');

  await ThermalPrinter.printText({
    printerId: connection.printerId,
    paperWidthMm: paperWidth,
    items: [
      { type: 'text', value: 'LOTTOPRO\n', style: { align: 'center', bold: true } },
      { type: 'text', value: 'PRUEBA DE IMPRESION\n', style: { align: 'center' } },
      { type: 'divider', char: '-' },
      { type: 'text', value: 'Impresora conectada correctamente.' },
      { type: 'cut', mode: 'partial', feedBefore: 2 },
    ],
  });

  await ThermalPrinter.setDefaultPrinter({ printerId: connection.printerId });
}

export async function setDefaultThermalPrinter(printerId: string, paperWidth?: ThermalPaperWidth): Promise<void> {
  const result = await ThermalPrinter.connectPrinter({ printerId, setAsDefault: true, paperWidthMm: paperWidth });
  if (!result.connected) throw new Error('No se pudo conectar con la impresora.');
}

export async function forgetThermalPrinter(printerId: string): Promise<void> {
  await ThermalPrinter.removePrinter({ printerId });
}

export async function printThermalText(
  text: string,
  qrUrl: string,
  paperWidth: ThermalPaperWidth,
  boldLines: ReadonlySet<string>,
): Promise<void> {
  const { profile } = await ThermalPrinter.getDefaultPrinter();
  if (!profile) throw new Error('Selecciona una impresora desde Configuración > Dispositivos.');

  await ThermalPrinter.printText({
    printerId: profile.id,
    paperWidthMm: paperWidth,
    encoding: 'WPC1252',
    items: [
      { type: 'qrcode', value: qrUrl, size: 5, align: 'center', errorCorrection: 'M' },
      ...text.split('\n').map((line) => ({
        type: 'text' as const,
        value: line,
        style: { bold: boldLines.has(line.trim()) },
      })),
    ],
    cut: true,
    feedLines: 3,
  });
}
