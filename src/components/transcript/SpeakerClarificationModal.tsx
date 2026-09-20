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
        5.0
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
        undefined
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="container-large max-w-md w-full p-5 relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-color)',
          boxShadow: 'var(--shadow-modal)'
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between pb-3 mb-3.5 border-b"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2.5">
            <div 
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--status-at-risk-bg)',
                color: 'var(--status-at-risk-text)',
                border: '1px solid var(--status-at-risk-border)'
              }}
            >
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] leading-tight">
                Sprecher-Zuordnung klären
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                5-Sekunden-Hörprobe zur Stimmenerkennung
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            aria-label="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Audio Snippet Player Section */}
        <div 
          className="p-3.5 rounded-lg border mb-3.5 space-y-2.5"
          style={{
            backgroundColor: 'var(--bg-subtle)',
            borderColor: 'var(--border-color)'
          }}
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)] flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Stimmprobe: {request.currentLabel}</span>
            </span>
            <span className="badge-neutral text-[11px] font-mono">
              {formatTimestamp(snippetStartTime)} - {formatTimestamp(snippetEndTime)} (5s)
            </span>
          </div>

          {/* Transcript Quote */}
          <blockquote 
            className="text-xs italic p-2 rounded border-l-2 text-[var(--text-secondary)]"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--text-primary)'
            }}
          >
            "{request.bestSegment.text}"
          </blockquote>

          {/* Audio Controls */}
          <div className="space-y-1.5 pt-1">
            <button
              onClick={handleToggle5sSnippet}
              className="btn-primary w-full text-xs py-2"
            >
              {activePlayback === '5s' ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>5-Sekunden-Schnipsel stoppen</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>5-Sekunden-Schnipsel abspielen</span>
                </>
              )}
            </button>

            <button
              onClick={handleToggleFullPlay}
              className="btn-secondary w-full text-xs py-1.5"
            >
              {activePlayback === 'full' ? (
                <>
                  <Square className="w-3 h-3 fill-current text-red-500" />
                  <span>Normales Abspielen beenden</span>
                </>
              ) : (
                <>
                  <FastForward className="w-3 h-3 text-[var(--text-muted)]" />
                  <span>Ganzen Beitrag normal abspielen</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Name Input & Suggested Chips */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Welche Person spricht hier?
            </label>
            <input
              type="text"
              placeholder="z.B. Sarah Schmidt, Alex, Florian..."
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              autoFocus
              className="input-saas w-full"
            />
          </div>

          {/* Suggested Names */}
          {request.suggestedNames && request.suggestedNames.length > 0 && (
            <div>
              <span className="text-[11px] font-medium text-[var(--text-muted)] block mb-1">
                Vorschläge aus dem Gespräch:
              </span>
              <div className="flex flex-wrap gap-1">
                {request.suggestedNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setNameInput(name)}
                    className="btn-secondary text-[11px] py-0.5 px-2"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div 
          className="mt-4 flex items-center justify-end gap-2 pt-3 border-t"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <button
            onClick={onDismiss}
            className="btn-secondary text-xs"
          >
            Später klären
          </button>
          <button
            onClick={handleConfirm}
            disabled={!nameInput.trim()}
            className="btn-primary text-xs"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Name zuweisen</span>
          </button>
        </div>
      </div>
    </div>
  );
};
