import React from 'react';
import { Check, Sparkles, Loader2 } from 'lucide-react';

interface ProcessingProgressBarProps {
  currentStep: string;
}

export const ProcessingProgressBar: React.FC<ProcessingProgressBarProps> = ({ currentStep }) => {
  const getProgressInfo = (step: string) => {
    const s = step.toLowerCase();
    if (s.includes('audio') || s.includes('aufbereitet')) {
      return { percent: 25, activeIndex: 0 };
    }
    if (s.includes('transkription') || s.includes('diarisierung') || s.includes('gemini') || s.includes('modell')) {
      return { percent: 55, activeIndex: 1 };
    }
    if (s.includes('sprecher') || s.includes('identität')) {
      return { percent: 75, activeIndex: 2 };
    }
    if (s.includes('aufgabe') || s.includes('deepseek') || s.includes('titel') || s.includes('extrahiere')) {
      return { percent: 92, activeIndex: 3 };
    }
    if (s.includes('fertig') || s.includes('kanban')) {
      return { percent: 100, activeIndex: 4 };
    }
    return { percent: 40, activeIndex: 1 };
  };

  const { percent, activeIndex } = getProgressInfo(currentStep);

  const steps = [
    { label: 'Audio', desc: 'Aufbereiten' },
    { label: 'Transkription', desc: 'Sprache zu Text' },
    { label: 'Sprecher', desc: 'Stimmen erkennen' },
    { label: 'Aufgaben & Titel', desc: 'KI-Analyse' }
  ];

  return (
    <div className="w-full max-w-xl mx-auto py-5 px-6 rounded-xl border bg-[var(--bg-surface)] border-[var(--border-color)] shadow-sm space-y-4">
      {/* Header with animated spinner and current step */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-[var(--text-primary)]">
              {currentStep || 'Meeting wird analysiert...'}
            </h3>
            <p className="text-[11px] text-[var(--text-muted)]">
              KI verarbeitet die Aufnahme automatisch
            </p>
          </div>
        </div>
        <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">
          {percent}%
        </span>
      </div>

      {/* Modern Progress Bar */}
      <div className="w-full bg-[var(--bg-subtle)] border border-[var(--border-color)] h-2.5 rounded-full overflow-hidden p-0.5">
        <div 
          className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 rounded-full transition-all duration-700 ease-out shadow-xs"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Step Indicators */}
      <div className="grid grid-cols-4 gap-1 sm:gap-2 pt-1">
        {steps.map((s, idx) => {
          const isDone = activeIndex > idx;
          const isCurrent = activeIndex === idx;

          return (
            <div 
              key={s.label}
              className={`flex flex-col items-center text-center p-2 rounded-lg transition-all ${
                isCurrent 
                  ? 'bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50' 
                  : isDone
                    ? 'opacity-85'
                    : 'opacity-40'
              }`}
            >
              <div className="mb-1">
                {isDone ? (
                  <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-[var(--border-color)] bg-[var(--bg-subtle)]" />
                )}
              </div>
              <span className="text-[11px] font-medium text-[var(--text-primary)] leading-tight">
                {s.label}
              </span>
              <span className="text-[10px] text-[var(--text-muted)] hidden sm:inline leading-tight mt-0.5">
                {s.desc}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
