import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAMPM(time: string) {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  let h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12; // the hour '0' should be '12'
  return `${h}:${minutes} ${ampm}`;
}

export function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function generateSellerId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function normalizePale(number: string) {
  const digitsOnly = (number || '').replace(/\D/g, '');
  if (digitsOnly.length !== 4) return number;
  const n1 = digitsOnly.substring(0, 2);
  const n2 = digitsOnly.substring(2, 4);
  return [n1, n2].sort().join('-');
}

export function getPaleParts(number: string): [string, string] | null {
  const digitsOnly = (number || '').replace(/\D/g, '');
  if (digitsOnly.length !== 4) return null;
  const n1 = digitsOnly.substring(0, 2);
  const n2 = digitsOnly.substring(2, 4);
  const sorted = [n1, n2].sort();
  return [sorted[0], sorted[1]];
}

export function formatPlayNumberForDisplay(number: string, type?: string): string {
  if (!number) return '';
  const normalizedType = (type || '').toUpperCase();
  const isPaleType = normalizedType === 'PALÉ' || normalizedType === 'PALÃ‰' || normalizedType === 'PALE';
  if (!isPaleType) return number;

  const paleParts = getPaleParts(number);
  if (!paleParts) return number;
  return `${paleParts[0]}-${paleParts[1]}`;
}

export function getCustomerDisplayName(
  customerName?: string,
  sequenceNumber?: number,
  fallbackSeed?: string,
): string {
  const cleanName = (customerName || '').trim();
  if (cleanName) return cleanName.toUpperCase();

  if (typeof sequenceNumber === 'number' && Number.isFinite(sequenceNumber)) {
    return `CLIENTE GENERAL ${sequenceNumber.toString().padStart(4, '0')}`;
  }

  const fallback = (fallbackSeed || '').replace(/\W/g, '').slice(-4).toUpperCase();
  return fallback ? `CLIENTE GENERAL ${fallback}` : 'CLIENTE GENERAL';
}

export function getCurrentTimeMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function getBusinessDate(timestamp = Date.now()): string {
  const shiftedDate = new Date(timestamp - 2 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Panama',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(shiftedDate);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function sortDrawsByTime<T extends { drawTimeSort?: number; drawTime?: string }>(draws: T[]): T[] {
  const now = getCurrentTimeMinutes();

  return [...draws].sort((a, b) => {
    const getMinutes = (draw: T) => {
      if (typeof draw.drawTimeSort === 'number') return draw.drawTimeSort;
      if (!draw.drawTime) return Number.POSITIVE_INFINITY;
      const [hours, minutes] = draw.drawTime.split(':').map(Number);
      return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : Number.POSITIVE_INFINITY;
    };
    const aMinutes = getMinutes(a);
    const bMinutes = getMinutes(b);

    if (!Number.isFinite(aMinutes)) return Number.isFinite(bMinutes) ? 1 : 0;
    if (!Number.isFinite(bMinutes)) return -1;

    const getDistanceFromNow = (minutes: number) => {
      const delta = minutes - now;
      return delta < 0 ? delta + 24 * 60 : delta;
    };

    return getDistanceFromNow(aMinutes) - getDistanceFromNow(bMinutes) || aMinutes - bMinutes;
  });
}

export function sortDrawsChronologically<T extends { drawTimeSort?: number; drawTime?: string }>(draws: T[]): T[] {
  const getMinutes = (draw: T) => {
    if (typeof draw.drawTimeSort === 'number') return draw.drawTimeSort;
    if (!draw.drawTime) return Number.POSITIVE_INFINITY;
    const [hours, minutes] = draw.drawTime.split(':').map(Number);
    return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : Number.POSITIVE_INFINITY;
  };

  return [...draws].sort((a, b) => getMinutes(a) - getMinutes(b));
}

export function sortDrawsByScheduleDescending<T extends { drawTimeSort?: number; drawTime?: string }>(draws: T[]): T[] {
  return sortDrawsChronologically(draws).reverse();
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function getDrawStatus(draw: { closeTimeSort?: number; results?: string[] }): 'open' | 'closed' {
  if (draw.results && draw.results.length > 0) return 'closed';
  if (draw.closeTimeSort === undefined) return 'open';
  const now = getCurrentTimeMinutes();
  return now >= draw.closeTimeSort ? 'closed' : 'open';
}
