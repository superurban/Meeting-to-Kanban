import React, { useState, useEffect } from 'react';
import { Volume2, Play, Square, UserCheck, X, HelpCircle, FastForward } from 'lucide-react';
import { SpeakerClarificationRequest } from '../../types';
import { AudioSnippetPlayer } from '../../services/audio/AudioSnippetPlayer';
import { formatTimestamp } from '../../utils/dateUtils';

interface SpeakerClarificationModalProps {
  request: SpeakerClarificationRequest | null;
  audioBlob?: Blob;
  onAssignName: (speakerId: string, assignedName: string) => void;
  onDismiss: () => void;
}

export const SpeakerClarificationModal: React.FC<SpeakerClarificationModalProps> = ({
  request,
  audioBlob,
  onAssignName,
  onDismiss
}) => {
  const [nameInput, setNameInput] = useState('');
  const [activePlayback, setActivePlayback] = useState<'5s' | 'full' | null>(null);

  useEffect(() => {
    if (request) {
      setNameInput(request.currentLabel.startsWith('Sprecher') ? '' : request.currentLabel);
      setActivePlayback(null);
    }
    return () => {
      AudioSnippetPlayer.stopCurrent();
    };
  }, [request]);

  if (!request) return null;

  const snippetStartTime = request.bestSegment.startTime;
  const naturalDuration = Math.max(0.5, request.bestSegment.endTime - request.bestSegment.startTime);
  const snippetEndTime = snippetStartTime + Math.min(5.0, naturalDuration);

  const handleToggle5sSnippet = () => {
    if (activePlayback === '5s') {
      AudioSnippetPlayer.stopCurrent();
      setActivePlayback(null);
    } else {
      setActivePlayback('5s');
      AudioSnippetPlayer.playSnippet(
        audioBlob,
        snippetStartTime,
        snippetEndTime,
        request.bestSegment.text,
        (playing) => {
          if (!playing) setActivePlayback(null);
        },
        5.0 // exactly 5 seconds
      );
    }
  };

  const handleToggleFullPlay = () => {
    if (activePlayback === 'full') {
      AudioSnippetPlayer.stopCurrent();
      setActivePlayback(null);
    } else {
      setActivePlayback('full');
      AudioSnippetPlayer.playSnippet(
        audioBlob,
        request.bestSegment.startTime,
        request.bestSegment.endTime,
        request.bestSegment.text,
        (playing) => {
          if (!playing) setActivePlayback(null);
        },
        undefined // normal playback without 5-second restriction
      );
    }
  };

  const handleConfirm = () => {
    const finalName = nameInput.trim();
    if (!finalName) return;
    AudioSnippetPlayer.stopCurrent();
    onAssignName(request.speakerId, finalName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Glow Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Sprecher-Zuordnung klären
              </h2>
              <p className="text-xs text-slate-400">
                5-Sekunden-Hörprobe zur Stimmenerkennung
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audio Snippet Player Section */}
        <div className="my-5 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-blue-400" />
              Stimmprobe: {request.currentLabel}
            </span>
            <span className="bg-blue-500/10 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded text-[11px] font-mono">
              {formatTimestamp(snippetStartTime)} - {formatTimestamp(snippetEndTime)} (5s)
            </span>
          </div>

          {/* Transcript Quote */}
          <blockquote className="text-sm italic text-slate-200 border-l-2 border-blue-500 pl-3 py-1.5 bg-slate-900/50 rounded-r-lg">
            "{request.bestSegment.text}"
          </blockquote>

          {/* Audio Controls */}
          <div className="space-y-2 pt-1">
            {/* 1. Primary 5-Second Snippet Button */}
            <button
              onClick={handleToggle5sSnippet}
              className={`w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-medium text-xs sm:text-sm transition-all cursor-pointer ${
                activePlayback === '5s'
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25'
              }`}
            >
              {activePlayback === '5s' ? (
                <>
                  <Square className="w-4 h-4 fill-white" />
                  <span>5-Sekunden-Schnipsel stoppen</span>
                  <span className="flex gap-1 items-center ml-2">
                    <span className="w-1 h-3 bg-white animate-bounce" />
                    <span className="w-1 h-4 bg-white animate-bounce delay-75" />
                    <span className="w-1 h-2 bg-white animate-bounce delay-150" />
                  </span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>5-Sekunden-Schnipsel abspielen</span>
                </>
              )}
            </button>

            {/* 2. Secondary Normal Full Playback Button */}
            <button
              onClick={handleToggleFullPlay}
              className={`w-full py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 font-medium text-xs transition-colors cursor-pointer border ${
                activePlayback === 'full'
                  ? 'bg-red-950/80 border-red-600/60 text-red-300'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {activePlayback === 'full' ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-red-300" />
                  <span>Normales Abspielen beenden</span>
                </>
              ) : (
                <>
                  <FastForward className="w-3.5 h-3.5 text-slate-400" />
                  <span>Nicht erkannt? Gesamten Beitrag normal abspielen</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Name Input & Suggested Chips */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Welche Person spricht hier?
            </label>
            <input
              type="text"
              placeholder="z.B. Sarah Schmidt, Alex, Florian..."
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              autoFocus
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Suggested Names (if available) */}
          {request.suggestedNames && request.suggestedNames.length > 0 && (
            <div>
              <span className="text-[11px] font-medium text-slate-400 block mb-1.5">
                Vorschläge aus dem Meeting-Kontext:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {request.suggestedNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setNameInput(name)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
          <button
            onClick={onDismiss}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Später klären
          </button>
          <button
            onClick={handleConfirm}
            disabled={!nameInput.trim()}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-md shadow-blue-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Name zuweisen</span>
          </button>
        </div>
      </div>
    </div>
  );
};
