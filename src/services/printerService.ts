import { Capacitor } from '@capacitor/core';
import { ThermalPrinter, type DiscoveredPrinter, type PrinterProfile } from '@delicity/capacitor-thermal-printer';
import { THERMAL_PAPER_WIDTHS, getReceiptColumns, type ThermalPaperWidth } from '../utils/thermalReceipt';

export const isNativePrinterAvailable = (): boolean => Capacitor.isNativePlatform();

const WEB_PAPER_KEY = 'lottopro.paperWidth';

export function getWebPaperWidth(): ThermalPaperWidth {
  const saved = Number(localStorage.getItem(WEB_PAPER_KEY));
  return (THERMAL_PAPER_WIDTHS as readonly number[]).includes(saved) ? (saved as ThermalPaperWidth) : 58;
}

export function setWebPaperWidth(width: ThermalPaperWidth): void {
  localStorage.setItem(WEB_PAPER_KEY, String(width));
}

const WEB_PRINTER_KEY = 'lottopro.webPrinter';
const WEB_PROFILE_KEY = 'lottopro.webPrinterProfile';
// Servicios GATT habituales de impresoras térmicas BLE.
const WEB_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
];

export const WEB_PRINTER_PROFILES = {
  generic: { label: 'Genérica ESC/POS BLE', chunkSize: 100 },
  compat: { label: 'Compatibilidad (paquetes cortos)', chunkSize: 20 },
} as const;
export type WebPrinterProfileId = keyof typeof WEB_PRINTER_PROFILES;

export interface WebPrinter {
  id: string;
  name: string;
}

let webDevice: any = null;

export const isWebBluetoothAvailable = (): boolean =>
  typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;

export function getWebPrinter(): WebPrinter | null {
  try {
    return JSON.parse(localStorage.getItem(WEB_PRINTER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function getWebPrinterProfile(): WebPrinterProfileId {
  const saved = localStorage.getItem(WEB_PROFILE_KEY);
  return saved && saved in WEB_PRINTER_PROFILES ? (saved as WebPrinterProfileId) : 'generic';
}

export function setWebPrinterProfile(profile: WebPrinterProfileId): void {
  localStorage.setItem(WEB_PROFILE_KEY, profile);
}

export function forgetWebPrinter(): void {
  if (webDevice?.gatt?.connected) webDevice.gatt.disconnect();
  webDevice = null;
  localStorage.removeItem(WEB_PRINTER_KEY);
}

export async function connectWebPrinter(): Promise<WebPrinter> {
  const device = await (navigator as any).bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: WEB_PRINTER_SERVICES,
  });
  webDevice = device;
  const printer = { id: device.id, name: device.name || 'Impresora Bluetooth' };
  localStorage.setItem(WEB_PRINTER_KEY, JSON.stringify(printer));
  return printer;
}

async function resolveWebDevice(): Promise<any> {
  if (webDevice) return webDevice;
  const saved = getWebPrinter();
  const bluetooth = (navigator as any).bluetooth;
  if (!saved || !bluetooth?.getDevices) return null;
  const granted: any[] = await bluetooth.getDevices();
  webDevice = granted.find((item) => item.id === saved.id) || null;
  return webDevice;
}

function buildEscPosBytes(text: string): Uint8Array {
  const body = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const bytes = Array.from(body, (char) => (char.charCodeAt(0) < 256 ? char.charCodeAt(0) : 63));
  return new Uint8Array([0x1b, 0x40, ...bytes, 0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x42, 0x00]);
}

export async function printWebBluetoothText(text: string): Promise<void> {
  const device = await resolveWebDevice();
  if (!device?.gatt) throw new Error('PRINTER_NOT_FOUND');
  const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
  let characteristic: any = null;
  for (const serviceId of WEB_PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceId);
      const candidates = await service.getCharacteristics();
      characteristic = candidates.find((item: any) => item.properties.write || item.properties.writeWithoutResponse);
      if (characteristic) break;
    } catch {
      // Esta impresora no expone ese servicio.
    }
  }
  if (!characteristic) throw new Error('CONNECTION_FAILED');

  const { chunkSize } = WEB_PRINTER_PROFILES[getWebPrinterProfile()];
  const data = buildEscPosBytes(text);
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    const chunk = data.slice(offset, offset + chunkSize);
    if (characteristic.properties.writeWithoutResponse) await characteristic.writeValueWithoutResponse(chunk);
    else await characteristic.writeValue(chunk);
  }
}

export function printThermalPreview(text: string, paperWidth: ThermalPaperWidth, boldLines: Set<string>): Promise<void> {
  const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = text
    .split('\n')
    .map((line) => (boldLines.has(line) ? `<b>${escapeHtml(line)}</b>` : escapeHtml(line)))
    .join('\n');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>@page{size:${paperWidth}mm auto;margin:0}html,body{margin:0;padding:0;background:#fff}pre{margin:0;padding:2mm;width:${paperWidth}mm;box-sizing:border-box;font:${Math.floor(((paperWidth - 4) * 3.78) / (getReceiptColumns(paperWidth) * 0.6))}px/1.25 'Courier New',monospace;color:#000;white-space:pre-wrap;word-break:break-all}</style></head><body><pre>${body}</pre></body></html>`;

  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        resolve();
      } catch (error) {
        reject(error);
      }
      window.setTimeout(() => frame.remove(), 60000);
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}

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
  selectedPrinterId?: string,
): Promise<void> {
  const { profile } = selectedPrinterId
    ? { profile: { id: selectedPrinterId } as PrinterProfile }
    : await ThermalPrinter.getDefaultPrinter();
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
