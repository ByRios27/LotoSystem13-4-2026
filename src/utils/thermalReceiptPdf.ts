import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import type { Draw, Ticket } from '../store/useStore';
import { formatThermalReceipt, getThermalReceiptBoldLines, type ThermalPaperWidth } from './thermalReceipt';

const MM_TO_POINTS = 72 / 25.4;
const PAGE_HEIGHT = 297 * MM_TO_POINTS;
const HORIZONTAL_MARGIN = 5 * MM_TO_POINTS;
const TOP_MARGIN = 5 * MM_TO_POINTS;
const QR_SIZE = 18 * MM_TO_POINTS;
const LINE_HEIGHT = 8.6;
const LINES_PER_PAGE = 76;

export async function createThermalReceiptPdf(
  ticket: Ticket,
  draws: Draw[],
  paperWidth: ThermalPaperWidth,
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(`Recibo ${ticket.sequenceNumber}`);
  document.setSubject('Comprobante de venta LottoPro');
  document.setCreator('LottoPro');

  const font = await document.embedFont(StandardFonts.Courier);
  const boldFont = await document.embedFont(StandardFonts.CourierBold);
  const receiptLines = formatThermalReceipt(ticket, draws, paperWidth).split('\n');
  const boldLines = getThermalReceiptBoldLines(ticket, draws, paperWidth);
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const qrDataUrl = await QRCode.toDataURL(`${origin}/ticket/${ticket.id}`, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 320,
  });
  const qrBase64 = qrDataUrl.slice(qrDataUrl.indexOf(',') + 1);
  const qrBinary = atob(qrBase64);
  const qrData = Uint8Array.from(qrBinary, (character) => character.charCodeAt(0));
  const qrImage = await document.embedPng(qrData);
  const pageWidth = paperWidth * MM_TO_POINTS;
  const fontSize = 7.1;

  for (let offset = 0, pageIndex = 0; offset < receiptLines.length; offset += LINES_PER_PAGE, pageIndex += 1) {
    const page = document.addPage([pageWidth, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - TOP_MARGIN;

    if (pageIndex === 0) {
      page.drawImage(qrImage, {
        x: (pageWidth - QR_SIZE) / 2,
        y: y - QR_SIZE,
        width: QR_SIZE,
        height: QR_SIZE,
      });
      y -= QR_SIZE + 10;
    } else {
      page.drawText('LOTTOPRO - CONTINUACION', {
        x: HORIZONTAL_MARGIN,
        y: y - fontSize,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
      y -= LINE_HEIGHT * 2;
    }

    const pageLines = receiptLines.slice(offset, offset + LINES_PER_PAGE);
    pageLines.forEach((line) => {
      if (line) {
        page.drawText(line, {
          x: HORIZONTAL_MARGIN,
          y: y - fontSize,
          size: fontSize,
          font: boldLines.has(line.trim()) ? boldFont : font,
          color: rgb(0, 0, 0),
        });
      }
      y -= LINE_HEIGHT;
    });
  }

  return document.save();
}
