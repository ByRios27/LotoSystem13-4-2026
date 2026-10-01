import React, { useState } from 'react';
import { StatsGridCell } from './StatsGridCell';
import { TicketsForNumberModal } from '../Sales/TicketsForNumberModal';

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
      <div className="grid grid-cols-10 gap-1.5 p-2 bg-black/20 rounded-2xl border border-white/5 shadow-inner">
        {numbers.map((num) => {
          const amount = salesByNumber[num] || 0;
          const isWinner = results?.includes(num);
          const position = results?.indexOf(num) === 0 ? '1er' : results?.indexOf(num) === 1 ? '2do' : results?.indexOf(num) === 2 ? '3er' : undefined;

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
