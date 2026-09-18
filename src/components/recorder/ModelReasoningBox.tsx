import React, { useRef, useEffect } from 'react';
import { Terminal, BrainCircuit, Sparkles, Copy, Check } from 'lucide-react';

interface ModelReasoningBoxProps {
  modelName: string;
  currentStep: string;
  reasoningLogs: string[];
  liveReasoningText: string;
  isProcessing: boolean;
}

export const ModelReasoningBox: React.FC<ModelReasoningBoxProps> = ({
  modelName,
  currentStep,
  reasoningLogs,
  liveReasoningText,
  isProcessing
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Auto-scroll to bottom as new reasoning/logs arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [reasoningLogs, liveReasoningText, currentStep]);

  const handleCopy = () => {
    const fullText = [...reasoningLogs, liveReasoningText].filter(Boolean).join('\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isProcessing && reasoningLogs.length === 0 && !liveReasoningText) {
    return null;
  }

  return (
    <div className="w-full bg-slate-950/90 border border-slate-800/90 rounded-2xl p-4 shadow-xl text-left font-mono text-xs overflow-hidden mt-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800 text-slate-400">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-indigo-400 animate-pulse" />
          <span className="font-semibold text-slate-200">Modell-Reasoning & Live-Fortschritt</span>
          <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-[10px]">
            {modelName}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
          title="Reasoning-Protokoll kopieren"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-emerald-400">Kopiert</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden sm:inline">Kopieren</span>
            </>
          )}
        </button>
      </div>

      {/* Current Step Banner */}
      {isProcessing && (
        <div className="flex items-center gap-2 mb-2 text-blue-400 font-sans text-xs bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
          <span className="font-medium truncate">{currentStep}</span>
        </div>
      )}

      {/* Scrollable Textbox with Reasoning and Logs */}
      <div
        ref={containerRef}
        className="max-h-56 min-h-[120px] overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px] leading-relaxed text-slate-300 select-text scroll-smooth"
      >
        {reasoningLogs.map((log, index) => (
          <div key={index} className="text-slate-400 flex items-start gap-1.5">
            <span className="text-slate-600 select-none">&gt;</span>
            <span className="break-words">{log}</span>
          </div>
        ))}

        {/* Live streaming reasoning / thoughts */}
        {liveReasoningText && (
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-indigo-300 uppercase tracking-wider mb-1">
              <Sparkles className="w-3 h-3 text-indigo-400 animate-spin" />
              <span>Gedankengang / Reasoning:</span>
            </div>
            <pre className="whitespace-pre-wrap break-words text-slate-200 font-mono bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
              {liveReasoningText}
              {isProcessing && <span className="inline-block w-2 h-3.5 bg-blue-400 ml-1 animate-pulse" />}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
