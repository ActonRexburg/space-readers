/**
 * Adult Gate Modal
 * 
 * Provides a parent-friendly gate to access settings and progress views.
 * Uses a PIN or simple math problem to verify adult access.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from './Button';
import { OverlayPortal, OVERLAY_Z } from './OverlayPortal';

interface AdultGateProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  correctPin: string;
  mode?: 'pin' | 'math';
}

/** 3–9 inclusive — products 9–81, harder to guess than 5+5. */
function digitFactor(): number {
  return Math.floor(Math.random() * 7) + 3;
}

function generateMathProblem(): { question: string; answer: number } {
  if (Math.random() < 0.5) {
    const a = Math.floor(Math.random() * 10) + 5;
    const b = Math.floor(Math.random() * 10) + 5;
    return { question: `${a} + ${b} = ?`, answer: a + b };
  }
  const a = digitFactor();
  const b = digitFactor();
  return { question: `${a} × ${b} = ?`, answer: a * b };
}

export function AdultGate({
  isOpen,
  onSuccess,
  onCancel,
  correctPin,
  mode = 'math'  // Default to math for easier access
}: AdultGateProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [mathProblem, setMathProblem] = useState(generateMathProblem);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setInput('');
      setError('');
      if (mode === 'math') {
        setMathProblem(generateMathProblem());
      }
    }
  }, [isOpen, mode]);

  const handleSubmit = useCallback(() => {
    if (mode === 'pin') {
      if (input === correctPin) {
        onSuccess();
      } else {
        setError('Incorrect PIN. Try again.');
        setInput('');
      }
    } else {
      // Math mode
      const userAnswer = parseInt(input, 10);
      if (userAnswer === mathProblem.answer) {
        onSuccess();
      } else {
        setError('Not quite! Try again.');
        setInput('');
        setMathProblem(generateMathProblem());
      }
    }
  }, [input, mode, correctPin, mathProblem.answer, onSuccess]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input) {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  }, [input, handleSubmit, onCancel]);

  const handleButtonClick = (num: string) => {
    if (input.length < 4) {
      setInput(prev => prev + num);
      setError('');
    }
  };

  const handleClear = () => {
    setInput('');
    setError('');
  };

  return (
    <OverlayPortal open={isOpen}>
      <div
        className={`fixed inset-0 ${OVERLAY_Z.baseBackdrop} bg-black/80`}
        data-overlay-backdrop="parent-gate"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        className={`fixed inset-0 ${OVERLAY_Z.baseDialog} flex items-center justify-center p-4`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="parent-gate-title"
        data-testid="parent-gate"
        onClick={(e) => e.target === e.currentTarget && onCancel()}
      >
      <div className="space-card p-6 max-w-sm w-full">
        <h2 id="parent-gate-title" className="text-2xl font-bold text-center mb-2">
          🔒 Parent Zone
        </h2>
        
        <p className="text-center text-slate-300 mb-4">
          {mode === 'pin' 
            ? 'Enter the parent PIN to continue'
            : 'Solve this to continue:'}
        </p>

        {mode === 'math' && (
          <div
            className="text-3xl font-bold text-center text-star-gold mb-4"
            data-testid="parent-gate-question"
          >
            {mathProblem.question}
          </div>
        )}

        {/* Display input */}
        <div className="bg-space-dark rounded-lg p-4 mb-4 text-center">
          <span className="text-3xl font-mono tracking-widest">
            {mode === 'pin' 
              ? input.replace(/./g, '●') || '____'
              : input || '?'}
          </span>
        </div>

        {error && (
          <p className="text-red-400 text-center mb-4">{error}</p>
        )}

        {/* Number pad */}
        <div 
          className="grid grid-cols-3 gap-2 mb-4"
          data-testid="parent-gate-keypad"
          onKeyDown={handleKeyDown}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '✓'].map((key) => (
            <button
              key={key}
              type="button"
              data-testid={`parent-gate-key-${key}`}
              className={`
                h-14 rounded-lg font-bold text-xl
                ${key === 'C' 
                  ? 'bg-red-500/50 hover:bg-red-500/70' 
                  : key === '✓'
                    ? 'bg-green-500/50 hover:bg-green-500/70'
                    : 'bg-white/10 hover:bg-white/20'}
                active:scale-95 transition-all
              `}
              onClick={() => {
                if (key === 'C') handleClear();
                else if (key === '✓') handleSubmit();
                else handleButtonClick(key);
              }}
            >
              {key}
            </button>
          ))}
        </div>

        <Button variant="ghost" className="w-full" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      </div>
    </OverlayPortal>
  );
}
