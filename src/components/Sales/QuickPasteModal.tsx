import React, { useState } from 'react';
import { X, Zap, ArrowLeftRight, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore, Entry, GameType, ChancePrice } from '../../store/useStore';
import { generateId } from '../../utils/helpers';

interface QuickPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (entries: Entry[]) => void;
  gameMode: GameType;
  chancePrice?: ChancePrice;
  isInverted: boolean;
  setIsInverted: (val: boolean) => void;
}

export const QuickPasteModal: React.FC<QuickPasteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  gameMode,
  chancePrice,
  isInverted,
  setIsInverted
}) => {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { settings } = useStore();

  const handleProcess = () => {
    if (!text.trim()) return;

    const normalizedText = text.replace(/[\n,]/g, ' ');
    const tokens = normalizedText.split(/\s+/).filter(Boolean);
    
    const newEntries: Entry[] = [];
    const pricePerUnit = gameMode === 'BILLETE' 
      ? (settings.billete?.unitPrice || 1) 
      : (gameMode === 'PALÉ' ? 1 : (chancePrice?.value || settings.pricePerTime || 1));

    const requiredDigits = gameMode === 'CHANCE' ? 2 : 4;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let numStr = '';
      let qtyStr = '';

      const internalSeparator = /[\/\-\.]/.exec(token);
      
      if (internalSeparator) {
        const parts = token.split(/[\/\-\.]/).filter(Boolean);
        if (parts.length !== 2) {
          setError(`Formato inválido en "${token}". Use el formato número/cantidad.`);
          return;
        }
        numStr = isInverted ? parts[1] : parts[0];
        qtyStr = isInverted ? parts[0] : parts[1];
      } else {
        if (i + 1 >= tokens.length) {
          setError(`Falta la cantidad para el número: "${token}".`);
          return;
        }
        numStr = isInverted ? tokens[i+1] : tokens[i];
        qtyStr = isInverted ? tokens[i] : tokens[i+1];
        i++;
      }

      if (numStr.length !== requiredDigits) {
        setError(`El número "${numStr}" debe tener ${requiredDigits} cifras para el modo ${gameMode}.`);
        return;
      }

      const pieces = parseInt(qtyStr, 10);
      if (isNaN(pieces) || pieces <= 0) {
        setError(`La cantidad "${qtyStr}" es inválida para el número "${numStr}".`);
        return;
      }

      const amount = Number((pieces * pricePerUnit).toFixed(2));

      newEntries.push({
        id: generateId(),
        number: numStr,
        amount,
        pieces,
        type: gameMode,
        ...(gameMode === 'CHANCE' && chancePrice ? { priceId: chancePrice.id } : {}),
        status: 'pending'
      });
    }

    onConfirm(newEntries);
    setText('');
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 250 }}
        className="bg-[#0B1220] w-full max-w-lg rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
      >
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-brand-primary/20 rounded-xl flex items-center justify-center text-brand-primary">
              <Zap size={22} />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider">Pegado Rápido</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">Modo: {gameMode}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-95">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="flex items-center gap-2.5">
              <ArrowLeftRight size={16} className="text-brand-primary" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Orden: {isInverted ? 'Cantidad / Número' : 'Número / Cantidad'}
              </span>
            </div>
            <button 
              onClick={() => setIsInverted(!isInverted)}
              className="text-xs font-black text-brand-primary uppercase tracking-wider hover:underline"
            >
              Invertir
            </button>
          </div>

          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              placeholder={`Ej: 74-6 47-6 75-7 (o use espacios, comas, saltos de línea)`}
              className="w-full h-36 bg-black/20 border-2 border-white/5 rounded-xl p-4 text-base font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-primary/50 transition-all resize-none"
            />
          </div>

          {error && (
            <motion.div 
              initial={{opacity: 0, y: -10}}
              animate={{opacity: 1, y: 0}}
              className="flex items-center gap-3 text-rose-400 bg-rose-400/10 p-3 rounded-xl border border-rose-400/20">
              <AlertCircle size={18} />
              <p className="text-xs font-bold uppercase tracking-tight">{error}</p>
            </motion.div>
          )}

          <div className="text-xs text-slate-500 font-semibold leading-relaxed text-center px-4">
            Separe las jugadas con <span className="text-slate-300 font-bold">espacios, comas o saltos de línea</span>. 
            Puede usar <span className="text-slate-300 font-bold">- / .</span> para separar número y cantidad.
          </div>
        </div>

        <div className="p-4 bg-black/20 border-t border-white/5">
          <button
            onClick={handleProcess}
            disabled={!text.trim()}
            className="w-full bg-brand-primary text-black py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-brand-primary/20 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Procesar y Agregar
          </button>
        </div>
      </motion.div>
    </div>
  );
};
