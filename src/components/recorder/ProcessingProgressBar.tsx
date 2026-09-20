import React, { useEffect, useRef } from 'react';
import { Sparkles, Terminal, Activity } from 'lucide-react';

interface ProcessingProgressBarProps {
  currentStep: string;
  reasoningLogs?: string[];
  liveReasoningText?: string;
}

export const ProcessingProgressBar: React.FC<ProcessingProgressBarProps> = ({
  currentStep,
  reasoningLogs = [],
  liveReasoningText = ''
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const getProgressPercent = (step: string): number => {
    const s = step.toLowerCase();
    if (s.includes('audio') || s.includes('aufbereitet') || s.includes('vorbereitet')) {
      return 20;
    }
    if (s.includes('transkription') || s.includes('diarisierung') || s.includes('gemini') || s.includes('modell')) {
      // If live transcription text is already streaming in, show higher progress
      return liveReasoningText ? 65 : 45;
    }
    if (s.includes('sprecher') || s.includes('identität')) {
      return 75;
    }
    if (s.includes('aufgabe') || s.includes('deepseek') || s.includes('titel') || s.includes('extrahiere') || s.includes('analysiere')) {
      return 90;
    }
    if (s.includes('fertig') || s.includes('kanban')) {
      return 100;
    }
    return liveReasoningText ? 60 : 35;
  };

  const percent = getProgressPercent(currentStep);

  // Auto-scroll log box to bottom when new logs or streaming chunks arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [reasoningLogs, liveReasoningText]);

  return (
    <div className="w-full max-w-xl mx-auto py-5 px-5 sm:px-6 rounded-xl border bg-[var(--bg-surface)] border-[var(--border-color)] shadow-sm space-y-4 text-left">
      {/* Header with animated icon, status text & percentage */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] truncate">
              {currentStep || 'KI-Verarbeitung läuft...'}
            </h3>
            <p className="text-[11px] text-[var(--text-muted)] truncate">
              Transkription & KI-Analyse im Hintergrund
            </p>
          </div>
        </div>
        <span className="text-xs sm:text-sm font-mono font-bold text-blue-600 dark:text-blue-400 shrink-0">
          {percent}%
        </span>
      </div>

      {/* Simple, sleek Progress Bar */}
      <div className="w-full bg-[var(--bg-subtle)] border border-[var(--border-color)] h-2 rounded-full overflow-hidden p-0.5">
        <div
          className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 rounded-full transition-all duration-500 ease-out shadow-xs"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Scrolling Log & Live Transcription Box */}
      <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden shadow-inner">
        {/* Terminal Title Bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 font-mono">
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            <span>Live-Protokoll & Transkription</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>LIVE</span>
          </div>
        </div>

        {/* Scrollable Console Output */}
        <div
          ref={scrollRef}
          className="h-44 sm:h-52 overflow-y-auto p-3 font-mono text-[11px] sm:text-xs leading-relaxed space-y-1.5 text-slate-200 select-text"
        >
          {/* Background API Call Logs */}
          {reasoningLogs.map((log, index) => {
            const isApi = log.includes('[ai.') || log.includes('[deepseek') || log.includes('[gemini');
            const isAudio = log.includes('[audio');
            const isSuccess = log.includes('erfolgreich') || log.includes('abgeschlossen') || log.includes('✅');

            return (
              <div key={index} className="flex items-start gap-1.5 break-words">
                <span className="text-slate-600 select-none shrink-0">&gt;</span>
                <span
                  className={
                    isSuccess
                      ? 'text-emerald-400 font-medium'
                      : isApi
                      ? 'text-cyan-300'
                      : isAudio
                      ? 'text-amber-300'
                      : 'text-slate-300'
                  }
                >
                  {log}
                </span>
              </div>
            );
          })}

          {/* Live Streaming Transcription / Output */}
          {liveReasoningText ? (
            <div className="pt-2 mt-2 border-t border-slate-800/80">
              <div className="text-[10px] font-semibold tracking-wider uppercase text-blue-400 mb-1 flex items-center gap-1.5">
                <Activity className="w-3 h-3 animate-spin text-blue-400" />
                <span>Live-Transkription:</span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed text-slate-100 bg-slate-900/50 p-2 rounded border border-slate-800/60 font-mono">
                {liveReasoningText}
                <span className="inline-block w-1.5 h-3.5 ml-1 bg-blue-400 animate-pulse align-middle" />
              </p>
            </div>
          ) : null}

          {/* Initial State when no logs yet */}
          {reasoningLogs.length === 0 && !liveReasoningText && (
            <div className="text-slate-500 italic py-2 flex items-center gap-2">
              <span className="inline-block w-1.5 h-3.5 bg-blue-400 animate-pulse" />
              <span>Verbindung zum KI-Dienst wird aufgebaut...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
