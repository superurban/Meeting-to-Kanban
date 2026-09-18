import React, { useRef, useEffect, useState } from 'react';
import { Terminal, Copy, Check, Play, Pause } from 'lucide-react';

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
  const [copied, setCopied] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [isTypewriting, setIsTypewriting] = useState(false);

  // Typewriter effect state: buffer queue
  const targetTextRef = useRef('');
  targetTextRef.current = liveReasoningText;

  // Typewriter loop
  useEffect(() => {
    let animationFrameId: number;

    const tick = () => {
      setDisplayedText((current) => {
        const target = targetTextRef.current;
        if (current.length < target.length) {
          setIsTypewriting(true);
          // Speed adapts dynamically: if backlog is large, type faster chunks
          const diff = target.length - current.length;
          const step = diff > 80 ? 8 : diff > 30 ? 4 : diff > 10 ? 2 : 1;
          return target.slice(0, current.length + step);
        } else {
          setIsTypewriting(false);
          return target;
        }
      });

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Auto-scroll to bottom as new text is typed
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedText, reasoningLogs, currentStep]);

  const handleCopy = () => {
    const fullText = [
      '=== OpenRouter Console.log & Model Stream ===',
      ...reasoningLogs,
      '',
      displayedText
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isProcessing && reasoningLogs.length === 0 && !displayedText) {
    return null;
  }

  return (
    <div className="w-full bg-[#090d16] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden mt-4 animate-in fade-in duration-200 text-left font-mono">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 select-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px] font-semibold text-slate-300">
            console.log — OpenRouter API Stream
          </span>
          <span className="text-[10px] text-slate-500 font-normal hidden sm:inline">
            ({modelName})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isProcessing && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              STREAMING
            </span>
          )}

          <button
            onClick={handleCopy}
            className="p-1 px-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer text-[10px]"
            title="Vollständiges Terminal-Protokoll kopieren"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Kopiert</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span className="hidden sm:inline">Log kopieren</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Terminal Output Body */}
      <div
        ref={containerRef}
        className="p-4 max-h-64 min-h-[140px] overflow-y-auto space-y-1 text-[11px] leading-relaxed select-text scroll-smooth"
      >
        {/* Real API HTTP / Event Logs */}
        {reasoningLogs.map((log, index) => {
          const isFetch = log.includes('[fetch]');
          const isResponse = log.includes('[response]');
          const isDone = log.includes('[done]');
          const isRetry = log.includes('[retry]');
          const isAudio = log.includes('[audio]');

          return (
            <div key={index} className="flex items-start gap-1.5">
              <span className="text-slate-600 select-none">&gt;</span>
              <span
                className={
                  isFetch
                    ? 'text-cyan-400'
                    : isResponse
                    ? 'text-emerald-400'
                    : isDone
                    ? 'text-blue-400 font-semibold'
                    : isRetry
                    ? 'text-amber-400'
                    : isAudio
                    ? 'text-purple-400'
                    : 'text-slate-400'
                }
              >
                {log}
              </span>
            </div>
          );
        })}

        {/* Real Streaming Model Data with Typewriter Effect */}
        {displayedText && (
          <div className="pt-2 mt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 mb-1 select-none">
              <span>console.stream &gt; model_output</span>
              {isTypewriting && <span className="text-[9px] text-slate-500 animate-pulse">(typewriter active)</span>}
            </div>
            <div className="whitespace-pre-wrap break-words text-slate-200 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 font-mono text-[11px] leading-relaxed selection:bg-emerald-500/30">
              {displayedText}
              {/* Blinking block terminal cursor */}
              <span className="inline-block w-2 h-3.5 bg-emerald-400 ml-0.5 align-middle animate-pulse" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
