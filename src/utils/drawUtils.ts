import type { Draw, WinningPosition } from '../store/useStore';

const prizePositionLabels = ['1ro', '2do', '3ro', '4to', '5to', '6to', '7mo', '8vo', '9no', '10mo'];
const winningPositions: WinningPosition[] = ['1er', '2do', '3er', '4to', '5to', '6to', '7mo', '8vo', '9no', '10mo'];

export const getDrawPrizeCount = (draw: Pick<Draw, 'drawType' | 'prizeCount'>): number =>
  draw.drawType === 'special' ? Math.min(10, Math.max(1, Math.floor(draw.prizeCount || 3))) : 3;

export const getDrawPrizeDigits = (draw: Draw, index: number): number =>
  draw.drawType === 'special'
    ? draw.specialPrizeRules?.[index]?.resultDigits || draw.digitsMode
    : draw.digitsMode;

export const hasCompleteDrawResults = (draw: Pick<Draw, 'drawType' | 'prizeCount' | 'results' | 'digitsMode' | 'specialPrizeRules'>): boolean =>
  Array.isArray(draw.results)
  && draw.results.length === getDrawPrizeCount(draw)
  && draw.results.every((result, index) => typeof result === 'string' && result.length === getDrawPrizeDigits(draw as Draw, index));

export const getPrizePositionLabel = (index: number): string =>
  prizePositionLabels[index] || `${index + 1}mo`;

export const getWinningPosition = (index: number): WinningPosition =>
  winningPositions[index] || '10mo';

export const getResultDigitsForPlay = (draw: Draw, result: string, digitCount: number, play: 'chance' | 'billete' | 'billeteExtra', prizeIndex = 0): string => {
  const rule = draw.drawType === 'special' ? draw.specialPrizeRules?.[prizeIndex] : undefined;
  const position = draw.drawType === 'special'
    ? play === 'chance'
      ? rule?.chanceSegment || draw.chanceMatchPosition || 'last'
      : play === 'billete'
        ? rule?.billeteSegment || draw.billeteMatchPosition || 'last'
        : rule?.billeteExtraSegment || 'last'
    : 'last';
  return position === 'first' ? result.slice(0, digitCount) : result.slice(-digitCount);
};