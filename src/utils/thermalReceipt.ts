import type { Draw, Ticket } from '../store/useStore';
import { formatAMPM, formatCurrency, formatPlayNumberForDisplay, getCustomerDisplayName } from './helpers';
import { normalizeTicketDrawEntries } from './ticketUtils';

export type ThermalPaperWidth = 58 | 80;

const stripUnsupportedCharacters = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\x20-\x7E]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const wrapText = (value: string, width: number): string[] => {
  const text = stripUnsupportedCharacters(value);
  if (!text) return [''];
  const lines: string[] = [];
  let line = '';

  text.split(' ').forEach((word) => {
    if (word.length > width) {
      if (line) lines.push(line);
      line = '';
      for (let offset = 0; offset < word.length; offset += width) {
        const part = word.slice(offset, offset + width);
        if (part.length === width) lines.push(part);
        else line = part;
      }
      return;
    }

    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });

  if (line) lines.push(line);
  return lines;
};

const center = (value: string, width: number): string => {
  const text = stripUnsupportedCharacters(value).slice(0, width);
  const left = Math.floor((width - text.length) / 2);
  return `${' '.repeat(left)}${text}`;
};

const columns = (left: string, right: string, width: number): string => {
  const safeLeft = stripUnsupportedCharacters(left).slice(0, width);
  const safeRight = stripUnsupportedCharacters(right).slice(0, width);
  return `${safeLeft}${' '.repeat(Math.max(1, width - safeLeft.length - safeRight.length))}${safeRight}`;
};

const formatDrawHeading = (drawName: string, drawTime?: string): string => {
  const cleanedName = stripUnsupportedCharacters(drawName || 'Sorteo');
  const embeddedTime = cleanedName.match(/\b\d{1,2}(?::\d{2})?\s*(?:AM|PM|MD|MN)\b/i)?.[0];
  const title = embeddedTime
    ? cleanedName.replace(embeddedTime, '').replace(/[|·()-]/g, ' ').replace(/\s+/g, ' ').trim()
    : cleanedName;
  const time = drawTime ? formatAMPM(drawTime) : embeddedTime;
  return [time, title].filter(Boolean).join(' ') || 'Sorteo';
};

export function formatThermalReceipt(ticket: Ticket, draws: Draw[], paperWidth: ThermalPaperWidth = 58): string {
  const width = paperWidth === 58 ? 32 : 48;
  const drawGroups = normalizeTicketDrawEntries(ticket);
  const lines = [
    center('LOTTOPRO', width),
    center('COMPROBANTE DE VENTA', width),
    '-'.repeat(width),
    ...wrapText(`Fecha: ${new Date(ticket.timestamp).toLocaleDateString('es-ES')}`, width),
    ...wrapText(`Hora: ${new Date(ticket.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`, width),
    ...wrapText(`Cliente: ${getCustomerDisplayName(ticket.customerName, ticket.sequenceNumber, ticket.id)}`, width),
    ...wrapText(`Vendedor: ${ticket.sellerName || 'N/A'}`, width),
    `Ticket: ${ticket.id.slice(0, 12).toUpperCase()}`,
    '-'.repeat(width),
  ];

  drawGroups.forEach((group) => {
    const draw = draws.find((item) => item.id === group.drawId);
    const drawLabel = formatDrawHeading(group.drawName || draw?.name || 'Sorteo', draw?.drawTime);
    lines.push(...wrapText(drawLabel, width));

    const numbers = group.entries.map((entry) => {
      const number = stripUnsupportedCharacters(formatPlayNumberForDisplay(entry.number, entry.type));
      if (entry.type === 'CHANCE') return `${entry.pieces}x${number}`;
      const type = entry.type === 'PALÉ' ? 'PL' : 'BL';
      return `${type} ${number}`;
    }).join(' | ');
    lines.push(...wrapText(numbers, width));

    lines.push(columns(`TX: ${ticket.id.slice(0, 8)}`, `$${formatCurrency(group.subtotal)}`, width));
    const groupPrize = group.entries.reduce((sum, entry) => sum + (entry.prize || 0), 0);
    if (groupPrize > 0) lines.push(columns('PREMIO', `$${formatCurrency(groupPrize)}`, width));
    lines.push('.'.repeat(width));
  });

  if (ticket.totalPrize && ticket.totalPrize > 0) {
    lines.push(columns('TOTAL PREMIOS', `$${formatCurrency(ticket.totalPrize)}`, width));
  }
  lines.push('-'.repeat(width));
  lines.push(columns('TOTAL', `$${formatCurrency(ticket.total)}`, width));
  lines.push('-'.repeat(width));
  lines.push(...wrapText('Sin comprobante no se pagan premios.', width).map((line) => center(line, width)));
  lines.push(center('GRACIAS POR SU COMPRA', width));
  lines.push('');

  return lines.join('\n');
}

export function getThermalReceiptBoldLines(ticket: Ticket, draws: Draw[], paperWidth: ThermalPaperWidth): Set<string> {
  const width = paperWidth === 58 ? 32 : 48;
  const drawGroups = normalizeTicketDrawEntries(ticket);
  const drawHeadings = new Set(drawGroups.flatMap((group) => {
    const draw = draws.find((item) => item.id === group.drawId);
    return wrapText(formatDrawHeading(group.drawName || draw?.name || 'Sorteo', draw?.drawTime), width).map((line) => line.trim());
  }));
  const date = new Date(ticket.timestamp);
  const boldHeaderLines = [
    center('LOTTOPRO', width),
    center('COMPROBANTE DE VENTA', width),
    ...wrapText(`Fecha: ${date.toLocaleDateString('es-ES')}`, width),
    ...wrapText(`Hora: ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`, width),
    ...wrapText(`Cliente: ${getCustomerDisplayName(ticket.customerName, ticket.sequenceNumber, ticket.id)}`, width),
    ...wrapText(`Vendedor: ${ticket.sellerName || 'N/A'}`, width),
    `Ticket: ${ticket.id.slice(0, 12).toUpperCase()}`,
  ];

  return new Set([
    ...boldHeaderLines,
    ...drawHeadings,
    ...formatThermalReceipt(ticket, draws, paperWidth).split('\n').filter((line) => {
    const content = line.trim();
      return /^(TX:|PREMIO|TOTAL)/i.test(content);
    }).map((line) => line.trim()),
  ].map((line) => line.trim()));
}
