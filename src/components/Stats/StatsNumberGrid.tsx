import React, { useState } from 'react';
import { StatsGridCell } from './StatsGridCell';
import { TicketsForNumberModal } from '../Sales/TicketsForNumberModal';
import { getWinningPosition } from '../../utils/drawUtils';

interface NumberGridProps {
  drawId: string;
  salesByNumber: { [number: string]: number };
  results?: string[];
}

export const StatsNumberGrid: React.FC<NumberGridProps> = ({
  drawId,
  salesByNumber,
  results,
}) => {
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);

  const values = Object.values(salesByNumber) as number[];
  const maxAmount = values.length > 0 ? Math.max(...values) : 0;

  const numbers = Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0'));

  const handleCellClick = (number: string) => {
    if (salesByNumber[number] > 0) {
      setSelectedNumber(number);
    }
  };

  const handleCloseModal = () => {
    setSelectedNumber(null);
  };

  return (
    <>
      <div className="mx-auto grid w-full max-w-[310px] grid-cols-10 gap-0.5 p-1 bg-black/20 rounded-lg border border-white/5 shadow-inner">
        {numbers.map((num) => {
          const amount = salesByNumber[num] || 0;
          const isWinner = results?.includes(num);
          const resultIndex = results?.indexOf(num) ?? -1;
          const position = resultIndex >= 0 ? getWinningPosition(resultIndex) : undefined;

          return (
            <StatsGridCell
              key={num}
              number={num}
              amount={amount}
              isWinner={isWinner}
              position={position}
              maxAmount={maxAmount}
              onClick={() => handleCellClick(num)}
            />
          );
        })}
      </div>

      {selectedNumber && (
        <TicketsForNumberModal
          drawId={drawId}
          number={selectedNumber}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};
