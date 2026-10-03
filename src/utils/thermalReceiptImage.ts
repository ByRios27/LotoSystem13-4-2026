import QRCode from 'qrcode';
import type { Draw, Ticket } from '../store/useStore';
import { formatAMPM, getCustomerDisplayName } from './helpers';
import { formatThermalReceipt, getThermalReceiptBoldLines, type ThermalPaperWidth } from './thermalReceipt';

const MAX_IMAGE_HEIGHT = 12000;
const SIDE_MARGIN = 12;
const FONT_SIZE = 18;
const LINE_HEIGHT = 25;
const HEADER_FONT_SIZE = 14;
const HEADER_LINE_HEIGHT = 17;
const QR_SIZE = 112;

const escapeXml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const wrapText = (value: string, maxChars: number): string[] => {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    if (word.length > maxChars) {
      if (line) lines.push(line);
      line = '';
      for (let offset = 0; offset < word.length; offset += maxChars) {
        const part = word.slice(offset, offset + maxChars);
        if (part.length === maxChars) lines.push(part);
        else line = part;
      }
      return;
    }
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
};

function getHeaderMetadata(ticket: Ticket, draws: Draw[], paperWidth: ThermalPaperWidth): string[] {
  const columns = paperWidth === 58 ? 32 : 48;
  const date = new Date(ticket.timestamp);
  const dateTime = `${date.toLocaleDateString('es-ES')} ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

  return [
    'LOTERIA - COMPROBANTE',
    ...wrapText(dateTime, columns),
    ...wrapText(`CLIENTE: ${getCustomerDisplayName(ticket.customerName, ticket.sequenceNumber, ticket.id)}`, Math.min(columns, 28)),
    ...wrapText(`VENDEDOR: ${ticket.sellerName || 'N/A'}`, Math.min(columns, 28)),
    `TX: ${ticket.id.slice(0, 8).toUpperCase()}`,
  ];
}

const createSvgPage = (
  width: number,
  height: number,
  qrDataUrl: string,
  headerLines: string[],
  bodyLines: string[],
  continuation: boolean,
  boldLines: ReadonlySet<string>,
): string => {
  const qrSize = continuation ? 0 : QR_SIZE;
  const metadataX = continuation ? SIDE_MARGIN : SIDE_MARGIN + qrSize + 12;
  const metadataWidth = width - metadataX - SIDE_MARGIN;
  const charWidth = HEADER_FONT_SIZE * 0.6;
  const metadataColumns = Math.max(12, Math.floor(metadataWidth / charWidth));
  const shownHeader = continuation ? ['LOTERIA - CONTINUACION'] : headerLines.flatMap((line) => wrapText(line, metadataColumns));
  const headerHeight = Math.max(qrSize, shownHeader.length * HEADER_LINE_HEIGHT) + 12;
  const headerSvg = continuation ? '' : `<image href="${qrDataUrl}" x="${SIDE_MARGIN}" y="${SIDE_MARGIN}" width="${QR_SIZE}" height="${QR_SIZE}" />`;
  const headerTextSvg = shownHeader.map((line, index) => (
    `<text x="${metadataX}" y="${SIDE_MARGIN + HEADER_FONT_SIZE + index * HEADER_LINE_HEIGHT}" font-family="monospace" font-size="${HEADER_FONT_SIZE}" font-weight="700" fill="#000">${escapeXml(line)}</text>`
  )).join('');
  const bodyStartY = SIDE_MARGIN + headerHeight + FONT_SIZE;
  const bodySvg = bodyLines.map((line, index) => (
    `<text x="${SIDE_MARGIN}" y="${bodyStartY + index * LINE_HEIGHT}" font-family="monospace" font-size="${FONT_SIZE}" font-weight="${boldLines.has(line.trim()) ? '700' : '400'}" fill="#000">${escapeXml(line)}</text>`
  )).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fff"/>${headerSvg}${headerTextSvg}${bodySvg}</svg>`;
};

export async function createThermalReceiptImages(
  ticket: Ticket,
  draws: Draw[],
  paperWidth: ThermalPaperWidth,
): Promise<Blob[]> {
  const columns = paperWidth === 58 ? 32 : 48;
  const imageWidth = columns * 12;
  const headerLines = getHeaderMetadata(ticket, draws, paperWidth);
  const fullTextLines = formatThermalReceipt(ticket, draws, paperWidth).split('\n');
  const boldLines = getThermalReceiptBoldLines(ticket, draws, paperWidth);
  const ticketLineIndex = fullTextLines.findIndex((line) => line.startsWith('Ticket:'));
  const bodyLines = fullTextLines.slice(ticketLineIndex >= 0 ? ticketLineIndex + 2 : 0);
  const qrDataUrl = await QRCode.toDataURL(`${window.location.origin}/ticket/${ticket.id}`, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 384,
  });

  const renderedImages: Blob[] = [];
  let bodyOffset = 0;
  let pageIndex = 0;
  while (bodyOffset < bodyLines.length || pageIndex === 0) {
    const continuation = pageIndex > 0;
    const shownHeader = continuation ? ['LOTERIA - CONTINUACION'] : headerLines;
    const metadataColumns = continuation ? columns : Math.max(12, Math.floor((imageWidth - SIDE_MARGIN * 2 - QR_SIZE - 12) / (HEADER_FONT_SIZE * 0.6)));
    const wrappedHeader = shownHeader.flatMap((line) => wrapText(line, metadataColumns));
    const headerHeight = Math.max(continuation ? 0 : QR_SIZE, wrappedHeader.length * HEADER_LINE_HEIGHT) + 12;
    const pageBodyCapacity = Math.max(1, Math.floor((MAX_IMAGE_HEIGHT - headerHeight - SIDE_MARGIN * 2) / LINE_HEIGHT));
    const pageLines = bodyLines.slice(bodyOffset, bodyOffset + pageBodyCapacity);
    const pageHeight = SIDE_MARGIN * 2 + headerHeight + FONT_SIZE + pageLines.length * LINE_HEIGHT;
    const svg = createSvgPage(imageWidth, pageHeight, qrDataUrl, shownHeader, pageLines, continuation, boldLines);
    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('No se pudo dibujar el recibo térmico.'));
    });
    image.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      await loaded;
      const canvas = document.createElement('canvas');
      canvas.width = imageWidth;
      canvas.height = pageHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('El dispositivo no pudo preparar la imagen del recibo.');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error('No se pudo exportar la imagen del recibo.')), 'image/png');
      });
      renderedImages.push(blob);
    } finally {
      URL.revokeObjectURL(image.src);
    }

    bodyOffset += pageLines.length;
    pageIndex += 1;
  }

  return renderedImages;
}
