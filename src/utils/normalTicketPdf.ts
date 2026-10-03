import QRCode from 'qrcode';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { AppSettings, Draw, Ticket } from '../store/useStore';
import { calculateEntryPrize } from './prizeCalculator';
import { formatCurrency, formatPlayNumberForDisplay, getCustomerDisplayName } from './helpers';
import { normalizeTicketDrawEntries } from './ticketUtils';

const PAGE_WIDTH = 400;
const MARGIN = 24;
const MAX_PAGE_HEIGHT = 13500;
const BRAND = rgb(22 / 255, 163 / 255, 74 / 255);
const DARK = rgb(15 / 255, 23 / 255, 42 / 255);
const MUTED = rgb(100 / 255, 116 / 255, 139 / 255);
const LIGHT = rgb(241 / 255, 245 / 255, 249 / 255);
const PALE_GREEN = rgb(240 / 255, 253 / 255, 244 / 255);

const cleanText = (value: string, supported: Set<number>): string => [...value.normalize('NFC')]
  .filter((character) => {
    const code = character.codePointAt(0) || 0;
    return supported.has(code) && !/\p{Extended_Pictographic}/u.test(character) && !(code >= 0x1f1e6 && code <= 0x1f1ff);
  })
  .join('')
  .replace(/\s+/g, ' ')
  .trim();

function wrapToWidth(value: string, font: PDFFont, size: number, maxWidth: number, supported: Set<number>): string[] {
  const text = cleanText(value, supported);
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ').filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = '';
    let part = '';
    for (const character of word) {
      const next = part + character;
      if (font.widthOfTextAtSize(next, size) > maxWidth && part) {
        lines.push(part);
        part = character;
      } else {
        part = next;
      }
    }
    current = part;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

export async function createNormalTicketPdf(ticket: Ticket, draws: Draw[], settings: AppSettings): Promise<Uint8Array> {
  const groups = normalizeTicketDrawEntries(ticket).map((group) => {
    const draw = draws.find((item) => item.id === group.drawId);
    const resultsAvailable = draw?.results?.length === 3;
    const entries = group.entries.map((entry) => ({
      entry,
      outcome: resultsAvailable && draw
        ? calculateEntryPrize(entry, draw, settings)
        : { prize: entry.prize || 0, winningPosition: entry.winningPosition },
    }));
    return {
      group,
      draw,
      entries,
      hasResults: !!resultsAvailable,
      prizes: entries.reduce((sum, item) => sum + item.outcome.prize, 0),
    };
  });

  const totalPrize = ticket.totalPrize || groups.reduce((sum, group) => sum + group.prizes, 0);
  const estimatedHeight = 360 + (totalPrize > 0 ? 48 : 0) + groups.reduce((height, item) => (
    height + 74 + item.entries.length * 22 + (item.hasResults ? 0 : 0)
  ), 0);
  const scale = Math.min(1, MAX_PAGE_HEIGHT / estimatedHeight);
  const pageHeight = estimatedHeight * scale;
  const document = await PDFDocument.create();
  document.setTitle(`Ticket ${ticket.id.slice(0, 8).toUpperCase()}`);
  document.setSubject('Comprobante de venta LottoPro');
  document.setCreator('LottoPro');
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const supported = new Set(regular.getCharacterSet());
  const page = document.addPage([PAGE_WIDTH * scale, pageHeight]);
  const drawText = (value: string, x: number, top: number, size: number, font: PDFFont, color = DARK) => {
    const safe = cleanText(value, supported);
    page.drawText(safe, { x: x * scale, y: pageHeight - (top + size) * scale, size: size * scale, font, color });
  };
  const drawLine = (top: number, color = LIGHT, thickness = 0.7) => {
    page.drawLine({ start: { x: MARGIN * scale, y: pageHeight - top * scale }, end: { x: (PAGE_WIDTH - MARGIN) * scale, y: pageHeight - top * scale }, color, thickness: thickness * scale });
  };
  const drawRect = (x: number, top: number, width: number, height: number, color: ReturnType<typeof rgb>, borderColor?: ReturnType<typeof rgb>) => {
    page.drawRectangle({ x: x * scale, y: pageHeight - (top + height) * scale, width: width * scale, height: height * scale, color, ...(borderColor ? { borderColor, borderWidth: 0.8 * scale } : {}) });
  };
  const drawWrapped = (value: string, x: number, top: number, size: number, maxWidth: number, font: PDFFont, color = DARK): number => {
    const lines = wrapToWidth(value, font, size, maxWidth, supported);
    lines.forEach((line, index) => drawText(line, x, top + index * (size + 3), size, font, color));
    return lines.length * (size + 3);
  };

  let y = 24;
  drawText('LOTTOPRO', MARGIN, y, 24, bold, BRAND);
  drawText('COMPROBANTE OFICIAL', MARGIN, y + 29, 8, bold, MUTED);
  const qrUrl = await QRCode.toDataURL(`${window.location.origin}/ticket/${ticket.id}`, { errorCorrectionLevel: 'H', margin: 1, width: 256 });
  const qrBase64 = qrUrl.slice(qrUrl.indexOf(',') + 1);
  const qrImage = await document.embedPng(Uint8Array.from(atob(qrBase64), (character) => character.charCodeAt(0)));
  const qrSize = 52;
  page.drawImage(qrImage, { x: (PAGE_WIDTH - MARGIN - qrSize) * scale, y: pageHeight - (y + qrSize) * scale, width: qrSize * scale, height: qrSize * scale });
  y += 58;

  drawLine(y, rgb(226 / 255, 232 / 255, 240 / 255));
  y += 10;
  drawText('FECHA', MARGIN, y, 7, bold, MUTED);
  drawText('HORA', PAGE_WIDTH - MARGIN - 100, y, 7, bold, MUTED);
  y += 11;
  drawText(new Date(ticket.timestamp).toLocaleDateString('es-ES'), MARGIN, y, 10, bold);
  drawText(new Date(ticket.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), PAGE_WIDTH - MARGIN - 100, y, 10, bold);
  y += 18;
  drawLine(y, rgb(226 / 255, 232 / 255, 240 / 255));
  y += 10;

  const customer = getCustomerDisplayName(ticket.customerName, ticket.sequenceNumber, ticket.id);
  const seller = `ID: ${ticket.sellerId || '---'}`;
  const customerLines = wrapToWidth(customer, bold, 10, 205, supported);
  const sellerLines = wrapToWidth(seller, bold, 10, 110, supported);
  const personRows = Math.max(customerLines.length, sellerLines.length);
  customerLines.forEach((line, index) => drawText(index === 0 ? 'CLIENTE' : '', MARGIN, y, 7, bold, MUTED));
  sellerLines.forEach((line, index) => drawText(index === 0 ? 'VENDEDOR' : '', PAGE_WIDTH - MARGIN - 110, y, 7, bold, MUTED));
  y += 10;
  for (let index = 0; index < personRows; index += 1) {
    if (customerLines[index]) drawText(customerLines[index], MARGIN, y, 10, bold);
    if (sellerLines[index]) drawText(sellerLines[index], PAGE_WIDTH - MARGIN - 110, y, 10, bold);
    y += 14;
  }
  drawLine(y, rgb(226 / 255, 232 / 255, 240 / 255));
  y += 12;

  if (totalPrize > 0) {
    drawRect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, 44, PALE_GREEN, rgb(187 / 255, 247 / 255, 208 / 255));
    drawText('TICKET PREMIADO', MARGIN, y + 7, 8, bold, BRAND);
    drawText(`$${formatCurrency(totalPrize)}`, MARGIN, y + 19, 18, bold, BRAND);
    y += 54;
  }

  groups.forEach(({ group, draw, entries, hasResults, prizes }) => {
    const drawName = group.drawName || draw?.name || 'Sorteo';
    const drawHeading = wrapToWidth(drawName, bold, 11, 220, supported);
    const prizeText = prizes > 0 ? `PREMIO: $${formatCurrency(prizes)}` : '';
    const sectionHeaderHeight = Math.max(drawHeading.length * 14, 15) + 6;
    drawRect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, sectionHeaderHeight, rgb(240 / 255, 253 / 255, 244 / 255));
    drawHeading.forEach((line, index) => drawText(line, MARGIN + 6, y + 4 + index * 14, 11, bold, BRAND));
    if (prizeText) drawText(prizeText, PAGE_WIDTH - MARGIN - 88, y + 5, 8, bold, BRAND);
    y += sectionHeaderHeight + 3;

    const resultWidth = hasResults ? 48 : 0;
    const headers = [
      { text: 'NUMERO', x: MARGIN + 4 },
      { text: 'CANT', x: MARGIN + 148 },
      { text: 'TIPO', x: MARGIN + 188 },
      { text: 'MONTO', x: PAGE_WIDTH - MARGIN - 116 },
      ...(hasResults ? [{ text: 'PREMIO', x: PAGE_WIDTH - MARGIN - resultWidth }] : []),
    ];
    headers.forEach(({ text, x }) => drawText(text, x, y, 7, bold, MUTED));
    y += 13;
    drawLine(y - 2, rgb(226 / 255, 232 / 255, 240 / 255));

    entries.forEach(({ entry, outcome }) => {
      const number = formatPlayNumberForDisplay(entry.number, entry.type) + (outcome.winningPosition ? ` (${outcome.winningPosition})` : '');
      drawText(number, MARGIN + 4, y, 9, bold);
      drawText(String(entry.pieces), MARGIN + 151, y, 9, regular, MUTED);
      drawText(entry.type === 'CHANCE' ? 'CH' : entry.type === 'PALÉ' ? 'PL' : 'BL', MARGIN + 190, y, 8, regular, MUTED);
      drawText(`$${formatCurrency(entry.amount)}`, PAGE_WIDTH - MARGIN - 116, y, 9, bold);
      if (hasResults) drawText(outcome.prize > 0 ? `$${formatCurrency(outcome.prize)}` : '-', PAGE_WIDTH - MARGIN - resultWidth, y, 9, outcome.prize > 0 ? bold : regular, outcome.prize > 0 ? BRAND : MUTED);
      y += 16;
      drawLine(y - 3, rgb(241 / 255, 245 / 255, 249 / 255), 0.4);
    });

    drawText(`TX: ${ticket.id.slice(0, 8).toUpperCase()}`, MARGIN + 4, y + 2, 7, regular, MUTED);
    drawText(`SUBTOTAL: $${formatCurrency(group.subtotal)}`, PAGE_WIDTH - MARGIN - 116, y, 9, bold);
    y += 22;
  });

  y += 4;
  drawRect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, 48, BRAND);
  drawText('TOTAL GENERAL', MARGIN + 12, y + 15, 10, bold, rgb(1, 1, 1));
  drawText(`$${formatCurrency(ticket.total)}`, PAGE_WIDTH - MARGIN - 100, y + 11, 18, bold, rgb(1, 1, 1));
  y += 60;
  drawLine(y, rgb(226 / 255, 232 / 255, 240 / 255));
  y += 10;
  const notice = 'IMPORTANTE: Sin comprobante no se pagan premios. Verifique su jugada antes de retirarse.';
  const noticeLines = wrapToWidth(notice, regular, 8, PAGE_WIDTH - MARGIN * 2, supported);
  noticeLines.forEach((line, index) => drawText(line, MARGIN, y + index * 11, 8, regular, MUTED));
  y += noticeLines.length * 11 + 8;
  drawText('GRACIAS POR SU COMPRA', MARGIN, y, 9, bold, BRAND);

  return document.save();
}
