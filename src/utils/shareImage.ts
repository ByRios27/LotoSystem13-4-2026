import { Capacitor } from '@capacitor/core';
import { toPng } from 'html-to-image';

type ShareImageOverrides = {
  pixelRatio?: number;
  backgroundColor?: string;
  skipFonts?: boolean;
  skipAutoScale?: boolean;
  style?: Record<string, string>;
};

const DEFAULT_EXPORT_OPTIONS = {
  pixelRatio: 3,
  backgroundColor: '#ffffff',
  skipFonts: false,
  cacheBust: true,
  style: {
    borderRadius: '0px',
  },
};

export async function exportNodeAsPng(node: HTMLElement, overrides: ShareImageOverrides = {}) {
  return toPng(node, {
    ...DEFAULT_EXPORT_OPTIONS,
    ...overrides,
    style: {
      ...DEFAULT_EXPORT_OPTIONS.style,
      ...(overrides.style || {}),
    },
  });
}

export async function exportNodeAsAdaptivePng(node: HTMLElement) {
  const bounds = node.getBoundingClientRect();
  const width = Math.max(1, node.scrollWidth, bounds.width);
  const height = Math.max(1, node.scrollHeight, bounds.height);
  const supportsLargeCanvas = Capacitor.getPlatform() === 'android'
    || (Capacitor.getPlatform() === 'web' && !/iPhone|iPad|iPod/i.test(navigator.userAgent));
  const maxDimension = supportsLargeCanvas ? 32760 : 16384;
  const maxPixels = supportsLargeCanvas ? 16000000 : 8000000;
  const pixelRatio = Math.min(
    3,
    maxDimension / width,
    maxDimension / height,
    Math.sqrt(maxPixels / (width * height)),
  );

  return exportNodeAsPng(node, { pixelRatio, skipAutoScale: true });
}
