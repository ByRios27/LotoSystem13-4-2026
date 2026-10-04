import { Draw, Entry, AppSettings, WinningPosition } from '../store/useStore';
import { getPaleParts } from './helpers';
import { getResultDigitsForPlay, getWinningPosition, hasCompleteDrawResults } from './drawUtils';

export function calculateEntryPrize(entry: Entry, draw: Draw, settings: AppSettings): { prize: number; winningPosition?: WinningPosition } {
  if (!hasCompleteDrawResults(draw)) {
    return { prize: 0 };
  }

  const results = draw.results || [];
  const [r1, r2, r3] = results;
  let prize = 0;
  let winningPosition: WinningPosition | undefined = undefined;

  const win1 = r1 ? getResultDigitsForPlay(draw, r1, 2, 'chance', 0) : '';
  const win2 = r2 ? getResultDigitsForPlay(draw, r2, 2, 'chance', 1) : '';
  const win3 = r3 ? getResultDigitsForPlay(draw, r3, 2, 'chance', 2) : '';

  if (entry.type === 'CHANCE') {
    // Find the price configuration for this specific entry, or fallback to the default one.
    const priceConfig = settings.chancePrices?.find(p => p.id === entry.priceId) 
                     || settings.chancePrices?.find(p => p.isDefault);

    // Get the payouts from the found config, or use a hardcoded fallback if the config or its payouts are missing.
    const chancePayouts = priceConfig?.payouts || { first: 60, second: 8, third: 4 };

    if (draw.drawType === 'special') {
      const defaultPayouts = [chancePayouts.first, chancePayouts.second, chancePayouts.third];
      results.forEach((result, index) => {
        const rule = draw.specialPrizeRules?.[index];
        if (rule ? !rule.chanceEnabled : draw.allowedSpecialBets.chance === false) return;
        const winningDigits = getResultDigitsForPlay(draw, result, 2, 'chance', index);
        const payout = rule?.chancePayoutPerPiece ?? draw.specialChancePayouts?.[index] ?? defaultPayouts[Math.min(index, 2)];
        if (entry.number === winningDigits) {
          prize += entry.pieces * payout;
          if (!winningPosition) winningPosition = getWinningPosition(index);
        }
      });
      return { prize, winningPosition };
    }

    const playedNum = entry.number.slice(-2);

    const chanceMatches: Array<{ result: string; payout: number; position: '1er' | '2do' | '3er' }> = [
      { result: (r1 || '').slice(-2), payout: chancePayouts.first, position: '1er' },
      { result: (r2 || '').slice(-2), payout: chancePayouts.second, position: '2do' },
      { result: (r3 || '').slice(-2), payout: chancePayouts.third, position: '3er' },
    ];
    
    const playedQuantity = entry.pieces;

    chanceMatches.forEach(({ result, payout, position }) => {
      if (playedNum === result) {
        prize += playedQuantity * payout;
        if (!winningPosition) winningPosition = position;
      }
    });
  } else if (entry.type === 'PALÉ') {
    const paleParts = getPaleParts(entry.number);
    if (!paleParts) {
      return { prize: 0 };
    }
    const [n1, n2] = paleParts;

    if (draw.drawType === 'special') {
      const defaultPalePayouts = settings.pale?.payouts || { firstSecond: 1000, firstThird: 1000, secondThird: 200 };
      const legacyPairs = [
        { firstPrizeIndex: 0, secondPrizeIndex: 1, enabled: true, multiplier: defaultPalePayouts.firstSecond },
        { firstPrizeIndex: 0, secondPrizeIndex: 2, enabled: true, multiplier: defaultPalePayouts.firstThird },
        { firstPrizeIndex: 1, secondPrizeIndex: 2, enabled: true, multiplier: defaultPalePayouts.secondThird },
      ];
      const pairs = draw.specialPalePairs?.length ? draw.specialPalePairs : legacyPairs;
      pairs.filter((pair) => pair.enabled).forEach((pair) => {
        const firstResult = results[pair.firstPrizeIndex];
        const secondResult = results[pair.secondPrizeIndex];
        if (!firstResult || !secondResult) return;
        const firstDigits = getResultDigitsForPlay(draw, firstResult, 2, 'chance', pair.firstPrizeIndex);
        const secondDigits = getResultDigitsForPlay(draw, secondResult, 2, 'chance', pair.secondPrizeIndex);
        if ((n1 === firstDigits && n2 === secondDigits) || (n1 === secondDigits && n2 === firstDigits)) {
          prize += entry.amount * pair.multiplier;
          if (!winningPosition) winningPosition = `${getWinningPosition(pair.firstPrizeIndex)} + ${getWinningPosition(pair.secondPrizeIndex)}`;
        }
      });
      return { prize, winningPosition };
    }
    
    const palePayouts = settings.pale?.payouts || { firstSecond: 1000, firstThird: 1000, secondThird: 200 };
    const matchesPair = (first: string, second: string) =>
      (n1 === first && n2 === second) || (n1 === second && n2 === first);

    if (matchesPair(win1, win2)) {
      prize = entry.amount * palePayouts.firstSecond;
      winningPosition = '1er + 2do';
    } else if (matchesPair(win1, win3)) {
      prize = entry.amount * palePayouts.firstThird;
      winningPosition = '1er + 3er';
    } else if (matchesPair(win2, win3)) {
      prize = entry.amount * palePayouts.secondThird;
      winningPosition = '2do + 3er';
    }
  } else if (entry.type === 'BILLETE') {
    if (draw.drawType !== 'special' && draw.digitsMode !== 4) return { prize: 0 };
      const billeteSettings = settings.billete || { unitPrice: 1.00, payouts: { firstPrize: { exact4: 0, exact3PrefixOrSuffix: 0, exact2PrefixOrSuffix: 0 }, secondPrize: { exact4: 0, exact3PrefixOrSuffix: 0, exact2PrefixOrSuffix: 0 }, thirdPrize: { exact4: 0, exact3PrefixOrSuffix: 0, exact2PrefixOrSuffix: 0 } } };
      const payouts = [billeteSettings.payouts.firstPrize, billeteSettings.payouts.secondPrize, billeteSettings.payouts.thirdPrize];

      draw.results.forEach((result, idx) => {
        const rule = draw.specialPrizeRules?.[idx];
        if (draw.drawType === 'special' && (!rule?.billeteEnabled || result.length < 4)) return;
        const payoutTable = payouts[Math.min(idx, payouts.length - 1)];
        const winningDigits = getResultDigitsForPlay(draw, result, 4, 'billete', idx);
        let bestPrizeForThisResult = 0;
        
        if (entry.number === winningDigits) {
          bestPrizeForThisResult = payoutTable.exact4;
        } else {
          const played3Prefix = entry.number.substring(0, 3);
          const played3Suffix = entry.number.substring(1, 4);
          const result3Prefix = winningDigits.substring(0, 3);
          const result3Suffix = winningDigits.substring(1, 4);
          
          if (played3Prefix === result3Prefix || played3Suffix === result3Suffix) {
            bestPrizeForThisResult = payoutTable.exact3PrefixOrSuffix;
          } else {
            const played2Prefix = entry.number.substring(0, 2);
            const played2Suffix = entry.number.substring(2, 4);
            const result2Prefix = winningDigits.substring(0, 2);
            const result2Suffix = winningDigits.substring(2, 4);
            
            if (played2Prefix === result2Prefix || played2Suffix === result2Suffix) {
              bestPrizeForThisResult = payoutTable.exact2PrefixOrSuffix;
            }
          }
        }
        
        if (bestPrizeForThisResult > 0) {
          prize += entry.pieces * bestPrizeForThisResult;
          if (idx === 0) winningPosition = '1er';
          else if (idx === 1 && !winningPosition) winningPosition = '2do';
          else if (idx === 2 && !winningPosition) winningPosition = '3er';
          else if (!winningPosition) winningPosition = getWinningPosition(idx);
        }
      });
  } else if (entry.type === 'BILLETE_ESPECIAL') {
    if (draw.drawType !== 'special') return { prize: 0 };
    const billeteDigits = draw.specialBilleteDigits || 5;
    results.forEach((result, index) => {
      const rule = draw.specialPrizeRules?.[index];
      if (!rule?.billeteExtraEnabled || result.length < billeteDigits) return;
      const winningDigits = getResultDigitsForPlay(draw, result, billeteDigits, 'billeteExtra', index);
      let matchedDigits = 0;
      for (let count = billeteDigits; count > 0; count--) {
        const prefixMatches = entry.number.slice(0, count) === winningDigits.slice(0, count);
        const suffixMatches = entry.number.slice(-count) === winningDigits.slice(-count);
        if (prefixMatches || suffixMatches) {
          matchedDigits = count;
          break;
        }
      }
      const payout = rule.billeteExtraPayouts[matchedDigits] || 0;
      if (payout > 0) {
        prize += entry.pieces * payout;
        if (!winningPosition) winningPosition = getWinningPosition(index);
      }
    });
  }

  return { prize, winningPosition };
}
