import { Draw, Entry, AppSettings, WinningPosition } from '../store/useStore';
import { getPaleParts } from './helpers';

export function calculateEntryPrize(entry: Entry, draw: Draw, settings: AppSettings): { prize: number; winningPosition?: WinningPosition } {
  if (!draw.results || draw.results.length !== 3) {
    return { prize: 0 };
  }

  const [r1, r2, r3] = draw.results;
  let prize = 0;
  let winningPosition: WinningPosition | undefined = undefined;

  const win1 = r1.slice(-2);
  const win2 = r2.slice(-2);
  const win3 = r3.slice(-2);

  if (entry.type === 'CHANCE') {
    const playedNum = entry.number.slice(-2);

    // Find the price configuration for this specific entry, or fallback to the default one.
    const priceConfig = settings.chancePrices?.find(p => p.id === entry.priceId) 
                     || settings.chancePrices?.find(p => p.isDefault);

    // Get the payouts from the found config, or use a hardcoded fallback if the config or its payouts are missing.
    const chancePayouts = priceConfig?.payouts || { first: 60, second: 8, third: 4 };

    const chanceMatches: Array<{ result: string; payout: number; position: '1er' | '2do' | '3er' }> = [
      { result: win1, payout: chancePayouts.first, position: '1er' },
      { result: win2, payout: chancePayouts.second, position: '2do' },
      { result: win3, payout: chancePayouts.third, position: '3er' },
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
    if (draw.digitsMode === 4) {
      const billeteSettings = settings.billete || { unitPrice: 1.00, payouts: { firstPrize: { exact4: 0, exact3PrefixOrSuffix: 0, exact2PrefixOrSuffix: 0 }, secondPrize: { exact4: 0, exact3PrefixOrSuffix: 0, exact2PrefixOrSuffix: 0 }, thirdPrize: { exact4: 0, exact3PrefixOrSuffix: 0, exact2PrefixOrSuffix: 0 } } };
      const payouts = [billeteSettings.payouts.firstPrize, billeteSettings.payouts.secondPrize, billeteSettings.payouts.thirdPrize];

      draw.results.forEach((result, idx) => {
        const payoutTable = payouts[idx];
        let bestPrizeForThisResult = 0;
        
        if (entry.number === result) {
          bestPrizeForThisResult = payoutTable.exact4;
        } else {
          const played3Prefix = entry.number.substring(0, 3);
          const played3Suffix = entry.number.substring(1, 4);
          const result3Prefix = result.substring(0, 3);
          const result3Suffix = result.substring(1, 4);
          
          if (played3Prefix === result3Prefix || played3Suffix === result3Suffix) {
            bestPrizeForThisResult = payoutTable.exact3PrefixOrSuffix;
          } else {
            const played2Prefix = entry.number.substring(0, 2);
            const played2Suffix = entry.number.substring(2, 4);
            const result2Prefix = result.substring(0, 2);
            const result2Suffix = result.substring(2, 4);
            
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
        }
      });
    }
  }

  return { prize, winningPosition };
}
